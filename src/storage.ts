import type { PersistedWorkspace, PersistedWorkspaceV1 } from './types';

const STORAGE_KEY = 'money-scenario.workspace.v1';
const DB_NAME = 'money-scenario-db';

type StoredWorkspace = PersistedWorkspace | PersistedWorkspaceV1;

function validV1(value: unknown): value is PersistedWorkspaceV1 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedWorkspaceV1>;
  return candidate.version === 1 && Array.isArray(candidate.scenarios) && typeof candidate.selectedId === 'string';
}

function validV2(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedWorkspace>;
  if (candidate.version !== 2 || !Array.isArray(candidate.scenarios) || typeof candidate.selectedId !== 'string') return false;
  const baseline = candidate.baseline;
  if (!baseline || typeof baseline !== 'object' || typeof baseline.enabled !== 'boolean') return false;
  if (baseline.manualYear !== undefined && (typeof baseline.manualYear !== 'number' || !Number.isFinite(baseline.manualYear))) return false;
  return true;
}

function validWorkspace(value: unknown): value is StoredWorkspace {
  return validV1(value) || validV2(value);
}

export async function readLocalWorkspace(): Promise<StoredWorkspace | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validWorkspace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeLocalWorkspace(workspace: PersistedWorkspace): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export async function readIndexedWorkspace(): Promise<StoredWorkspace | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onsuccess = () => {
        const transaction = request.result.transaction('workspace', 'readonly');
        const getRequest = transaction.objectStore('workspace').get('active');
        getRequest.onsuccess = () => resolve(validWorkspace(getRequest.result) ? getRequest.result : null);
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeIndexedWorkspace(workspace: PersistedWorkspace): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onsuccess = () => {
        const transaction = request.result.transaction('workspace', 'readwrite');
        transaction.objectStore('workspace').put(workspace, 'active');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}
