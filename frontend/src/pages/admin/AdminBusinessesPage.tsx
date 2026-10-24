import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type {
  AdminBusinessSummary,
  PaginationMeta,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import {
  ArrowLeft,
  Building2,
  Globe,
  RotateCw,
  Search,
  X,
  CheckCircle2,
  ShieldAlert,
  CreditCard,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Briefcase,
} from "lucide-react";

const ALLOWED_PLANS = ["starter", "pro", "enterprise"];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "active",
  "past_due",
  "cancelled",
  "suspended",
];

export function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<AdminBusinessSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "suspended">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Active item for Modals
  const [selectedBusiness, setSelectedBusiness] = useState<AdminBusinessSummary | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Status Change Confirmation Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatusAction, setTargetStatusAction] = useState<"suspend" | "reactivate" | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Subscription Edit Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subPlanInput, setSubPlanInput] = useState("");
  const [subStatusInput, setSubStatusInput] = useState<SubscriptionStatus>("active");
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "10");
      if (statusFilter) params.set("status", statusFilter);
      if (activeSearch.trim()) params.set("search", activeSearch.trim());

      const res = await api.get<{
        businesses: AdminBusinessSummary[];
        pagination: PaginationMeta;
      }>(`/admin/businesses?${params.toString()}`);

      setBusinesses(res.businesses || []);
      setPagination(
        res.pagination || {
          page: currentPage,
          limit: 10,
          total: res.businesses?.length || 0,
          totalPages: 1,
        }
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to load platform businesses.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, activeSearch]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Handle Search Submission
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setActiveSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setCurrentPage(1);
  };

  // Status Filter Change
  const handleStatusFilterChange = (status: "" | "active" | "suspended") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Open Details Modal
  const handleOpenDetails = async (biz: AdminBusinessSummary) => {
    setSelectedBusiness(biz);
    setDetailsModalOpen(true);
    // Optionally re-fetch single business details to ensure latest state
    try {
      const res = await api.get<{ business: AdminBusinessSummary }>(
        `/admin/businesses/${biz.id}`
      );
      if (res?.business) {
        setSelectedBusiness(res.business);
      }
    } catch {
      // Use existing summary if single-fetch fails
    }
  };

  // Open Status Confirmation Modal
  const handleOpenStatusModal = (
    biz: AdminBusinessSummary,
    action: "suspend" | "reactivate"
  ) => {
    setSelectedBusiness(biz);
    setTargetStatusAction(action);
    setStatusModalOpen(true);
    setActionFeedback(null);
  };

  // Execute Status Change
  const handleConfirmStatusChange = async () => {
    if (!selectedBusiness || !targetStatusAction) return;

    setIsSubmittingStatus(true);
    setActionFeedback(null);

    try {
      const endpoint =
        targetStatusAction === "suspend"
          ? `/admin/businesses/${selectedBusiness.id}/suspend`
          : `/admin/businesses/${selectedBusiness.id}/reactivate`;

      const res = await api.post<{
        business: AdminBusinessSummary;
        message: string;
      }>(endpoint);

      setActionFeedback({
        type: "success",
        message: res.message || `Business ${targetStatusAction}ed successfully.`,
      });

      setStatusModalOpen(false);
      setSelectedBusiness(null);
      setTargetStatusAction(null);
      await fetchBusinesses();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err?.message || `Failed to ${targetStatusAction} business.`,
      });
      setStatusModalOpen(false);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Open Subscription Modal
  const handleOpenSubModal = (biz: AdminBusinessSummary) => {
    setSelectedBusiness(biz);
    setSubPlanInput(biz.subscription?.planName || "starter");
    setSubStatusInput(biz.subscription?.status || "active");
    setSubError(null);
    setSubModalOpen(true);
    setActionFeedback(null);
  };

  // Submit Subscription Change
  const handleSubSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;

    setIsSubmittingSub(true);
    setSubError(null);

    try {
      const payload: UpdateSubscriptionPayload = {
        plan_name: subPlanInput.trim().toLowerCase(),
        status: subStatusInput,
      };

      const res = await api.patch<{ message: string }>(
        `/admin/businesses/${selectedBusiness.id}/subscription`,
        payload
      );

      setActionFeedback({
        type: "success",
        message: res.message || "Subscription updated successfully.",
      });

      setSubModalOpen(false);
      setSelectedBusiness(null);
      await fetchBusinesses();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setSubError(err.message);
      } else {
        setSubError(err?.message || "Failed to update subscription.");
      }
    } finally {
      setIsSubmittingSub(false);
    }
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
            <span className="text-xs font-semibold text-[#18181B]">Tenants</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Platform Tenant Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Global catalog of registered businesses, plan tiers, and administrative status controls.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchBusinesses}
          isLoading={isLoading}
          leftIcon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Reload
        </Button>
      </div>

      {actionFeedback && (
        <div
          className={`flex items-center justify-between gap-2 p-3.5 rounded-lg border text-xs font-medium ${
            actionFeedback.type === "success"
              ? "bg-[#DCFCE7] border-[#BBF7D0] text-[#16A34A]"
              : "bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]"
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5"
            aria-label="Dismiss feedback"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <Alert type="error" message={error} />
          <Button variant="secondary" size="sm" onClick={fetchBusinesses}>
            Retry Loading Tenants
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="inline-flex rounded-lg border border-[#E7E7E4] p-1 bg-white">
          <button
            type="button"
            onClick={() => handleStatusFilterChange("")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === ""
                ? "bg-[#285943] text-white shadow-xs"
                : "text-[#6B6B6B] hover:text-[#18181B]"
            }`}
          >
            All Tenants
          </button>
          <button
            type="button"
            onClick={() => handleStatusFilterChange("active")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "active"
                ? "bg-[#285943] text-white shadow-xs"
                : "text-[#6B6B6B] hover:text-[#18181B]"
            }`}
          >
            Active Only
          </button>
          <button
            type="button"
            onClick={() => handleStatusFilterChange("suspended")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === "suspended"
                ? "bg-[#285943] text-white shadow-xs"
                : "text-[#6B6B6B] hover:text-[#18181B]"
            }`}
          >
            Suspended Only
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6B6B6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business or owner..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-[#E7E7E4] bg-white focus:outline-hidden focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-[#6B6B6B] hover:text-[#18181B]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <SkeletonCard lines={6} />
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6 stroke-[1.5]" />}
          title={
            activeSearch || statusFilter
              ? "No matching tenants found"
              : "No registered tenants"
          }
          description={
            activeSearch || statusFilter
              ? "Try adjusting your search query or status filter to locate tenant organizations."
              : "There are currently no business organizations registered on this platform."
          }
          action={
            activeSearch || statusFilter ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter("");
                  setSearchQuery("");
                  setActiveSearch("");
                  setCurrentPage(1);
                }}
              >
                Reset All Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card
          title="Registered Tenants"
          subtitle={`Showing ${businesses.length} of ${pagination.total} platform organizations`}
        >
          <div className="divide-y divide-[#E7E7E4]">
            {businesses.map((biz) => {
              const isSuspended = biz.status === "suspended";

              return (
                <div
                  key={biz.id}
                  className="py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm text-[#18181B] truncate">
                        {biz.name}
                      </h4>
                      <StatusBadge status={biz.status} size="sm" />
                      {biz.subscription && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#EFEEEB] text-[#18181B] border border-[#E7E7E4] uppercase font-bold">
                          {biz.subscription.planName} ({biz.subscription.status})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#6B6B6B] flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-[#6B6B6B]" />
                        <span>
                          {biz.ownerName} ({biz.ownerEmail})
                        </span>
                      </span>

                      <span>•</span>

                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Globe className="h-3 w-3 text-[#2563EB]" />
                        {biz.timezone}
                      </span>

                      <span>•</span>

                      <span className="font-mono text-[11px] text-[#6B6B6B]">
                        ID: {biz.id.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="text-[11px] text-[#6B6B6B] flex items-center gap-4 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-[#6B6B6B]" />
                        <span>{biz.servicesCount} services</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-[#6B6B6B]" />
                        <span>{biz.bookingsCount} bookings</span>
                      </span>
                      <span className="text-[#6B6B6B]">
                        Registered: {new Date(biz.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenDetails(biz)}
                      leftIcon={<Eye className="h-3.5 w-3.5" />}
                    >
                      Details
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenSubModal(biz)}
                      leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                    >
                      Plan
                    </Button>

                    {isSuspended ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenStatusModal(biz, "reactivate")}
                        leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenStatusModal(biz, "suspend")}
                        leftIcon={<ShieldAlert className="h-3.5 w-3.5" />}
                      >
                        Suspend
                      </Button>
                    )}
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

      {/* 1. View Business Details Modal */}
      {detailsModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E7E4] shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E4]">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#18181B]" />
                <h3 className="font-bold text-lg text-[#18181B]">Tenant Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="p-1 rounded-md text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Business Name</span>
                <span className="font-semibold text-[#18181B]">{selectedBusiness.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Tenant Isolation Key</span>
                <span className="font-mono text-[#18181B]">{selectedBusiness.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Status</span>
                <StatusBadge status={selectedBusiness.status} size="sm" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Timezone</span>
                <span className="font-mono text-[#18181B]">{selectedBusiness.timezone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Owner ID</span>
                <span className="font-mono text-[#6B6B6B]">{selectedBusiness.ownerId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Owner Name</span>
                <span className="font-semibold text-[#18181B]">{selectedBusiness.ownerName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Owner Email</span>
                <span className="font-mono text-[#18181B]">{selectedBusiness.ownerEmail}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Configured Services</span>
                <span className="font-bold text-[#18181B]">{selectedBusiness.servicesCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E7E7E4]">
                <span className="text-[#6B6B6B]">Total Bookings</span>
                <span className="font-bold text-[#18181B]">{selectedBusiness.bookingsCount}</span>
              </div>

              {selectedBusiness.subscription ? (
                <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E7E7E4] space-y-1.5">
                  <div className="font-semibold text-[#18181B] flex items-center justify-between">
                    <span>Subscription Plan</span>
                    <span className="font-mono uppercase font-bold text-[#2563EB]">
                      {selectedBusiness.subscription.planName}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Status</span>
                    <span className="capitalize font-semibold text-[#18181B]">
                      {selectedBusiness.subscription.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Started</span>
                    <span>
                      {new Date(selectedBusiness.subscription.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E7E7E4] text-[#6B6B6B]">
                  No subscription record linked to this tenant.
                </div>
              )}

              <div className="flex justify-between py-1.5 text-[11px] text-[#6B6B6B]">
                <span>Registered Date</span>
                <span>{new Date(selectedBusiness.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E7E4] flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Suspend / Reactivate Confirmation Modal */}
      {statusModalOpen && selectedBusiness && targetStatusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E7E4] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  targetStatusAction === "suspend"
                    ? "bg-[#FEE2E2] text-[#DC2626]"
                    : "bg-[#DCFCE7] text-[#16A34A]"
                }`}
              >
                {targetStatusAction === "suspend" ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base text-[#18181B]">
                  {targetStatusAction === "suspend" ? "Suspend Business Tenant" : "Reactivate Business Tenant"}
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Confirm administrative action for <strong className="text-[#18181B]">{selectedBusiness.name}</strong>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAFAF8] border border-[#E7E7E4] text-xs text-[#6B6B6B] leading-relaxed">
              {targetStatusAction === "suspend" ? (
                <>
                  Suspending this business will immediately mark the tenant as suspended and pause its subscription. Clients will not be able to view availability or book appointments with this business.
                </>
              ) : (
                <>
                  Reactivating this business will restore its active tenant status and reactivate its subscription. Clients will immediately be able to book appointments again based on configured operating hours.
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusModalOpen(false)}
                disabled={isSubmittingStatus}
              >
                Cancel
              </Button>
              <Button
                variant={targetStatusAction === "suspend" ? "danger" : "primary"}
                size="sm"
                onClick={handleConfirmStatusChange}
                isLoading={isSubmittingStatus}
              >
                Confirm {targetStatusAction === "suspend" ? "Suspension" : "Reactivation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Subscription Edit Modal */}
      {subModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E7E4] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E4]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#18181B]" />
                <h3 className="font-bold text-base text-[#18181B]">
                  Update Tenant Subscription
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubModalOpen(false)}
                className="p-1 rounded-md text-[#6B6B6B] hover:text-[#18181B] hover:bg-[#EFEEEB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {subError && <Alert type="error" message={subError} />}

            <form onSubmit={handleSubSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#18181B]">
                  Plan Tier
                </label>
                <select
                  value={subPlanInput}
                  onChange={(e) => setSubPlanInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E7E7E4] bg-white focus:outline-hidden focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                >
                  {ALLOWED_PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#18181B]">
                  Subscription Status
                </label>
                <select
                  value={subStatusInput}
                  onChange={(e) => setSubStatusInput(e.target.value as SubscriptionStatus)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E7E7E4] bg-white focus:outline-hidden focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                >
                  {SUBSCRIPTION_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E7E7E4] text-[11px] text-[#6B6B6B]">
                Updating subscription status directly takes effect immediately for tenant <strong className="text-[#18181B]">{selectedBusiness.name}</strong>.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSubModalOpen(false)}
                  disabled={isSubmittingSub}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmittingSub}
                >
                  Save Subscription
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
