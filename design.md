# SaaS Booking System --- Design Decisions (V1)

**Status:** Ready for implementation after the open decisions at the end
are confirmed.\
**Database:** PostgreSQL on Neon\
**Planned application:** React + TypeScript frontend; Node.js + Express
backend; PostgreSQL database\
**Purpose:** A multi-tenant appointment-booking platform for businesses
such as salons, clinics, and consultants.

------------------------------------------------------------------------

## 1. Product scope

The application supports three user roles:

-   **Platform admin:** Manages the platform, views business-level
    statistics, monitors subscription status, and activates or suspends
    businesses.
-   **Business owner:** Registers one business, configures its services
    and working hours, and manages bookings for that business.
-   **Customer:** Uses one global account to browse businesses, book
    appointments, view their own bookings, and cancel eligible bookings.

Businesses share one application and database, but each business's
private data must be isolated from other businesses.

## 2. V1 scope

### Included in V1

-   Customer registration and login.
-   Business-owner registration and self-service business creation.
-   Platform-admin account created through a controlled seed/setup
    script.
-   Business listing and business/service details.
-   Business working hours, configured per weekday.
-   Fixed 30-minute appointment slots.
-   Availability calculation from working hours, existing bookings, and
    availability blocks.
-   Booking creation and customer booking history.
-   Customer cancellation up to and including two hours before
    appointment start.
-   Business-owner booking list and owner cancellation at any time for
    the owner's own business.
-   Business suspension and activation by the platform admin.
-   Basic platform-admin statistics using aggregate business-level data.
-   Subscription plan/status records; no automatic payment processing.
-   Activity logs for important platform/business actions.
-   Backend request validation, authorization, rate limiting for login,
    and configured CORS.
-   Deployment and testing of the complete customer, owner, and admin
    workflows.

### Deferred / non-goals for V1

-   Online payments and automatic subscription billing.
-   Email or SMS notifications.
-   Services that occupy multiple 30-minute slots.
-   Multiple businesses owned by one owner account.
-   Advanced analytics and reporting.
-   A full audit/compliance platform beyond basic activity logs.
-   Automatic refunds, rescheduling workflows, waitlists, recurring
    appointments, and calendar integrations.

Deferred features can be considered after V1; they are not required for
initial release.

## 3. Architecture

-   **Frontend:** React + TypeScript.
-   **Backend:** Node.js + Express REST API.
-   **Database:** PostgreSQL hosted by Neon.
-   **Validation:** Zod for backend request-body validation.
-   **Authentication:** JWT bearer tokens sent in the `Authorization`
    header.
-   **Password storage:** bcrypt password hashes.
-   **Hosting:** Frontend on Vercel and backend on Render, subject to
    final deployment configuration.
-   **Configuration:** Secrets and environment-specific values are
    provided through environment variables, not committed to Git.

The frontend is not a security boundary. All important validation,
authorization, and business rules must be enforced by the backend and,
where appropriate, the database.

## 4. Database organization

Use one PostgreSQL database with two schemas:

-   `platform`: global users, businesses, subscriptions, and platform
    activity logs.
-   `booking`: working hours, services, bookings, and availability
    blocks.

Schemas organize database objects but do not automatically provide
tenant isolation. Tenant isolation must be enforced by backend
authorization and correctly scoped queries.

Use PostgreSQL `UUID` identifiers consistently for primary keys and
corresponding foreign keys.

## 5. Data model

The following eight tables are planned for V1. Exact SQL types,
constraint names, and migration details will be defined in the
migration.

### 5.1 `platform.users`

Stores global user accounts.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `name`
-   `email` (stored in normalized lowercase form and unique)
-   `phone` (nullable unless a final product decision makes it required)
-   `password_hash`
-   `role` (`platform_admin`, `business_owner`, or `customer`)
-   `email_verified_at` (nullable; email verification is not part of the
    initial required flow unless added later)
-   `created_at`
-   `updated_at`

Rules:

-   Never store plaintext passwords.
-   Normalize email before registration and login; enforce
    case-insensitive uniqueness in the database.
-   Public request bodies must not choose a privileged role.
-   The initial platform-admin account is created by a controlled
    seed/setup script.
-   The backend determines the role for each registration workflow.

### 5.2 `platform.businesses`

Stores business identity, ownership, timezone, and status.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `owner_id UUID NOT NULL REFERENCES platform.users(id)`
-   `name`
-   `timezone` (IANA timezone identifier, e.g. `Africa/Addis_Ababa`)
-   `status` (`active` or `suspended`)
-   `created_at`
-   `updated_at`

Rules:

-   V1 permits one business per owner account; enforce this with
    `UNIQUE(owner_id)`.
-   Newly registered businesses are active by default.
-   The business timezone controls the interpretation and display of
    local appointment times.
-   Weekly opening hours are stored in `booking.business_hours`; do not
    duplicate open/close fields in this table.
-   A suspended business is excluded from public listings and cannot
    receive new bookings. Existing booking records remain stored.

### 5.3 `platform.subscriptions`

Stores a business's current plan and subscription status.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NOT NULL REFERENCES platform.businesses(id)`
-   `plan_name`
-   `status` (the exact allowed values must be defined in the migration)
-   `started_at`
-   `current_period_end` (nullable where appropriate)
-   `created_at`
-   `updated_at`

V1 records plan/status information only. Automatic billing and payment
processing are out of scope. For a simple V1, allow at most one current
subscription record per business; if subscription history is required,
model historical records explicitly rather than overwriting them without
a decision.

### 5.4 `platform.activity_logs`

Records important platform and business actions.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NULL REFERENCES platform.businesses(id)` (nullable
    for platform-wide events)
-   `actor_user_id UUID NULL REFERENCES platform.users(id)` (nullable
    for system-generated events)
-   `action`
-   `created_at`

Rules:

-   Do not store passwords, JWTs, secrets, or unnecessary customer
    details.
-   Keep logged details minimal and useful for troubleshooting/auditing.
-   Activity logs are not a replacement for security controls.

### 5.5 `booking.business_hours`

Stores each business's schedule for each weekday.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NOT NULL REFERENCES platform.businesses(id)`
-   `day_of_week` (1--7, with 1 = Monday and 7 = Sunday)
-   `open_time TIME NULL`
-   `close_time TIME NULL`
-   `is_closed BOOLEAN NOT NULL DEFAULT FALSE`

Rules:

-   Enforce one row per business per weekday with
    `UNIQUE(business_id, day_of_week)`.
-   Validate `day_of_week` is between 1 and 7.
-   If `is_closed = TRUE`, opening/closing times may be null.
-   If open, require valid opening and closing times, with closing later
    than opening. Overnight opening hours are not supported in V1 unless
    explicitly added later.

### 5.6 `booking.services`

Stores services offered by each business.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NOT NULL REFERENCES platform.businesses(id)`
-   `name`
-   `description` (nullable)
-   `duration_minutes` (must be 30 for active bookable services in V1)
-   `price NUMERIC(10,2)`
-   `is_active BOOLEAN NOT NULL DEFAULT TRUE`
-   `created_at`
-   `updated_at`

Rules:

-   A service belongs to exactly one business.
-   Price must be non-negative.
-   V1 uses fixed 30-minute slots. A service must not be bookable unless
    it fits this model; for V1, enforce `duration_minutes = 30`.
-   Owners may deactivate services; historical bookings referencing a
    service should remain valid.

### 5.7 `booking.bookings`

Stores appointments.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NOT NULL REFERENCES platform.businesses(id)`
-   `customer_id UUID NOT NULL REFERENCES platform.users(id)`
-   `service_id UUID NOT NULL`
-   `start_time TIMESTAMPTZ NOT NULL`
-   `status` (`confirmed` or `cancelled`)
-   `created_at`
-   `updated_at`
-   `cancelled_at` (nullable)

Rules:

-   The customer identity is derived from the authenticated user; do not
    trust a client-supplied `customer_id`.

-   Owner operations must be scoped to the owner's authorized business.

-   A booking must reference a service belonging to the same business.
    Enforce this with a composite foreign key: `UNIQUE(id, business_id)`
    on services and `FOREIGN KEY (service_id, business_id)` on bookings.

-   In V1, each booking occupies one 30-minute slot. The end time is
    `start_time + 30 minutes`.

-   `start_time` must be in the future and no more than 30 days ahead,
    using a clearly defined rolling-window boundary.

-   The business must be active, the service active, and the appointment
    must fit within working hours and not overlap an availability block.

-   Use a database unique partial index to prevent more than one
    confirmed booking for the same business and start time, for example:

    ``` sql
    CREATE UNIQUE INDEX unique_active_booking_slot
    ON booking.bookings (business_id, start_time)
    WHERE status = 'confirmed';
    ```

-   This index prevents duplicate confirmed bookings for the same
    business/start time. The backend must also validate slot alignment
    and availability. Because V1 uses exactly 30-minute slots,
    mixed-duration overlap handling is not required.

-   Cancellation changes the status to `cancelled`; do not delete the
    row. A cancelled booking no longer occupies the slot under the
    partial index.

-   Only confirmed bookings may be cancelled. Repeated cancellation
    should be handled consistently and safely.

### 5.8 `booking.availability_blocks`

Stores periods when a business cannot accept bookings, such as holidays
or temporary closures.

Planned fields:

-   `id UUID PRIMARY KEY`
-   `business_id UUID NOT NULL REFERENCES platform.businesses(id)`
-   `start_time TIMESTAMPTZ NOT NULL`
-   `end_time TIMESTAMPTZ NOT NULL`
-   `reason` (nullable)
-   `created_at`

Rules:

-   Require `end_time > start_time`.
-   A booking is invalid if its interval overlaps an availability block.
-   Only the authorized owner of the business can create, update, or
    remove its blocks.
-   Although blocks are included in V1, they are not a replacement for
    normal weekly working hours.

## 6. Roles and permissions

### Platform admin

Can:

-   View business-level statistics and aggregate activity.
-   View business and subscription status.
-   Activate or suspend businesses.
-   View necessary platform operational data.

Should not receive customer personal data by default. Admin statistics
should return aggregate counts or business-level information unless a
specific operational need justifies more access.

The platform-admin account is created through a controlled seed/setup
process. Public registration cannot create an admin.

### Business owner

Can:

-   Manage their own business information.
-   Configure their own weekly working hours.
-   Create, update, and deactivate their own services.
-   Create and manage availability blocks for their business.
-   View bookings for their business.
-   Cancel bookings for their business at any time, subject to booking
    state.
-   View only the customer information necessary for bookings at their
    own business.

Cannot access or modify another business's private data.

### Customer

Can:

-   Register and log in.
-   Browse active businesses and their active services.
-   View available appointment slots.
-   Create bookings for themselves.
-   View their own bookings.
-   Cancel their own confirmed bookings at least two hours before
    appointment start.

Cannot view or modify another customer's bookings.

## 7. Authentication and authorization

-   Use bcrypt to hash passwords.
-   Issue JWT bearer tokens with a one-hour lifetime in V1; refresh
    tokens are out of scope.
-   Verify JWT signature, expiration, and required claims on protected
    endpoints.
-   Treat the verified token subject as the authenticated user's
    identity; do not trust user IDs sent in request bodies.
-   For sensitive owner operations, load the user's current role and
    authorized business from database records as appropriate.
-   Derive the owner's `business_id` from the authenticated user and
    database, not from a request body or query parameter.
-   Every business-specific query must be scoped to the authorized
    `business_id`.
-   A valid login does not grant permission to access every resource.
-   Return appropriate errors for unauthenticated, unauthorized,
    missing, or invalid resources without leaking another tenant's data.

## 8. Booking and availability rules

1.  Generate possible slots from business working hours; do not store
    every possible slot as a database row.
2.  Use the business's timezone when interpreting local schedules and
    displaying appointment times.
3.  Store actual appointment instants as `TIMESTAMPTZ`.
4.  In V1, each appointment occupies one 30-minute slot.
5.  Reject appointment times in the past or beyond the 30-day booking
    window.
6.  Reject appointments outside working hours.
7.  Reject appointments overlapping availability blocks.
8.  Reject bookings for suspended businesses or inactive services.
9.  Verify that the selected service belongs to the selected business.
10. Check availability in the backend, but rely on the database unique
    index as the final protection against concurrent duplicate bookings.
11. Handle a unique-index conflict gracefully and tell the customer the
    slot is no longer available.
12. Customers can cancel their own confirmed booking when at least two
    hours remain before its start time, including exactly two hours.
13. Owners can cancel confirmed bookings belonging to their own business
    at any time.
14. Keep cancelled booking records; cancelled bookings no longer reserve
    the slot.

## 9. API design principles

The API will be a REST API. Exact endpoint paths and response formats
will be documented during implementation.

Initial endpoint groups:

-   Authentication: register and login.
-   Businesses: list active businesses, retrieve public business
    details, register a business, and manage an owned business.
-   Services: list active services and owner-managed service CRUD.
-   Working hours: retrieve and update a business's weekly hours.
-   Availability: retrieve available slots for a business/date.
-   Bookings: create bookings, list the authenticated customer's
    bookings, list an owner's business bookings, and cancel an
    authorized booking.
-   Subscriptions: retrieve/manage the relevant business plan/status as
    permitted.
-   Admin: aggregate statistics, list/manage businesses, and
    activate/suspend a business.

Use the authenticated user's identity for customer actions. Do not
accept a customer ID from the client as the authority for whose bookings
to return.

## 10. Validation and security

-   Use Zod to validate relevant backend request bodies.
-   Validate path/query parameters as well as request bodies where
    appropriate.
-   Use parameterized database queries or a safe query builder/ORM; do
    not concatenate untrusted input into SQL.
-   Rate-limit login attempts.
-   Configure CORS with allowed origins from environment variables.
-   Store secrets in environment variables; never commit credentials to
    the repository.
-   Do not expose password hashes, JWTs, or secrets in API responses or
    activity logs.
-   Apply authorization checks on every protected endpoint, including
    direct API requests.
-   Enforce critical invariants in the database as well as in
    application code where possible.

## 11. Time and timezone handling

-   Store booking instants and availability-block instants as
    `TIMESTAMPTZ`.
-   Store a valid IANA timezone identifier on each business.
-   Interpret weekly `TIME` working hours in that business's timezone.
-   Generate slots in local business time, then convert them to actual
    instants for storage and comparison.
-   Return timestamps with timezone information in API responses.
-   The initial deployment and testing should include
    `Africa/Addis_Ababa`, while the data model remains able to represent
    other valid IANA timezones.

## 12. Subscription and suspension behavior

-   Subscription records track plan and status; automatic payments are
    not included in V1.
-   Admins can inspect subscription status and business-level
    information.
-   Suspending a business hides it from public listings and rejects new
    bookings.
-   Existing bookings are retained.
-   The exact treatment of existing appointments after suspension (for
    example, whether the owner/customer can still view or cancel them)
    should be consistent and documented before that workflow is
    implemented.

## 13. Activity logging

Record important events such as:

-   Business registered.
-   Business activated or suspended.
-   Service created, updated, or deactivated.
-   Working hours changed.
-   Availability block created or removed.
-   Booking created or cancelled.
-   Subscription status changed.

Logs should include only the minimum information needed to identify the
action, actor, relevant business, and time. Never log passwords, tokens,
or unnecessary customer personal data.

## 14. Testing requirements

Before V1 is considered complete, test:

### Database

-   All tables and relationships are created by migrations.
-   An owner cannot own more than one business in V1.
-   A booking cannot reference a service belonging to a different
    business.
-   Two confirmed bookings cannot occupy the same business/start time.
-   Cancelling a booking frees the slot.

### Authentication and authorization

-   Invalid credentials are rejected.
-   Expired or invalid JWTs are rejected.
-   Public registration cannot assign `platform_admin`.
-   Customers can only retrieve their own bookings.
-   Owners can only manage their own business's resources.
-   Admin endpoints reject non-admin users.

### Booking

-   Booking outside working hours is rejected.
-   Booking during an availability block is rejected.
-   Past and out-of-window bookings are rejected.
-   Inactive services and suspended businesses cannot receive new
    bookings.
-   Customer cancellation at exactly two hours is permitted;
    cancellation after the deadline is rejected.
-   Concurrent requests for the same slot result in at most one
    confirmed booking.

### Platform and integration

-   Admin statistics do not unnecessarily expose customer personal data.
-   CORS permits configured origins.
-   Login rate limiting works.
-   The frontend's main customer, owner, and admin workflows work
    against the deployed API.

## 15. Environment and deployment

Planned deployment:

-   Frontend: Vercel.
-   Backend: Render.
-   Database: Neon PostgreSQL.

Use environment variables for database connection strings, JWT signing
secrets, and allowed frontend origins. Keep development and production
configuration separate. Never commit production secrets.

A deployment is not complete until the deployed application has been
tested against the production configuration and database.

## 16. Definition of done for V1

V1 is complete when:

-   The database migration runs successfully.
-   Required constraints and indexes are verified.
-   All required API endpoints are implemented and tested.
-   Authentication, authorization, and tenant isolation are enforced.
-   Customer booking and cancellation workflows work.
-   Owner business-management workflows work.
-   Admin statistics and business activation/suspension work.
-   Subscription status and activity logging work.
-   The frontend is integrated with the backend.
-   Important success and failure cases pass automated or repeatable
    tests.
-   The application is deployed and its main workflows have been
    verified.
-   A README explains setup, environment variables, architecture, and
    how to run tests.

------------------------------------------------------------------------

## 17. Remaining decisions to confirm

These are the small number of product/implementation details that are
not completely determined by the current decisions. Recommended defaults
are included so implementation can proceed without reopening the entire
architecture.

  -----------------------------------------------------------------------
  Open detail                         Recommended V1 default
  ----------------------------------- -----------------------------------
  Can one person both own a business  Keep one role per account in V1. If
  and book as a customer using the    owners must also book as customers,
  same account?                       decide on a multi-role/permissions
                                      model before implementing role
                                      checks.

  Is customer phone required?         Store `phone` as nullable
                                      initially; require it only if the
                                      booking workflow genuinely needs
                                      it. Owners may see it only for
                                      customers booking at their own
                                      business.

  What exact subscription statuses    Start with `active`, `past_due`,
  are allowed?                        `cancelled`, and `suspended` only
                                      if those states are needed;
                                      otherwise choose a smaller
                                      documented set. No automatic
                                      billing in V1.

  How is the 30-day booking boundary  Use a rolling window from the
  calculated?                         current instant through 30 days
                                      ahead; document whether the exact
                                      upper boundary is inclusive.

  What happens to existing bookings   Keep the records; allow authorized
  when a business is suspended?       users to view them. Owner
                                      cancellation remains allowed.
                                      Customer cancellation follows the
                                      normal two-hour rule unless a
                                      different suspension policy is
                                      explicitly chosen.

  How are service prices represented? Use `NUMERIC(10,2)` and define the
                                      currency used by the platform
                                      (recommended: ETB for the initial
                                      market).

  Does V1 require email verification  Keep both out of the initial
  or password reset?                  booking flow unless required for
                                      launch; do not claim email
                                      verification is implemented if it
                                      is not.

  What does "business activation"     Admin can change a business between
  mean when new businesses are active `active` and `suspended`; no
  by default?                         separate pending-approval state in
                                      V1.

  What exact admin statistics are     Start with total businesses, active
  required?                           businesses, suspended businesses,
                                      and counts by subscription status.
                                      Do not include customer-level
                                      personal data.

  Are overnight business hours        No, not in V1. Closing time must be
  supported?                          later than opening time on the same
                                      local day.
  -----------------------------------------------------------------------

**Implementation rule:** Confirm or accept these defaults, then freeze
the design. Reopen a decision only when a real implementation or test
demonstrates a problem.
