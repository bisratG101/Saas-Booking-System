import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { SafeBooking, SafeBusiness } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { DateBadge } from "../../components/ui/DateBadge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import {
  Calendar,
  Store,
  Clock,
  RotateCw,
  AlertCircle,
  Building,
} from "lucide-react";

export function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<SafeBooking[]>([]);
  const [businesses, setBusinesses] = useState<Record<string, SafeBusiness>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation state
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch customer's own bookings
      const bookingRes = await api.get<{ bookings: SafeBooking[] }>("/bookings/me");
      const list = bookingRes?.bookings || [];
      setBookings(list);

      // 2. Fetch businesses to resolve business names and timezones
      try {
        const bizRes = await api.get<{ businesses: SafeBusiness[] }>("/businesses");
        const map: Record<string, SafeBusiness> = {};
        (bizRes?.businesses || []).forEach((b) => {
          map[b.id] = b;
        });
        setBusinesses(map);
      } catch {
        // Non-critical if business lookup fails
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load your appointments. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancelBooking = async (booking: SafeBooking) => {
    const confirmPrompt = window.confirm(
      "Are you sure you want to cancel this appointment? This action cannot be undone."
    );
    if (!confirmPrompt) return;

    setCancellingBookingId(booking.id);
    setCancelMessage(null);

    try {
      await api.post(`/bookings/${booking.id}/cancel`);

      setCancelMessage({
        type: "success",
        text: `Booking #${booking.id.slice(0, 8)} was successfully cancelled.`,
      });

      // Reload list to update status and open the slot again
      await loadData();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "CANCELLATION_DEADLINE_PASSED") {
          setCancelMessage({
            type: "error",
            text: "Cancellations must be requested at least 2 hours prior to the scheduled start time.",
          });
        } else {
          setCancelMessage({
            type: "error",
            text: err.message || "Failed to cancel booking.",
          });
        }
      } else {
        setCancelMessage({
          type: "error",
          text: "An unexpected error occurred while attempting cancellation.",
        });
      }
    } finally {
      setCancellingBookingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            My Appointments
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Review your confirmed and cancelled bookings for {user?.name || user?.email}.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Refresh List
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}

      {cancelMessage && (
        <Alert
          type={cancelMessage.type}
          message={cancelMessage.text}
          className="mb-4"
        />
      )}

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6 stroke-[1.5]" />}
          title="No appointments scheduled"
          description="You don't have any bookings yet. Browse verified businesses in the directory to find and reserve time slots."
          action={
            <Link to="/businesses">
              <Button variant="primary" leftIcon={<Store className="h-4 w-4" />}>
                Browse Business Directory
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const biz = businesses[booking.businessId];
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);

            // 2-hour cancellation rule calculation
            const nowMs = Date.now();
            const startMs = startTime.getTime();
            const hoursUntilStart = (startMs - nowMs) / (1000 * 60 * 60);
            const canCancel =
              booking.status === "confirmed" && hoursUntilStart >= 2;
            const isTooLateToCancel =
              booking.status === "confirmed" && hoursUntilStart < 2 && hoursUntilStart > 0;

            return (
              <Card
                key={booking.id}
                className="hover:border-[#D4D4D0] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <DateBadge date={booking.startTime} size="md" />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-[#18181B]">
                          Appointment #{booking.id.slice(0, 8)}
                        </h4>
                        <StatusBadge status={booking.status} size="sm" />
                      </div>

                      <div className="text-xs text-[#6B6B6B] flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#18181B] inline-flex items-center gap-1">
                          <Building className="h-3 w-3 text-[#6B6B6B]" />
                          {biz?.name || `Business ${booking.businessId.slice(0, 8)}...`}
                        </span>
                        <span>•</span>
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
                          {biz?.timezone && (
                            <span className="text-[10px] text-[#6B6B6B] ml-0.5">
                              ({biz.timezone})
                            </span>
                          )}
                        </span>
                      </div>

                      {booking.cancelledAt && (
                        <div className="text-[11px] text-[#DC2626] font-mono">
                          Cancelled on {new Date(booking.cancelledAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Rules */}
                  <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-center">
                    {canCancel ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={cancellingBookingId === booking.id}
                        onClick={() => handleCancelBooking(booking)}
                        className="text-xs text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FCA5A5]"
                      >
                        Cancel Appointment
                      </Button>
                    ) : isTooLateToCancel ? (
                      <div className="flex items-center gap-1 text-[11px] text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-1 rounded">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>Cannot cancel within 2h of start</span>
                      </div>
                    ) : null}

                    <div className="text-[10px] font-mono text-[#6B6B6B]">
                      Ref: {booking.id}
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
