import { query } from "../../db";
import { CreateServiceInput, UpdateServiceInput } from "./schemas";
import { ServiceRecord, SafeService } from "./types";

export class ServiceNotFoundError extends Error {
  constructor(message = "Service not found") {
    super(message);
    this.name = "ServiceNotFoundError";
  }
}

function mapToSafeService(row: ServiceRecord): SafeService {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    durationMinutes: Number(row.duration_minutes),
    price: Number(row.price),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Creates a service for the authenticated business.
 * Strictly enforces business_id scoping and 30-minute duration.
 */
export async function createService(
  businessId: string,
  input: CreateServiceInput
): Promise<SafeService> {
  const result = await query<ServiceRecord>(
    `INSERT INTO booking.services (business_id, name, description, duration_minutes, price, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at;`,
    [
      businessId,
      input.name.trim(),
      input.description ? input.description.trim() : null,
      input.duration_minutes ?? 30,
      input.price,
      input.is_active ?? true,
    ]
  );

  return mapToSafeService(result.rows[0]);
}

/**
 * Lists all services belonging to the authenticated business.
 */
export async function listServicesByBusinessId(businessId: string): Promise<SafeService[]> {
  const result = await query<ServiceRecord>(
    `SELECT id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at
     FROM booking.services
     WHERE business_id = $1
     ORDER BY created_at ASC;`,
    [businessId]
  );

  return result.rows.map(mapToSafeService);
}

/**
 * Lists public active services for a given business ID.
 * Returns only services where is_active = true.
 */
export async function listActiveServicesByBusinessId(businessId: string): Promise<SafeService[]> {
  const result = await query<ServiceRecord>(
    `SELECT id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at
     FROM booking.services
     WHERE business_id = $1 AND is_active = true
     ORDER BY name ASC;`,
    [businessId]
  );

  return result.rows.map(mapToSafeService);
}

/**
 * Retrieves a single service by ID scoped to the authenticated business.
 */
export async function getServiceById(
  businessId: string,
  serviceId: string
): Promise<SafeService | null> {
  const result = await query<ServiceRecord>(
    `SELECT id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at
     FROM booking.services
     WHERE business_id = $1 AND id = $2;`,
    [businessId, serviceId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapToSafeService(result.rows[0]);
}

/**
 * Updates a service scoped to the authenticated business.
 */
export async function updateService(
  businessId: string,
  serviceId: string,
  input: UpdateServiceInput
): Promise<SafeService> {
  const hasDescription = input.description !== undefined;

  const result = await query<ServiceRecord>(
    `UPDATE booking.services
     SET
       name = COALESCE($1, name),
       description = CASE WHEN $2::boolean THEN $3 ELSE description END,
       price = COALESCE($4, price),
       is_active = COALESCE($5, is_active),
       updated_at = NOW()
     WHERE business_id = $6 AND id = $7
     RETURNING id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at;`,
    [
      input.name ? input.name.trim() : null,
      hasDescription,
      hasDescription ? (input.description ? input.description.trim() : null) : null,
      input.price !== undefined ? input.price : null,
      input.is_active !== undefined ? input.is_active : null,
      businessId,
      serviceId,
    ]
  );

  if (result.rows.length === 0) {
    throw new ServiceNotFoundError();
  }

  return mapToSafeService(result.rows[0]);
}

/**
 * Soft-deactivates a service (sets is_active = false).
 * Historical bookings referring to this service remain intact.
 */
export async function deactivateService(
  businessId: string,
  serviceId: string
): Promise<SafeService> {
  const result = await query<ServiceRecord>(
    `UPDATE booking.services
     SET is_active = FALSE, updated_at = NOW()
     WHERE business_id = $1 AND id = $2
     RETURNING id, business_id, name, description, duration_minutes, price, is_active, created_at, updated_at;`,
    [businessId, serviceId]
  );

  if (result.rows.length === 0) {
    throw new ServiceNotFoundError();
  }

  return mapToSafeService(result.rows[0]);
}
