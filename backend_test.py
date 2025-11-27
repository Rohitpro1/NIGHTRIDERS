import requests
import sys
import json
from datetime import datetime

class UrbanTransportAPITester:
    def __init__(self, base_url="https://routeview-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_admin_login_valid(self):
        """Test admin login with correct password"""
        success, response = self.run_test(
            "Admin Login (Valid)",
            "POST",
            "admin/login",
            200,
            data={"password": "admin123"}
        )
        
        if success and response.get('success') and response.get('token'):
            self.admin_token = response['token']
            return True
        return False

    def test_admin_login_invalid(self):
        """Test admin login with wrong password"""
        success, _ = self.run_test(
            "Admin Login (Invalid)",
            "POST",
            "admin/login",
            401,
            data={"password": "wrongpassword"}
        )
        return success

    def test_get_routes_search(self):
        """Test public route search"""
        success, response = self.run_test(
            "Get Routes (Public)",
            "GET",
            "routes/search",
            200
        )
        
        if success and isinstance(response, list) and len(response) >= 3:
            # Check if sample routes exist
            route_numbers = [r.get('route_number') for r in response]
            expected_routes = ['101', '202', '303']
            has_sample_data = all(route in route_numbers for route in expected_routes)
            
            self.log_test(
                "Sample Routes Data",
                has_sample_data,
                f"Found routes: {route_numbers}, Expected: {expected_routes}"
            )
            return has_sample_data
        
        return success

    def test_get_live_buses(self):
        """Test live buses endpoint"""
        success, response = self.run_test(
            "Get Live Buses",
            "GET",
            "buses/live",
            200
        )
        
        if success and isinstance(response, list) and len(response) >= 3:
            # Check if sample buses exist
            bus_ids = [b.get('bus_id') for b in response]
            crowd_levels = [b.get('crowd_level') for b in response]
            
            has_sample_buses = len(bus_ids) >= 3
            has_crowd_levels = all(level in ['Low', 'Medium', 'High'] for level in crowd_levels if level)
            
            self.log_test(
                "Sample Buses Data",
                has_sample_buses,
                f"Found {len(bus_ids)} buses with crowd levels: {set(crowd_levels)}"
            )
            
            self.log_test(
                "Crowd Level Validation",
                has_crowd_levels,
                f"Crowd levels: {crowd_levels}"
            )
            
            return has_sample_buses and has_crowd_levels
        
        return success

    def test_admin_get_routes(self):
        """Test admin routes endpoint"""
        if not self.admin_token:
            self.log_test("Admin Get Routes", False, "No admin token available")
            return False
            
        return self.run_test(
            "Admin Get Routes",
            "GET",
            "admin/routes",
            200
        )[0]

    def test_admin_create_route(self):
        """Test creating a new route"""
        if not self.admin_token:
            self.log_test("Admin Create Route", False, "No admin token available")
            return False
            
        test_route = {
            "route_number": "TEST-001",
            "route_name": "Test Route",
            "starting_point": "Test Start",
            "ending_point": "Test End",
            "stops": ["Test Start", "Test Middle", "Test End"]
        }
        
        success, response = self.run_test(
            "Admin Create Route",
            "POST",
            "admin/routes",
            200,
            data=test_route
        )
        
        if success and response.get('id'):
            self.test_route_id = response['id']
            return True
        return False

    def test_admin_update_route(self):
        """Test updating a route"""
        if not self.admin_token or not hasattr(self, 'test_route_id'):
            self.log_test("Admin Update Route", False, "No admin token or test route available")
            return False
            
        update_data = {
            "route_name": "Updated Test Route"
        }
        
        return self.run_test(
            "Admin Update Route",
            "PUT",
            f"admin/routes/{self.test_route_id}",
            200,
            data=update_data
        )[0]

    def test_admin_delete_route(self):
        """Test deleting a route"""
        if not self.admin_token or not hasattr(self, 'test_route_id'):
            self.log_test("Admin Delete Route", False, "No admin token or test route available")
            return False
            
        return self.run_test(
            "Admin Delete Route",
            "DELETE",
            f"admin/routes/{self.test_route_id}",
            200
        )[0]

    def test_admin_get_buses(self):
        """Test admin buses endpoint"""
        if not self.admin_token:
            self.log_test("Admin Get Buses", False, "No admin token available")
            return False
            
        return self.run_test(
            "Admin Get Buses",
            "GET",
            "admin/buses",
            200
        )[0]

    def test_admin_update_bus_location(self):
        """Test updating bus location"""
        if not self.admin_token:
            self.log_test("Admin Update Bus Location", False, "No admin token available")
            return False
            
        # First get a route to use
        success, routes = self.run_test(
            "Get Routes for Bus Update",
            "GET",
            "admin/routes",
            200
        )
        
        if not success or not routes:
            self.log_test("Admin Update Bus Location", False, "No routes available for bus update")
            return False
            
        route = routes[0]
        bus_update = {
            "bus_id": "TEST-BUS-001",
            "route_id": route['id'],
            "route_name": route['route_name'],
            "latitude": 28.6139,
            "longitude": 77.2090,
            "crowd_level": "Medium"
        }
        
        success, response = self.run_test(
            "Admin Update Bus Location",
            "POST",
            "admin/buses/update",
            200,
            data=bus_update
        )
        
        if success and response.get('id'):
            self.test_bus_id = response.get('bus_id')
            return True
        return False

    def test_admin_delete_bus(self):
        """Test deleting a bus"""
        if not self.admin_token or not hasattr(self, 'test_bus_id'):
            self.log_test("Admin Delete Bus", False, "No admin token or test bus available")
            return False
            
        return self.run_test(
            "Admin Delete Bus",
            "DELETE",
            f"admin/buses/{self.test_bus_id}",
            200
        )[0]

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Urban Transport API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic API tests
        self.test_root_endpoint()
        
        # Public endpoints
        self.test_get_routes_search()
        self.test_get_live_buses()
        
        # Admin authentication
        self.test_admin_login_valid()
        self.test_admin_login_invalid()
        
        # Admin endpoints (only if login successful)
        if self.admin_token:
            self.test_admin_get_routes()
            self.test_admin_get_buses()
            
            # CRUD operations
            if self.test_admin_create_route():
                self.test_admin_update_route()
                self.test_admin_delete_route()
            
            if self.test_admin_update_bus_location():
                self.test_admin_delete_bus()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = UrbanTransportAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())