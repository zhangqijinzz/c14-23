import { describe, expect, it } from 'vitest';
import { calculateProjection, SAMPLE_SCENARIOS } from '../domain';
import type { PersistedWorkspace, PersistedWorkspaceV1 } from '../types';
import { MoneyScenarioViewModel } from '../viewModel';
import type { ScenarioRepository } from '../repository';

class MemoryRepository implements ScenarioRepository {
  constructor(private value: PersistedWorkspace | PersistedWorkspaceV1 | null = null, private failSave = false) {}
  async load() { return this.value; }
  async save(workspace: PersistedWorkspace) { if (this.failSave) throw new Error('storage'); this.value = workspace; }
  saved(): PersistedWorkspace | PersistedWorkspaceV1 | null { return this.value; }
}

async function createVm(saved: PersistedWorkspace | PersistedWorkspaceV1 | null = null, failSave = false) {
  const repository = new MemoryRepository(saved, failSave);
  const vm = new MoneyScenarioViewModel(repository);
  await vm.init();
  return { vm, repository };
}

describe('MoneyScenarioViewModel', () => {
  it('initializes sample scenarios and updates projections', async () => {
    const { vm } = await createVm();
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
    vm.updateField('steady', 'years', 30);
    expect(vm.getSnapshot().projections[0].points).toHaveLength(31);
  });

  it('restores saved state and surfaces invalid input', async () => {
    const saved: PersistedWorkspaceV1 = { version: 1, scenarios: [{ ...SAMPLE_SCENARIOS[0], years: 12 }], selectedId: 'steady' };
    const { vm } = await createVm(saved);
    expect(vm.getSnapshot().scenarios[0].years).toBe(12);
    vm.updateField('steady', 'years', 99);
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    expect(vm.getSnapshot().projections).toHaveLength(0);
  });

  it('handles persistence failure without losing the editing state', async () => {
    const { vm } = await createVm(null, true);
    await vm.save();
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
  });
});

describe('baseline year setting', () => {
  it('enables the shortest-year baseline for fresh sample workspaces', async () => {
    const { vm } = await createVm();
    const state = vm.getSnapshot();
    expect(state.baseline).toEqual({ enabled: true });
    expect(state.baselineYear).toBe(20);
  });

  it('keeps legacy v1 workspaces on the old rendering path until the user opts in', async () => {
    const saved: PersistedWorkspaceV1 = {
      version: 1,
      scenarios: [{ ...SAMPLE_SCENARIOS[0], years: 20 }, { ...SAMPLE_SCENARIOS[1], years: 30 }],
      selectedId: 'steady',
    };
    const { vm } = await createVm(saved);
    let state = vm.getSnapshot();
    expect(state.baseline).toBeNull();
    expect(state.baselineYear).toBeNull();
    expect(state.baselineRows).toEqual([]);

    vm.setBaselineEnabled(true);
    state = vm.getSnapshot();
    expect(state.baselineYear).toBe(20);
    expect(state.baselineRows[0].extrapolationPoints).toHaveLength(0);
    expect(state.baselineRows[1].extrapolationPoints).toHaveLength(10);
  });

  it('supports a manual baseline year and marks shorter scenarios uncovered', async () => {
    const { vm } = await createVm();
    vm.updateField('balanced', 'years', 30);
    vm.setBaselineYear(25);
    const state = vm.getSnapshot();
    expect(state.baselineYear).toBe(25);
    const steadyRow = state.baselineRows.find((row) => row.scenarioId === 'steady');
    const balancedRow = state.baselineRows.find((row) => row.scenarioId === 'balanced');
    expect(steadyRow?.covered).toBe(false);
    expect(balancedRow?.covered).toBe(true);
    expect(balancedRow?.extrapolationPoints).toHaveLength(5);
  });

  it('rejects a manual year beyond the longest scenario and falls back to the shortest', async () => {
    const { vm } = await createVm();
    vm.updateField('balanced', 'years', 30);
    vm.setBaselineYear(45);
    const state = vm.getSnapshot();
    expect(state.baselineYear).toBe(20);
    expect(state.baselineError).toContain('30');
    expect(state.status).toBe('editing');
  });

  it('recalculates the shortest default when scenario years change and resets on demand', async () => {
    const { vm } = await createVm();
    vm.updateField('steady', 'years', 15);
    expect(vm.getSnapshot().baselineYear).toBe(15);
    vm.setBaselineYear(18);
    expect(vm.getSnapshot().baselineYear).toBe(18);
    vm.resetBaselineYear();
    expect(vm.getSnapshot().baselineYear).toBe(15);
    expect(vm.getSnapshot().baseline).toEqual({ enabled: true });
  });

  it('can be disabled back to the per-scenario terminal-value view', async () => {
    const { vm } = await createVm();
    vm.setBaselineEnabled(false);
    const state = vm.getSnapshot();
    expect(state.baseline?.enabled).toBe(false);
    expect(state.baselineYear).toBeNull();
  });

  it('persists and restores the baseline setting as a v2 workspace', async () => {
    const { vm, repository } = await createVm();
    vm.updateField('balanced', 'years', 30);
    vm.setBaselineYear(25);
    await vm.save();
    expect(repository.saved()).toMatchObject({ version: 2, baseline: { enabled: true, manualYear: 25 } });

    const restored = await createVm(repository.saved() as PersistedWorkspace);
    const state = restored.vm.getSnapshot();
    expect(state.baselineYear).toBe(25);
    expect(state.baselineRows.find((row) => row.scenarioId === 'steady')?.covered).toBe(false);
  });

  it('saves legacy v1 workspaces as explicit opt-outs without changing their view', async () => {
    const saved: PersistedWorkspaceV1 = { version: 1, scenarios: SAMPLE_SCENARIOS, selectedId: 'steady' };
    const { vm, repository } = await createVm(saved);
    await vm.save();
    const persisted = repository.saved() as PersistedWorkspace;
    expect(persisted.version).toBe(2);
    expect(persisted.baseline).toEqual({ enabled: false });
    expect(vm.getSnapshot().baselineYear).toBeNull();
  });

  it('reports comparable baseline values equal to a direct projection lookup', async () => {
    const { vm } = await createVm();
    vm.setBaselineYear(20);
    const state = vm.getSnapshot();
    state.baselineRows.forEach((row) => {
      const projection = state.projections.find((item) => item.scenarioId === row.scenarioId);
      const expected = calculateProjection({ ...SAMPLE_SCENARIOS.find((scenario) => scenario.id === row.scenarioId)! });
      expect(projection?.points.find((point) => point.year === 20)?.nominal).toBe(expected.points[20].nominal);
      expect(row.baselinePoint?.nominal).toBe(expected.points[20].nominal);
    });
  });
});
