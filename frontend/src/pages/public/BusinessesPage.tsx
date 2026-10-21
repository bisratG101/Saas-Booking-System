import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { SafeBusiness } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import {
  Store,
  Clock,
  ArrowRight,
  Search,
  RotateCw,
  X,
  Building,
} from "lucide-react";

export function BusinessesPage() {
  const [businesses, setBusinesses] = useState<SafeBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadBusinesses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Calls actual backend GET /api/v1/businesses
      const res = await api.get<{ businesses: SafeBusiness[] }>("/businesses");
      setBusinesses(res?.businesses || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Failed to load business directory. Please verify server connectivity."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  // Client-side search filtering over backend-loaded businesses
  const filteredBusinesses = useMemo(() => {
    if (!searchQuery.trim()) return businesses;
    const q = searchQuery.toLowerCase().trim();
    return businesses.filter(
      (biz) =>
        biz.name.toLowerCase().includes(q) ||
        biz.timezone.toLowerCase().includes(q)
    );
  }, [businesses, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Directory Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Service Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Browse registered businesses offering scheduled appointments.
          </p>
        </div>

        {/* Retry Button if an error occurred */}
        {error && (
          <Button
            variant="secondary"
            size="sm"
            onClick={loadBusinesses}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
          >
            Retry Loading
          </Button>
        )}
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <Alert
          type="error"
          title="Connection Error"
          message={error}
          className="flex items-center justify-between"
        />
      )}

      {/* Search Bar & Scope Indicator */}
      {!isLoading && !error && businesses.length > 0 && (
        <div className="space-y-1.5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by business name or timezone..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#E7E7E4] bg-white text-xs sm:text-sm text-[#18181B] placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#18181B] p-0.5 rounded"
                aria-label="Clear filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#6B6B6B]">
            Client-side filter searching loaded businesses by exact name or timezone.
            {searchQuery && (
              <span className="font-medium text-[#18181B] ml-1">
                Showing {filteredBusinesses.length} of {businesses.length} result(s).
              </span>
            )}
          </p>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : businesses.length === 0 ? (
        /* Empty State: Zero businesses on platform */
        <EmptyState
          icon={<Store className="h-6 w-6 stroke-[1.5]" />}
          title="No businesses listed yet"
          description="There are currently no active service providers registered on the platform. Registered accounts can set up a business tenant."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={loadBusinesses}
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            >
              Refresh Directory
            </Button>
          }
        />
      ) : filteredBusinesses.length === 0 ? (
        /* Empty State: Search filter yielded zero matches */
        <EmptyState
          icon={<Search className="h-6 w-6 stroke-[1.5]" />}
          title="No matching businesses"
          description={`No registered businesses match your search for "${searchQuery}".`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchQuery("")}
            >
              Clear Filter
            </Button>
          }
        />
      ) : (
        /* Grid of Active Businesses */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBusinesses.map((biz) => (
            <Card
              key={biz.id}
              className="flex flex-col justify-between hover:border-[#D4D4D0] transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center font-bold text-xs text-[#18181B] shrink-0">
                      {biz.name ? biz.name.charAt(0).toUpperCase() : <Building className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-[#18181B] truncate">
                        {biz.name}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-[#6B6B6B] mt-0.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{biz.timezone}</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={biz.status} size="sm" />
                </div>

                <div className="text-[11px] text-[#6B6B6B] pt-1 border-t border-[#F4F4F5]">
                  <span>Listed: </span>
                  <span className="font-mono text-[#18181B]">
                    {new Date(biz.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E7E7E4] flex items-center justify-between">
                <span className="text-[11px] text-[#6B6B6B] font-mono">
                  ID: {biz.id.slice(0, 8)}...
                </span>
                <Link
                  to={`/businesses/${biz.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#18181B] hover:text-[#2563EB] transition-colors"
                >
                  <span>View Details</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
