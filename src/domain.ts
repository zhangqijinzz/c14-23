import type {
  BaselineSetting,
  FinanceScenario,
  ProjectionPoint,
  ScenarioField,
  ScenarioProjection,
  ValidationErrors,
} from './types';

export const COLORS = ['#e4774e', '#286f68', '#5e65c7', '#c49336', '#b45d88'];

export const SAMPLE_SCENARIOS: FinanceScenario[] = [
  { id: 'steady', name: '稳健积累', color: COLORS[0], principal: 30000, recurring: 1500, years: 20, annualRate: 4.5, inflationRate: 2, feeRate: 0.4 },
  { id: 'balanced', name: '平衡增长', color: COLORS[1], principal: 30000, recurring: 1500, years: 20, annualRate: 7, inflationRate: 2, feeRate: 0.6 },
  { id: 'growth', name: '长期增长', color: COLORS[2], principal: 30000, recurring: 1500, years: 20, annualRate: 9, inflationRate: 2.5, feeRate: 0.8 },
];

export function validateScenario(scenario: FinanceScenario): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!Number.isFinite(scenario.principal) || scenario.principal < 0) errors.principal = '请输入不小于 0 的金额';
  if (!Number.isFinite(scenario.recurring) || scenario.recurring < 0) errors.recurring = '请输入不小于 0 的金额';
  if (!Number.isInteger(scenario.years) || scenario.years < 1 || scenario.years > 60) errors.years = '年限需为 1–60 年的整数';
  if (!Number.isFinite(scenario.annualRate) || scenario.annualRate < -50 || scenario.annualRate > 100) errors.annualRate = '收益率需在 -50% 至 100% 之间';
  if (!Number.isFinite(scenario.inflationRate) || scenario.inflationRate < 0 || scenario.inflationRate > 30) errors.inflationRate = '通胀率需在 0% 至 30% 之间';
  if (!Number.isFinite(scenario.feeRate) || scenario.feeRate < 0 || scenario.feeRate > 10) errors.feeRate = '费用率需在 0% 至 10% 之间';
  return errors;
}

export function calculateProjection(scenario: FinanceScenario): ScenarioProjection {
  const monthlyRate = Math.pow(1 + (scenario.annualRate - scenario.feeRate) / 100, 1 / 12) - 1;
  let nominal = scenario.principal;
  let invested = scenario.principal;
  const points: ProjectionPoint[] = [{ year: 0, nominal, real: nominal, invested }];

  for (let month = 1; month <= scenario.years * 12; month += 1) {
    nominal = nominal * (1 + monthlyRate) + scenario.recurring;
    invested += scenario.recurring;
    if (month % 12 === 0) {
      const year = month / 12;
      points.push({ year, nominal, real: nominal / Math.pow(1 + scenario.inflationRate / 100, year), invested });
    }
  }
  const final = points[points.length - 1];
  return { scenarioId: scenario.id, points, finalValue: final.nominal, finalRealValue: final.real, totalInvested: final.invested };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function isBaselineSetting(value: unknown): value is BaselineSetting {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { mode?: unknown; year?: unknown };
  if (candidate.mode === 'auto' || candidate.mode === 'off') return true;
  return candidate.mode === 'manual' && typeof candidate.year === 'number' && Number.isFinite(candidate.year);
}

export function resolveBaselineYear(
  setting: BaselineSetting,
  scenarios: FinanceScenario[],
  errors: Record<string, ValidationErrors>,
): number | null {
  if (setting.mode === 'off') return null;
  const validYears = scenarios.filter((scenario) => !errors[scenario.id]).map((scenario) => scenario.years);
  if (validYears.length === 0) return null;
  if (setting.mode === 'auto') return Math.min(...validYears);
  return Math.min(Math.max(Math.round(setting.year), 1), Math.max(...validYears));
}

export function pointAtYear(projection: ScenarioProjection, year: number): ProjectionPoint | undefined {
  return projection.points.find((point) => point.year === year);
}

export function fieldLabel(field: ScenarioField): string {
  return { principal: '初始金额', recurring: '每月投入', years: '投资年限', annualRate: '年化收益', inflationRate: '通胀率', feeRate: '费用率' }[field];
}
