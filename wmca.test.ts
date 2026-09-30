import { describe, it, expect } from "vitest";
import config from "../config/model.wmca.v1.json";
import { computeScore, normalizeMinMax, validateWeights, type ModelConfig } from "../lib/scoring/wmca";

const cfg = config as ModelConfig;
// TEST FIXTURE ONLY: verifies the engine. It is NOT a real Ngabang result.
const FIXTURE = { geology: 0.82, structure: 0.71, geochemistry: 0.77, drainage: 0.59, topography: 0.51 };

describe("weights", () => {
  it("initial weights sum to 1", () => {
    expect(() => validateWeights(cfg.criteria)).not.toThrow();
  });
  it("rejects invalid weight sets", () => {
    expect(() => validateWeights([{ id: "a", weight: 0.5 }])).toThrow();
    expect(() => validateWeights([{ id: "a", weight: -0.2 }, { id: "b", weight: 1.2 }])).toThrow();
    expect(() => validateWeights([])).toThrow();
  });
});

describe("normalizeMinMax", () => {
  it("applies directionality", () => {
    expect(normalizeMinMax(250, 0, 1000, "HIGHER_IS_MORE_PROSPECTIVE")).toBeCloseTo(0.25);
    expect(normalizeMinMax(250, 0, 1000, "LOWER_IS_MORE_PROSPECTIVE")).toBeCloseTo(0.75);
  });
  it("returns null, never a fake number, for unusable input", () => {
    const d = "HIGHER_IS_MORE_PROSPECTIVE";
    expect(normalizeMinMax(NaN, 0, 1, d)).toBeNull();
    expect(normalizeMinMax(null, 0, 1, d)).toBeNull();
    expect(normalizeMinMax(0.5, 1, 1, d)).toBeNull();
    expect(normalizeMinMax(0.5, 0, Infinity, d)).toBeNull();
  });
  it("clamps extreme values to [0,1]", () => {
    expect(normalizeMinMax(1e9, 0, 1000, "HIGHER_IS_MORE_PROSPECTIVE")).toBe(1);
    expect(normalizeMinMax(-1e9, 0, 1000, "HIGHER_IS_MORE_PROSPECTIVE")).toBe(0);
  });
});

describe("computeScore", () => {
  it("matches the fixture: 0.726 -> 72.6", () => {
    const r = computeScore(cfg, FIXTURE);
    expect(r.status).toBe("CALCULATED");
    expect(r.completeness).toBeCloseTo(1, 9);
    expect(r.score).toBeCloseTo(72.6, 9);
    expect(r.contributions[0].contribution).toBeCloseTo(0.246, 9);
    expect(r.labels).toContain("UNVALIDATED MODEL");
  });
  it("is reproducible", () => {
    expect(computeScore(cfg, FIXTURE)).toEqual(computeScore(cfg, FIXTURE));
  });
  it("treats missing as missing, not zero (renormalizes available evidence)", () => {
    const r = computeScore(cfg, { ...FIXTURE, geochemistry: null });
    expect(r.status).toBe("INCOMPLETE_SCORE");
    expect(r.completeness).toBeCloseTo(0.75, 9);
    expect(r.score).toBeCloseTo(71.1333, 3); // zero-fill would give 53.35
    expect(r.contributions[2]).toMatchObject({ status: "MISSING", normalized: null, contribution: null });
  });
  it("keeps a real 0 as evidence", () => {
    const r = computeScore(cfg, { geology: 0, structure: 0, geochemistry: 0, drainage: 0, topography: 0 });
    expect(r.status).toBe("CALCULATED");
    expect(r.score).toBe(0);
  });
  it("treats NaN / out-of-range / undefined as missing", () => {
    const r = computeScore(cfg, { geology: NaN, structure: 1.4, geochemistry: undefined, drainage: 0.5, topography: 0.5 });
    expect(r.status).toBe("NOT_CALCULABLE");
    expect(r.contributions.filter((c) => c.status === "MISSING")).toHaveLength(3);
  });
  it("is NOT_CALCULABLE below minimum completeness or on empty input", () => {
    expect(computeScore(cfg, { drainage: 0.5, topography: 0.5 })).toMatchObject({ status: "NOT_CALCULABLE", score: null });
    expect(computeScore(cfg, {})).toMatchObject({ status: "NOT_CALCULABLE", score: null });
  });
});
