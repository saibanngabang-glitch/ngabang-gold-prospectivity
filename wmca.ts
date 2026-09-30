// Weighted Multi-Criteria Analysis (WMCA) baseline.
// Pure and deterministic: no randomness, no hidden defaults, no fabricated values.

export type Directionality = "HIGHER_IS_MORE_PROSPECTIVE" | "LOWER_IS_MORE_PROSPECTIVE";
export type ScoreStatus = "CALCULATED" | "INCOMPLETE_SCORE" | "NOT_CALCULABLE";

export interface ModelConfig {
  modelVersion: string;
  weightStatus: string; // e.g. "INITIAL MODEL PARAMETER"
  validationStatus: string; // e.g. "UNVALIDATED MODEL"
  missingDataStrategy: string; // "RENORMALIZE_AVAILABLE_EVIDENCE"
  minCompleteness: number; // share of nominal weight that must have evidence
  criteria: { id: string; weight: number }[];
}

export interface Contribution {
  criterion: string;
  status: "AVAILABLE" | "MISSING";
  normalized: number | null; // MODEL: normalized feature value in [0,1]
  nominalWeight: number; // ASSUMPTION: configured weight
  effectiveWeight: number | null; // ASSUMPTION after missing-data strategy
  contribution: number | null; // RESULT: normalized x effectiveWeight (0..1 scale)
  reason?: "NO DATA" | "INVALID VALUE";
}

export interface ScoreResult {
  modelVersion: string;
  status: ScoreStatus;
  score: number | null; // 0..100 model index. NOT a probability of gold.
  completeness: number; // share of nominal weight backed by valid evidence (0..1)
  labels: string[];
  contributions: Contribution[];
}

const EPS = 1e-9;

export function validateWeights(criteria: ModelConfig["criteria"]): void {
  if (criteria.length === 0) throw new Error("No criteria defined");
  let sum = 0;
  for (const c of criteria) {
    if (!Number.isFinite(c.weight) || c.weight < 0) throw new Error(`Invalid weight for ${c.id}`);
    sum += c.weight;
  }
  if (Math.abs(sum - 1) > EPS) throw new Error(`Weights must sum to 1, got ${sum}`);
}

/** Min-max normalization to [0,1]. Returns null (never 0) when input is unusable. */
export function normalizeMinMax(
  value: number | null | undefined,
  min: number,
  max: number,
  direction: Directionality,
): number | null {
  if (typeof value !== "number" || ![value, min, max].every(Number.isFinite) || max <= min) return null;
  const n = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return direction === "HIGHER_IS_MORE_PROSPECTIVE" ? n : 1 - n;
}

/** inputs: already-normalized criterion values in [0,1]; null/undefined/NaN/out-of-range = MISSING. */
export function computeScore(
  config: ModelConfig,
  inputs: Record<string, number | null | undefined>,
): ScoreResult {
  validateWeights(config.criteria);

  const rows = config.criteria.map((c) => {
    const v = inputs[c.id];
    const ok = typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
    return { c, v: ok ? v : null, reason: ok ? undefined : v == null ? ("NO DATA" as const) : ("INVALID VALUE" as const) };
  });

  const availableWeight = rows.reduce((s, r) => (r.v === null ? s : s + r.c.weight), 0);
  const completeness = Math.min(1, availableWeight); // nominal weights sum to 1 (validated above)
  const calculable = availableWeight > 0 && completeness + EPS >= config.minCompleteness;

  const contributions: Contribution[] = rows.map(({ c, v, reason }) => {
    const eff = calculable && v !== null ? c.weight / availableWeight : null;
    return {
      criterion: c.id,
      status: v === null ? "MISSING" : "AVAILABLE",
      normalized: v,
      nominalWeight: c.weight,
      effectiveWeight: eff,
      contribution: eff !== null && v !== null ? v * eff : null,
      reason,
    };
  });

  // Missing criteria have no effective weight, so skipping them here is not zero-filling.
  const score = calculable ? 100 * contributions.reduce((s, x) => s + (x.contribution ?? 0), 0) : null;
  const status: ScoreStatus = !calculable
    ? "NOT_CALCULABLE"
    : completeness + EPS >= 1
      ? "CALCULATED"
      : "INCOMPLETE_SCORE";

  return {
    modelVersion: config.modelVersion,
    status,
    score,
    completeness,
    labels: [config.validationStatus, config.weightStatus],
    contributions,
  };
}
