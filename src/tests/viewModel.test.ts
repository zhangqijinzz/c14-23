import { describe, expect, it } from 'vitest';
import { SAMPLE_SCENARIOS } from '../domain';
import type { PersistedWorkspace } from '../types';
import { MoneyScenarioViewModel } from '../viewModel';
import type { ScenarioRepository } from '../repository';

class MemoryRepository implements ScenarioRepository {
  constructor(private value: PersistedWorkspace | null = null, private failSave = false) {}
  async load() { return this.value; }
  async save(workspace: PersistedWorkspace) { if (this.failSave) throw new Error('storage'); this.value = workspace; }
}

describe('MoneyScenarioViewModel', () => {
  it('initializes sample scenarios and updates projections', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository());
    await vm.init();
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
    vm.updateField('steady', 'years', 30);
    expect(vm.getSnapshot().projections[0].points).toHaveLength(31);
  });

  it('restores saved state and surfaces invalid input', async () => {
    const saved = { version: 1 as const, scenarios: [{ ...SAMPLE_SCENARIOS[0], years: 12 }], selectedId: 'steady' };
    const vm = new MoneyScenarioViewModel(new MemoryRepository(saved));
    await vm.init();
    expect(vm.getSnapshot().scenarios[0].years).toBe(12);
    vm.updateField('steady', 'years', 99);
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    expect(vm.getSnapshot().projections).toHaveLength(0);
  });

  it('handles persistence failure without losing the editing state', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository(null, true));
    await vm.init();
    await vm.save();
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
  });

  it('defaults new workspaces to auto baseline and persists the choice', async () => {
    const repository = new MemoryRepository();
    const vm = new MoneyScenarioViewModel(repository);
    await vm.init();
    expect(vm.getSnapshot().baseline).toEqual({ mode: 'auto' });
    vm.setBaseline({ mode: 'manual', year: 10 });
    await vm.save();
    expect((await repository.load())?.baseline).toEqual({ mode: 'manual', year: 10 });
  });

  it('restores a saved baseline and keeps legacy workspaces on per-scenario finals', async () => {
    const withBaseline: PersistedWorkspace = { version: 1, scenarios: SAMPLE_SCENARIOS, selectedId: 'steady', baseline: { mode: 'manual', year: 15 } };
    const vm = new MoneyScenarioViewModel(new MemoryRepository(withBaseline));
    await vm.init();
    expect(vm.getSnapshot().baseline).toEqual({ mode: 'manual', year: 15 });

    const legacy: PersistedWorkspace = { version: 1, scenarios: SAMPLE_SCENARIOS, selectedId: 'steady' };
    const legacyVm = new MoneyScenarioViewModel(new MemoryRepository(legacy));
    await legacyVm.init();
    expect(legacyVm.getSnapshot().baseline).toEqual({ mode: 'off' });
  });
});
