import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { SafeBooking, SafeBusiness, SafeService } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { DateBadge } from "../../components/ui/DateBadge";
import {
  ArrowLeft,
  Calendar,
  Clock,
  RotateCw,
  User,
  XCircle,
} from "lucide-react";

export function OwnerBookingsPage() {
  const [bookings, setBookings] = useState<SafeBooking[]>([]);
  const [business, setBusiness] = useState<SafeBusiness | null>(null);
  const [servicesMap, setServicesMap] = useState<Record<string, SafeService>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "cancelled">("all");

  // Cancellation state
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch business details for timezone
      const bizRes = await api.get<{ business: SafeBusiness }>("/businesses/me");
      setBusiness(bizRes.business);

      // 2. Fetch owner services to resolve names and prices
      try {
        const srvRes = await api.get<{ services: SafeService[] }>("/businesses/me/services");
        const map: Record<string, SafeService> = {};
        (srvRes?.services || []).forEach((s) => {
          map[s.id] = s;
        });
        setServicesMap(map);
      } catch {
        // Non-critical if services map fails
      }

      // 3. Fetch owner bookings
      const bookRes = await api.get<{ bookings: SafeBooking[] }>("/businesses/me/bookings");
      setBookings(bookRes?.bookings || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load appointment bookings. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOwnerCancel = async (booking: SafeBooking) => {
    const sName = servicesMap[booking.serviceId]?.name || "appointment";
    const confirmPrompt = window.confirm(
      `Are you sure you want to cancel ${sName} (#${booking.id.slice(0, 8)})? The client slot will be released.`
    );
    if (!confirmPrompt) return;

    setCancellingBookingId(booking.id);
    setActionMessage(null);

    try {
      await api.post(`/businesses/me/bookings/${booking.id}/cancel`);

      setActionMessage({
        type: "success",
        text: `Booking #${booking.id.slice(0, 8)} has been cancelled.`,
      });

      await loadData();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setActionMessage({
          type: "error",
          text: err.message || "Failed to cancel booking.",
        });
      } else {
        setActionMessage({
          type: "error",
          text: "A network error occurred while attempting cancellation.",
        });
      }
    } finally {
      setCancellingBookingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const counts = useMemo(
    () => ({
      all: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    }),
    [bookings]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/owner"
              className="text-xs text-[#6B6B6B] hover:text-[#18181B] inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Dashboard</span>
            </Link>
            <span className="text-xs text-[#6B6B6B]">/</span>
            <span className="text-xs font-semibold text-[#18181B]">Appointments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Client Appointments
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Review booked appointment slots, client IDs, and manage business-level cancellations.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Refresh Schedule
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}
      {actionMessage && (
        <Alert
          type={actionMessage.type}
          message={actionMessage.text}
          className="mb-4"
        />
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7E7E4] pb-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            statusFilter === "all"
              ? "bg-[#285943] text-white shadow-xs"
              : "text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
          }`}
        >
          All Appointments ({counts.all})
        </button>
        <button
          onClick={() => setStatusFilter("confirmed")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            statusFilter === "confirmed"
              ? "bg-[#285943] text-white shadow-xs"
              : "text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
          }`}
        >
          Confirmed ({counts.confirmed})
        </button>
        <button
          onClick={() => setStatusFilter("cancelled")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            statusFilter === "cancelled"
              ? "bg-[#285943] text-white shadow-xs"
              : "text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
          }`}
        >
          Cancelled ({counts.cancelled})
        </button>
      </div>

      {/* Bookings List Card */}
      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6 stroke-[1.5]" />}
          title={
            statusFilter === "all"
              ? "No client appointments yet"
              : `No ${statusFilter} appointments found`
          }
          description={
            statusFilter === "all"
              ? "When clients select available 30-minute slots from your directory profile, their bookings will appear here."
              : `There are currently no bookings with status "${statusFilter}".`
          }
          action={
            statusFilter !== "all" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                Show All Bookings
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const svc = servicesMap[booking.serviceId];
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);

            return (
              <Card
                key={booking.id}
                className="hover:border-[#D4D4D0] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <DateBadge date={booking.startTime} size="md" />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-[#18181B]">
                          {svc?.name || `Service ${booking.serviceId.slice(0, 8)}...`}
                        </h4>
                        <StatusBadge status={booking.status} size="sm" />
                        {svc?.price !== undefined && (
                          <span className="text-[11px] font-mono font-bold text-[#18181B] px-1.5 py-0.5 rounded bg-[#FAFAF8] border border-[#E7E7E4]">
                            {svc.price} ETB
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#6B6B6B] flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {startTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {endTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {business?.timezone && (
                            <span className="text-[10px] text-[#6B6B6B] ml-0.5">
                              ({business.timezone})
                            </span>
                          )}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 text-[#6B6B6B]" />
                          Client ID: {booking.customerId.slice(0, 8)}...
                        </span>
                      </div>

                      {booking.cancelledAt && (
                        <div className="text-[11px] text-[#DC2626] font-mono">
                          Cancelled on {new Date(booking.cancelledAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Info */}
                  <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-center">
                    {booking.status === "confirmed" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={cancellingBookingId === booking.id}
                        onClick={() => handleOwnerCancel(booking)}
                        leftIcon={<XCircle className="h-3.5 w-3.5" />}
                        className="text-xs text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FCA5A5]"
                      >
                        Cancel Booking
                      </Button>
                    ) : (
                      <span className="text-xs text-[#6B6B6B] italic font-mono">
                        Slot Released
                      </span>
                    )}

                    <div className="text-[10px] font-mono text-[#6B6B6B]">
                      ID: {booking.id}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
