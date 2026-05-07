/**
 * Skills System — Agent 自主技能创建与改进
 * Skills system: Agents can create skills from experience and self-improve
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

export interface Skill {
  id: string;
  name: string;
  description: string;
  triggerPatterns: string[];
  code: string;
  language: "python" | "javascript" | "typescript";
  usageCount: number;
  successRate: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface SkillInvocation {
  skillId: string;
  sessionId: string;
  params: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: string;
}

const SKILLS_DIR = join(homedir(), ".webrain", "skills");
const SKILLS_PATH = join(SKILLS_DIR, "skills.json");
const INVOCATIONS_PATH = join(SKILLS_DIR, "invocations.json");

export class SkillManager {
  private skills = new Map<string, Skill>();
  private invocations: SkillInvocation[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      // Load user skills
      if (existsSync(SKILLS_PATH)) {
        const list: Skill[] = JSON.parse(readFileSync(SKILLS_PATH, "utf-8"));
        for (const s of list) this.skills.set(s.id, s);
      }
      if (existsSync(INVOCATIONS_PATH)) {
        this.invocations = JSON.parse(readFileSync(INVOCATIONS_PATH, "utf-8"));
      }
      // Load built-in skills (seed if not present)
      this._loadBuiltins();
    } catch (err) {
      console.error("[skills] Load failed:", err);
    }
  }

  private _loadBuiltins(): void {
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const builtinsDir = join(__dirname, "builtins");
      if (!existsSync(builtinsDir)) return;
      const files = readdirSync(builtinsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const raw = JSON.parse(readFileSync(join(builtinsDir, file), "utf-8"));
        const skill: Skill = {
          ...raw,
          usageCount: 0,
          successRate: 1.0,
          createdBy: "webrain-built-in",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Only add if not already present (user may have overridden)
        if (!this.skills.has(skill.id)) {
          this.skills.set(skill.id, skill);
        }
      }
      console.log(`[skills] Loaded ${files.length} built-in skills`);
    } catch (err) {
      console.warn("[skills] Built-in load failed:", err);
    }
  }

  private save(): void {
    if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
    writeFileSync(SKILLS_PATH, JSON.stringify(Array.from(this.skills.values()), null, 2));
    writeFileSync(INVOCATIONS_PATH, JSON.stringify(this.invocations.slice(-1000), null, 2));
  }

  createSkill(
    name: string,
    description: string,
    code: string,
    language: Skill["language"] = "python",
    triggerPatterns: string[] = [],
    createdBy = "agent-default",
    tags: string[] = []
  ): Skill {
    const skill: Skill = {
      id: `skill-${Date.now()}`,
      name,
      description,
      triggerPatterns,
      code,
      language,
      usageCount: 0,
      successRate: 0,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      tags,
    };
    this.skills.set(skill.id, skill);
    this.save();
    return skill;
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  searchSkills(query: string): Skill[] {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  matchSkill(userInput: string): Skill | undefined {
    const input = userInput.toLowerCase();
    for (const skill of this.skills.values()) {
      for (const pattern of skill.triggerPatterns) {
        if (input.includes(pattern.toLowerCase())) {
          return skill;
        }
      }
    }
    return undefined;
  }

  async invokeSkill(skillId: string, params: Record<string, unknown>, sessionId: string): Promise<unknown> {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    let success = false;
    let result: unknown;
    let error: string | undefined;

    try {
      if (skill.language === "python") {
        const { execSync } = await import("child_process");
        const paramJson = JSON.stringify(params).replace(/"/g, '\\"');
        const wrapped = `import json\nparams = json.loads("${paramJson}")\n${skill.code}`;
        result = execSync(`python3 -c "${wrapped.replace(/"/g, '\\"')}"`, { encoding: "utf-8", timeout: 30000 });
        success = true;
      } else if (skill.language === "javascript" || skill.language === "typescript") {
        const paramJson = JSON.stringify(params);
        const wrapped = `const params = ${paramJson};\n${skill.code}`;
        const { execSync } = await import("child_process");
        result = execSync(`node -e "${wrapped.replace(/"/g, '\\"')}"`, { encoding: "utf-8", timeout: 30000 });
        success = true;
      }
    } catch (err: any) {
      error = String(err.message || err);
      result = error;
    }

    skill.usageCount++;
    const inv: SkillInvocation = {
      skillId,
      sessionId,
      params,
      success,
      result,
      error,
      timestamp: new Date().toISOString(),
    };
    this.invocations.push(inv);

    const skillInvs = this.invocations.filter(i => i.skillId === skillId);
    const successCount = skillInvs.filter(i => i.success).length;
    skill.successRate = skillInvs.length > 0 ? successCount / skillInvs.length : 0;
    skill.updatedAt = new Date().toISOString();

    this.save();
    return { success, result, error };
  }

  improveSkill(skillId: string, improvedCode: string, reason: string): Skill | undefined {
    const skill = this.skills.get(skillId);
    if (!skill) return undefined;
    skill.code = improvedCode;
    skill.version++;
    skill.updatedAt = new Date().toISOString();
    skill.tags = [...new Set([...skill.tags, "improved", reason])];
    this.save();
    return skill;
  }

  deleteSkill(skillId: string): boolean {
    const ok = this.skills.delete(skillId);
    if (ok) this.save();
    return ok;
  }

  getStats(): { total: number; totalInvocations: number; avgSuccessRate: number } {
    const skills = Array.from(this.skills.values());
    const total = skills.length;
    const totalInvocations = this.invocations.length;
    const avgSuccessRate = total > 0 ? skills.reduce((sum, s) => sum + s.successRate, 0) / total : 0;
    return { total, totalInvocations, avgSuccessRate };
  }
}
