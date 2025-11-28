import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '@/App.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast, Toaster } from 'sonner';
import { Bus, MapPin, Route as RouteIcon, Trash2, Edit, Plus, Search, LogOut, Navigation } from 'lucide-react';
import MapView from "@/components/MapView";
import EtaView from "./components/EtaView";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom bus icons based on crowd level
const createBusIcon = (crowdLevel) => {
  const colors = {
    'Low': '#10b981',
    'Medium': '#f59e0b',
    'High': '#ef4444'
  };
  
  return L.divIcon({
    html: `<div style="background-color: ${colors[crowdLevel]}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 12h18"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg></div>`,
    className: 'custom-bus-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Navigation Component
function Navbar({ isAdmin, onLogout }) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
            <Bus className="w-6 h-6 text-emerald-600" />
            <span className="text-xl font-bold text-gray-900">RouteView</span>
          </Link>
          
          <div className="flex items-center space-x-1 sm:space-x-4">
            {!isAdmin ? (
              <>
                <Link to="/">
                  <Button variant="ghost" size="sm" data-testid="nav-home">
                    <span className="hidden sm:inline">Home</span>
                    <span className="sm:hidden">Home</span>
                  </Button>
                </Link>
                <Link to="/live-tracking">
                  <Button variant="ghost" size="sm" data-testid="nav-live-tracking">
                    <span className="hidden sm:inline">Live Tracking</span>
                    <span className="sm:hidden">Track</span>
                  </Button>
                </Link>
                <Link to="/routes">
                  <Button variant="ghost" size="sm" data-testid="nav-routes">
                    <span className="hidden sm:inline">Routes</span>
                    <span className="sm:hidden">Routes</span>
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button variant="outline" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" data-testid="nav-admin-login">
                    Admin
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/admin/dashboard">
                  <Button variant="ghost" size="sm" data-testid="nav-admin-dashboard">Dashboard</Button>
                </Link>
                <Link to="/admin/routes">
                  <Button variant="ghost" size="sm" data-testid="nav-admin-routes">Manage Routes</Button>
                </Link>
                <Link to="/admin/buses">
                  <Button variant="ghost" size="sm" data-testid="nav-admin-buses">Bus List</Button>
                </Link>
                <Link to="/admin/update-bus">
                  <Button variant="ghost" size="sm" data-testid="nav-admin-update-bus">Update Location</Button>
                </Link>
                <Button variant="outline" size="sm" onClick={onLogout} data-testid="nav-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// Home Page
function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <Bus className="w-20 h-20 mx-auto text-emerald-600 mb-6" />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6" data-testid="home-title">
              Urban Transport Made Simple
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-8" data-testid="home-subtitle">
              Track buses in real-time, find routes, and never miss your ride again.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/live-tracking">
              <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="home-track-buses-btn">
                <Navigation className="w-5 h-5 mr-2" />
                Track Buses
              </Button>
            </Link>
            <Link to="/routes">
              <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="home-search-routes-btn">
                <Search className="w-5 h-5 mr-2" />
                Search Routes
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card data-testid="feature-card-real-time">
              <CardHeader>
                <MapPin className="w-12 h-12 mx-auto text-emerald-600 mb-4" />
                <CardTitle>Real-Time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">See live bus locations and crowd levels on an interactive map</p>
              </CardContent>
            </Card>
            
            <Card data-testid="feature-card-route-info">
              <CardHeader>
                <RouteIcon className="w-12 h-12 mx-auto text-emerald-600 mb-4" />
                <CardTitle>Route Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Search and view detailed information about all available routes</p>
              </CardContent>
            </Card>
            
            <Card data-testid="feature-card-crowd-levels">
              <CardHeader>
                <Bus className="w-12 h-12 mx-auto text-emerald-600 mb-4" />
                <CardTitle>Crowd Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Know how crowded each bus is before you board</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Live Bus Tracking Page
function LiveTrackingPage() {
  const [buses, setBuses] = useState([]);
  
  useEffect(() => {
    fetchBuses();
    const interval = setInterval(fetchBuses, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);
  
  const fetchBuses = async () => {
    try {
      const response = await axios.get(`${API}/buses/live`);
      setBuses(response.data);
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="live-tracking-title">Live Bus Tracking</h1>
          <p className="text-gray-600">Real-time locations update every 5 seconds</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card data-testid="map-container">
              <CardContent className="p-0">
                <div style={{ height: '600px', width: '100%' }}>
                  <MapContainer center={[28.6139, 77.2090]} zoom={11} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {buses.map((bus) => (
                      <Marker
                        key={bus.id}
                        position={[bus.latitude, bus.longitude]}
                        icon={createBusIcon(bus.crowd_level)}
                      >
                        <Popup>
                          <div className="text-sm" data-testid={`bus-popup-${bus.bus_id}`}>
                            <p className="font-bold">{bus.bus_id}</p>
                            <p className="text-gray-600">{bus.route_name}</p>
                            <p className="mt-2">
                              <span className="font-semibold">Crowd:</span>{' '}
                              <span className={`font-bold ${
                                bus.crowd_level === 'Low' ? 'text-green-600' :
                                bus.crowd_level === 'Medium' ? 'text-orange-600' :
                                'text-red-600'
                              }`}>{bus.crowd_level}</span>
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card data-testid="bus-list-card">
              <CardHeader>
                <CardTitle>Active Buses ({buses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[540px] overflow-y-auto">
                  {buses.map((bus) => (
                    <div key={bus.id} className="p-3 bg-gray-50 rounded-lg" data-testid={`bus-item-${bus.bus_id}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{bus.bus_id}</p>
                          <p className="text-sm text-gray-600">{bus.route_name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          bus.crowd_level === 'Low' ? 'bg-green-100 text-green-700' :
                          bus.crowd_level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {bus.crowd_level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Route Search Page
function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  
  useEffect(() => {
    fetchRoutes();
  }, []);
  
  useEffect(() => {
    if (searchQuery) {
      const filtered = routes.filter(route => 
        route.route_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.route_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRoutes(filtered);
    } else {
      setFilteredRoutes(routes);
    }
  }, [searchQuery, routes]);
  
  const fetchRoutes = async () => {
    try {
      const response = await axios.get(`${API}/routes/search`);
      setRoutes(response.data);
      setFilteredRoutes(response.data);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="routes-title">Route Search</h1>
          <p className="text-gray-600">Find your bus route</p>
        </div>
        
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by route number or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="route-search-input"
                />
              </div>
              <Button data-testid="route-search-btn">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutes.map((route) => (
            <Card key={route.id} data-testid={`route-card-${route.route_number}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold">
                    {route.route_number}
                  </div>
                  <RouteIcon className="w-5 h-5 text-gray-400" />
                </div>
                <CardTitle className="mt-2">{route.route_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Starting Point</p>
                    <p className="font-medium text-gray-900">{route.starting_point}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ending Point</p>
                    <p className="font-medium text-gray-900">{route.ending_point}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Stops ({route.stops.length})</p>
                    <div className="space-y-1">
                      {route.stops.map((stop, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-700">
                          <div className="w-2 h-2 bg-emerald-600 rounded-full mr-2"></div>
                          {stop}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Login Page
function AdminLoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/admin/login`, { password });
      if (response.data.success) {
        toast.success('Login successful!');
        onLogin();
        navigate('/admin/dashboard');
      }
    } catch (error) {
      toast.error('Invalid password');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md" data-testid="admin-login-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">Enter admin password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                data-testid="admin-password-input"
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading} data-testid="admin-login-btn">
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const [stats, setStats] = useState({ routes: 0, buses: 0 });
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      const [routesRes, busesRes] = await Promise.all([
        axios.get(`${API}/admin/routes`),
        axios.get(`${API}/admin/buses`)
      ]);
      setStats({
        routes: routesRes.data.length,
        buses: busesRes.data.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8" data-testid="admin-dashboard-title">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-card-routes">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{stats.routes}</p>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-card-buses">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Active Buses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{stats.buses}</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/admin/routes">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="quick-action-manage-routes">
              <CardHeader>
                <RouteIcon className="w-12 h-12 text-emerald-600 mb-2" />
                <CardTitle>Manage Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Add, edit, or delete bus routes</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/admin/update-bus">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="quick-action-update-location">
              <CardHeader>
                <MapPin className="w-12 h-12 text-emerald-600 mb-2" />
                <CardTitle>Update Bus Location</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Manually update bus coordinates and status</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/admin/buses">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="quick-action-bus-list">
              <CardHeader>
                <Bus className="w-12 h-12 text-emerald-600 mb-2" />
                <CardTitle>View All Buses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">See complete bus list and details</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Admin Routes Management
function AdminRoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [formData, setFormData] = useState({
    route_number: '',
    route_name: '',
    starting_point: '',
    ending_point: '',
    stops: ''
  });
  
  useEffect(() => {
    fetchRoutes();
  }, []);
  
  const fetchRoutes = async () => {
    try {
      const response = await axios.get(`${API}/admin/routes`);
      setRoutes(response.data);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const stops = formData.stops.split(',').map(s => s.trim()).filter(s => s);
      const data = { ...formData, stops };
      
      if (editingRoute) {
        await axios.put(`${API}/admin/routes/${editingRoute.id}`, data);
        toast.success('Route updated successfully');
      } else {
        await axios.post(`${API}/admin/routes`, data);
        toast.success('Route created successfully');
      }
      
      setIsFormOpen(false);
      setEditingRoute(null);
      resetForm();
      fetchRoutes();
    } catch (error) {
      toast.error('Error saving route');
    }
  };
  
  const handleEdit = (route) => {
    setEditingRoute(route);
    setFormData({
      route_number: route.route_number,
      route_name: route.route_name,
      starting_point: route.starting_point,
      ending_point: route.ending_point,
      stops: route.stops.join(', ')
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      try {
        await axios.delete(`${API}/admin/routes/${id}`);
        toast.success('Route deleted successfully');
        fetchRoutes();
      } catch (error) {
        toast.error('Error deleting route');
      }
    }
  };
  
  const resetForm = () => {
    setFormData({
      route_number: '',
      route_name: '',
      starting_point: '',
      ending_point: '',
      stops: ''
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="manage-routes-title">Manage Routes</h1>
          <Button onClick={() => { resetForm(); setEditingRoute(null); setIsFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-route-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Route
          </Button>
        </div>
        
        {isFormOpen && (
          <Card className="mb-8" data-testid="route-form-card">
            <CardHeader>
              <CardTitle>{editingRoute ? 'Edit Route' : 'Add New Route'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="route_number">Route Number</Label>
                    <Input
                      id="route_number"
                      value={formData.route_number}
                      onChange={(e) => setFormData({...formData, route_number: e.target.value})}
                      required
                      data-testid="route-number-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="route_name">Route Name</Label>
                    <Input
                      id="route_name"
                      value={formData.route_name}
                      onChange={(e) => setFormData({...formData, route_name: e.target.value})}
                      required
                      data-testid="route-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="starting_point">Starting Point</Label>
                    <Input
                      id="starting_point"
                      value={formData.starting_point}
                      onChange={(e) => setFormData({...formData, starting_point: e.target.value})}
                      required
                      data-testid="starting-point-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ending_point">Ending Point</Label>
                    <Input
                      id="ending_point"
                      value={formData.ending_point}
                      onChange={(e) => setFormData({...formData, ending_point: e.target.value})}
                      required
                      data-testid="ending-point-input"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="stops">Stops (comma-separated)</Label>
                  <Input
                    id="stops"
                    value={formData.stops}
                    onChange={(e) => setFormData({...formData, stops: e.target.value})}
                    placeholder="Stop 1, Stop 2, Stop 3..."
                    required
                    data-testid="stops-input"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-route-btn">
                    {editingRoute ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); setEditingRoute(null); resetForm(); }} data-testid="cancel-route-btn">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route Number</TableHead>
                  <TableHead>Route Name</TableHead>
                  <TableHead>Start - End</TableHead>
                  <TableHead>Stops</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id} data-testid={`route-row-${route.route_number}`}>
                    <TableCell className="font-medium">{route.route_number}</TableCell>
                    <TableCell>{route.route_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {route.starting_point} → {route.ending_point}
                    </TableCell>
                    <TableCell>{route.stops.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(route)} data-testid={`edit-route-${route.route_number}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(route.id)} data-testid={`delete-route-${route.route_number}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Admin Update Bus Location
function AdminUpdateBusPage() {
  const [routes, setRoutes] = useState([]);
  const [formData, setFormData] = useState({
    bus_id: '',
    route_id: '',
    route_name: '',
    latitude: '',
    longitude: '',
    crowd_level: 'Low'
  });
  
  useEffect(() => {
    fetchRoutes();
  }, []);
  
  const fetchRoutes = async () => {
    try {
      const response = await axios.get(`${API}/admin/routes`);
      setRoutes(response.data);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };
  
  const handleRouteChange = (routeId) => {
    const selectedRoute = routes.find(r => r.id === routeId);
    if (selectedRoute) {
      setFormData({
        ...formData,
        route_id: selectedRoute.id,
        route_name: selectedRoute.route_name
      });
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      };
      
      await axios.post(`${API}/admin/buses/update`, data);
      toast.success('Bus location updated successfully');
      
      // Reset form
      setFormData({
        bus_id: '',
        route_id: '',
        route_name: '',
        latitude: '',
        longitude: '',
        crowd_level: 'Low'
      });
    } catch (error) {
      toast.error('Error updating bus location');
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8" data-testid="update-bus-title">Update Bus Location</h1>
        
        <Card className="max-w-2xl mx-auto" data-testid="update-bus-form-card">
          <CardHeader>
            <CardTitle>Manual Bus Location Entry</CardTitle>
            <CardDescription>Enter current bus coordinates and status</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bus_id">Bus ID / Name</Label>
                <Input
                  id="bus_id"
                  value={formData.bus_id}
                  onChange={(e) => setFormData({...formData, bus_id: e.target.value})}
                  placeholder="e.g., BUS-101-A"
                  required
                  data-testid="bus-id-input"
                />
              </div>
              
              <div>
                <Label htmlFor="route">Select Route</Label>
                <Select onValueChange={handleRouteChange} required>
                  <SelectTrigger data-testid="route-select">
                    <SelectValue placeholder="Choose a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.map((route) => (
                      <SelectItem key={route.id} value={route.id} data-testid={`route-option-${route.route_number}`}>
                        {route.route_number} - {route.route_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                    placeholder="28.6139"
                    required
                    data-testid="latitude-input"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                    placeholder="77.2090"
                    required
                    data-testid="longitude-input"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="crowd_level">Crowd Level</Label>
                <Select value={formData.crowd_level} onValueChange={(value) => setFormData({...formData, crowd_level: value})}>
                  <SelectTrigger data-testid="crowd-level-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low" data-testid="crowd-level-low">Low</SelectItem>
                    <SelectItem value="Medium" data-testid="crowd-level-medium">Medium</SelectItem>
                    <SelectItem value="High" data-testid="crowd-level-high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-bus-update-btn">
                Update Location
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Admin Bus List Page
function AdminBusListPage() {
  const [buses, setBuses] = useState([]);
  
  useEffect(() => {
    fetchBuses();
    const interval = setInterval(fetchBuses, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchBuses = async () => {
    try {
      const response = await axios.get(`${API}/admin/buses`);
      setBuses(response.data);
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };
  
  const handleDelete = async (busId) => {
    if (window.confirm('Are you sure you want to delete this bus?')) {
      try {
        await axios.delete(`${API}/admin/buses/${busId}`);
        toast.success('Bus deleted successfully');
        fetchBuses();
      } catch (error) {
        toast.error('Error deleting bus');
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="bus-list-title">Bus List</h1>
          <p className="text-gray-600">Total: {buses.length} buses</p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus ID</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Crowd Level</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.map((bus) => (
                  <TableRow key={bus.id} data-testid={`bus-list-row-${bus.bus_id}`}>
                    <TableCell className="font-medium">{bus.bus_id}</TableCell>
                    <TableCell>{bus.route_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        bus.crowd_level === 'Low' ? 'bg-green-100 text-green-700' :
                        bus.crowd_level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {bus.crowd_level}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(bus.last_updated).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(bus.bus_id)} data-testid={`delete-bus-${bus.bus_id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  
  const handleLogin = () => {
    setIsAdmin(true);
  };
  
  const handleLogout = () => {
    setIsAdmin(false);
  };
  
  return (
    <div className="App">
      <BrowserRouter>
        <Navbar isAdmin={isAdmin} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/live-tracking" element={<LiveTrackingPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/admin/login" element={<AdminLoginPage onLogin={handleLogin} />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/routes" element={<AdminRoutesPage />} />
          <Route path="/admin/update-bus" element={<AdminUpdateBusPage />} />
          <Route path="/admin/buses" element={<AdminBusListPage />} />
          <Route path="/route-map"  element={<MapView routeIdToShow="e93ea2bb-c548-4ec6-a388-2fa84f710341"/>} />
 <Route path="/eta/:busId" element={<EtaView />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
