/**
 * CEAP Auto-Calculation Utility
 * Derives CEAP classification from clinical findings
 */

interface CeapInput {
  clinical_signs?: string | null;           // JSON array string
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
  etiology?: string | null;
}

export interface CeapResult {
  ceap_c: string;
  ceap_e: string;
  ceap_a: string;
  ceap_p: string;
  ceap_full: string;
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
  let ceap_c = "C0";
  if (signs.includes("Telangiectasia"))       ceap_c = "C1";
  if (signs.includes("Varicose Veins"))       ceap_c = "C2";
  if (signs.includes("Venous Edema"))         ceap_c = "C3";
  if (signs.includes("Pigmentation"))         ceap_c = "C4a";
  if (signs.includes("Lipodermatosclerosis")) ceap_c = "C4b";
  if (signs.includes("Healed Ulcer"))         ceap_c = "C5";
  if (signs.includes("Active Ulcer"))         ceap_c = "C6";

  // ── E class: use explicit etiology if set, else derive ──
  let ceap_e = "En";
  if (input.etiology) {
    ceap_e = input.etiology;
  } else {
    const hasReflux = input.sfj_reflux || input.gsv_reflux || input.ssv_reflux ||
      [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
        .some(v => v && v.includes("Reflux"));
    const hasObstruction =
      [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein, input.deep_system]
        .some(v => v && (v.includes("Obstruction") || v === "DVT"));

    if (hasReflux && hasObstruction) ceap_e = "Ep,Es";
    else if (hasReflux) ceap_e = "Ep";
    else if (hasObstruction) ceap_e = "Es";
  }

  // ── A class: which system is abnormal ──
  const aParts: string[] = [];
  const gsvAbnormal = (input.gsv_diameter && input.gsv_diameter > 0) || input.gsv_reflux;
  const ssvAbnormal = (input.ssv_diameter && input.ssv_diameter > 0) || input.ssv_reflux;
  if (gsvAbnormal || ssvAbnormal) aParts.push("As");

  const deepAbnormal = [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
    .some(v => v && v !== "Normal");
  if (deepAbnormal) aParts.push("Ad");

  if (input.incompetent_perforators) aParts.push("Ap");

  const ceap_a = aParts.length ? aParts.join(",") : "An";

  // ── P class: pathophysiology ──
  const hasRefluxP = input.sfj_reflux || input.gsv_reflux || input.ssv_reflux ||
    [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein]
      .some(v => v && v.includes("Reflux"));
  const hasObstructionP =
    [input.common_femoral_vein, input.superficial_femoral_vein, input.popliteal_vein, input.deep_system]
      .some(v => v && (v.includes("Obstruction") || v === "DVT"));

  let ceap_p = "Pn";
  if (hasRefluxP && hasObstructionP) ceap_p = "Pr,o";
  else if (hasRefluxP) ceap_p = "Pr";
  else if (hasObstructionP) ceap_p = "Po";

  const ceap_full = `${ceap_c}, ${ceap_e}, ${ceap_a}, ${ceap_p}`;

  return { ceap_c, ceap_e, ceap_a, ceap_p, ceap_full };
}
