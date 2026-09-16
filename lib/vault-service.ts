'use server';

import { createClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type DigitalUnitSecretVersion = {
  secret_version_id: string;
  digital_inventory_unit_id: string;
  version_no: number;
  version_status: 'current' | 'retired' | 'revoked';
  vault_secret_id: string;
};

/**
 * Server-only write boundary for creating/replacing a unit secret.
 *
 * This module is intentionally not imported by client components. It never
 * logs or returns the plaintext value. Vault uses the project's default
 * encryption key through the database boundary; no custom key is accepted
 * from application configuration.
 */
export async function createOrReplaceDigitalUnitSecret(input: {
  digitalInventoryUnitId: string;
  secret: string;
  replacementIdempotencyKey: string;
  actor?: string;
}): Promise<DigitalUnitSecretVersion> {
  if (!isUuid(input.digitalInventoryUnitId)) throw new Error('Invalid digital unit');
  if (!input.secret || input.secret.length > 100000) throw new Error('Invalid secret');
  if (!input.replacementIdempotencyKey || input.replacementIdempotencyKey.length > 255) {
    throw new Error('Invalid idempotency key');
  }

  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, serviceRoleKey);
  const { data, error } = await admin.rpc('create_or_replace_digital_unit_secret', {
    p_digital_inventory_unit_id: input.digitalInventoryUnitId,
    p_new_secret: input.secret,
    // Kept null for compatibility with the existing RPC signature. The
    // forward migration intentionally ignores this deprecated parameter.
    p_key_id: null,
    p_replacement_idempotency_key: input.replacementIdempotencyKey,
    p_actor: input.actor || 'server',
  });

  if (error || !Array.isArray(data) || data.length !== 1) {
    // Deliberately do not include the Supabase error: it could contain query
    // details, and this function must never echo secret-bearing context.
    throw new Error('Vault secret operation failed');
  }

  return data[0] as DigitalUnitSecretVersion;
}

export async function getDigitalUnitSecretForSession(input: {
  orderId: string;
  allocationId: string;
  sessionId: string;
}): Promise<string> {
  if (!isUuid(input.orderId) || !isUuid(input.allocationId) || !isUuid(input.sessionId)) {
    throw new Error('Invalid digital delivery request');
  }

  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, serviceRoleKey);
  const { data, error } = await admin.rpc('get_digital_unit_secret_for_session', {
    p_order_id: input.orderId,
    p_allocation_id: input.allocationId,
    p_session_id: input.sessionId,
  });

  if (error || typeof data !== 'string' || data.length === 0) {
    throw new Error('Digital delivery is not authorized');
  }

  return data;
}
