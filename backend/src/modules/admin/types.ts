import { SafeSubscription } from "../subscriptions/types";

export interface AdminBusinessSummary {
  id: string;
  name: string;
  timezone: string;
  status: "active" | "suspended";
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  subscription: SafeSubscription | null;
  servicesCount: number;
  bookingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStats {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  subscriptionsByStatus: {
    active: number;
    past_due: number;
    cancelled: number;
    suspended: number;
  };
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalUsers: number;
  usersByRole: {
    platform_admin: number;
    business_owner: number;
    customer: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface AdminActivityLogItem {
  id: string;
  businessId: string | null;
  businessName: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  createdAt: string;
}
