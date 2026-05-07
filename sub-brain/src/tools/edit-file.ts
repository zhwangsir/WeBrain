/**
 * Edit File Tool — 精确文件编辑
 * 支持: 行级替换、多行替换、插入、删除、字符串替换、apply_patch
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { registry, ToolDefinition } from "./tool-registry.js";

const editFileDef: ToolDefinition = {
  name: "edit_file",
  description: "Precisely edit a file: replace lines, insert, delete, or string replacement. Shows a diff preview.",
  category: "filesystem",
  parameters: [
    { name: "path", type: "string", description: "File path", required: true },
    { name: "operation", type: "string", description: "Operation: replace_line, replace_string, insert_after, insert_before, delete_line, delete_range, append", required: true },
    { name: "target", type: "string", description: "Target: line number, string to find, or line content", required: true },
    { name: "replacement", type: "string", description: "Replacement content (for replace/insert operations)", default: "" },
    { name: "preview", type: "boolean", description: "Return diff preview without writing", default: false },
  ],
};

async function editFileExecute(params: Record<string, unknown>) {
  const filePath = resolve(String(params.path || ""));
  const operation = String(params.operation || "");
  const target = String(params.target || "");
  const replacement = String(params.replacement || "");
  const preview = Boolean(params.preview);

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let newLines: string[] = [...lines];
    let diff: Array<{ type: "keep" | "remove" | "add"; line: string; lineNum: number }> = [];

    switch (operation) {
      case "replace_line": {
        const lineNum = parseInt(target, 10) - 1;
        if (lineNum < 0 || lineNum >= lines.length) {
          return { error: `Line ${target} out of range (1-${lines.length})` };
        }
        diff = buildDiff(lines, lineNum, lineNum + 1, replacement.split("\n"));
        newLines = [...lines.slice(0, lineNum), ...replacement.split("\n"), ...lines.slice(lineNum + 1)];
        break;
      }

      case "replace_string": {
        if (!content.includes(target)) {
          return { error: `String not found: "${target.slice(0, 50)}..."` };
        }
        const newContent = content.split(target).join(replacement);
        newLines = newContent.split("\n");
        diff = [{ type: "keep", line: `[Replaced ${target.length} chars with ${replacement.length} chars]`, lineNum: 0 }];
        break;
      }

      case "insert_after": {
        const lineNum = parseInt(target, 10) - 1;
        if (lineNum < 0 || lineNum >= lines.length) {
          return { error: `Line ${target} out of range` };
        }
        const insertLines = replacement.split("\n");
        newLines = [...lines.slice(0, lineNum + 1), ...insertLines, ...lines.slice(lineNum + 1)];
        diff = buildDiff(lines, lineNum + 1, lineNum + 1, insertLines);
        break;
      }

      case "insert_before": {
        const lineNum = parseInt(target, 10) - 1;
        if (lineNum < 0 || lineNum >= lines.length) {
          return { error: `Line ${target} out of range` };
        }
        const insertLines = replacement.split("\n");
        newLines = [...lines.slice(0, lineNum), ...insertLines, ...lines.slice(lineNum)];
        diff = buildDiff(lines, lineNum, lineNum, insertLines);
        break;
      }

      case "delete_line": {
        const lineNum = parseInt(target, 10) - 1;
        if (lineNum < 0 || lineNum >= lines.length) {
          return { error: `Line ${target} out of range` };
        }
        diff = buildDiff(lines, lineNum, lineNum + 1, []);
        newLines = [...lines.slice(0, lineNum), ...lines.slice(lineNum + 1)];
        break;
      }

      case "delete_range": {
        const [start, end] = target.split("-").map((s) => parseInt(s.trim(), 10) - 1);
        if (start < 0 || end >= lines.length || start > end) {
          return { error: `Invalid range: ${target}` };
        }
        diff = buildDiff(lines, start, end + 1, []);
        newLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
        break;
      }

      case "append": {
        newLines = [...lines, ...replacement.split("\n")];
        diff = buildDiff(lines, lines.length, lines.length, replacement.split("\n"));
        break;
      }

      default:
        return { error: `Unknown operation: ${operation}` };
    }

    if (preview) {
      return {
        preview: true,
        diff: diff.slice(0, 50),
        old_line_count: lines.length,
        new_line_count: newLines.length,
      };
    }

    writeFileSync(filePath, newLines.join("\n"), "utf-8");
    return {
      ok: true,
      path: filePath,
      operation,
      old_line_count: lines.length,
      new_line_count: newLines.length,
      diff_preview: diff.slice(0, 20),
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

function buildDiff(
  oldLines: string[],
  removeStart: number,
  removeEnd: number,
  addLines: string[],
): Array<{ type: "keep" | "remove" | "add"; line: string; lineNum: number }> {
  const diff: Array<{ type: "keep" | "remove" | "add"; line: string; lineNum: number }> = [];

  // Context before
  const ctxStart = Math.max(0, removeStart - 2);
  for (let i = ctxStart; i < removeStart; i++) {
    diff.push({ type: "keep", line: oldLines[i], lineNum: i + 1 });
  }

  // Removed lines
  for (let i = removeStart; i < removeEnd; i++) {
    diff.push({ type: "remove", line: oldLines[i], lineNum: i + 1 });
  }

  // Added lines
  for (const line of addLines) {
    diff.push({ type: "add", line, lineNum: removeStart + 1 });
  }

  // Context after
  const ctxEnd = Math.min(oldLines.length, removeEnd + 2);
  for (let i = removeEnd; i < ctxEnd; i++) {
    diff.push({ type: "keep", line: oldLines[i], lineNum: i + 1 });
  }

  return diff;
}

// ─── Apply Patch ─────────────────────────────────────────────────

const applyPatchDef: ToolDefinition = {
  name: "apply_patch",
  description: "Apply a unified diff patch to a file",
  category: "filesystem",
  parameters: [
    { name: "path", type: "string", description: "File path", required: true },
    { name: "patch", type: "string", description: "Unified diff patch content", required: true },
    { name: "preview", type: "boolean", description: "Return diff preview without writing", default: false },
  ],
};

async function applyPatchExecute(params: Record<string, unknown>) {
  const filePath = resolve(String(params.path || ""));
  const patchContent = String(params.patch || "");
  const preview = Boolean(params.preview);

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Simple patch parser for @@ -start,count +start,count @@ format
    const patchLines = patchContent.split("\n");
    let result: string[] = [...lines];
    let changed = 0;

    for (let i = 0; i < patchLines.length; i++) {
      const line = patchLines[i];
      if (line.startsWith("@@")) {
        // Parse hunk header
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) continue;
        const oldStart = parseInt(match[1], 10) - 1;
        const oldCount = parseInt(match[2] || "1", 10);
        // const newStart = parseInt(match[3], 10) - 1;
        // const newCount = parseInt(match[4] || "1", 10);

        const hunkAdd: string[] = [];
        let j = i + 1;
        while (j < patchLines.length && !patchLines[j].startsWith("@@") && patchLines[j] !== "---" && !patchLines[j].startsWith("diff ")) {
          if (patchLines[j].startsWith("+")) {
            hunkAdd.push(patchLines[j].slice(1));
          } else if (!patchLines[j].startsWith("-") && !patchLines[j].startsWith("\\")) {
            hunkAdd.push(patchLines[j].slice(1)); // Context line
          }
          j++;
        }

        // Simple replacement: remove old lines, insert new lines
        result = [...result.slice(0, oldStart), ...hunkAdd, ...result.slice(oldStart + oldCount)];
        changed++;
      }
    }

    if (preview) {
      return {
        preview: true,
        hunks: changed,
        old_line_count: lines.length,
        new_line_count: result.length,
      };
    }

    writeFileSync(filePath, result.join("\n"), "utf-8");
    return {
      ok: true,
      path: filePath,
      hunks_applied: changed,
      old_line_count: lines.length,
      new_line_count: result.length,
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── Registration ────────────────────────────────────────────────

export function registerEditFileTools(): void {
  registry.register(editFileDef, editFileExecute);
  registry.register(applyPatchDef, applyPatchExecute);
}
