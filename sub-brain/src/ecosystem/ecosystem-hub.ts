/**
 * Ecosystem Hub — 资源管理 + SQLite 持久化 + 能力交换
 */

import { subBrainDB } from "../db/sub-brain-db.js";

export interface Resource {
  id: string;
  name: string;
  type: string;
  data: unknown;
  sharedWith: string[];
  owner: string;
  createdAt: string;
  updatedAt?: string;
}

export class EcosystemHub {
  private resources = new Map<string, Resource>();
  private db = subBrainDB.getDb();

  async initialize(): Promise<void> {
    const rows = this.db.prepare("SELECT * FROM ecosystem_resources").all() as any[];
    for (const row of rows) {
      this.resources.set(row.id, {
        id: row.id,
        name: row.name,
        type: row.type,
        data: JSON.parse(row.data || "{}"),
        sharedWith: JSON.parse(row.shared_with || "[]"),
        owner: row.owner,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    console.log(`[ecosystem] Loaded ${this.resources.size} persisted resources`);
  }

  async register(name: string, type: string, data: unknown, owner: string = "default"): Promise<{ ok: boolean; resource_id?: string; error?: string }> {
    const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const resource: Resource = {
      id, name, type, data, sharedWith: [], owner,
      createdAt: new Date().toISOString(),
    };
    this.resources.set(id, resource);

    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO ecosystem_resources (id, name, type, data, shared_with, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(id, name, type, JSON.stringify(data), "[]", owner, resource.createdAt, resource.createdAt);

    return { ok: true, resource_id: id };
  }

  async share(resourceId: string, target: string): Promise<{ ok: boolean; error?: string }> {
    const res = this.resources.get(resourceId);
    if (!res) {
      return { ok: false, error: `Resource not found: ${resourceId}` };
    }
    if (!res.sharedWith.includes(target)) {
      res.sharedWith.push(target);
    }

    const stmt = this.db.prepare("UPDATE ecosystem_resources SET shared_with = ?, updated_at = ? WHERE id = ?");
    stmt.run(JSON.stringify(res.sharedWith), new Date().toISOString(), resourceId);

    return { ok: true };
  }

  async revoke(resourceId: string, target: string): Promise<{ ok: boolean; error?: string }> {
    const res = this.resources.get(resourceId);
    if (!res) return { ok: false, error: "Resource not found" };

    res.sharedWith = res.sharedWith.filter((t) => t !== target);

    const stmt = this.db.prepare("UPDATE ecosystem_resources SET shared_with = ?, updated_at = ? WHERE id = ?");
    stmt.run(JSON.stringify(res.sharedWith), new Date().toISOString(), resourceId);

    return { ok: true };
  }

  listResources(): Array<{ id: string; name: string; type: string; shared_count: number; owner: string }> {
    return Array.from(this.resources.values()).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      shared_count: r.sharedWith.length,
      owner: r.owner,
    }));
  }

  getResource(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  async deleteResource(id: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.resources.has(id)) return { ok: false, error: "Resource not found" };
    this.resources.delete(id);
    const stmt = this.db.prepare("DELETE FROM ecosystem_resources WHERE id = ?");
    stmt.run(id);
    return { ok: true };
  }
}
