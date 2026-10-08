/**
 * File storage abstraction for document attachments (patient scans, lab and
 * radiology reports, donor ID proofs, …).
 *
 * Binary bytes never live in the row store — `documents-service.ts` persists
 * only metadata plus a `storage_key`, and asks this module to read/write the
 * actual bytes. Mirrors the driver-swap pattern in `@/db`: an
 * in-memory store for local development, Supabase Storage in production.
 * Switching is the same DATABASE_DRIVER=supabase config already used for the
 * database — no separate setting needed.
 */
import { getConfig } from "@/config/env";
import { AppError } from "@/lib/errors";

export interface StoredFile {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PutInput {
  data: Buffer;
  fileName: string;
  mimeType: string;
}

export interface StorageDriver {
  put(input: PutInput): Promise<StoredFile>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

function makeKey(fileName: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}-${fileName}`;
}

// ─── In-memory driver (default for local development) ─────────────────────

interface MemoryStore {
  files: Map<string, { data: Buffer; fileName: string; mimeType: string }>;
}

// Persist across HMR reloads in dev, same trick used by the in-memory DB adapter.
const globalRef = globalThis as unknown as { __samvaadStorage?: MemoryStore };

function getMemoryStore(): MemoryStore {
  if (!globalRef.__samvaadStorage) {
    globalRef.__samvaadStorage = { files: new Map() };
  }
  return globalRef.__samvaadStorage;
}

class MemoryStorageDriver implements StorageDriver {
  async put(input: PutInput): Promise<StoredFile> {
    const key = makeKey(input.fileName);
    getMemoryStore().files.set(key, {
      data: input.data,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    return {
      key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
    };
  }

  async get(key: string): Promise<Buffer | null> {
    return getMemoryStore().files.get(key)?.data ?? null;
  }

  async remove(key: string): Promise<void> {
    getMemoryStore().files.delete(key);
  }
}

// ─── Supabase Storage driver ────────────────────────────────────────────────

/** Bucket must exist in the Supabase project (create it once, privately). */
const SUPABASE_BUCKET = "documents";

class SupabaseStorageDriver implements StorageDriver {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    const cfg = getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
      throw new AppError(500, "INTERNAL", "Supabase storage is not configured");
    }
    this.baseUrl = `${cfg.supabaseUrl}/storage/v1/object`;
    this.apiKey = cfg.supabaseServiceKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      apikey: this.apiKey,
      ...extra,
    };
  }

  private objectUrl(key: string): string {
    return `${this.baseUrl}/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`;
  }

  async put(input: PutInput): Promise<StoredFile> {
    const key = makeKey(input.fileName);
    const res = await fetch(this.objectUrl(key), {
      method: "POST",
      headers: this.headers({ "Content-Type": input.mimeType }),
      body: new Uint8Array(input.data),
    });
    if (!res.ok) {
      throw new AppError(502, "INTERNAL", `Storage upload failed: ${res.status} ${await res.text()}`);
    }
    return {
      key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
    };
  }

  async get(key: string): Promise<Buffer | null> {
    const res = await fetch(this.objectUrl(key), { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new AppError(502, "INTERNAL", `Storage download failed: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), { method: "DELETE", headers: this.headers() });
    if (!res.ok && res.status !== 404) {
      throw new AppError(502, "INTERNAL", `Storage delete failed: ${res.status}`);
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────

let driver: StorageDriver | null = null;

/** Get the configured, ready-to-use storage driver. */
export function getStorage(): StorageDriver {
  if (driver) return driver;
  driver =
    getConfig().databaseDriver === "supabase"
      ? new SupabaseStorageDriver()
      : new MemoryStorageDriver();
  return driver;
}
