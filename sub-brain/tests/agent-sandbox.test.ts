import { describe, it, expect, beforeEach } from 'vitest';
import { AgentSandbox } from '../src/agent/agent-sandbox.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('AgentSandbox', () => {
  let sandbox: AgentSandbox;
  let tmpDir: string;

  beforeEach(() => {
    sandbox = new AgentSandbox();
    tmpDir = mkdtempSync(join(tmpdir(), 'webrain-sandbox-test-'));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should create default policy for agent', () => {
    const policy = sandbox.createDefaultPolicy('agent-test');
    expect(policy.agentId).toBe('agent-test');
    expect(policy.allowNetwork).toBe(true);
    expect(policy.blockedTools).toContain('shell');
    expect(policy.blockedTools).toContain('docker');
    expect(policy.allowedPaths.length).toBeGreaterThan(0);
  });

  it('should get and update policy', () => {
    sandbox.createDefaultPolicy('agent-1');
    const p = sandbox.getPolicy('agent-1');
    expect(p).toBeDefined();

    const updated = sandbox.updatePolicy('agent-1', { maxMemoryMB: 256 });
    expect(updated).toBeDefined();
    expect(updated!.maxMemoryMB).toBe(256);
    expect(sandbox.getPolicy('agent-1')!.maxMemoryMB).toBe(256);
  });

  it('should allow file access within allowed paths', () => {
    const policy = sandbox.createDefaultPolicy('agent-2');
    const testFile = join(policy.allowedPaths[0], 'test.txt');
    writeFileSync(testFile, 'hello');

    const read = sandbox.checkFileAccess('agent-2', testFile, 'read');
    expect(read.allowed).toBe(true);

    const write = sandbox.checkFileAccess('agent-2', testFile, 'write');
    expect(write.allowed).toBe(true);
  });

  it('should block file access outside allowed paths', () => {
    sandbox.createDefaultPolicy('agent-3');
    const outsideFile = join(tmpdir(), 'outside.txt');
    writeFileSync(outsideFile, 'secret');

    const result = sandbox.checkFileAccess('agent-3', outsideFile, 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('outside allowed scope');
  });

  it('should block access to blocked paths', () => {
    sandbox.createDefaultPolicy('agent-4');
    const result = sandbox.checkFileAccess('agent-4', '/etc/shadow', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('should respect read-only paths', () => {
    const readOnlyDir = join(tmpDir, 'readonly');
    mkdirSync(readOnlyDir, { recursive: true });
    const readOnlyFile = join(readOnlyDir, 'config.txt');
    writeFileSync(readOnlyFile, 'config');

    sandbox.createPolicy({
      agentId: 'agent-5',
      allowedPaths: [tmpDir],
      readOnlyPaths: [readOnlyDir],
      blockedPaths: [],
      allowNetwork: true,
    });

    const read = sandbox.checkFileAccess('agent-5', readOnlyFile, 'read');
    expect(read.allowed).toBe(true);

    const write = sandbox.checkFileAccess('agent-5', readOnlyFile, 'write');
    expect(write.allowed).toBe(false);
    expect(write.reason).toContain('read-only');
  });

  it('should control network access', () => {
    sandbox.createPolicy({
      agentId: 'agent-6',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: false,
    });

    const result = sandbox.checkNetworkAccess('agent-6', 'example.com');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('should allow network with host whitelist', () => {
    sandbox.createPolicy({
      agentId: 'agent-7',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: true,
      allowedHosts: ['api.example.com'],
    });

    expect(sandbox.checkNetworkAccess('agent-7', 'api.example.com').allowed).toBe(true);
    expect(sandbox.checkNetworkAccess('agent-7', 'evil.com').allowed).toBe(false);
  });

  it('should block network for blocked hosts', () => {
    sandbox.createPolicy({
      agentId: 'agent-8',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: true,
      blockedHosts: ['malware.com'],
    });

    expect(sandbox.checkNetworkAccess('agent-8', 'malware.com').allowed).toBe(false);
    expect(sandbox.checkNetworkAccess('agent-8', 'safe.com').allowed).toBe(true);
  });

  it('should control tool access', () => {
    sandbox.createPolicy({
      agentId: 'agent-9',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: true,
      blockedTools: ['shell'],
    });

    expect(sandbox.checkToolAccess('agent-9', 'shell').allowed).toBe(false);
    expect(sandbox.checkToolAccess('agent-9', 'file_read').allowed).toBe(true);
  });

  it('should whitelist tools', () => {
    sandbox.createPolicy({
      agentId: 'agent-10',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: true,
      allowedTools: ['file_read', 'file_write'],
    });

    expect(sandbox.checkToolAccess('agent-10', 'file_read').allowed).toBe(true);
    expect(sandbox.checkToolAccess('agent-10', 'file_write').allowed).toBe(true);
    expect(sandbox.checkToolAccess('agent-10', 'shell').allowed).toBe(false);
  });

  it('should create and manage sessions', () => {
    const session = sandbox.createSession('agent-11');
    expect(session.sessionId).toBeDefined();
    expect(session.agentId).toBe('agent-11');
    expect(session.active).toBe(true);

    const retrieved = sandbox.getSession(session.sessionId);
    expect(retrieved).toBeDefined();

    sandbox.closeSession(session.sessionId);
    expect(sandbox.getSession(session.sessionId)!.active).toBe(false);
  });

  it('should perform sandboxed read/write', () => {
    const policy = sandbox.createDefaultPolicy('agent-12');
    const testFile = join(policy.allowedPaths[0], 'sandboxed.txt');

    const writeResult = sandbox.sandboxedWrite('agent-12', testFile, 'hello world');
    expect(writeResult.ok).toBe(true);

    const readResult = sandbox.sandboxedRead('agent-12', testFile);
    expect(readResult.ok).toBe(true);
    expect(readResult.content).toBe('hello world');
  });

  it('should reject sandboxed write outside scope', () => {
    sandbox.createDefaultPolicy('agent-13');
    const outsideFile = join(tmpdir(), 'forbidden.txt');

    const result = sandbox.sandboxedWrite('agent-13', outsideFile, 'data');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('outside allowed scope');
  });

  it('should enforce max file size', () => {
    sandbox.createPolicy({
      agentId: 'agent-14',
      allowedPaths: [tmpDir],
      readOnlyPaths: [],
      blockedPaths: [],
      allowNetwork: true,
      maxFileSizeMB: 0.001, // ~1KB
    });

    const bigFile = join(tmpDir, 'big.txt');
    const bigContent = 'x'.repeat(10 * 1024); // 10KB
    const result = sandbox.sandboxedWrite('agent-14', bigFile, bigContent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('exceeds limit');
  });

  it('should record audit logs', () => {
    sandbox.createPolicy({
      agentId: 'agent-15',
      allowedPaths: [],
      readOnlyPaths: [],
      blockedPaths: ['/etc/shadow'],
      allowNetwork: true,
      blockedHosts: ['evil.com'],
    });
    sandbox.checkFileAccess('agent-15', '/etc/shadow', 'read');
    sandbox.checkNetworkAccess('agent-15', 'evil.com');

    const logs = sandbox.getAuditLogs('agent-15');
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some(l => l.action === 'file_access' && !l.allowed)).toBe(true);
    expect(logs.some(l => l.action === 'network_access' && !l.allowed)).toBe(true);
  });

  it('should provide stats', () => {
    sandbox.createDefaultPolicy('agent-stats');
    sandbox.createSession('agent-stats');
    sandbox.checkFileAccess('agent-stats', '/etc/shadow', 'read');

    const stats = sandbox.getStats();
    expect(stats.totalPolicies).toBeGreaterThanOrEqual(1);
    expect(stats.totalAuditLogs).toBeGreaterThanOrEqual(1);
    expect(stats.blockedActions).toBeGreaterThanOrEqual(1);
  });
});
