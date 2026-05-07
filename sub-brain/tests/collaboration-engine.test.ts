import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentCollaborationEngine,
  type A2AMessage,
  type AgentConversation,
} from '../src/agent/collaboration-engine.js';

describe('AgentCollaborationEngine', () => {
  let engine: AgentCollaborationEngine;
  const mockResolver = vi.fn((id: string) => ({ id, name: id } as any));

  beforeEach(() => {
    // Clean persisted data
    try {
      const { readdirSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      const base = join(homedir(), '.webrain', 'agents');
      for (const subdir of ['messages', 'conversations', 'votes']) {
        try {
          const dir = join(base, subdir);
          for (const f of readdirSync(dir)) {
            if (f.endsWith('.json')) try { unlinkSync(join(dir, f)); } catch {}
          }
        } catch {}
      }
    } catch {}
    engine = new AgentCollaborationEngine(mockResolver);
  });

  it('should broadcast a message', async () => {
    const msg = await engine.broadcast('agent-a', 'test-topic', { data: 1 });
    expect(msg.type).toBe('broadcast');
    expect(msg.from).toBe('agent-a');
    expect(msg.topic).toBe('test-topic');
    expect(msg.payload).toEqual({ data: 1 });
    expect(msg.id).toBeDefined();
    expect(msg.timestamp).toBeDefined();
  });

  it('should send direct message', async () => {
    const msg = await engine.sendDirect('agent-a', 'agent-b', 'direct-topic', { text: 'hello' });
    expect(msg.type).toBe('direct');
    expect(msg.from).toBe('agent-a');
    expect(msg.to).toBe('agent-b');
    expect(msg.payload).toEqual({ text: 'hello' });
  });

  it('should store messages and retrieve them', async () => {
    await engine.broadcast('agent-a', 't1', { v: 1 });
    await engine.broadcast('agent-b', 't2', { v: 2 });
    await engine.sendDirect('agent-a', 'agent-b', 't3', { v: 3 });

    const all = engine.getMessages();
    expect(all.length).toBeGreaterThanOrEqual(3);

    const fromA = engine.getMessages({ from: 'agent-a' });
    expect(fromA.length).toBeGreaterThanOrEqual(2);

    const typeDirect = engine.getMessages({ type: 'direct' });
    expect(typeDirect.length).toBeGreaterThanOrEqual(1);
  });

  it('should create and manage conversations', async () => {
    await engine.sendDirect('a', 'b', 'chat-1', { text: 'hi' });
    await engine.sendDirect('b', 'a', 'chat-1', { text: 'hello' });

    const conv = engine.getConversation('chat-1');
    expect(conv).toBeDefined();
    expect(conv!.topic).toBe('chat-1');
    expect(conv!.agentIds).toContain('a');
    expect(conv!.agentIds).toContain('b');
    expect(conv!.messages.length).toBeGreaterThanOrEqual(2);

    const list = engine.listConversations('a');
    expect(list.some(c => c.id === 'chat-1')).toBe(true);
  });

  it.skip('should handle request/response pattern', async () => {
    // Setup response handler
    engine.on('request', (msg: A2AMessage) => {
      const req = (msg.payload as any).request;
      if (req) {
        // Resolve pending request synchronously, then send response message in background
        engine.respond(req.id, 'agent-b', 'agent-a', true, { result: 42 }).catch(() => {});
      }
    });

    const resp = await engine.request('agent-a', 'agent-b', 'compute', { x: 1 }, 3000);
    expect(resp.ok).toBe(true);
    expect(resp.result).toEqual({ result: 42 });
    expect(resp.from).toBe('agent-b');
  }, 10000);

  it('should timeout on request if no response', async () => {
    await expect(engine.request('agent-a', 'agent-b', 'slow', {}, 100)).rejects.toThrow('timed out');
  });

  it('should delegate task and receive result', async () => {
    engine.on('delegate', async (msg: A2AMessage) => {
      const { delegateId, taskType } = msg.payload as any;
      await engine.reportDelegationResult(delegateId, 'agent-b', 'agent-a', true, { taskType, done: true });
    });

    const { taskId, result } = await engine.delegate('agent-a', 'agent-b', 'task-x', { p: 1 }, 'ctx-1');
    expect(taskId).toBeDefined();
    const output = await result;
    expect(output).toEqual({ taskType: 'task-x', done: true });
  });

  it('should create and vote on proposals', () => {
    const prop = engine.createProposal('agent-a', 'deploy', 'Deploy to prod?', 2, 60);
    expect(prop.topic).toBe('deploy');
    expect(prop.quorum).toBe(2);
    expect(prop.status).toBe('open');
    expect(prop.votes.length).toBe(0);

    // First vote — not enough quorum
    const v1 = engine.castVote('agent-b', prop.id, 'yes');
    expect(v1.ok).toBe(true);
    expect(v1.proposal!.status).toBe('open');

    // Second vote — reaches quorum
    const v2 = engine.castVote('agent-c', prop.id, 'yes');
    expect(v2.ok).toBe(true);
    expect(v2.proposal!.status).toBe('passed');
    expect(v2.proposal!.result).toEqual({ yes: 2, total: 2 });
  });

  it('should reject votes on closed proposals', () => {
    const prop = engine.createProposal('a', 't', 'd', 1, 60);
    engine.castVote('b', prop.id, 'yes');
    const result = engine.castVote('c', prop.id, 'no');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('already passed');
  });

  it.skip('should list proposals by status', () => {
    const p1 = engine.createProposal('a', 't1', 'd1', 5, 3600);
    const p2 = engine.createProposal('b', 't2', 'd2', 5, 3600);
    engine.closeProposal(p1.id);

    const allOpen = engine.listProposals('open');
    const allRejected = engine.listProposals('rejected');

    // p1 should be closed (rejected because no votes)
    expect(allRejected.some(p => p.id === p1.id)).toBe(true);
    // p2 should still be open
    expect(allOpen.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide stats', async () => {
    await engine.broadcast('a', 't', {});
    await engine.sendDirect('a', 'b', 't', {});
    engine.createProposal('a', 'p', 'd', 1, 3600);

    const stats = engine.getStats();
    expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
    expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
    expect(stats.activeProposals).toBeGreaterThanOrEqual(1);
    expect(Object.keys(stats.agentActivity)).toContain('a');
  });

  it('should handle message handler registration and unregistration', async () => {
    const handler = vi.fn();
    const unsubscribe = engine.on('broadcast', handler);

    await engine.broadcast('a', 't', {});
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    await engine.broadcast('a', 't', {});
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });
});
