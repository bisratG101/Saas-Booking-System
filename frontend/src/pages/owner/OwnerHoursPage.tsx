import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type {
  SafeBusinessHour,
  SafeBusiness,
  BusinessHourDayPayload,
} from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { SkeletonCard } from "../../components/ui/Skeleton";
import {
  ArrowLeft,
  RotateCw,
  Save,
  Globe,
  Info,
} from "lucide-react";

const WEEKDAYS = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
  { day: 3, name: "Wednesday" },
  { day: 4, name: "Thursday" },
  { day: 5, name: "Friday" },
  { day: 6, name: "Saturday" },
  { day: 7, name: "Sunday" },
];

interface DayScheduleState {
  day_of_week: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
}

export function OwnerHoursPage() {
  const [business, setBusiness] = useState<SafeBusiness | null>(null);
  const [schedule, setSchedule] = useState<DayScheduleState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Fetch business for timezone
      const bizRes = await api.get<{ business: SafeBusiness }>("/businesses/me");
      setBusiness(bizRes.business);

      // 2. Fetch current hours
      const hoursRes = await api.get<{ hours: SafeBusinessHour[] }>("/businesses/me/hours");
      const existingHours = hoursRes?.hours || [];

      // Build 7-day state, defaulting to Mon-Fri 09:00-17:00, Sat-Sun Closed if not yet initialized
      const daysMap = new Map<number, SafeBusinessHour>();
      existingHours.forEach((h) => daysMap.set(h.dayOfWeek, h));

      const initialSchedule: DayScheduleState[] = WEEKDAYS.map(({ day }) => {
        const entry = daysMap.get(day);
        if (entry) {
          // Normalize "09:00:00" to "09:00" for HTML time input
          const formatTime = (t: string | null) => (t ? t.slice(0, 5) : "");
          return {
            day_of_week: day,
            is_closed: entry.isClosed,
            open_time: formatTime(entry.openTime) || "09:00",
            close_time: formatTime(entry.closeTime) || "17:00",
          };
        }
        // Default fallback
        const isWeekend = day === 6 || day === 7;
        return {
          day_of_week: day,
          is_closed: isWeekend,
          open_time: isWeekend ? "" : "09:00",
          close_time: isWeekend ? "" : "17:00",
        };
      });

      setSchedule(initialSchedule);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load working schedule. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleClosed = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day_of_week === dayOfWeek) {
          const nextClosed = !d.is_closed;
          return {
            ...d,
            is_closed: nextClosed,
            open_time: nextClosed ? "" : d.open_time || "09:00",
            close_time: nextClosed ? "" : d.close_time || "17:00",
          };
        }
        return d;
      })
    );
    // Clear validation error for this day if toggled
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[dayOfWeek];
      return copy;
    });
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: "open_time" | "close_time",
    val: string
  ) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, [field]: val } : d))
    );
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[dayOfWeek];
      return copy;
    });
  };

  const validateSchedule = (): boolean => {
    const errors: Record<number, string> = {};

    schedule.forEach((d) => {
      if (!d.is_closed) {
        if (!d.open_time || !d.close_time) {
          errors[d.day_of_week] = "Opening and closing times are required when open.";
        } else if (d.close_time <= d.open_time) {
          errors[d.day_of_week] =
            "Closing time must be later than opening time on the same day.";
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);
    setSuccessMessage(null);

    if (!validateSchedule()) {
      return;
    }

    setIsSaving(true);

    try {
      const payload: { hours: BusinessHourDayPayload[] } = {
        hours: schedule.map((d) => ({
          day_of_week: d.day_of_week,
          is_closed: d.is_closed,
          open_time: d.is_closed ? null : d.open_time,
          close_time: d.is_closed ? null : d.close_time,
        })),
      };

      await api.put("/businesses/me/hours", payload);

      setSuccessMessage(
        "Working hours updated successfully. Customer availability slots will immediately reflect this schedule."
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to update working hours.");
      } else {
        setError("A network error occurred while saving schedule.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
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
            <span className="text-xs font-semibold text-[#18181B]">Working Hours</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Operating Schedule
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Configure your 7-day weekly opening and closing hours for appointment availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            Save Schedule
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}

      {/* Timezone Notice Card */}
      {business && (
        <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E7E4] flex items-start gap-3">
          <Globe className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-[#18181B]">
              Operating Timezone: <span className="font-mono text-[#2563EB]">{business.timezone}</span>
            </h4>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              All hours entered below represent your local business time. The slot generation engine converts these opening and closing windows into unambiguous UTC booking slots for clients.
            </p>
          </div>
        </div>
      )}

      {/* Schedule Form Table */}
      <Card
        title="Weekly Hours (Monday – Sunday)"
        subtitle="Manage availability by day of the week"
        className="shadow-xs"
      >
        {isLoading ? (
          <SkeletonCard lines={7} />
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="divide-y divide-[#E7E7E4]">
              {schedule.map((d) => {
                const dayMeta = WEEKDAYS.find((w) => w.day === d.day_of_week);
                const dayError = validationErrors[d.day_of_week];

                return (
                  <div
                    key={d.day_of_week}
                    className={`py-3.5 px-2 -mx-2 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      d.is_closed ? "bg-[#FAFAF8]/60" : "bg-white"
                    }`}
                  >
                    {/* Day Name and Open/Close Toggle */}
                    <div className="flex items-center gap-3 w-48">
                      <span className="font-semibold text-xs text-[#18181B] w-24">
                        {dayMeta?.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleClosed(d.day_of_week)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-all select-none ${
                          d.is_closed
                            ? "bg-[#EFEEEB] text-[#6B6B6B] border-[#E7E7E4] hover:bg-[#E7E7E4]"
                            : "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0] hover:bg-[#BBF7D0]"
                        }`}
                      >
                        {d.is_closed ? "Closed" : "Open"}
                      </button>
                    </div>

                    {/* Time Input Controls */}
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                      {d.is_closed ? (
                        <span className="text-xs text-[#6B6B6B] italic font-mono py-1">
                          Closed all day (no booking slots generated)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#6B6B6B]">From</span>
                            <input
                              type="time"
                              required
                              value={d.open_time}
                              onChange={(e) =>
                                handleTimeChange(d.day_of_week, "open_time", e.target.value)
                              }
                              className="px-2.5 py-1 text-xs border border-[#E7E7E4] rounded-lg bg-white text-[#18181B] font-mono focus:outline-none focus:ring-2 focus:ring-[#111111]"
                            />
                          </div>

                          <span className="text-xs text-[#6B6B6B]">to</span>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              required
                              value={d.close_time}
                              onChange={(e) =>
                                handleTimeChange(d.day_of_week, "close_time", e.target.value)
                              }
                              className="px-2.5 py-1 text-xs border border-[#E7E7E4] rounded-lg bg-white text-[#18181B] font-mono focus:outline-none focus:ring-2 focus:ring-[#111111]"
                            />
                          </div>
                        </div>
                      )}

                      {dayError && (
                        <div className="text-[11px] text-[#DC2626] font-medium sm:text-right">
                          {dayError}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E7E7E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                <Info className="h-4 w-4 text-[#2563EB]" />
                <span>Overnight hours (past 23:59) are not permitted in V1.</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Weekly Schedule
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
