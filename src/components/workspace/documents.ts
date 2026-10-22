// Open documents, layout preferences, and share links.
//
// Everything is stored locally (localStorage). Tabs from the previous UI's
// storage key are imported once so nobody loses work on upgrade. Share links
// carry the program in the URL fragment, compressed, so nothing is uploaded.

import {
  engineProfiles,
  getEngineProfile,
  normalizeEngineSettings,
  type EngineSettings,
} from "@/src/engine";

export interface WorkspaceDocument {
  id: string;
  name: string;
  source: string;
  /** Source as of the last save/open; `source !== savedSource` means edited. */
  savedSource: string;
  profileId: string;
  /** Effective rules; may differ from the profile's when customised. */
  settings: EngineSettings;
}

export interface WorkspacePrefs {
  language: string;
  fontSize: number;
  sidePanelOpen: boolean;
  sideTab: "diagrama" | "traduccion" | "referencia";
  bottomOpen: boolean;
  bottomTab: "consola" | "prueba" | "problemas";
  bottomHeight: number;
  sideWidth: number;
  speedIndex: number;
}

export interface WorkspaceSnapshot {
  documents: WorkspaceDocument[];
  activeId: string;
  prefs: WorkspacePrefs;
}

const STORAGE_KEY = "codoritmo.workspace.v3";
const LEGACY_KEY = "algo-brain.workspace.v1";

export const DEFAULT_PROFILE_ID = "desktop-default";

export const defaultPrefs: WorkspacePrefs = {
  language: "c",
  fontSize: 15,
  sidePanelOpen: true,
  sideTab: "diagrama",
  bottomOpen: true,
  bottomTab: "consola",
  bottomHeight: 220,
  sideWidth: 420,
  speedIndex: 1,
};

export function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function profileSettings(profileId: string): EngineSettings {
  return normalizeEngineSettings((getEngineProfile(profileId) ?? engineProfiles[0]).settings);
}

export function createDocument(name: string, source: string, profileId = DEFAULT_PROFILE_ID): WorkspaceDocument {
  return { id: createId(), name, source, savedSource: source, profileId, settings: profileSettings(profileId) };
}

/** "Algoritmo Promedio" → "Promedio.psc"; falls back to the given name. */
export function nameFromSource(source: string, fallback: string): string {
  const match = /^\s*(?:Algoritmo|Proceso)\s+([\p{L}_][\p{L}\p{N}_]*)/imu.exec(source);
  return match ? `${match[1]}.psc` : fallback;
}

function isDocument(value: unknown): value is WorkspaceDocument {
  const doc = value as WorkspaceDocument;
  return !!doc && typeof doc.id === "string" && typeof doc.name === "string" && typeof doc.source === "string";
}

function migrateLegacy(): WorkspaceSnapshot | null {
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as {
      activeSessionId?: string;
      sessions?: { id: string; title?: string; source: string; profileId?: string; settings?: Partial<EngineSettings> }[];
    };
    const documents = (legacy.sessions ?? [])
      .filter((s) => typeof s?.source === "string")
      .map((s) => {
        const profileId = s.profileId && getEngineProfile(s.profileId) ? s.profileId : DEFAULT_PROFILE_ID;
        return {
          id: s.id ?? createId(),
          name: nameFromSource(s.source, `${s.title ?? "SinTitulo"}.psc`),
          source: s.source,
          savedSource: s.source,
          profileId,
          settings: normalizeEngineSettings({ ...profileSettings(profileId), ...s.settings }),
        };
      });
    if (!documents.length) return null;
    const activeId = documents.find((d) => d.id === legacy.activeSessionId)?.id ?? documents[0].id;
    return { documents, activeId, prefs: defaultPrefs };
  } catch {
    return null;
  }
}

export function loadWorkspace(): WorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
      const documents = (parsed.documents ?? []).filter(isDocument).map((d) => ({
        ...d,
        savedSource: typeof d.savedSource === "string" ? d.savedSource : d.source,
        profileId: getEngineProfile(d.profileId) ? d.profileId : DEFAULT_PROFILE_ID,
        settings: normalizeEngineSettings(d.settings ?? profileSettings(d.profileId)),
      }));
      if (documents.length) {
        return {
          documents,
          activeId: documents.find((d) => d.id === parsed.activeId)?.id ?? documents[0].id,
          prefs: { ...defaultPrefs, ...parsed.prefs },
        };
      }
    }
    return migrateLegacy();
  } catch {
    return null;
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or privacy mode: the workspace still works, it just won't persist.
  }
}

/* ---------------- Share links ---------------- */

interface SharePayload {
  n: string; // file name
  s: string; // source
  p: string; // profile id
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

/** Builds `…#c=<deflated base64url>` (or `#u=` when compression is unavailable). */
export async function buildShareUrl(doc: WorkspaceDocument): Promise<string> {
  const payload: SharePayload = { n: doc.name, s: doc.source, p: doc.profileId };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const base = `${window.location.origin}${window.location.pathname}`;
  if (typeof CompressionStream !== "undefined") {
    return `${base}#c=${toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw")))}`;
  }
  return `${base}#u=${toBase64Url(bytes)}`;
}

/** Reads a shared program from the current URL fragment, if any. */
export async function readSharedDocument(hash: string): Promise<WorkspaceDocument | null> {
  const match = /^#([cu])=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match) return null;
  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1] === "c") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
    if (typeof payload.s !== "string") return null;
    const profileId = getEngineProfile(payload.p) ? payload.p : DEFAULT_PROFILE_ID;
    return createDocument(typeof payload.n === "string" ? payload.n : "Compartido.psc", payload.s, profileId);
  } catch {
    return null;
  }
}

/* ---------------- Files ---------------- */

export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadUrl(name: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

/** PSeInt saves Latin-1; decode as UTF-8 and fall back when that fails. */
export function decodeProgramFile(bytes: Uint8Array): string {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("�")) text = new TextDecoder("iso-8859-1").decode(bytes);
  return text.replace(/\r\n?/g, "\n");
}
