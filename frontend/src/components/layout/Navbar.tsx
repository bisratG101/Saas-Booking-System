import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                B
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                BookFlow
              </span>
            </Link>

            {/* Main Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                to="/businesses"
                className="text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Browse Businesses
              </Link>

              {isAuthenticated && user?.role === "customer" && (
                <Link
                  to="/my-bookings"
                  className="text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  My Appointments
                </Link>
              )}

              {isAuthenticated && user?.role === "business_owner" && (
                <div className="flex items-center gap-4">
                  <Link
                    to="/owner"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Owner Dashboard
                  </Link>
                  <Link
                    to="/owner/bookings"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Schedule
                  </Link>
                  <Link
                    to="/owner/services"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Services
                  </Link>
                  <Link
                    to="/owner/hours"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Working Hours
                  </Link>
                  <Link
                    to="/owner/subscription"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Subscription
                  </Link>
                </div>
              )}

              {isAuthenticated && user?.role === "platform_admin" && (
                <div className="flex items-center gap-4">
                  <Link
                    to="/admin"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Admin Stats
                  </Link>
                  <Link
                    to="/admin/businesses"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Manage Businesses
                  </Link>
                  <Link
                    to="/admin/activity-logs"
                    className="text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    Audit Logs
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {/* Right Action / Profile */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono capitalize">
                    {user.role.replace("_", " ")}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
