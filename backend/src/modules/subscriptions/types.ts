export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "suspended";

export interface SubscriptionRecord {
  id: string;
  business_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
}

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
