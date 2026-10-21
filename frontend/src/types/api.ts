// Roles supported in the system
export type UserRole = "customer" | "business_owner" | "platform_admin";

// Authenticated user representation
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

// Authentication response
export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: SafeUser;
}

// Standard API Error response from backend
export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

// Business Entity
export interface SafeBusiness {
  id: string;
  ownerId: string;
  name: string;
  timezone: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

// Business Service
export interface SafeService {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Business Hours
export interface SafeBusinessHour {
  id: string;
  businessId: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

// Subscription
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "suspended";

export interface SafeSubscription {
  id: string;
  businessId: string;
  planName: string;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

// Bookings
export type BookingStatus = "confirmed" | "cancelled";

export interface SafeBooking {
  id: string;
  businessId: string;
  customerId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface CreateBookingPayload {
  business_id: string;
  service_id: string;
  start_time: string;
}

export interface CreateServicePayload {
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
  is_active?: boolean;
}

export interface UpdateServicePayload {
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

export interface BusinessHourDayPayload {
  day_of_week: number;
  is_closed: boolean;
  open_time?: string | null;
  close_time?: string | null;
}

export interface SetWeeklyHoursPayload {
  hours: BusinessHourDayPayload[];
}

export interface UpdateBusinessPayload {
  name?: string;
  timezone?: string;
}

// Availability Slot
export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  localStartTime: string;
  localEndTime: string;
}

export interface AvailabilityResponse {
  businessId: string;
  serviceId: string;
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
}

// Platform Admin Views
export interface PlatformStats {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  subscriptionsByStatus: Record<SubscriptionStatus, number>;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
}

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

export interface UpdateSubscriptionPayload {
  plan_name?: string;
  status?: SubscriptionStatus;
}
