import { readIndexedWorkspace, readLocalWorkspace, writeIndexedWorkspace, writeLocalWorkspace } from './storage';
import type { PersistedWorkspace, PersistedWorkspaceV1 } from './types';

export type StoredWorkspace = PersistedWorkspace | PersistedWorkspaceV1;

export interface ScenarioRepository {
  load(): Promise<StoredWorkspace | null>;
  save(workspace: PersistedWorkspace): Promise<void>;
}

export class LocalScenarioRepository implements ScenarioRepository {
  async load(): Promise<StoredWorkspace | null> {
    return (await readIndexedWorkspace()) ?? (await readLocalWorkspace());
  }

  async save(workspace: PersistedWorkspace): Promise<void> {
    let indexedSaved = false;
    try {
      await writeIndexedWorkspace(workspace);
      indexedSaved = true;
    } catch {
      // localStorage below is the recoverable fallback when IndexedDB is unavailable.
    }
    try {
      await writeLocalWorkspace(workspace);
    } catch (error) {
      if (!indexedSaved) throw error;
    }
  }
}
