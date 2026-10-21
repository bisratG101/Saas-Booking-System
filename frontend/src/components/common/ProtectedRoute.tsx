import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/api";
import { SkeletonCard } from "../ui/Skeleton";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated visitors to login, preserving intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // User is authenticated but does not possess the required privilege
    return (
      <div className="max-w-md mx-auto py-16">
        <Card className="text-center p-6 space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 stroke-[1.5]" />
          </div>
          <h2 className="text-lg font-bold text-[#18181B]">
            Access Restricted
          </h2>
          <p className="text-xs text-[#6B6B6B] leading-relaxed">
            Your account ({user.email}) has role{" "}
            <strong className="text-[#18181B] font-mono">{user.role}</strong>,
            which does not have authorization to view this area.
          </p>
          <div className="pt-2 flex justify-center">
            <Link
              to={
                user.role === "business_owner"
                  ? "/owner"
                  : user.role === "platform_admin"
                  ? "/admin"
                  : "/businesses"
              }
            >
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Return to My Workspace
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-12">
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (isAuthenticated && user) {
    // Already authenticated: redirect away from login/register to the relevant area
    if (user.role === "platform_admin") {
      return <Navigate to="/admin" replace />;
    }
    if (user.role === "business_owner") {
      return <Navigate to="/owner" replace />;
    }
    return <Navigate to="/businesses" replace />;
  }

  return <>{children}</>;
}
