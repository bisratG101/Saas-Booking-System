import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/common/ProtectedRoute";

// Public Pages
import { HomePage } from "./pages/public/HomePage";
import { LoginPage } from "./pages/public/LoginPage";
import { RegisterPage } from "./pages/public/RegisterPage";
import { BusinessesPage } from "./pages/public/BusinessesPage";
import { BusinessDetailsPage } from "./pages/public/BusinessDetailsPage";

// Customer Pages
import { MyBookingsPage } from "./pages/customer/MyBookingsPage";

// Business Owner Pages
import { OwnerDashboardPage } from "./pages/owner/OwnerDashboardPage";
import { OwnerServicesPage } from "./pages/owner/OwnerServicesPage";
import { OwnerHoursPage } from "./pages/owner/OwnerHoursPage";
import { OwnerBookingsPage } from "./pages/owner/OwnerBookingsPage";
import { OwnerSubscriptionPage } from "./pages/owner/OwnerSubscriptionPage";

// Platform Admin Pages
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminBusinessesPage } from "./pages/admin/AdminBusinessesPage";
import { AdminLogsPage } from "./pages/admin/AdminLogsPage";

// Not Found
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route
              path="/businesses/:businessId"
              element={<BusinessDetailsPage />}
            />

            {/* Customer Routes (Protected) */}
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute
                  allowedRoles={["customer", "business_owner", "platform_admin"]}
                >
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />

            {/* Business Owner Routes (Protected - business_owner only) */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute allowedRoles={["business_owner"]}>
                  <OwnerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/services"
              element={
                <ProtectedRoute allowedRoles={["business_owner"]}>
                  <OwnerServicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/hours"
              element={
                <ProtectedRoute allowedRoles={["business_owner"]}>
                  <OwnerHoursPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/bookings"
              element={
                <ProtectedRoute allowedRoles={["business_owner"]}>
                  <OwnerBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/subscription"
              element={
                <ProtectedRoute allowedRoles={["business_owner"]}>
                  <OwnerSubscriptionPage />
                </ProtectedRoute>
              }
            />

            {/* Platform Admin Routes (Protected - platform_admin only) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["platform_admin"]}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/businesses"
              element={
                <ProtectedRoute allowedRoles={["platform_admin"]}>
                  <AdminBusinessesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/activity-logs"
              element={
                <ProtectedRoute allowedRoles={["platform_admin"]}>
                  <AdminLogsPage />
                </ProtectedRoute>
              }
            />

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
