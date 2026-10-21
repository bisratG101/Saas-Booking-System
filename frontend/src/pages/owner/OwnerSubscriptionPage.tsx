import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { SafeSubscription, SafeBusiness, UpdateBusinessPayload } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Building2,
  Save,
  RotateCw,
  Globe,
  ShieldAlert,
} from "lucide-react";

const COMMON_TIMEZONES = [
  "Africa/Addis_Ababa",
  "Africa/Nairobi",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Riyadh",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

// Helper to validate IANA timezone client-side
function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function OwnerSubscriptionPage() {
  const [business, setBusiness] = useState<SafeBusiness | null>(null);
  const [subscription, setSubscription] = useState<SafeSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Form State
  const [nameInput, setNameInput] = useState("");
  const [timezoneInput, setTimezoneInput] = useState("");
  const [isCustomTz, setIsCustomTz] = useState(false);
  const [customTzInput, setCustomTzInput] = useState("");

  const [formErrors, setFormErrors] = useState<{ name?: string; timezone?: string }>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Subscription Cancel State
  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [subActionMessage, setSubActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [bizRes, subRes] = await Promise.allSettled([
        api.get<{ business: SafeBusiness }>("/businesses/me"),
        api.get<{ subscription: SafeSubscription }>("/businesses/me/subscription"),
      ]);

      if (bizRes.status === "fulfilled") {
        const b = bizRes.value.business;
        setBusiness(b);
        setNameInput(b.name);
        setTimezoneInput(b.timezone);

        if (!COMMON_TIMEZONES.includes(b.timezone)) {
          setIsCustomTz(true);
          setCustomTzInput(b.timezone);
        } else {
          setIsCustomTz(false);
        }
      } else {
        throw new Error(bizRes.reason?.message || "Failed to load business profile.");
      }

      if (subRes.status === "fulfilled") {
        setSubscription(subRes.value.subscription || null);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to load settings.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle business profile update
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccessMessage(null);

    const errors: { name?: string; timezone?: string } = {};
    const trimmedName = nameInput.trim();
    const finalTimezone = isCustomTz ? customTzInput.trim() : timezoneInput.trim();

    if (!trimmedName) {
      errors.name = "Business name cannot be empty.";
    } else if (trimmedName.length > 255) {
      errors.name = "Business name cannot exceed 255 characters.";
    }

    if (!finalTimezone) {
      errors.timezone = "Timezone is required.";
    } else if (!isValidTimezone(finalTimezone)) {
      errors.timezone = "Invalid IANA timezone identifier (e.g. 'Africa/Addis_Ababa', 'UTC').";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSavingProfile(true);

    try {
      const payload: UpdateBusinessPayload = {
        name: trimmedName,
        timezone: finalTimezone,
      };

      const res = await api.patch<{ business: SafeBusiness }>("/businesses/me", payload);
      setBusiness(res.business);
      setNameInput(res.business.name);
      setTimezoneInput(res.business.timezone);
      setProfileSuccessMessage("Business profile updated successfully.");
    } catch (err: any) {
      if (err instanceof ApiError) {
        setProfileError(err.message);
      } else {
        setProfileError(err?.message || "Failed to update business profile.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    const confirmPrompt = window.confirm(
      "Are you sure you want to cancel your platform subscription? This action will mark your plan as cancelled."
    );
    if (!confirmPrompt) return;

    setIsCancellingSub(true);
    setSubActionMessage(null);

    try {
      const res = await api.post<{ subscription: SafeSubscription; message: string }>(
        "/businesses/me/subscription/cancel"
      );
      setSubscription(res.subscription);
      setSubActionMessage({
        type: "success",
        text: "Subscription cancelled successfully.",
      });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setSubActionMessage({
          type: "error",
          text: err.message,
        });
      } else {
        setSubActionMessage({
          type: "error",
          text: "An error occurred while cancelling subscription.",
        });
      }
    } finally {
      setIsCancellingSub(false);
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
            <span className="text-xs font-semibold text-[#18181B]">Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Settings & Subscription
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Configure business identity, operating timezone, and manage your Goom platform tier.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          isLoading={isLoading}
          leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Reload
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Business Profile Settings */}
        <div className="space-y-6">
          <Card
            title="Business Profile"
            subtitle="Update your business name and scheduling timezone"
            headerAction={
              business && <StatusBadge status={business.status} size="sm" />
            }
          >
            {isLoading ? (
              <SkeletonCard lines={4} />
            ) : business ? (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {profileSuccessMessage && (
                  <Alert type="success" message={profileSuccessMessage} />
                )}
                {profileError && <Alert type="error" message={profileError} />}

                {/* Business Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="bizName"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Business Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    id="bizName"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Addis Medical Center"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white focus:outline-hidden transition-all ${
                      formErrors.name
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                        : "border-[#E7E7E4] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-[#DC2626]">{formErrors.name}</p>
                  )}
                </div>

                {/* Timezone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="bizTimezone"
                      className="block text-xs font-semibold text-[#18181B]"
                    >
                      Operating Timezone <span className="text-[#DC2626]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomTz(!isCustomTz)}
                      className="text-[11px] text-[#2563EB] hover:underline"
                    >
                      {isCustomTz ? "Select from list" : "Enter custom IANA"}
                    </button>
                  </div>

                  {isCustomTz ? (
                    <input
                      type="text"
                      value={customTzInput}
                      onChange={(e) => setCustomTzInput(e.target.value)}
                      placeholder="e.g. Africa/Addis_Ababa"
                      className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white focus:outline-hidden transition-all ${
                        formErrors.timezone
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                          : "border-[#E7E7E4] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                      }`}
                    />
                  ) : (
                    <select
                      id="bizTimezone"
                      value={timezoneInput}
                      onChange={(e) => setTimezoneInput(e.target.value)}
                      className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white focus:outline-hidden transition-all ${
                        formErrors.timezone
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                          : "border-[#E7E7E4] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                      }`}
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  )}

                  {formErrors.timezone ? (
                    <p className="text-xs text-[#DC2626]">{formErrors.timezone}</p>
                  ) : (
                    <p className="text-[11px] text-[#6B6B6B] flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>
                        Availability slots are generated strictly aligned to this timezone.
                      </span>
                    </p>
                  )}
                </div>

                {/* Read-only metadata */}
                <div className="pt-2 border-t border-[#E7E7E4] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#6B6B6B]">
                    <span>Business ID (Tenant Key)</span>
                    <span className="font-mono text-[#18181B]">
                      {business.id.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#6B6B6B]">
                    <span>Registered Date</span>
                    <span className="font-mono text-[#18181B]">
                      {new Date(business.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSavingProfile}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                icon={<Building2 className="h-6 w-6 stroke-[1.5]" />}
                title="No business profile"
                description="No registered business entity is linked to your account."
              />
            )}
          </Card>
        </div>

        {/* Right Column: Subscription & Platform Tier */}
        <div className="space-y-6">
          <Card
            title="Subscription & Platform Tier"
            subtitle="Current multi-tenant tier and plan entitlements"
            headerAction={
              subscription && <StatusBadge status={subscription.status} size="sm" />
            }
          >
            {isLoading ? (
              <SkeletonCard lines={4} />
            ) : subscription ? (
              <div className="space-y-4">
                {subActionMessage && (
                  <Alert
                    type={subActionMessage.type}
                    message={subActionMessage.text}
                  />
                )}

                <div className="flex items-center justify-between py-2.5 border-b border-[#E7E7E4]">
                  <span className="text-xs text-[#6B6B6B]">Plan Tier</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#18181B] font-mono">
                    {subscription.planName}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-[#E7E7E4]">
                  <span className="text-xs text-[#6B6B6B]">Subscription Status</span>
                  <span className="text-xs font-semibold capitalize text-[#18181B]">
                    {subscription.status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-[#E7E7E4]">
                  <span className="text-xs text-[#6B6B6B]">Term Started</span>
                  <span className="text-xs font-mono text-[#6B6B6B]">
                    {new Date(subscription.startedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E7E4] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <span>Included Multi-Tenant Features</span>
                  </div>
                  <ul className="text-xs text-[#6B6B6B] space-y-1 list-disc pl-4 leading-relaxed">
                    <li>Unlimited deterministic appointment booking slots</li>
                    <li>7-day custom working schedule configuration</li>
                    <li>Independent tenant data isolation & activity logs</li>
                    <li>Unrestricted business-owner booking cancellations</li>
                  </ul>
                </div>

                {/* Subscription Action */}
                {subscription.status === "active" && (
                  <div className="pt-3 border-t border-[#E7E7E4] flex items-center justify-between">
                    <div className="text-[11px] text-[#6B6B6B]">
                      Cancel subscription to end active billing cycle.
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleCancelSubscription}
                      isLoading={isCancellingSub}
                      leftIcon={<ShieldAlert className="h-3.5 w-3.5" />}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<CreditCard className="h-6 w-6 stroke-[1.5]" />}
                title="No subscription record found"
                description="There is no active subscription record linked to this business."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
