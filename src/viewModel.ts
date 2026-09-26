import { buildBaselineRows, calculateProjection, COLORS, resolveBaselineYear, SAMPLE_SCENARIOS, validateScenario } from './domain';
import type { BaselineRow } from './domain';
import type { ScenarioRepository } from './repository';
import type { BaselineSetting, FinanceScenario, PersistedWorkspace, ScenarioField, ScenarioProjection, ValidationErrors } from './types';

export type ViewStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface MoneyScenarioState {
  status: ViewStatus;
  scenarios: FinanceScenario[];
  selectedId: string;
  errors: Record<string, ValidationErrors>;
  projections: ScenarioProjection[];
  message: string;
  /**
   * 比较基准年设置；null 表示当前工作区来自旧版数据且用户尚未启用该功能，
   * 此时表格与图表保持旧表现（各情景按各自终值比较）。
   */
  baseline: BaselineSetting | null;
  /** 实际生效的基准年；baseline 关闭或没有可用推演时为 null。 */
  baselineYear: number | null;
  /** 手动基准年输入的校验提示；有效时为 null。 */
  baselineError: string | null;
  /** 按基准年切分的可比/外推数据，仅在 baselineYear 非空时生成。 */
  baselineRows: BaselineRow[];
}

type Listener = (state: MoneyScenarioState) => void;

function initialState(): MoneyScenarioState {
  return { status: 'loading', scenarios: [], selectedId: '', errors: {}, projections: [], message: '正在恢复最近的情景…', baseline: null, baselineYear: null, baselineError: null, baselineRows: [] };
}

const DEFAULT_BASELINE: BaselineSetting = { enabled: true };

export class MoneyScenarioViewModel {
  private state: MoneyScenarioState = initialState();
  private readonly listeners = new Set<Listener>();
  private initialized = false;
  private readonly repository: ScenarioRepository;

  constructor(repository: ScenarioRepository) {
    this.repository = repository;
  }

  getSnapshot(): MoneyScenarioState { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const saved = await this.repository.load();
      if (!saved) {
        this.applyScenarios(SAMPLE_SCENARIOS, SAMPLE_SCENARIOS[0].id, '已载入示例情景，各方案已按最短年限统一比较', DEFAULT_BASELINE);
        return;
      }
      if (saved.version === 1) {
        // 旧版工作区没有基准年设置：沿用旧渲染，升级不改变已保存的结论。
        this.applyScenarios(saved.scenarios, saved.selectedId, '已恢复上次工作状态（旧版比较口径）', null);
        return;
      }
      this.applyScenarios(saved.scenarios, saved.selectedId, '已恢复上次工作状态', saved.baseline);
    } catch {
      this.applyScenarios(SAMPLE_SCENARIOS, SAMPLE_SCENARIOS[0].id, '本地数据读取失败，已使用示例情景', DEFAULT_BASELINE);
      this.setState({ status: 'error', message: '本地数据读取失败，当前使用临时示例；仍可继续推演' });
    }
  }

  updateField(id: string, field: ScenarioField, value: number): void {
    const scenarios = this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, [field]: value } : scenario);
    this.applyScenarios(scenarios, id, '参数已更新，结果实时刷新');
  }

  renameScenario(id: string, name: string): void {
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) return;
    this.applyScenarios(this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, name: trimmed } : scenario), id, '情景名称已更新');
  }

  addScenario(): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios[this.state.scenarios.length - 1] ?? SAMPLE_SCENARIOS[0];
    const id = `scenario-${Date.now()}`;
    const scenario = { ...source, id, name: `情景 ${this.state.scenarios.length + 1}`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.applyScenarios([...this.state.scenarios, scenario], id, '已新增情景');
  }

  duplicateScenario(id: string): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios.find((scenario) => scenario.id === id);
    if (!source) return;
    const copy = { ...source, id: `scenario-${Date.now()}`, name: `${source.name} · 复制`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.applyScenarios([...this.state.scenarios, copy], copy.id, '已复制情景，可修改任意参数比较差异');
  }

  removeScenario(id: string): void {
    if (this.state.scenarios.length <= 1) return;
    const scenarios = this.state.scenarios.filter((scenario) => scenario.id !== id);
    const nextSelected = this.state.selectedId === id ? scenarios[0].id : this.state.selectedId;
    this.applyScenarios(scenarios, nextSelected, '情景已移除');
  }

  setBaselineEnabled(enabled: boolean): void {
    const previous = this.state.baseline;
    if (enabled) {
      if (previous?.enabled) return;
      const setting: BaselineSetting = { enabled: true, manualYear: previous?.manualYear };
      const { year } = resolveBaselineYear(setting, this.state.projections);
      const message = year === null ? '已启用统一基准年比较' : `已按第 ${year} 年统一比较；该年之后均为外推`;
      this.applyScenarios(this.state.scenarios, this.state.selectedId, message, setting);
      return;
    }
    if (previous && !previous.enabled) return;
    // 关闭即回到旧口径（各情景按各自终值比较）。
    this.applyScenarios(this.state.scenarios, this.state.selectedId, '已关闭统一基准年，恢复为各情景按各自终值比较', { enabled: false, manualYear: previous?.manualYear });
  }

  setBaselineYear(year: number): void {
    const previous = this.state.baseline;
    const setting: BaselineSetting = { enabled: true, manualYear: Number.isFinite(year) ? year : previous?.manualYear };
    this.applyScenarios(this.state.scenarios, this.state.selectedId, '基准年已更新', setting);
    if (this.state.baselineError) this.setState({ status: 'editing', message: this.state.baselineError });
  }

  resetBaselineYear(): void {
    this.applyScenarios(this.state.scenarios, this.state.selectedId, '基准年已恢复为最短情景年限', { enabled: true });
  }

  async save(): Promise<void> {
    if (Object.keys(this.state.errors).length > 0 || this.state.baselineError) {
      this.setState({ status: 'error', message: '请先修正标红参数（含比较基准年），再保存比较' });
      return;
    }
    const baseline: BaselineSetting = this.state.baseline
      ? { enabled: this.state.baseline.enabled, manualYear: Number.isFinite(this.state.baseline.manualYear) ? this.state.baseline.manualYear : undefined }
      : { enabled: false };
    const workspace: PersistedWorkspace = { version: 2, scenarios: this.state.scenarios, selectedId: this.state.selectedId, baseline };
    try {
      await this.repository.save(workspace);
      this.setState({ status: 'completed', message: '比较已保存，本地刷新后仍可继续编辑' });
    } catch {
      this.setState({ status: 'error', message: '保存失败，请检查浏览器本地存储权限' });
    }
  }

  private applyScenarios(scenarios: FinanceScenario[], selectedId: string, message: string, baselineOverride?: BaselineSetting | null): void {
    const errors: Record<string, ValidationErrors> = {};
    const projections: ScenarioProjection[] = [];
    scenarios.forEach((scenario) => {
      const scenarioErrors = validateScenario(scenario);
      if (Object.keys(scenarioErrors).length) errors[scenario.id] = scenarioErrors;
      else projections.push(calculateProjection(scenario));
    });
    const baseline = baselineOverride === undefined ? this.state.baseline : baselineOverride;
    const { year, error } = resolveBaselineYear(baseline, projections);
    const baselineRows = year === null ? [] : buildBaselineRows(projections, year);
    const nextSelected = scenarios.some((scenario) => scenario.id === selectedId) ? selectedId : (scenarios[0]?.id ?? '');
    this.setState({
      scenarios,
      selectedId: nextSelected,
      errors,
      projections,
      baseline,
      baselineYear: year,
      baselineError: error,
      baselineRows,
      status: Object.keys(errors).length || error ? 'editing' : 'ready',
      message,
    });
  }

  private setState(patch: Partial<MoneyScenarioState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
