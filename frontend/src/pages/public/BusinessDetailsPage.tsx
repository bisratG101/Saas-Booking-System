import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type {
  SafeBusiness,
  SafeService,
  AvailabilityResponse,
  AvailabilitySlot,
  SafeBooking,
} from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SkeletonCard, SkeletonLine } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowLeft,
  Clock,
  Store,
  Calendar as CalendarIcon,
  CheckCircle2,
  Building,
  LogIn,
  Check,
  ChevronRight,
  RotateCw,
} from "lucide-react";

export function BusinessDetailsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const { user, isAuthenticated, isCustomer } = useAuth();
  const location = useLocation();

  // Business and services state
  const [business, setBusiness] = useState<SafeBusiness | null>(null);
  const [services, setServices] = useState<SafeService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking selection state
  const [selectedService, setSelectedService] = useState<SafeService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Submission state
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<SafeBooking | null>(null);

  // Rolling 30-day window limits
  const { minDateStr, maxDateStr } = useMemo(() => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);

    const pad = (n: number) => String(n).padStart(2, "0");
    const format = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return {
      minDateStr: format(today),
      maxDateStr: format(maxDate),
    };
  }, []);

  // 1. Load business and its active services
  const loadData = async () => {
    if (!businessId) {
      setError("No business identifier provided.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find business entity
      const bizRes = await api.get<{ businesses: SafeBusiness[] }>("/businesses");
      const matched = (bizRes?.businesses || []).find((b) => b.id === businessId);

      if (!matched) {
        setBusiness(null);
        setIsLoading(false);
        return;
      }
      setBusiness(matched);

      // Fetch public active services using the endpoint from Part 1
      const srvRes = await api.get<{ services: SafeService[] }>(
        `/businesses/${businessId}/services`
      );
      setServices(srvRes?.services || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load business profile. Please verify server connectivity.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId]);

  // 2. Fetch availability slots whenever selectedService and selectedDate change
  const fetchSlots = async (serviceId: string, date: string) => {
    if (!businessId || !serviceId || !date) return;

    setIsLoadingSlots(true);
    setSlotError(null);
    setSelectedSlot(null);

    try {
      const res = await api.get<AvailabilityResponse>(
        `/businesses/${businessId}/services/${serviceId}/availability`,
        { params: { date } }
      );
      setAvailability(res);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setSlotError(err.message);
      } else {
        setSlotError("Failed to calculate time slot availability.");
      }
      setAvailability(null);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleServiceSelect = (service: SafeService) => {
    setSelectedService(service);
    setSelectedSlot(null);
    setBookingError(null);
    setConfirmedBooking(null);

    // Initialize with today or next day if none selected
    const initialDate = selectedDate || minDateStr;
    setSelectedDate(initialDate);
    fetchSlots(service.id, initialDate);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (selectedService) {
      fetchSlots(selectedService.id, newDate);
    }
  };

  // 3. Confirm and place the booking
  const handleConfirmBooking = async () => {
    if (!business || !selectedService || !selectedSlot) return;

    if (!isAuthenticated) return;

    setIsSubmittingBooking(true);
    setBookingError(null);

    try {
      const res = await api.post<{ booking: SafeBooking }>("/bookings", {
        business_id: business.id,
        service_id: selectedService.id,
        start_time: selectedSlot.startTime,
      });

      setConfirmedBooking(res.booking);

      // Immediately refresh availability so the occupied slot disappears
      if (selectedDate) {
        fetchSlots(selectedService.id, selectedDate);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === "SLOT_UNAVAILABLE") {
          setBookingError(
            "This slot was just reserved by another client. Please select another available time slot."
          );
          // Refresh slots so occupied slot disappears from UI
          if (selectedDate && selectedService) {
            fetchSlots(selectedService.id, selectedDate);
          }
        } else {
          setBookingError(err.message || "Failed to confirm booking.");
        }
      } else {
        setBookingError("An unexpected network error occurred while booking.");
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  // Not Found State
  if (!business) {
    return (
      <div className="max-w-md mx-auto py-16">
        <EmptyState
          icon={<Store className="h-8 w-8 stroke-[1.5] text-[#6B6B6B]" />}
          title="Business Not Found"
          description={`No active business was found for reference "${businessId}". The business may be suspended or does not exist.`}
          action={
            <Link to="/businesses">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Return to Directory
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/businesses"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6B6B] hover:text-[#18181B] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Directory</span>
        </Link>
        <span className="text-xs font-mono text-[#6B6B6B]">
          Ref: {business.id.slice(0, 8)}...
        </span>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Business Header Card */}
      <Card
        title="Business Profile"
        subtitle="Verified appointment provider on Goom Booking System"
        headerAction={<StatusBadge status={business.status} size="md" />}
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E7E4]">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center font-bold text-xl text-[#18181B] shrink-0">
                {business.name ? business.name.charAt(0).toUpperCase() : <Building className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#18181B]">
                  {business.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B] mt-1">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
                    Local Timezone: {business.timezone}
                  </span>
                  <span>•</span>
                  <span>Rolling 30-Day Window</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-[#6B6B6B] sm:text-right">
              <div>Joined: {new Date(business.createdAt).toLocaleDateString()}</div>
              <div className="font-mono text-[11px] mt-0.5">
                Currency: <span className="font-semibold text-[#18181B]">ETB</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Booking Confirmation View */}
      {confirmedBooking && (
        <Card className="border-[#BBF7D0] bg-[#F0FDF4] p-6 text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
            <Check className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#166534]">
              Appointment Confirmed!
            </h3>
            <p className="text-xs text-[#166534] mt-1">
              Your appointment for{" "}
              <strong>{selectedService?.name}</strong> has been secured in the
              database.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-white rounded-lg border border-[#BBF7D0] p-4 text-xs space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Booking Ref:</span>
              <span className="font-mono font-semibold text-[#18181B]">
                {confirmedBooking.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Provider:</span>
              <span className="font-semibold text-[#18181B]">{business.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Date & Slot:</span>
              <span className="font-mono font-semibold text-[#2563EB]">
                {selectedDate} ({selectedSlot?.localStartTime} -{" "}
                {selectedSlot?.localEndTime} {business.timezone})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Service Price:</span>
              <span className="font-bold text-[#18181B]">
                {selectedService?.price} ETB
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link to="/my-bookings">
              <Button variant="primary" size="sm">
                View in My Bookings
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmedBooking(null);
                setSelectedSlot(null);
              }}
            >
              Book Another Service
            </Button>
          </div>
        </Card>
      )}

      {/* Services Catalog */}
      <Card
        title="Available Services"
        subtitle="Select a 30-minute offering to check real-time availability"
      >
        {services.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6 stroke-[1.5]" />}
            title="No active services listed"
            description="This provider does not currently have any active services configured for online booking."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <div className="divide-y divide-[#E7E7E4]">
            {services.map((svc) => {
              const isChosen = selectedService?.id === svc.id;

              return (
                <div
                  key={svc.id}
                  className={`py-4 transition-all rounded-lg px-3 -mx-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isChosen ? "bg-[#EFEEEB]/60" : "hover:bg-[#FAFAF8]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-[#18181B]">
                        {svc.name}
                      </h4>
                      <span className="text-[11px] font-mono text-[#6B6B6B] px-1.5 py-0.5 rounded bg-white border border-[#E7E7E4]">
                        {svc.durationMinutes} min
                      </span>
                    </div>
                    {svc.description && (
                      <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xl">
                        {svc.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xs text-[#6B6B6B]">Rate</div>
                      <div className="text-sm font-bold font-mono text-[#18181B]">
                        {svc.price} ETB
                      </div>
                    </div>

                    <Button
                      variant={isChosen ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handleServiceSelect(svc)}
                      rightIcon={
                        isChosen ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      {isChosen ? "Selected" : "Select Slot"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Interactive Slot Selection & Booking Panel */}
      {selectedService && !confirmedBooking && (
        <Card
          title={`Booking: ${selectedService.name}`}
          subtitle={`Duration: ${selectedService.durationMinutes} minutes • Price: ${selectedService.price} ETB`}
          headerAction={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedService(null);
                setSelectedSlot(null);
              }}
            >
              Cancel Selection
            </Button>
          }
          className="border-[#2563EB]/40 shadow-md"
        >
          <div className="space-y-6">
            {bookingError && <Alert type="error" message={bookingError} />}

            {/* Step 1: Date Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="appointment-date"
                  className="text-xs font-semibold text-[#18181B] flex items-center gap-1.5"
                >
                  <CalendarIcon className="h-4 w-4 text-[#2563EB]" />
                  <span>Choose Appointment Date (30-day window)</span>
                </label>
                <span className="text-[11px] font-mono text-[#6B6B6B]">
                  Local Timezone: {business.timezone}
                </span>
              </div>

              <input
                id="appointment-date"
                type="date"
                min={minDateStr}
                max={maxDateStr}
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 text-sm border border-[#E7E7E4] rounded-lg bg-white text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#111111]"
              />
            </div>

            {/* Step 2: Slot Availability */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E7E4]">
                <h4 className="text-xs font-semibold text-[#18181B]">
                  Available 30-Minute Slots for {selectedDate}
                </h4>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchSlots(selectedService.id, selectedDate)}
                    leftIcon={<RotateCw className="h-3 w-3" />}
                    className="text-[11px]"
                  >
                    Refresh
                  </Button>
                )}
              </div>

              {slotError && <Alert type="error" message={slotError} />}

              {isLoadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonLine key={i} height="h-10" />
                  ))}
                </div>
              ) : !availability || availability.slots.length === 0 ? (
                <div className="p-6 bg-[#FAFAF8] rounded-xl border border-dashed border-[#E7E7E4] text-center space-y-1">
                  <Clock className="h-6 w-6 text-[#6B6B6B] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#18181B]">
                    No Available Slots on {selectedDate}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B]">
                    The business may be closed or all slots are already booked.
                    Please pick another date within the 30-day window.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {availability.slots.map((slot) => {
                    const isPicked =
                      selectedSlot?.startTime === slot.startTime;

                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-mono font-medium transition-all text-center flex flex-col items-center justify-center select-none ${
                          isPicked
                            ? "bg-[#111111] text-white border-[#111111] shadow-sm scale-102"
                            : "bg-white text-[#18181B] border-[#E7E7E4] hover:border-[#111111] hover:bg-[#FAFAF8]"
                        }`}
                      >
                        <span className="font-bold">
                          {slot.localStartTime} - {slot.localEndTime}
                        </span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isPicked ? "text-slate-300" : "text-[#6B6B6B]"
                          }`}
                        >
                          Available
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Confirmation Action */}
            {selectedSlot && (
              <div className="pt-4 border-t border-[#E7E7E4] bg-[#FAFAF8] p-4 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[#6B6B6B]">Selected Appointment: </span>
                    <strong className="text-[#18181B]">
                      {selectedDate} at {selectedSlot.localStartTime} -{" "}
                      {selectedSlot.localEndTime}
                    </strong>
                    <span className="text-[11px] text-[#6B6B6B] ml-1">
                      ({business.timezone})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B]">Total Price: </span>
                    <strong className="text-[#18181B] font-mono">
                      {selectedService.price} ETB
                    </strong>
                  </div>
                </div>

                {!isAuthenticated ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-[#E7E7E4] rounded-lg">
                    <p className="text-xs text-[#6B6B6B]">
                      Please sign in with your customer account to finalize this booking.
                    </p>
                    <Link
                      to="/login"
                      state={{ from: location }}
                      className="shrink-0"
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<LogIn className="h-4 w-4" />}
                      >
                        Sign In to Book
                      </Button>
                    </Link>
                  </div>
                ) : !isCustomer ? (
                  <Alert
                    type="warning"
                    title="Account Restriction"
                    message={`Only customer accounts can place bookings. You are currently logged in with role "${user?.role}". Please register or log in as a customer.`}
                  />
                ) : (
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="primary"
                      isLoading={isSubmittingBooking}
                      onClick={handleConfirmBooking}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Confirm Booking ({selectedService.price} ETB)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
