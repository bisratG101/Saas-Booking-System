import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { AdminActivityLogItem, PaginationMeta } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  ArrowLeft,
  ScrollText,
  User,
  Building2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const COMMON_ACTIONS = [
  "BUSINESS_CREATED",
  "BUSINESS_SUSPENDED",
  "BUSINESS_ACTIVATED",
  "BOOKING_CANCELLED",
  "BOOKING_CANCELLED_BY_OWNER",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_CANCELLED",
];

export function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminActivityLogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "15");
      if (actionFilter) params.set("action", actionFilter);

      const res = await api.get<{
        logs: AdminActivityLogItem[];
        pagination: PaginationMeta;
      }>(`/admin/activity-logs?${params.toString()}`);

      setLogs(res.logs || []);
      setPagination(
        res.pagination || {
          page: currentPage,
          limit: 15,
          total: res.logs?.length || 0,
          totalPages: 1,
        }
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to load activity logs.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleActionChange = (action: string) => {
    setActionFilter(action);
    setCurrentPage(1);
  };

  // Helper to format action badges visually
  const getActionBadgeColor = (action: string) => {
    if (action.includes("SUSPENDED") || action.includes("CANCELLED")) {
      return "text-[#DC2626] bg-[#FEE2E2] border-[#FECACA]";
    }
    if (action.includes("ACTIVATED") || action.includes("CREATED")) {
      return "text-[#16A34A] bg-[#DCFCE7] border-[#BBF7D0]";
    }
    return "text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]";
  };

  const getActionIcon = (action: string) => {
    if (action.includes("SUSPENDED")) {
      return <ShieldAlert className="h-3 w-3" />;
    }
    if (action.includes("CANCELLED")) {
      return <XCircle className="h-3 w-3" />;
    }
    if (action.includes("ACTIVATED") || action.includes("CREATED")) {
      return <CheckCircle2 className="h-3 w-3" />;
    }
    return <ScrollText className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin"
              className="text-xs text-[#6B6B6B] hover:text-[#18181B] inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Overview</span>
            </Link>
            <span className="text-xs text-[#6B6B6B]">/</span>
            <span className="text-xs font-semibold text-[#18181B]">Audit Logs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Platform Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Immutable system audit stream tracking tenant lifecycle, bookings, and security events.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchLogs}
          isLoading={isLoading}
          leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Reload
        </Button>
      </div>

      {error && (
        <div className="space-y-3">
          <Alert type="error" message={error} />
          <Button variant="secondary" size="sm" onClick={fetchLogs}>
            Retry Loading Logs
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#6B6B6B]" />
          <label htmlFor="actionFilter" className="text-xs font-semibold text-[#18181B]">
            Filter by Action:
          </label>
          <select
            id="actionFilter"
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#E7E7E4] bg-white focus:outline-hidden focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
          >
            <option value="">All Platform Actions</option>
            {COMMON_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {actionFilter && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleActionChange("")}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Main Logs List */}
      {isLoading ? (
        <SkeletonCard lines={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6 stroke-[1.5]" />}
          title={
            actionFilter
              ? "No events found for this action filter"
              : "No activity recorded"
          }
          description={
            actionFilter
              ? "There are no logged events matching the selected action filter."
              : "The platform audit log is currently clear. Administrative actions will be logged automatically."
          }
          action={
            actionFilter ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleActionChange("")}
              >
                Reset Filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card
          title="Activity Events Stream"
          subtitle={`Showing ${logs.length} of ${pagination.total} total audit records`}
        >
          <div className="divide-y divide-[#E7E7E4]">
            {logs.map((log) => {
              const badgeStyle = getActionBadgeColor(log.action);
              const badgeIcon = getActionIcon(log.action);

              return (
                <div
                  key={log.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-md text-[11px] border ${badgeStyle}`}
                      >
                        {badgeIcon}
                        <span>{log.action}</span>
                      </span>

                      {log.businessName && (
                        <span className="inline-flex items-center gap-1 text-[#18181B] font-semibold">
                          <Building2 className="h-3 w-3 text-[#6B6B6B]" />
                          <span>{log.businessName}</span>
                        </span>
                      )}

                      {log.businessId && (
                        <span className="text-[10px] font-mono text-[#6B6B6B]">
                          (Tenant #{log.businessId.slice(0, 8)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#6B6B6B]">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Actor: {log.actorEmail || "System / Unspecified"}</span>
                      </span>

                      {log.actorUserId && (
                        <span className="font-mono text-[10px]">
                          ID: {log.actorUserId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#6B6B6B] shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pt-4 border-t border-[#E7E7E4] flex items-center justify-between text-xs text-[#6B6B6B]">
              <div>
                Page <span className="font-semibold text-[#18181B]">{pagination.page}</span> of{" "}
                <span className="font-semibold text-[#18181B]">{pagination.totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
