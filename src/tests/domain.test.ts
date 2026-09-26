import { describe, expect, it } from 'vitest';
import { calculateProjection, isBaselineSetting, pointAtYear, resolveBaselineYear, validateScenario, SAMPLE_SCENARIOS } from '../domain';

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

describe('baseline year', () => {
  const scenarios = [
    { ...SAMPLE_SCENARIOS[0], years: 20 },
    { ...SAMPLE_SCENARIOS[1], id: 'long', years: 30 },
  ];

  it('auto resolves to the shortest valid scenario', () => {
    expect(resolveBaselineYear({ mode: 'auto' }, scenarios, {})).toBe(20);
    expect(resolveBaselineYear({ mode: 'auto' }, scenarios, { long: { years: 'invalid' } })).toBe(20);
    expect(resolveBaselineYear({ mode: 'auto' }, [], {})).toBeNull();
  });

  it('manual clamps into the valid range', () => {
    expect(resolveBaselineYear({ mode: 'manual', year: 25 }, scenarios, {})).toBe(25);
    expect(resolveBaselineYear({ mode: 'manual', year: 99 }, scenarios, {})).toBe(30);
    expect(resolveBaselineYear({ mode: 'manual', year: 0 }, scenarios, {})).toBe(1);
  });

  it('off keeps per-scenario finals', () => {
    expect(resolveBaselineYear({ mode: 'off' }, scenarios, {})).toBeNull();
  });

  it('finds the yearly point and validates persisted settings', () => {
    const projection = calculateProjection(scenarios[0]);
    expect(pointAtYear(projection, 10)?.year).toBe(10);
    expect(pointAtYear(projection, 25)).toBeUndefined();
    expect(isBaselineSetting({ mode: 'auto' })).toBe(true);
    expect(isBaselineSetting({ mode: 'manual', year: 15 })).toBe(true);
    expect(isBaselineSetting({ mode: 'manual' })).toBe(false);
    expect(isBaselineSetting('auto')).toBe(false);
  });
});
