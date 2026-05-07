import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/agent/workflow-engine.js';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    // Clean persisted workflows and runs
    try {
      const { readdirSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      for (const subdir of ['workflows', 'workflow-runs']) {
        const dir = join(homedir(), '.webrain', 'agents', subdir);
        for (const f of readdirSync(dir)) {
          if (f.endsWith('.json')) try { unlinkSync(join(dir, f)); } catch {}
        }
      }
    } catch {}
    engine = new WorkflowEngine();
  });

  function createSimpleWorkflow() {
    return engine.createWorkflow({
      name: 'Test Workflow',
      description: 'Simple linear workflow',
      nodes: [
        { id: 'n1', type: 'delay', name: 'step1', config: {}, delayMs: 10 },
        { id: 'n2', type: 'delay', name: 'step2', config: {}, delayMs: 10 },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });
  }

  it('should create a workflow', () => {
    const result = createSimpleWorkflow();
    expect(result.ok).toBe(true);
    expect(result.workflow).toBeDefined();
    expect(result.workflow!.id).toBeDefined();
    expect(result.workflow!.nodes.length).toBe(2);
  });

  it('should reject workflows with cycles', () => {
    const result = engine.createWorkflow({
      name: 'Cyclic',
      description: 'Bad workflow',
      nodes: [
        { id: 'a', type: 'delay', name: 'a', config: {}, delayMs: 10 },
        { id: 'b', type: 'delay', name: 'b', config: {}, delayMs: 10 },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cycles');
  });

  it('should get and list workflows', () => {
    const { workflow } = createSimpleWorkflow() as any;
    expect(engine.getWorkflow(workflow.id)).toBeDefined();
    expect(engine.listWorkflows().length).toBeGreaterThanOrEqual(1);
    expect(engine.listWorkflows('default').length).toBeGreaterThanOrEqual(1);
    expect(engine.listWorkflows('other')).toHaveLength(0);
  });

  it('should validate workflow', () => {
    const { workflow } = createSimpleWorkflow() as any;
    const validation = engine.validateWorkflow(workflow.id);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect validation errors', () => {
    // Cycle is rejected at creation
    const cyclic = engine.createWorkflow({
      name: 'Cyclic',
      description: 'd',
      nodes: [
        { id: 'a', type: 'delay', name: 'a', config: {}, delayMs: 10 },
        { id: 'b', type: 'delay', name: 'b', config: {}, delayMs: 10 },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });
    expect(cyclic.ok).toBe(false);
    expect(cyclic.error).toContain('cycles');

    // Missing end node
    const disconnected = engine.createWorkflow({
      name: 'Disconnected',
      description: 'd',
      nodes: [
        { id: 'a', type: 'delay', name: 'a', config: {}, delayMs: 10 },
        { id: 'b', type: 'delay', name: 'b', config: {}, delayMs: 10 },
      ],
      edges: [],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });
    expect(disconnected.ok).toBe(true);
    const validation = engine.validateWorkflow(disconnected.workflow!.id);
    // Disconnected nodes (no edges) are technically valid (multi-start/multi-end allowed)
    expect(validation.valid).toBe(true);
  });

  it('should run a simple workflow', async () => {
    const { workflow } = createSimpleWorkflow() as any;
    const run = await engine.runWorkflow(workflow.id, { input: 'test' });
    expect(run.status).toBe('completed');
    expect(run.nodeResults['n1'].status).toBe('completed');
    expect(run.nodeResults['n2'].status).toBe('completed');
    expect(run.outputs['step1']).toEqual({ delayed: 10 });
    expect(run.outputs['step2']).toEqual({ delayed: 10 });
  });

  it('should run parallel branches', async () => {
    engine.createWorkflow({
      name: 'Parallel',
      description: 'Parallel then join',
      nodes: [
        { id: 'start', type: 'delay', name: 'start', config: {}, delayMs: 5 },
        { id: 'branch1', type: 'delay', name: 'b1', config: {}, delayMs: 10 },
        { id: 'branch2', type: 'delay', name: 'b2', config: {}, delayMs: 10 },
        { id: 'join', type: 'join', name: 'join', config: {} },
      ],
      edges: [
        { from: 'start', to: 'branch1' },
        { from: 'start', to: 'branch2' },
        { from: 'branch1', to: 'join' },
        { from: 'branch2', to: 'join' },
      ],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });

    const wf = engine.listWorkflows().find(w => w.name === 'Parallel')!;
    const run = await engine.runWorkflow(wf.id, {});
    expect(run.status).toBe('completed');
    expect(run.nodeResults['branch1'].status).toBe('completed');
    expect(run.nodeResults['branch2'].status).toBe('completed');
    expect(run.nodeResults['join'].status).toBe('completed');
  });

  it('should run conditional workflow', async () => {
    engine.createWorkflow({
      name: 'Conditional',
      description: 'Branch based on input',
      nodes: [
        { id: 'check', type: 'condition', name: 'check', config: {}, condition: 'inputs.shouldRun === true' },
        { id: 'if-yes', type: 'delay', name: 'yes', config: {}, delayMs: 5 },
        { id: 'if-no', type: 'delay', name: 'no', config: {}, delayMs: 5 },
      ],
      edges: [
        { from: 'check', to: 'if-yes', condition: 'inputs.shouldRun === true' },
        { from: 'check', to: 'if-no', condition: 'inputs.shouldRun !== true' },
      ],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });

    const wf = engine.listWorkflows().find(w => w.name === 'Conditional')!;
    const run = await engine.runWorkflow(wf.id, { shouldRun: true });
    expect(run.status).toBe('completed');
    expect(run.nodeResults['if-yes'].status).toBe('completed');
    expect(run.nodeResults['if-no'].status).toBe('skipped');
  });

  it('should handle node retries', async () => {
    let callCount = 0;
    engine.registerExecutor('tool', async () => {
      callCount++;
      if (callCount < 3) throw new Error('fail');
      return { ok: true };
    });

    engine.createWorkflow({
      name: 'RetryTest',
      description: 'd',
      nodes: [
        { id: 'r1', type: 'tool', name: 'r1', config: {}, toolName: 'test', retries: 3, retryDelayMs: 10 },
      ],
      edges: [],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });

    const wf = engine.listWorkflows().find(w => w.name === 'RetryTest')!;
    const run = await engine.runWorkflow(wf.id, {});
    expect(run.status).toBe('completed');
    expect(run.nodeResults['r1'].attempts).toBe(3);
    expect(callCount).toBe(3);
  });

  it('should fail workflow on node failure', async () => {
    engine.registerExecutor('tool', async () => {
      throw new Error('always fails');
    });

    engine.createWorkflow({
      name: 'FailTest',
      description: 'd',
      nodes: [
        { id: 'f1', type: 'tool', name: 'f1', config: {}, toolName: 'test', retries: 0 },
      ],
      edges: [],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });

    const wf = engine.listWorkflows().find(w => w.name === 'FailTest')!;
    const run = await engine.runWorkflow(wf.id, {});
    expect(run.status).toBe('failed');
    expect(run.nodeResults['f1'].status).toBe('failed');
    expect(run.error).toContain('f1');
  });

  it('should cancel running workflow', async () => {
    engine.createWorkflow({
      name: 'Long',
      description: 'd',
      nodes: [
        { id: 'l1', type: 'delay', name: 'l1', config: {}, delayMs: 5000 },
      ],
      edges: [],
      owner: 'test',
      workspaceId: 'default',
      version: '1.0.0',
    });

    const wf = engine.listWorkflows().find(w => w.name === 'Long')!;
    const runPromise = engine.runWorkflow(wf.id, {});

    // Wait a bit then cancel
    await new Promise(r => setTimeout(r, 100));
    const runs = engine.listRuns(wf.id);
    const runId = runs.find(r => r.status === 'running')?.runId;
    if (runId) {
      engine.cancelRun(runId);
    }

    const run = await runPromise;
    expect(run.status).toBe('cancelled');
  }, 10000);

  it('should get run details', async () => {
    const { workflow } = createSimpleWorkflow() as any;
    const run = await engine.runWorkflow(workflow.id, {});
    const retrieved = engine.getRun(run.runId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.runId).toBe(run.runId);
  });

  it('should delete workflow', () => {
    const { workflow } = createSimpleWorkflow() as any;
    expect(engine.deleteWorkflow(workflow.id)).toBe(true);
    expect(engine.getWorkflow(workflow.id)).toBeUndefined();
  });

  it('should provide stats', () => {
    createSimpleWorkflow();
    const stats = engine.getStats();
    expect(stats.totalWorkflows).toBeGreaterThanOrEqual(1);
  });
});
