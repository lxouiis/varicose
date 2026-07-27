/**
 * rVCSS Total Calculation
 * Sum of all 10 rVCSS parameters (each 0–3, max total = 30)
 */

export interface RvcssInput {
  pain: number;
  varicose_veins: number;
  edema: number;
  pigmentation: number;
  inflammation: number;
  induration: number;
  ulcer_count: number;
  ulcer_duration: number;
  ulcer_size: number;
  compression: number;
}

export function calculateRvcss(input: RvcssInput): number {
  return (
    (input.pain || 0) +
    (input.varicose_veins || 0) +
    (input.edema || 0) +
    (input.pigmentation || 0) +
    (input.inflammation || 0) +
    (input.induration || 0) +
    (input.ulcer_count || 0) +
    (input.ulcer_duration || 0) +
    (input.ulcer_size || 0) +
    (input.compression || 0)
  );
}
