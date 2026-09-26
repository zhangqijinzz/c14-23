export type ScenarioField =
  | 'principal'
  | 'recurring'
  | 'years'
  | 'annualRate'
  | 'inflationRate'
  | 'feeRate';

export interface FinanceScenario {
  id: string;
  name: string;
  color: string;
  principal: number;
  recurring: number;
  years: number;
  annualRate: number;
  inflationRate: number;
  feeRate: number;
}

export interface ProjectionPoint {
  year: number;
  nominal: number;
  real: number;
  invested: number;
}

export interface ScenarioProjection {
  scenarioId: string;
  points: ProjectionPoint[];
  finalValue: number;
  finalRealValue: number;
  totalInvested: number;
}

export type ValidationErrors = Partial<Record<ScenarioField, string>>;

/**
 * 统一比较基准年设置。
 * 该字段缺失（旧版数据）时沿用各自年限终值的旧渲染方式，保证升级不改变已有结论。
 */
export interface BaselineSetting {
  /** 是否启用统一基准年比较；旧版数据视为关闭。 */
  enabled: boolean;
  /** 手动指定的基准年；省略时默认取所有情景中最短的年限。 */
  manualYear?: number;
}

/** v1：升级前保存的数据，没有基准年设置，按旧表现渲染。 */
export interface PersistedWorkspaceV1 {
  version: 1;
  scenarios: FinanceScenario[];
  selectedId: string;
}

export interface PersistedWorkspace {
  version: 2;
  scenarios: FinanceScenario[];
  selectedId: string;
  baseline: BaselineSetting;
}
