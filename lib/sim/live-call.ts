export type LiveCallSource = "clinician" | "patient";

export type LiveCallState = {
  active: boolean;
  conversationId: string | null;
  startedAt: number | null;
  source: LiveCallSource | null;
};

const STORAGE_KEY = "mend.liveCall";

const inactive: LiveCallState = {
  active: false,
  conversationId: null,
  startedAt: null,
  source: null,
};

let memory: LiveCallState = { ...inactive };
const listeners = new Set<() => void>();
let storageListening = false;

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function parseState(raw: string | null): LiveCallState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LiveCallState>;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.active !== "boolean") return null;
    return {
      active: parsed.active,
      conversationId:
        parsed.conversationId === null || typeof parsed.conversationId === "string"
          ? (parsed.conversationId ?? null)
          : null,
      startedAt:
        parsed.startedAt === null || typeof parsed.startedAt === "number"
          ? (parsed.startedAt ?? null)
          : null,
      source:
        parsed.source === "clinician" || parsed.source === "patient" || parsed.source === null
          ? (parsed.source ?? null)
          : null,
    };
  } catch {
    return null;
  }
}

function readPersisted(): LiveCallState | null {
  if (!canUseSessionStorage()) return null;
  try {
    return parseState(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writePersisted(state: LiveCallState): void {
  if (!canUseSessionStorage()) return;
  try {
    if (!state.active) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Best-effort persistence; ignore quota / private-mode failures.
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(next: LiveCallState): void {
  memory = next;
  writePersisted(next);
  notify();
}

function ensureStorageListener(): void {
  if (storageListening || typeof window === "undefined") return;
  storageListening = true;
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const next = parseState(event.newValue) ?? { ...inactive };
    memory = next;
    notify();
  });
}

export function getLiveCall(): LiveCallState {
  const persisted = readPersisted();
  if (persisted) {
    memory = persisted;
    return { ...persisted };
  }
  return { ...memory };
}

export function startLiveCall(args: {
  conversationId: string | null;
  source: LiveCallSource;
}): void {
  setState({
    active: true,
    conversationId: args.conversationId,
    startedAt: Date.now(),
    source: args.source,
  });
}

export function clearLiveCall(): void {
  setState({ ...inactive });
}

export function subscribeLiveCall(listener: () => void): () => void {
  listeners.add(listener);
  ensureStorageListener();
  return () => {
    listeners.delete(listener);
  };
}
