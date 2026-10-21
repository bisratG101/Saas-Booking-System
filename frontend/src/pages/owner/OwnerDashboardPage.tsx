import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type {
  SafeBusiness,
  SafeService,
  SafeBooking,
  SafeSubscription,
} from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { KpiCard } from "../../components/ui/KpiCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonKpi, SkeletonCard } from "../../components/ui/Skeleton";
import { DateBadge } from "../../components/ui/DateBadge";
import { Button } from "../../components/ui/Button";
import {
  Calendar,
  Briefcase,
  Clock,
  CreditCard,
  BarChart3,
  PieChart,
  ArrowRight,
  ExternalLink,
  Store,
  RotateCw,
  CheckCircle2,
  XCircle,
  Coins,
} from "lucide-react";

export function OwnerDashboardPage() {
  const [business, setBusiness] = useState<SafeBusiness | null>(null);
  const [services, setServices] = useState<SafeService[]>([]);
  const [bookings, setBookings] = useState<SafeBooking[]>([]);
  const [subscription, setSubscription] = useState<SafeSubscription | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [bizRes, srvRes, bookRes, subRes] = await Promise.allSettled([
        api.get<{ business: SafeBusiness }>("/businesses/me"),
        api.get<{ services: SafeService[] }>("/businesses/me/services"),
        api.get<{ bookings: SafeBooking[] }>("/businesses/me/bookings"),
        api.get<{ subscription: SafeSubscription }>("/businesses/me/subscription"),
      ]);

      if (bizRes.status === "fulfilled") {
        setBusiness(bizRes.value.business);
      } else {
        const reason = bizRes.reason;
        throw new Error(reason?.message || "Failed to load business profile.");
      }

      if (srvRes.status === "fulfilled") {
        setServices(srvRes.value.services || []);
      }

      if (bookRes.status === "fulfilled") {
        setBookings(bookRes.value.bookings || []);
      }

      if (subRes.status === "fulfilled") {
        setSubscription(subRes.value.subscription || null);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to load dashboard metrics.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Service lookup map for fast name & price resolution
  const servicesMap = useMemo(() => {
    const map = new Map<string, SafeService>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  // Metrics derived accurately from genuine backend data
  const metrics = useMemo(() => {
    const tz = business?.timezone || "UTC";
    const now = new Date();

    // Format current date in business timezone (YYYY-MM-DD)
    let todayStr = "";
    try {
      todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    } catch {
      todayStr = now.toISOString().slice(0, 10);
    }

    let todayBookingsCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;
    let scheduledRevenue = 0;

    const upcomingBookingsList: SafeBooking[] = [];

    bookings.forEach((b) => {
      const start = new Date(b.startTime);
      const isConfirmed = b.status === "confirmed";

      if (isConfirmed) {
        confirmedCount += 1;
        const svc = servicesMap.get(b.serviceId);
        if (svc) {
          scheduledRevenue += Number(svc.price) || 0;
        }

        // Today check in business timezone
        try {
          const bookingDateStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
          }).format(start);
          if (bookingDateStr === todayStr) {
            todayBookingsCount += 1;
          }
        } catch {
          // fallback
          if (b.startTime.slice(0, 10) === todayStr) {
            todayBookingsCount += 1;
          }
        }

        // Upcoming check
        if (start.getTime() >= now.getTime()) {
          upcomingBookingsList.push(b);
        }
      } else if (b.status === "cancelled") {
        cancelledCount += 1;
      }
    });

    // Sort upcoming ascending by start time
    upcomingBookingsList.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const activeServicesCount = services.filter((s) => s.isActive).length;

    return {
      todayStr,
      todayBookingsCount,
      confirmedCount,
      cancelledCount,
      totalBookings: bookings.length,
      activeServicesCount,
      totalServices: services.length,
      scheduledRevenue,
      upcomingBookings: upcomingBookingsList.slice(0, 5),
    };
  }, [business, services, bookings, servicesMap]);

  // Format time in business timezone
  const formatTimeInBusinessTz = (isoDate: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: business?.timezone || "UTC",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(isoDate));
    } catch {
      return new Date(isoDate).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Workspace Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Real-time appointment schedule, capacity metrics, and service configuration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {business && (
            <>
              <StatusBadge status={business.status} size="md" />
              <span className="text-xs font-mono text-[#6B6B6B] px-2.5 py-1 rounded-md bg-white border border-[#E7E7E4]">
                {business.timezone}
              </span>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDashboardData}
            isLoading={isLoading}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* 1. Four Responsive KPI Cards Connected to Genuine Data */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Today's Appointments"
            value={metrics.todayBookingsCount}
            subtitle={
              metrics.todayBookingsCount === 1
                ? "1 appointment scheduled today"
                : `${metrics.todayBookingsCount} appointments scheduled today`
            }
            icon={<Clock className="h-4 w-4" />}
            change={business?.timezone || "Local"}
            changeType="neutral"
          />

          <KpiCard
            title="Confirmed Bookings"
            value={metrics.confirmedCount}
            subtitle={`${metrics.totalBookings} total appointments placed`}
            icon={<Calendar className="h-4 w-4" />}
            change={
              metrics.totalBookings > 0
                ? `${Math.round(
                    (metrics.confirmedCount / metrics.totalBookings) * 100
                  )}% rate`
                : "No data"
            }
            changeType={metrics.confirmedCount > 0 ? "positive" : "neutral"}
          />

          <KpiCard
            title="Active Services"
            value={`${metrics.activeServicesCount} / ${metrics.totalServices}`}
            subtitle={
              metrics.totalServices === 0
                ? "No services configured yet"
                : `${metrics.activeServicesCount} bookable by clients`
            }
            icon={<Briefcase className="h-4 w-4" />}
            change={metrics.activeServicesCount > 0 ? "Active" : "Setup needed"}
            changeType={metrics.activeServicesCount > 0 ? "positive" : "neutral"}
          />

          <KpiCard
            title="Scheduled Value"
            value={`ETB ${metrics.scheduledRevenue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle="From confirmed client bookings"
            icon={<Coins className="h-4 w-4" />}
            change={subscription?.status === "active" ? "Subscribed" : "Tier ready"}
            changeType="positive"
          />
        </div>
      )}

      {/* 2. Volume & Status Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: 30-Day Appointment Volume */}
        <Card
          title="Appointment Demand & Volume"
          subtitle="All-time appointment metrics recorded in Goom Booking System"
          headerAction={
            <Link
              to="/owner/bookings"
              className="text-xs font-semibold text-[#18181B] hover:text-[#2563EB] inline-flex items-center gap-1"
            >
              <span>View Bookings</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {isLoading ? (
            <SkeletonCard lines={3} />
          ) : metrics.totalBookings === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6 stroke-[1.5]" />}
              title="No activity recorded yet"
              description="Daily booking trends and slot demand will calculate and graph here as clients book appointments with your business."
              className="py-10 border-0 bg-transparent"
            />
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E7E4]">
                <div>
                  <div className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wider">
                    Total
                  </div>
                  <div className="text-xl font-bold text-[#18181B] mt-0.5">
                    {metrics.totalBookings}
                  </div>
                  <div className="text-[11px] text-[#6B6B6B]">All-time</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider">
                    Confirmed
                  </div>
                  <div className="text-xl font-bold text-[#16A34A] mt-0.5">
                    {metrics.confirmedCount}
                  </div>
                  <div className="text-[11px] text-[#6B6B6B]">Active slots</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-[#DC2626] uppercase tracking-wider">
                    Cancelled
                  </div>
                  <div className="text-xl font-bold text-[#DC2626] mt-0.5">
                    {metrics.cancelledCount}
                  </div>
                  <div className="text-[11px] text-[#6B6B6B]">Released slots</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#6B6B6B]">
                  <span>Slot Occupancy Ratio</span>
                  <span className="font-semibold text-[#18181B]">
                    {Math.round(
                      (metrics.confirmedCount / metrics.totalBookings) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#EFEEEB] rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#111111] h-full transition-all"
                    style={{
                      width: `${(metrics.confirmedCount / metrics.totalBookings) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-[#EF4444] h-full transition-all"
                    style={{
                      width: `${(metrics.cancelledCount / metrics.totalBookings) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-[#6B6B6B] pt-1 leading-relaxed">
                Slot reservations are processed deterministically via Neon PostgreSQL transactional lock isolation.
              </p>
            </div>
          )}
        </Card>

        {/* Card 2: Status Breakdown */}
        <Card
          title="Booking Status Breakdown"
          subtitle="Confirmed vs. cancelled distribution ratio"
        >
          {isLoading ? (
            <SkeletonCard lines={3} />
          ) : metrics.totalBookings === 0 ? (
            <EmptyState
              icon={<PieChart className="h-6 w-6 stroke-[1.5]" />}
              title="No appointment history available"
              description="Status distributions will calculate and appear automatically once customer appointments are processed."
              className="py-10 border-0 bg-transparent"
            />
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <span className="text-xs font-semibold text-[#18181B]">
                      Confirmed Appointments
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#18181B]">
                      {metrics.confirmedCount}
                    </span>
                    <span className="text-xs text-[#6B6B6B]">
                      (
                      {Math.round(
                        (metrics.confirmedCount / metrics.totalBookings) * 100
                      )}
                      %)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-2.5">
                    <XCircle className="h-4 w-4 text-[#DC2626]" />
                    <span className="text-xs font-semibold text-[#18181B]">
                      Cancelled Appointments
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#18181B]">
                      {metrics.cancelledCount}
                    </span>
                    <span className="text-xs text-[#6B6B6B]">
                      (
                      {Math.round(
                        (metrics.cancelledCount / metrics.totalBookings) * 100
                      )}
                      %)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#FAFAF8] border border-[#E7E7E4] flex items-center justify-between text-xs">
                <span className="text-[#6B6B6B]">Active Cancellation Policy</span>
                <span className="font-semibold text-[#18181B]">
                  Owner anytime / Client 2-hour cutoff
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Lower Section: Upcoming Appointments & Business Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lower Card 1: Upcoming Appointments */}
        <Card
          title="Upcoming Appointments"
          subtitle="Next scheduled client reservations"
          headerAction={
            <Link
              to="/owner/bookings"
              className="text-xs font-semibold text-[#18181B] hover:text-[#2563EB] inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {isLoading ? (
            <SkeletonCard lines={4} />
          ) : metrics.upcomingBookings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6 stroke-[1.5]" />}
              title="No upcoming appointments"
              description="You have no upcoming confirmed reservations. When clients book appointments, they will appear here in chronological order."
              action={
                <Link to="/owner/bookings">
                  <Button variant="secondary" size="sm">
                    View Schedule
                  </Button>
                </Link>
              }
              className="py-8 border-0 bg-transparent"
            />
          ) : (
            <div className="divide-y divide-[#E7E7E4]">
              {metrics.upcomingBookings.map((b) => {
                const svc = servicesMap.get(b.serviceId);
                const sName = svc?.name || "Standard Appointment";
                const sPrice = svc ? `ETB ${svc.price.toFixed(2)}` : "ETB 0.00";
                const startTimeStr = formatTimeInBusinessTz(b.startTime);
                const endTimeStr = formatTimeInBusinessTz(b.endTime);

                return (
                  <div
                    key={b.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DateBadge date={b.startTime} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#18181B] truncate">
                          {sName}
                        </div>
                        <div className="text-xs text-[#6B6B6B] flex items-center gap-2 mt-0.5">
                          <span>
                            {startTimeStr} - {endTimeStr}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">
                            Client #{b.customerId.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-[#18181B]">
                        {sPrice}
                      </span>
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Lower Card 2: Configuration & Business Details */}
        <Card
          title="Business Configuration"
          subtitle="Overview of operating hours, services, and subscription tier"
          headerAction={
            <Link
              to="/owner/subscription"
              className="text-xs font-semibold text-[#18181B] hover:text-[#2563EB] inline-flex items-center gap-1"
            >
              <span>Manage Profile</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {isLoading ? (
            <SkeletonCard lines={4} />
          ) : business ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[#E7E7E4]">
                <span className="text-xs text-[#6B6B6B]">Business Name</span>
                <span className="text-xs font-semibold text-[#18181B]">
                  {business.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#E7E7E4]">
                <span className="text-xs text-[#6B6B6B]">Registered Timezone</span>
                <span className="text-xs font-mono text-[#18181B]">
                  {business.timezone}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#E7E7E4]">
                <span className="text-xs text-[#6B6B6B]">Subscription Plan</span>
                <span className="text-xs font-mono font-bold uppercase text-[#18181B]">
                  {subscription?.planName || "STANDARD"} (
                  {subscription?.status || "active"})
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#E7E7E4]">
                <span className="text-xs text-[#6B6B6B]">Tenant Isolation Key</span>
                <span className="text-xs font-mono text-[#6B6B6B]">
                  {business.id.slice(0, 16)}...
                </span>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <Link to="/owner/services">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Briefcase className="h-3.5 w-3.5" />}
                  >
                    Services ({services.length})
                  </Button>
                </Link>
                <Link to="/owner/hours">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Clock className="h-3.5 w-3.5" />}
                  >
                    Operating Hours
                  </Button>
                </Link>
                <Link to="/owner/subscription">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                  >
                    Profile & Billing
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Store className="h-6 w-6 stroke-[1.5]" />}
              title="No business profile"
              description="No registered business entity is associated with your account."
              className="py-8 border-0 bg-transparent"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
