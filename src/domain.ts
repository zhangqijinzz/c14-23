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

export function fieldLabel(field: ScenarioField): string {
  return { principal: '初始金额', recurring: '每月投入', years: '投资年限', annualRate: '年化收益', inflationRate: '通胀率', feeRate: '费用率' }[field];
}

/**
 * 默认比较基准年：所有参与比较的情景里最短的年限。
 * 用各自推演得出的年限而非情景输入，确保参数非法时不会误取年限。
 */
export function shortestProjectionYear(projections: ScenarioProjection[]): number | null {
  const years = projections.map((projection) => projection.points[projection.points.length - 1]?.year).filter((year): year is number => typeof year === 'number');
  return years.length ? Math.min(...years) : null;
}

export function longestProjectionYear(projections: ScenarioProjection[]): number | null {
  const years = projections.map((projection) => projection.points[projection.points.length - 1]?.year).filter((year): year is number => typeof year === 'number');
  return years.length ? Math.max(...years) : null;
}

/** 基准年输入的合法范围与情景年限一致（1–60 的整数）。 */
export function validateBaselineYear(year: number, maxAllowed: number): string | null {
  if (!Number.isInteger(year)) return '基准年需为整数年';
  if (year < 1 || year > 60) return '基准年需为 1–60 年的整数';
  if (maxAllowed >= 1 && year > maxAllowed) return `基准年不能超过最长情景的 ${maxAllowed} 年，否则没有可比对象`;
  return null;
}

/**
 * 计算实际生效的基准年：手动值合法时用手动值，否则回退到最短年限。
 * 回退时同时给出错误提示，供控件标红，保证汇总始终基于一个可解释的年份。
 */
export function resolveBaselineYear(
  setting: BaselineSetting | null,
  projections: ScenarioProjection[],
): { year: number | null; source: 'manual' | 'shortest'; error: string | null } {
  if (!setting || !setting.enabled) return { year: null, source: 'shortest', error: null };
  const shortest = shortestProjectionYear(projections);
  if (shortest === null) return { year: null, source: 'shortest', error: null };
  const longest = longestProjectionYear(projections) ?? shortest;
  const manual = setting.manualYear;
  if (typeof manual === 'number' && Number.isFinite(manual)) {
    const error = validateBaselineYear(manual, longest);
    if (!error) return { year: manual, source: 'manual', error: null };
    return { year: shortest, source: 'shortest', error };
  }
  return { year: shortest, source: 'shortest', error: null };
}

export interface BaselineRow {
  scenarioId: string;
  /** 基准年时点：落在该情景自身年限内时可取，否则为 null（未推演到基准年，不参与比较）。 */
  covered: boolean;
  baselinePoint: ProjectionPoint | null;
  /** 超过基准年、延伸到该情景自身终值的外推点（不含基准年点）。 */
  extrapolationPoints: ProjectionPoint[];
}

/** 按统一基准年切分每个情景的可比部分与外推部分。 */
export function buildBaselineRows(projections: ScenarioProjection[], baselineYear: number): BaselineRow[] {
  return projections.map((projection) => {
    const baselinePoint = projection.points.find((point) => point.year === baselineYear) ?? null;
    const extrapolationPoints = projection.points.filter((point) => point.year > baselineYear);
    return { scenarioId: projection.scenarioId, covered: baselinePoint !== null, baselinePoint, extrapolationPoints };
  });
}

