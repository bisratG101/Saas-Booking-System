import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  Calendar,
  Store,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";

export function HomePage() {
  const { user, isAuthenticated, isOwner, isAdmin, isCustomer } = useAuth();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="bg-white rounded-2xl border border-[#E7E7E4] p-8 sm:p-12 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#18181B] leading-tight">
            Appointment management for modern service providers.
          </h1>

          <p className="mt-4 text-[#6B6B6B] text-base sm:text-lg leading-relaxed">
            Discover verified businesses, book guaranteed slots in local business
            time, and manage clients with strict PostgreSQL multi-tenant isolation.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/businesses">
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Browse Businesses
              </Button>
            </Link>

            {!isAuthenticated ? (
              <Link to="/register">
                <Button size="lg" variant="secondary">
                  Create Free Account
                </Button>
              </Link>
            ) : (
              <Link
                to={
                  isOwner
                    ? "/owner"
                    : isAdmin
                    ? "/admin"
                    : isCustomer
                    ? "/my-bookings"
                    : "/businesses"
                }
              >
                <Button size="lg" variant="secondary">
                  Go to Workspace
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Ambient subtle background element */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 pointer-events-none hidden sm:block">
          <Calendar className="w-96 h-96 text-[#18181B]" />
        </div>
      </div>

      {/* Feature Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B] shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#18181B]">
                Deterministic Slots
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed">
                Discrete 30-minute availability blocks computed across 7-day schedules in business local timezones.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B] shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#18181B]">
                Concurrency Safe
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed">
                Database level unique slot constraints prevent race conditions and eliminate double bookings.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B] shrink-0">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#18181B]">
                Tenant Isolation
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed">
                Role-based access control guarantees business owners and clients only see authorized data.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Platform Status Footer Note */}
      {isAuthenticated && user && (
        <div className="px-5 py-4 rounded-xl bg-white border border-[#E7E7E4] flex items-center justify-between text-xs text-[#6B6B6B]">
          <span>
            Connected as <strong className="text-[#18181B]">{user.email}</strong> ({user.role})
          </span>
          <span className="font-mono text-[11px] text-[#2563EB]">
            Session Active
          </span>
        </div>
      )}
    </div>
  );
}
