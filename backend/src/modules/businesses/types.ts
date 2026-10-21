export interface BusinessRecord {
  id: string;
  owner_id: string;
  name: string;
  timezone: string;
  status: "active" | "suspended";
  created_at: Date;
  updated_at: Date;
}

export interface SafeBusiness {
  id: string;
  ownerId: string;
  name: string;
  timezone: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: string | number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

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

export interface BusinessHourRecord {
  id: string;
  business_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface SafeBusinessHour {
  id: string;
  businessId: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}
