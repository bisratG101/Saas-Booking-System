-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Creates the platform and booking schemas, tables, constraints,
--              and concurrency indexes per design.md (V1 Scope).
-- ============================================================================

-- Enable pgcrypto extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Schemas
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS booking;

-- ----------------------------------------------------------------------------
-- 2. platform.users
-- Stores global user accounts across all roles.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('platform_admin', 'business_owner', 'customer')),
  email_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce case-insensitive email uniqueness
CREATE UNIQUE INDEX users_email_lower_unique ON platform.users (LOWER(email));

-- ----------------------------------------------------------------------------
-- 3. platform.businesses
-- Stores business entities owned by business owners.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT businesses_owner_id_unique UNIQUE (owner_id)
);

-- ----------------------------------------------------------------------------
-- 4. platform.subscriptions
-- Tracks subscription status and plan name for each business.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES platform.businesses(id) ON DELETE CASCADE,
  plan_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'suspended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_business_id_unique UNIQUE (business_id)
);

-- ----------------------------------------------------------------------------
-- 5. platform.activity_logs
-- Records significant audit and operational events.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NULL REFERENCES platform.businesses(id) ON DELETE SET NULL,
  actor_user_id UUID NULL REFERENCES platform.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_logs_business_id_idx ON platform.activity_logs(business_id);
CREATE INDEX activity_logs_actor_user_id_idx ON platform.activity_logs(actor_user_id);

-- ----------------------------------------------------------------------------
-- 6. booking.business_hours
-- Configures weekly working hours per weekday (1=Monday to 7=Sunday).
-- ----------------------------------------------------------------------------
CREATE TABLE booking.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES platform.businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  open_time TIME NULL,
  close_time TIME NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT business_hours_unique_day UNIQUE (business_id, day_of_week),
  CONSTRAINT check_business_hours_validity CHECK (
    (is_closed = TRUE) OR 
    (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)
  )
);

-- ----------------------------------------------------------------------------
-- 7. booking.services
-- Stores bookable services offered by businesses (fixed 30 min in V1).
-- ----------------------------------------------------------------------------
CREATE TABLE booking.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES platform.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes = 30),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT services_id_business_id_unique UNIQUE (id, business_id)
);

CREATE INDEX services_business_id_idx ON booking.services(business_id);

-- ----------------------------------------------------------------------------
-- 8. booking.bookings
-- Stores customer appointments with strict tenant consistency and concurrency protection.
-- ----------------------------------------------------------------------------
CREATE TABLE booking.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES platform.businesses(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ NULL,
  -- Foreign key ensuring the booked service belongs to the exact same business
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id, business_id) 
    REFERENCES booking.services(id, business_id) ON DELETE RESTRICT,
  -- Ensures cancellation timestamp is maintained consistently with status
  CONSTRAINT check_cancellation_consistency CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (status = 'confirmed' AND cancelled_at IS NULL)
  )
);

-- Critical concurrency control: prevents double-booking for the same business slot
CREATE UNIQUE INDEX unique_active_booking_slot
  ON booking.bookings (business_id, start_time)
  WHERE status = 'confirmed';

CREATE INDEX bookings_customer_id_idx ON booking.bookings(customer_id);
CREATE INDEX bookings_business_start_time_idx ON booking.bookings(business_id, start_time);

-- ----------------------------------------------------------------------------
-- 9. booking.availability_blocks
-- Stores periods when a business cannot accept bookings (e.g. holidays).
-- ----------------------------------------------------------------------------
CREATE TABLE booking.availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES platform.businesses(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_block_time_order CHECK (end_time > start_time)
);

CREATE INDEX availability_blocks_business_time_idx 
  ON booking.availability_blocks(business_id, start_time, end_time);
