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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    route_number: str
    route_name: str
    starting_point: str
    ending_point: str
    stops: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteCreate(BaseModel):
    route_number: str
    route_name: str
    starting_point: str
    ending_point: str
    stops: List[str]

class RouteUpdate(BaseModel):
    route_number: Optional[str] = None
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    ending_point: Optional[str] = None
    stops: Optional[List[str]] = None

class Bus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bus_id: str
    route_id: str
    route_name: str
    latitude: float
    longitude: float
    crowd_level: str  # Low, Medium, High
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

# Initialize admin password if not exists
async def init_admin():
    admin = await db.admin.find_one({"username": "admin"})
    if not admin:
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        await db.admin.insert_one({
            "username": "admin",
            "password": hashed_password.decode('utf-8')
        })

# Initialize sample data
async def init_sample_data():
    routes_count = await db.routes.count_documents({})
    if routes_count == 0:
        # Sample routes
        sample_routes = [
            {
                "id": str(uuid.uuid4()),
                "route_number": "101",
                "route_name": "City Center Express",
                "starting_point": "Central Station",
                "ending_point": "Airport",
                "stops": ["Central Station", "Park Square", "Mall Junction", "Tech Park", "Airport"],
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "route_number": "202",
                "route_name": "Suburban Link",
                "starting_point": "Railway Station",
                "ending_point": "Industrial Area",
                "stops": ["Railway Station", "Market Street", "Hospital", "University", "Industrial Area"],
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "route_number": "303",
                "route_name": "Coastal Route",
                "starting_point": "Beach Road",
                "ending_point": "Harbor",
                "stops": ["Beach Road", "Marina", "Lighthouse", "Port Area", "Harbor"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        await db.routes.insert_many(sample_routes)
        
        # Sample buses
        route_ids = [route["id"] for route in sample_routes]
        sample_buses = [
            {
                "id": str(uuid.uuid4()),
                "bus_id": "BUS-101-A",
                "route_id": route_ids[0],
                "route_name": "City Center Express",
                "latitude": 28.6139,
                "longitude": 77.2090,
                "crowd_level": "Low",
                "last_updated": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "bus_id": "BUS-202-B",
                "route_id": route_ids[1],
                "route_name": "Suburban Link",
                "latitude": 28.7041,
                "longitude": 77.1025,
                "crowd_level": "Medium",
                "last_updated": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "bus_id": "BUS-303-C",
                "route_id": route_ids[2],
                "route_name": "Coastal Route",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "crowd_level": "High",
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        await db.buses.insert_many(sample_buses)

@app.on_event("startup")
async def startup_event():
    await init_admin()
    await init_sample_data()

# Public Routes
@api_router.get("/")
async def root():
    return {"message": "Urban Transport System API"}

@api_router.get("/routes/search")
async def search_routes(q: Optional[str] = None):
    if q:
        routes = await db.routes.find({
            "$or": [
                {"route_number": {"$regex": q, "$options": "i"}},
                {"route_name": {"$regex": q, "$options": "i"}}
            ]
        }, {"_id": 0}).to_list(100)
    else:
        routes = await db.routes.find({}, {"_id": 0}).to_list(100)
    
    for route in routes:
        if isinstance(route.get('created_at'), str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
    
    return routes

@api_router.get("/buses/live")
async def get_live_buses():
    buses = await db.buses.find({}, {"_id": 0}).to_list(100)
    
    for bus in buses:
        if isinstance(bus.get('last_updated'), str):
            bus['last_updated'] = datetime.fromisoformat(bus['last_updated'])
    
    return buses

# Admin Routes
@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(credentials: AdminLogin):
    admin = await db.admin.find_one({"username": "admin"})
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    stored_password = admin["password"].encode('utf-8')
    if bcrypt.checkpw(credentials.password.encode('utf-8'), stored_password):
        return AdminLoginResponse(
            success=True,
            message="Login successful",
            token="admin_authenticated"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@api_router.get("/admin/routes", response_model=List[Route])
async def get_all_routes():
    routes = await db.routes.find({}, {"_id": 0}).to_list(1000)
    
    for route in routes:
        if isinstance(route.get('created_at'), str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
    
    return routes

@api_router.post("/admin/routes", response_model=Route)
async def create_route(route_input: RouteCreate):
    route_dict = route_input.model_dump()
    route_obj = Route(**route_dict)
    
    doc = route_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.routes.insert_one(doc)
    return route_obj

@api_router.put("/admin/routes/{route_id}", response_model=Route)
async def update_route(route_id: str, route_update: RouteUpdate):
    existing_route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    
    if not existing_route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    update_data = route_update.model_dump(exclude_unset=True)
    
    if update_data:
        await db.routes.update_one(
            {"id": route_id},
            {"$set": update_data}
        )
    
    updated_route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    
    if isinstance(updated_route.get('created_at'), str):
        updated_route['created_at'] = datetime.fromisoformat(updated_route['created_at'])
    
    return Route(**updated_route)

@api_router.delete("/admin/routes/{route_id}")
async def delete_route(route_id: str):
    result = await db.routes.delete_one({"id": route_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Also delete buses associated with this route
    await db.buses.delete_many({"route_id": route_id})
    
    return {"message": "Route deleted successfully"}

@api_router.get("/admin/buses", response_model=List[Bus])
async def get_all_buses():
    buses = await db.buses.find({}, {"_id": 0}).to_list(1000)
    
    for bus in buses:
        if isinstance(bus.get('last_updated'), str):
            bus['last_updated'] = datetime.fromisoformat(bus['last_updated'])
    
    return buses

@api_router.post("/admin/buses/update", response_model=Bus)
async def update_bus_location(bus_update: BusUpdate):
    # Check if bus exists, if not create new one
    existing_bus = await db.buses.find_one({"bus_id": bus_update.bus_id})
    
    bus_dict = bus_update.model_dump()
    bus_obj = Bus(**bus_dict)
    
    doc = bus_obj.model_dump()
    doc['last_updated'] = doc['last_updated'].isoformat()
    
    if existing_bus:
        # Update existing bus
        await db.buses.update_one(
            {"bus_id": bus_update.bus_id},
            {"$set": doc}
        )
    else:
        # Create new bus
        await db.buses.insert_one(doc)
    
    return bus_obj

@api_router.delete("/admin/buses/{bus_id}")
async def delete_bus(bus_id: str):
    result = await db.buses.delete_one({"bus_id": bus_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bus not found"
        )
    
    return {"message": "Bus deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
