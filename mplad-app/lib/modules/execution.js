'use server';
import db from '../db';
import { appendAuditLog } from './audit';

// Canonical state transition chain — strictly linear, no skipping
const NEXT_STATE = {
  SANCTIONED: 'IN-EXECUTION',
  'IN-EXECUTION': 'COMPLETED',
  COMPLETED: 'UTILISED',
};

// Canonical media type and capture authority codes per architecture spec
const VALID_MEDIA_TYPES = new Set(['PHOTO', 'VIDEO']);
const VALID_CAPTURE_AUTHORITIES = new Set(['OFFICER', 'PUBLIC']);

/**
 * EXECUTION STATE UPDATE: Advances a Work through the strict linear state chain.
 * Chain: SANCTIONED → IN-EXECUTION → COMPLETED → UTILISED
 * No skipping states. No reversal. Every transition creates an immutable audit entry.
 */
export async function updateExecutionState(work_id, requested_new_state) {
  if (!work_id) throw new Error('work_id is required.');

  const work = await db.work.findUnique({ where: { id: work_id } });
  if (!work) throw new Error(`Work not found: ${work_id}`);

  // Enforce strict linear chain — no skipping, no reversal
  const expectedNext = NEXT_STATE[work.status];
  if (!expectedNext) {
    throw new Error(`Work ${work_id} is in terminal state '${work.status}' and cannot be advanced further.`);
  }
  if (requested_new_state !== expectedNext) {
    throw new Error(
      `Invalid state transition for Work ${work_id}: ` +
      `current state is '${work.status}', ` +
      `expected next is '${expectedNext}', ` +
      `but '${requested_new_state}' was requested.`
    );
  }

  const data = { status: requested_new_state };

  const updatedWork = await db.work.update({ where: { id: work_id }, data });
  await appendAuditLog('OFFICER', work_id, requested_new_state);
  return updatedWork;
}

/**
 * APPEND EVIDENCE: Appends immutable geo-tagged media evidence to a Work.
 * Evidence is allowed from SANCTIONED onward.
 * PUBLIC upload allowed — creates no state change, no process trigger, non-authoritative.
 * Validates media_type_code ∈ {PHOTO, VIDEO} and capture_authority_code ∈ {OFFICER, PUBLIC}.
 */
export async function appendEvidence(work_id, media_type_code, geo_latitude, geo_longitude, capture_authority_code, image_path = null) {
  if (!work_id) throw new Error('work_id is required.');

  if (!VALID_MEDIA_TYPES.has(media_type_code)) {
    throw new Error(`Invalid media_type_code: '${media_type_code}'. Must be one of ${[...VALID_MEDIA_TYPES].join(', ')}.`);
  }
  if (!VALID_CAPTURE_AUTHORITIES.has(capture_authority_code)) {
    throw new Error(`Invalid capture_authority_code: '${capture_authority_code}'. Must be one of ${[...VALID_CAPTURE_AUTHORITIES].join(', ')}.`);
  }
  if (typeof geo_latitude !== 'number' || geo_latitude < -90 || geo_latitude > 90) {
    throw new Error('geo_latitude must be a number between -90 and 90.');
  }
  if (typeof geo_longitude !== 'number' || geo_longitude < -180 || geo_longitude > 180) {
    throw new Error('geo_longitude must be a number between -180 and 180.');
  }

  const work = await db.work.findUnique({ where: { id: work_id } });
  if (!work) throw new Error(`Work not found: ${work_id}`);

  // Evidence may be appended from SANCTIONED onward — block only pre-sanction states
  const PRE_SANCTION_STATES = new Set(['PROPOSED', 'SCRUTINISED']);
  if (PRE_SANCTION_STATES.has(work.status)) {
    throw new Error(`Cannot append evidence: Work ${work_id} is in pre-sanction state '${work.status}'.`);
  }

  const crypto = require('crypto');
  const evidence_id = 'E-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  // WORK-EVIDENCE: immutable at creation (no updates ever performed)
  return await db.evidenceSubmission.create({
    data: {
      id: evidence_id,
      work_id,
      image_path: image_path,
      created_at: new Date().toISOString(),
      captured_at: new Date().toISOString(),
      lat: geo_latitude,
      lon: geo_longitude,
      capture_source: capture_authority_code,
      status: 'submitted'
    },
  });
}
