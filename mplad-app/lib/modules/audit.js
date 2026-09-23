'use server';
import db from '../db';

// Canonical actor type codes per architecture spec
const VALID_ACTOR_TYPES = new Set(['MEMBER', 'AUTHORITY', 'OFFICER', 'PUBLIC']);

/**
 * ACTION-AUDIT: append-only, immutable, non-deletable, non-updatable. Minimal facts only.
 * actor_type_code  ∈ {MEMBER, AUTHORITY, OFFICER, PUBLIC}
 * reason_term_id   required only if rejecting a proposal; null otherwise.
 */
export async function appendAuditLog(actor_type_code, affected_identity_id, state_change_code, reason_term_id = null) {
  if (!VALID_ACTOR_TYPES.has(actor_type_code)) {
    throw new Error(`Invalid actor_type_code: '${actor_type_code}'. Must be one of ${[...VALID_ACTOR_TYPES].join(', ')}.`);
  }
  if (!affected_identity_id || typeof affected_identity_id !== 'string') {
    throw new Error('affected_identity_id must be a non-empty string.');
  }
  if (!state_change_code || typeof state_change_code !== 'string') {
    throw new Error('state_change_code must be a non-empty string.');
  }

  return await db.actionAudit.create({
    data: {
      actor_type_code,
      affected_identity_id,
      state_change_code,
      reason_term_id: reason_term_id ?? null,
    },
  });
}
