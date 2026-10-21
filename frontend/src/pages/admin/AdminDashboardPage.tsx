import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { PlatformStats } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { KpiCard } from "../../components/ui/KpiCard";
import { SkeletonKpi } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  Building2,
  AlertTriangle,
  Calendar,
  Users,
  ScrollText,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  CheckCircle2,
  XCircle,
  CreditCard,
  UserCheck,
} from "lucide-react";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<PlatformStats>("/admin/stats");
      setStats(res);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to load platform statistics.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Derived metrics from real response
  const totalSubs = stats
    ? stats.subscriptionsByStatus.active +
      stats.subscriptionsByStatus.past_due +
      stats.subscriptionsByStatus.cancelled +
      stats.subscriptionsByStatus.suspended
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Platform Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Global metrics, tenant oversight, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E7E7E4] text-xs font-medium text-[#18181B]">
            <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
            <span>Root Authorization</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchStats}
            isLoading={isLoading}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state with retry action */}
      {error && (
        <div className="space-y-3">
          <Alert type="error" message={error} />
          <Button variant="secondary" size="sm" onClick={fetchStats}>
            Retry Request
          </Button>
        </div>
      )}

      {/* 1. Four Responsive Platform KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Businesses"
            value={stats.totalBusinesses}
            subtitle={`${stats.activeBusinesses} active • ${stats.suspendedBusinesses} suspended`}
            icon={<Building2 className="h-4 w-4" />}
            change={`${stats.activeBusinesses} active`}
            changeType="positive"
          />

          <KpiCard
            title="Suspended Tenants"
            value={stats.suspendedBusinesses}
            subtitle={
              stats.suspendedBusinesses > 0
                ? "Administrative action applied"
                : "All business tenants healthy"
            }
            icon={<AlertTriangle className="h-4 w-4" />}
            change={stats.suspendedBusinesses > 0 ? "Action required" : "Healthy"}
            changeType={stats.suspendedBusinesses > 0 ? "negative" : "positive"}
          />

          <KpiCard
            title="System Bookings"
            value={stats.totalBookings}
            subtitle={`${stats.confirmedBookings} confirmed • ${stats.cancelledBookings} cancelled`}
            icon={<Calendar className="h-4 w-4" />}
            change={
              stats.totalBookings > 0
                ? `${Math.round(
                    (stats.confirmedBookings / stats.totalBookings) * 100
                  )}% confirmed`
                : "No bookings"
            }
            changeType="neutral"
          />

          <KpiCard
            title="Registered Users"
            value={stats.totalUsers}
            subtitle={`${stats.usersByRole.customer} clients • ${stats.usersByRole.business_owner} owners`}
            icon={<Users className="h-4 w-4" />}
            change={`${stats.usersByRole.platform_admin} admins`}
            changeType="neutral"
          />
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="h-6 w-6 stroke-[1.5]" />}
          title="No platform statistics available"
          description="Unable to compute platform metrics. Please verify backend database connectivity."
          action={
            <Button variant="secondary" size="sm" onClick={fetchStats}>
              Retry Connection
            </Button>
          }
        />
      )}

      {/* 2. Real Metric Breakdown Cards */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Subscription Health Breakdown */}
          <Card
            title="Subscription Lifecycle Distribution"
            subtitle="Plan status distribution across registered business tenants"
            headerAction={
              <Link
                to="/admin/businesses"
                className="text-xs font-semibold text-[#18181B] hover:text-[#2563EB] inline-flex items-center gap-1"
              >
                <span>Manage Subscriptions</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="space-y-4 py-1">
              {/* Distribution progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#6B6B6B]">
                  <span>Active Subscriptions Ratio</span>
                  <span className="font-semibold text-[#18181B]">
                    {totalSubs > 0
                      ? `${Math.round(
                          (stats.subscriptionsByStatus.active / totalSubs) * 100
                        )}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#EFEEEB] rounded-full overflow-hidden flex">
                  {totalSubs > 0 && (
                    <>
                      <div
                        className="bg-[#16A34A] h-full transition-all"
                        style={{
                          width: `${(stats.subscriptionsByStatus.active / totalSubs) * 100}%`,
                        }}
                        title={`Active: ${stats.subscriptionsByStatus.active}`}
                      />
                      <div
                        className="bg-[#D97706] h-full transition-all"
                        style={{
                          width: `${(stats.subscriptionsByStatus.past_due / totalSubs) * 100}%`,
                        }}
                        title={`Past Due: ${stats.subscriptionsByStatus.past_due}`}
                      />
                      <div
                        className="bg-[#DC2626] h-full transition-all"
                        style={{
                          width: `${(stats.subscriptionsByStatus.cancelled / totalSubs) * 100}%`,
                        }}
                        title={`Cancelled: ${stats.subscriptionsByStatus.cancelled}`}
                      />
                      <div
                        className="bg-[#71717A] h-full transition-all"
                        style={{
                          width: `${(stats.subscriptionsByStatus.suspended / totalSubs) * 100}%`,
                        }}
                        title={`Suspended: ${stats.subscriptionsByStatus.suspended}`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Status table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Active</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.subscriptionsByStatus.active}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#D97706]">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Past Due</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.subscriptionsByStatus.past_due}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancelled</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.subscriptionsByStatus.cancelled}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#71717A]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Suspended</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.subscriptionsByStatus.suspended}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Platform Bookings & User Roles */}
          <Card
            title="Bookings & Account Composition"
            subtitle="Breakdown of appointment states and user registrations"
          >
            <div className="space-y-4 py-1">
              {/* Booking status split */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#6B6B6B]">
                  <span>Confirmed Bookings Rate</span>
                  <span className="font-semibold text-[#18181B]">
                    {stats.totalBookings > 0
                      ? `${Math.round(
                          (stats.confirmedBookings / stats.totalBookings) * 100
                        )}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#EFEEEB] rounded-full overflow-hidden flex">
                  {stats.totalBookings > 0 && (
                    <>
                      <div
                        className="bg-[#111111] h-full transition-all"
                        style={{
                          width: `${(stats.confirmedBookings / stats.totalBookings) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-[#EF4444] h-full transition-all"
                        style={{
                          width: `${(stats.cancelledBookings / stats.totalBookings) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* User Roles */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Customers</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.usersByRole.customer}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Owners</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.usersByRole.business_owner}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E7E7E4] bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Admins</span>
                  </div>
                  <div className="text-lg font-bold text-[#18181B] mt-1 font-mono">
                    {stats.usersByRole.platform_admin}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 3. Quick Admin Navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link to="/admin/businesses" className="group">
          <Card className="h-full hover:border-[#D4D4D0] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#18181B] group-hover:text-[#2563EB] transition-colors">
                    Tenant Directory & Management
                  </h4>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    Inspect tenant profiles, update subscriptions, and manage business suspension status.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#6B6B6B] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link to="/admin/activity-logs" className="group">
          <Card className="h-full hover:border-[#D4D4D0] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B]">
                  <ScrollText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#18181B] group-hover:text-[#2563EB] transition-colors">
                    Immutable Activity Audit Logs
                  </h4>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    Review administrative audit stream for business creation, role changes, and subscription lifecycle events.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#6B6B6B] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
