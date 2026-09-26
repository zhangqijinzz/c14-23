import { describe, expect, it } from 'vitest';
import { buildBaselineRows, calculateProjection, resolveBaselineYear, shortestProjectionYear, validateBaselineYear, validateScenario, SAMPLE_SCENARIOS } from '../domain';
import type { BaselineSetting } from '../types';

describe('scenario domain', () => {
  it('calculates monthly contributions and inflation-adjusted value', () => {
    const projection = calculateProjection(SAMPLE_SCENARIOS[0]);
    expect(projection.points).toHaveLength(21);
    expect(projection.totalInvested).toBe(390000);
    expect(projection.finalValue).toBeGreaterThan(projection.totalInvested);
    expect(projection.finalRealValue).toBeLessThan(projection.finalValue);
  });

  it('rejects unreasonable years and rates', () => {
    const errors = validateScenario({ ...SAMPLE_SCENARIOS[0], years: 61, feeRate: -1 });
    expect(errors.years).toBeTruthy();
    expect(errors.feeRate).toBeTruthy();
  });

  it('keeps zero contribution scenarios valid', () => {
    const scenario = { ...SAMPLE_SCENARIOS[0], principal: 0, recurring: 0 };
    expect(validateScenario(scenario)).toEqual({});
    expect(calculateProjection(scenario).finalValue).toBe(0);
  });
});

describe('baseline comparison', () => {
  const projections = [
    calculateProjection({ ...SAMPLE_SCENARIOS[0], years: 20 }),
    calculateProjection({ ...SAMPLE_SCENARIOS[1], years: 30 }),
  ];

  it('defaults the baseline to the shortest scenario year', () => {
    expect(shortestProjectionYear(projections)).toBe(20);
    const resolved = resolveBaselineYear({ enabled: true }, projections);
    expect(resolved).toMatchObject({ year: 20, source: 'shortest', error: null });
  });

  it('keeps baseline disabled for legacy settings and returns no year', () => {
    expect(resolveBaselineYear(null, projections).year).toBeNull();
    expect(resolveBaselineYear({ enabled: false, manualYear: 10 }, projections).year).toBeNull();
  });

  it('accepts a manual year within the longest scenario and rejects out-of-range values', () => {
    expect(validateBaselineYear(25, 30)).toBeNull();
    expect(validateBaselineYear(25.5, 30)).toBeTruthy();
    expect(validateBaselineYear(31, 30)).toBeTruthy();
    expect(resolveBaselineYear({ enabled: true, manualYear: 25 }, projections)).toMatchObject({ year: 25, source: 'manual', error: null });
  });

  it('falls back to the shortest year with an error when the manual year is invalid', () => {
    const setting: BaselineSetting = { enabled: true, manualYear: 40 };
    const resolved = resolveBaselineYear(setting, projections);
    expect(resolved.year).toBe(20);
    expect(resolved.source).toBe('shortest');
    expect(resolved.error).toContain('30');
  });

  it('splits comparable core points from extrapolation points', () => {
    const rows = buildBaselineRows(projections, 20);
    const short = rows[0];
    const long = rows[1];
    expect(short.covered).toBe(true);
    expect(short.baselinePoint?.year).toBe(20);
    expect(short.extrapolationPoints).toHaveLength(0);
    expect(long.covered).toBe(true);
    expect(long.baselinePoint?.year).toBe(20);
    expect(long.extrapolationPoints).toHaveLength(10);
    expect(long.extrapolationPoints[0].year).toBe(21);
  });

  it('marks scenarios shorter than a manual baseline as uncovered', () => {
    const rows = buildBaselineRows(projections, 25);
    expect(rows[0].covered).toBe(false);
    expect(rows[0].baselinePoint).toBeNull();
    expect(rows[1].covered).toBe(true);
  });
});
