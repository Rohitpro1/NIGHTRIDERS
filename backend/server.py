from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import math

# ============================================================
# Haversine Distance Formula
# ============================================================
def haversine(lat1, lon1, lat2, lon2):
    R = 6371 * 1000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

# ============================================================
# ENV + DB SETUP
# ============================================================
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============================================================
# MODELS
# ============================================================
class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    route_number: str
    route_name: str
    starting_point: str
    ending_point: str
    stops: List[str]
    coordinates: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteCreate(BaseModel):
    route_number: str
    route_name: str
    starting_point: str
    ending_point: str
    stops: List[str]
    coordinates: List[dict] = Field(default_factory=list)

class RouteUpdate(BaseModel):
    route_number: Optional[str] = None
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    ending_point: Optional[str] = None
    stops: Optional[List[str]] = None
    coordinates: Optional[List[dict]] = None

class Bus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid.uuid4()))
    bus_id: str
    route_id: str
    route_name: str
    latitude: float
    longitude: float
    crowd_level: str
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusUpdate(BaseModel):
    bus_id: str
    route_id: str
    route_name: str
    latitude: float
    longitude: float
    crowd_level: str

class AdminLogin(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None

# ============================================================
# INITIAL ADMIN SETUP
# ============================================================
async def init_admin():
    admin = await db.admin.find_one({"username": "admin"})
    if not admin:
        hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
        await db.admin.insert_one({"username": "admin", "password": hashed})

# ============================================================
# ETA API
# ============================================================
@api_router.get("/eta/{bus_id}")
async def get_eta(bus_id: str):

    bus = await db.buses.find_one({"bus_id": bus_id})

    if not bus:
        raise HTTPException(404, "Bus not found")

    curr_lat = float(bus["latitude"])
    curr_lng = float(bus["longitude"])
    now_ts = datetime.utcnow().timestamp()

    # Get route
    route = await db.routes.find_one({"id": bus["route_id"]})
    if not route:
        raise HTTPException(404, "Route not found")

    stops = route["stops"]
    coords = route.get("coordinates", [])

    if len(stops) != len(coords):
        raise HTTPException(400, "Stops and coordinates mismatch")

    # -------- SPEED CALCULATION --------
    prev = bus.get("prev_location")
    speed_mps = 0

    if prev:
        dist = haversine(curr_lat, curr_lng, prev["lat"], prev["lng"])
        dt = now_ts - prev["timestamp"]
        if dt > 0:
            speed_mps = dist / dt

    # Default speed if bus is stationary
    if speed_mps < 0.5:
        speed_mps = 3  # default: 3 m/s → 10.8 km/h

    # Save new previous location
    await db.buses.update_one(
        {"bus_id": bus_id},
        {"$set": {"prev_location": {"lat": curr_lat, "lng": curr_lng, "timestamp": now_ts}}}
    )

    # -------- ETA CALCULATION --------
    eta_list = []
    for stop_name, c in zip(stops, coords):
        d = haversine(curr_lat, curr_lng, c["lat"], c["lng"])
        eta_sec = d / speed_mps
        eta_list.append({
            "stop": stop_name,
            "distance_meters": d,
            "eta_seconds": eta_sec
        })

    return {
        "current_speed_mps": speed_mps,
        "current_speed_kmph": speed_mps * 3.6,
        "eta": eta_list
    }

# ============================================================
# ROUTES API
# ============================================================
@api_router.get("/routes/search")
async def search_routes(q: Optional[str] = None):
    if q:
        return await db.routes.find({
            "$or": [
                {"route_number": {"$regex": q, "$options": "i"}},
                {"route_name": {"$regex": q, "$options": "i"}},
            ]
        }, {"_id": 0}).to_list(200)
    return await db.routes.find({}, {"_id": 0}).to_list(200)

# ============================================================
# BUS LOCATION UPDATE
# ============================================================
@api_router.post("/buses/update-location")
async def update_bus_location(data: dict):
    bus_id = data.get("bus_id")
    lat = data.get("latitude")
    lng = data.get("longitude")

    if not all([bus_id, lat, lng]):
        raise HTTPException(400, "Missing fields")

    await db.buses.update_one(
        {"bus_id": bus_id},
        {"$set": {
            "latitude": lat,
            "longitude": lng,
            "last_updated": datetime.utcnow().isoformat()
        }},
        upsert=True
    )

    return {"status": "updated"}

@api_router.get("/buses/live")
async def get_live_buses():
    return await db.buses.find({}, {"_id": 0}).to_list(200)

# ============================================================
# ADMIN LOGIN
# ============================================================
@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(credentials: AdminLogin):
    admin = await db.admin.find_one({"username": "admin"})
    if not admin:
        raise HTTPException(401, "Invalid credentials")

    if bcrypt.checkpw(credentials.password.encode(), admin["password"].encode()):
        return AdminLoginResponse(success=True, message="Login successful", token="admin_authenticated")

    raise HTTPException(401, "Invalid credentials")

# ============================================================
# CRUD: ROUTES & BUSES
# ============================================================
@api_router.get("/admin/routes", response_model=List[Route])
async def get_all_routes():
    return await db.routes.find({}, {"_id": 0}).to_list(500)

@api_router.post("/admin/routes", response_model=Route)
async def create_route(route_input: RouteCreate):
    route = Route(**route_input.model_dump())
    doc = route.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.routes.insert_one(doc)
    return route

@api_router.put("/admin/routes/{route_id}", response_model=Route)
async def update_route(route_id: str, data: RouteUpdate):
    await db.routes.update_one({"id": route_id}, {"$set": data.model_dump(exclude_unset=True)})
    updated = await db.routes.find_one({"id": route_id}, {"_id": 0})
    return Route(**updated)

@api_router.delete("/admin/routes/{route_id}")
async def delete_route(route_id: str):
    await db.routes.delete_one({"id": route_id})
    await db.buses.delete_many({"route_id": route_id})
    return {"message": "Route deleted"}

@api_router.get("/admin/buses", response_model=List[Bus])
async def get_all_buses():
    return await db.buses.find({}, {"_id": 0}).to_list(500)

@api_router.post("/admin/buses/update", response_model=Bus)
async def update_bus(bus_update: BusUpdate):
    doc = Bus(**bus_update.model_dump()).model_dump()
    doc["last_updated"] = datetime.utcnow().isoformat()
    await db.buses.update_one({"bus_id": bus_update.bus_id}, {"$set": doc}, upsert=True)
    return Bus(**doc)

@api_router.delete("/admin/buses/{bus_id}")
async def delete_bus(bus_id: str):
    await db.buses.delete_one({"bus_id": bus_id})
    return {"message": "Bus deleted"}

# ============================================================
# MIDDLEWARE
# ============================================================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# SHUTDOWN
# ============================================================
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
