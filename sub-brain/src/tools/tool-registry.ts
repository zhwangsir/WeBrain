/**
 * Tool Registry — 自注册工具系统
 * Tool registry for managing available tools
 */

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: string;
}

export type ToolExecuteFn = (params: Record<string, unknown>) => Promise<unknown>;

export interface RegisteredTool {
  def: ToolDefinition;
  execute: ToolExecuteFn;
}

class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(def: ToolDefinition, execute: ToolExecuteFn): void {
    if (this.tools.has(def.name)) {
      console.warn(`[tool-registry] Tool "${def.name}" already registered, overwriting`);
    }
    this.tools.set(def.name, { def, execute });
    console.log(`[tool-registry] Registered: ${def.name} (${def.category})`);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.def);
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  categories(): string[] {
    const cats = new Set<string>();
    for (const t of this.tools.values()) cats.add(t.def.category);
    return Array.from(cats);
  }

  byCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.def.category === category)
      .map(t => t.def);
  }
}

export const registry = new ToolRegistry();
