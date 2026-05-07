import { describe, it, expect, beforeEach } from 'vitest';
import { AgentTemplateEngine } from '../src/agent/template-engine.js';

describe('AgentTemplateEngine', () => {
  let engine: AgentTemplateEngine;

  beforeEach(() => {
    // Clean up custom templates from disk before each test
    try {
      const { readdirSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      const dir = join(homedir(), '.webrain', 'agents', 'templates');
      for (const f of readdirSync(dir)) {
        if (!f.startsWith('tpl-') || !f.endsWith('.json')) continue;
        // Only delete non-built-in templates (builtins don't have files on disk)
        try { unlinkSync(join(dir, f)); } catch {}
      }
    } catch {}
    engine = new AgentTemplateEngine();
  });

  it('should load built-in templates on init', () => {
    const all = engine.list();
    expect(all.length).toBeGreaterThanOrEqual(7);
    expect(all.some(t => t.id === 'tpl-researcher')).toBe(true);
    expect(all.some(t => t.id === 'tpl-coder')).toBe(true);
  });

  it('should get template by id', () => {
    const tpl = engine.get('tpl-coder');
    expect(tpl).toBeDefined();
    expect(tpl!.name).toBe('Code Agent');
    expect(tpl!.blueprint.role).toBe('coder');
    expect(tpl!.isBuiltIn).toBe(true);
  });

  it('should return undefined for unknown template', () => {
    expect(engine.get('nonexistent')).toBeUndefined();
  });

  it('should list templates by category', () => {
    const dev = engine.list('development');
    expect(dev.length).toBe(1);
    expect(dev[0].id).toBe('tpl-coder');

    const data = engine.list('data');
    expect(data.length).toBe(1);
    expect(data[0].id).toBe('tpl-analyst');
  });

  it('should list templates by tag', () => {
    const research = engine.list(undefined, 'research');
    expect(research.length).toBe(1);
    expect(research[0].id).toBe('tpl-researcher');
  });

  it('should create custom template', () => {
    const created = engine.create({
      name: 'Custom Agent',
      description: 'Test custom template',
      category: 'test',
      version: '1.0.0',
      author: 'test',
      tags: ['test'],
      blueprint: {
        role: 'tester',
        systemPrompt: 'You are a test agent.',
        capabilities: ['chat'],
        tools: ['shell'],
        modelConfig: {},
        channels: [],
        maxSteps: 5,
        harnessEnabled: false,
      },
    });

    expect(created.id).toBeDefined();
    expect(created.isBuiltIn).toBe(false);
    expect(engine.get(created.id)).toBeDefined();
    expect(engine.list().length).toBeGreaterThanOrEqual(8);
  });

  it('should not delete built-in templates', () => {
    const result = engine.delete('tpl-coder');
    expect(result).toBe(false);
    expect(engine.get('tpl-coder')).toBeDefined();
  });

  it('should delete custom templates', () => {
    const created = engine.create({
      name: 'Temp',
      description: 'd',
      category: 'c',
      version: '1.0.0',
      author: 'a',
      tags: [],
      blueprint: { role: 'r', systemPrompt: 's', capabilities: [], tools: [], modelConfig: {}, channels: [] },
    });
    expect(engine.delete(created.id)).toBe(true);
    expect(engine.get(created.id)).toBeUndefined();
  });

  it('should instantiate template with variable substitution', () => {
    const result = engine.instantiate('tpl-coder', {
      name: 'My Coder',
      variables: { language: 'rust', style: 'clippy' },
    });

    expect(result.ok).toBe(true);
    expect(result.card).toBeDefined();
    expect(result.card!.name).toBe('My Coder');
    expect(result.card!.role).toBe('coder');
    expect(result.card!.templateId).toBe('tpl-coder');
  });

  it('should fail instantiation for unknown template', () => {
    const result = engine.instantiate('unknown', {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should provide categories and tags', () => {
    const cats = engine.getCategories();
    expect(cats.length).toBeGreaterThanOrEqual(7);
    expect(cats).toContain('development');
    expect(cats).toContain('security');

    const tags = engine.getTags();
    expect(tags.length).toBeGreaterThan(10);
    expect(tags).toContain('coding');
    expect(tags).toContain('research');
  });

  it('should provide stats', () => {
    const stats = engine.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(7);
    expect(stats.builtin).toBeGreaterThanOrEqual(7);
    expect(stats.custom).toBeGreaterThanOrEqual(0);
    expect(stats.categories.length).toBeGreaterThanOrEqual(7);
  });
});
