export type BookingStatus = "confirmed" | "cancelled";

export interface BookingRecord {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  start_time: Date;
  status: BookingStatus;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
}

export interface SafeBooking {
  id: string;
  businessId: string;
  customerId: string;
  serviceId: string;
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC (startTime + 30m)
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface AvailabilitySlot {
  startTime: string;      // ISO 8601 UTC
  endTime: string;        // ISO 8601 UTC
  localStartTime: string; // HH:MM
  localEndTime: string;   // HH:MM
}

export interface AvailabilityResponse {
  businessId: string;
  serviceId: string;
  date: string;           // YYYY-MM-DD
  timezone: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityBlockRecord {
  id: string;
  business_id: string;
  start_time: Date;
  end_time: Date;
  reason: string | null;
  created_at: Date;
}
