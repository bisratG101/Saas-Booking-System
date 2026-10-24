import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Clock,
  CreditCard,
  Building2,
  ScrollText,
  Store,
  LogOut,
  X,
  Compass,
  Home,
  LogIn,
  UserPlus,
} from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, isAuthenticated, isOwner, isAdmin, isCustomer, logout } =
    useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
    onClose();
  }

  // Active / inactive navlink styling: subtle neutral background with a slim Goom green accent indicator
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all select-none relative ${
      isActive
        ? "bg-[#EFEEEB] text-[#18181B] font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-[#285943] dark:before:bg-[#3D8663]"
        : "text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#F4F4F5]"
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[248px] bg-white border-r border-[#E7E7E4] flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#E7E7E4] flex items-center justify-between">
          <Link
            to={
              isOwner
                ? "/owner"
                : isAdmin
                ? "/admin"
                : isCustomer
                ? "/my-bookings"
                : "/"
            }
            onClick={onClose}
            className="flex items-center gap-2.5 group"
          >
            {/* Goom Brand Mark */}
            <div className="h-8 w-8 rounded-lg bg-[#285943] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-[#1E4332] transition-colors">
              G
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181B] tracking-tight flex items-center gap-1.5 leading-none">
                <span>Goom</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EFEEEB] text-[#6B6B6B] border border-[#E7E7E4]">
                  SYSTEM
                </span>
              </div>
              <div className="text-[11px] text-[#6B6B6B] mt-0.5 leading-tight">
                Goom Booking System
              </div>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Business Owner Section */}
          {isOwner && (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Management
              </div>
              <NavLink to="/owner" end className={getNavClass} onClick={onClose}>
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/owner/bookings" className={getNavClass} onClick={onClose}>
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Appointments</span>
              </NavLink>
              <NavLink to="/owner/services" className={getNavClass} onClick={onClose}>
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>Services</span>
              </NavLink>
              <NavLink to="/owner/hours" className={getNavClass} onClick={onClose}>
                <Clock className="h-4 w-4 shrink-0" />
                <span>Working Hours</span>
              </NavLink>
              <NavLink to="/owner/subscription" className={getNavClass} onClick={onClose}>
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>Subscription</span>
              </NavLink>
            </div>
          )}

          {/* Customer Section */}
          {isCustomer && (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Client Portal
              </div>
              <NavLink to="/businesses" className={getNavClass} onClick={onClose}>
                <Store className="h-4 w-4 shrink-0" />
                <span>Find Businesses</span>
              </NavLink>
              <NavLink to="/my-bookings" className={getNavClass} onClick={onClose}>
                <Calendar className="h-4 w-4 shrink-0" />
                <span>My Bookings</span>
              </NavLink>
            </div>
          )}

          {/* Platform Admin Section */}
          {isAdmin && (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Administration
              </div>
              <NavLink to="/admin" end className={getNavClass} onClick={onClose}>
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Overview</span>
              </NavLink>
              <NavLink to="/admin/businesses" className={getNavClass} onClick={onClose}>
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Tenants</span>
              </NavLink>
              <NavLink to="/admin/activity-logs" className={getNavClass} onClick={onClose}>
                <ScrollText className="h-4 w-4 shrink-0" />
                <span>Audit Logs</span>
              </NavLink>
            </div>
          )}

          {/* Public / Unauthenticated Navigation */}
          {!isAuthenticated && (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Explore
              </div>
              <NavLink to="/" end className={getNavClass} onClick={onClose}>
                <Home className="h-4 w-4 shrink-0" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/businesses" className={getNavClass} onClick={onClose}>
                <Store className="h-4 w-4 shrink-0" />
                <span>Directory</span>
              </NavLink>
              <div className="pt-2 mt-2 border-t border-[#E7E7E4]">
                <NavLink to="/login" className={getNavClass} onClick={onClose}>
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>Sign In</span>
                </NavLink>
                <NavLink to="/register" className={getNavClass} onClick={onClose}>
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span>Register</span>
                </NavLink>
              </div>
            </div>
          )}

          {/* Directory Link for Authenticated Users */}
          {isAuthenticated && !isCustomer && (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Directory
              </div>
              <NavLink to="/businesses" className={getNavClass} onClick={onClose}>
                <Compass className="h-4 w-4 shrink-0" />
                <span>Public Directory</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* User Footer Identity */}
        {isAuthenticated && user ? (
          <div className="p-3 border-t border-[#E7E7E4] bg-[#FAFAF8]">
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-[#E7E7E4]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                  {user.name ? user.name.charAt(0) : user.email.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#18181B] truncate">
                    {user.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusBadge
                      status={user.role}
                      size="sm"
                      className="text-[10px] py-0 px-1.5"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 text-[#6B6B6B] hover:text-[#DC2626] rounded-md hover:bg-[#FEE2E2] transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-[#E7E7E4] bg-[#FAFAF8]">
            <div className="text-xs text-[#6B6B6B] text-center">
              Goom Booking Platform v1.0
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
