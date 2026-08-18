/**
 * CEAP Auto-Calculation Utility
 * Derives CEAP classification from clinical findings.
 *
 * NOTE (v2 — normalized schema):
 * - ceap_full is no longer returned; it is computed on-the-fly in API responses
 *   as `${ceap_c}, ${ceap_e}, ${ceap_a}, ${ceap_p}`.
 * - clinical_signs and etiology are no longer stored as Leg columns;
 *   ceap_c and ceap_e are the canonical source of truth.
 * - Ultrasound fields (sfj_reflux, gsv_diameter, etc.) are still accepted as
 *   inputs for computing ceap_a/ceap_p during the assessment submission,
 *   but they are NOT persisted to the Leg table (they live in DopplerImage).
 */

interface CeapInput {
  clinical_signs?: string | null; // JSON array string — used to derive ceap_c
  common_femoral_vein?: string | null;
  superficial_femoral_vein?: string | null;
  popliteal_vein?: string | null;
  sfj_reflux?: boolean;
  gsv_diameter?: number | null;
  gsv_reflux?: boolean;
  ssv_diameter?: number | null;
  ssv_reflux?: boolean;
  incompetent_perforators?: boolean;
  deep_system?: string | null;
  etiology?: string | null; // used to derive ceap_e
}

export interface CeapResult {
  ceap_c: string;
  ceap_e: string;
  ceap_a: string;
  ceap_p: string;
  // ceap_full intentionally removed — compute on-the-fly: `${c}, ${e}, ${a}, ${p}`
}

export function calculateCEAP(input: CeapInput): CeapResult {
  let signs: string[] = [];
  if (input.clinical_signs) {
    try {
      const parsed = JSON.parse(input.clinical_signs);
      signs = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      signs = [input.clinical_signs]; // treat plain string as a single sign
    }
  }

  // ── C class: highest present sign wins ──
  let ceap_c = 'C0';
  if (signs.includes('Telangiectasia'))       ceap_c = 'C1';
  if (signs.includes('Varicose Veins'))       ceap_c = 'C2';
  if (signs.includes('Venous Edema'))         ceap_c = 'C3';
  if (signs.includes('Pigmentation'))         ceap_c = 'C4a';
  if (signs.includes('Lipodermatosclerosis')) ceap_c = 'C4b';
  if (signs.includes('Healed Ulcer'))         ceap_c = 'C5';
  if (signs.includes('Active Ulcer'))         ceap_c = 'C6';

  // ── E class: use explicit etiology if set, else derive ──
  let ceap_e = 'En';
  if (input.etiology) {
    ceap_e = input.etiology;
  } else {
    const hasReflux =
      input.sfj_reflux || input.gsv_reflux || input.ssv_reflux ||
      [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
        .some(v => v && v.includes('Reflux'));
    const hasObstruction =
      [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein, input.deep_system]
        .some(v => v && (v.includes('Obstruction') || v === 'DVT'));

    if (hasReflux && hasObstruction) ceap_e = 'Ep,Es';
    else if (hasReflux)              ceap_e = 'Ep';
    else if (hasObstruction)         ceap_e = 'Es';
  }

  // ── A class: which system is anatomically abnormal ──
  const aParts: string[] = [];
  const gsvAbnormal = (input.gsv_diameter && input.gsv_diameter > 0) || input.gsv_reflux;
  const ssvAbnormal = (input.ssv_diameter && input.ssv_diameter > 0) || input.ssv_reflux;
  if (gsvAbnormal || ssvAbnormal) aParts.push('As');

  const deepAbnormal = [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
    .some(v => v && v !== 'Normal');
  if (deepAbnormal) aParts.push('Ad');

  if (input.incompetent_perforators) aParts.push('Ap');

  const ceap_a = aParts.length ? aParts.join(',') : 'An';

  // ── P class: pathophysiology ──
  const hasRefluxP =
    input.sfj_reflux || input.gsv_reflux || input.ssv_reflux ||
    [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
      .some(v => v && v.includes('Reflux'));
  const hasObstructionP =
    [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein, input.deep_system]
      .some(v => v && (v.includes('Obstruction') || v === 'DVT'));

  let ceap_p = 'Pn';
  if (hasRefluxP && hasObstructionP) ceap_p = 'Pr,o';
  else if (hasRefluxP)               ceap_p = 'Pr';
  else if (hasObstructionP)          ceap_p = 'Po';

  return { ceap_c, ceap_e, ceap_a, ceap_p };
}

/** Convenience helper — compute ceap_full string on-the-fly from stored components */
export function formatCeapFull(ceap_c?: string | null, ceap_e?: string | null, ceap_a?: string | null, ceap_p?: string | null): string {
  return `${ceap_c ?? 'C0'}, ${ceap_e ?? 'En'}, ${ceap_a ?? 'An'}, ${ceap_p ?? 'Pn'}`;
}
