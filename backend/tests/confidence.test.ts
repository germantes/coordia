import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { defaultRule, evaluateConfidence, proximityFactor, type Contribution } from '../src/models/confidence.js';
import { ReportStore } from '../src/models/report.js';

function confirm(reputation: number, seconds: number): Contribution {
  return { response: 'confirm', reputation, updatedAt: new Date(seconds * 1000).toISOString() };
}

it('reproduces the T1 score, threshold and rolling burst window while keeping low scores pending', () => {
  expect(evaluateConfidence(defaultRule, 0.9, proximityFactor(100), [confirm(0.85, 0), confirm(0.90, 300), confirm(0.80, 900)]))
    .toEqual({ state: 'verified', score: 0.82 });
  expect(evaluateConfidence(defaultRule, 1, 1, [confirm(3 / 7, 0)])).toEqual({ state: 'verified', score: 0.70 });
  expect(evaluateConfidence(defaultRule, 0.466, 1, [])).toEqual({ state: 'pending', score: 0.39 });
  expect(evaluateConfidence(defaultRule, 1, 1, [0, 240, 250, 260].map(time => confirm(1, time))))
    .toEqual({ state: 'pending', score: 0.50 });
  expect(evaluateConfidence(defaultRule, 1, 1, [0, 15, 30].map(time => confirm(1, time))))
    .toEqual({ state: 'verified', score: 0.90 });
});

it('reopens the report with the same evidence, rule and audit trail and handles replay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coordia-verification-'));
  const path = join(dir, 'reports.sqlite');
  let store = new ReportStore(path);
  try {
    store.create({ category: 'other', ownerId: 'author', status: 'validated' });
    store.create({ category: 'other', ownerId: 'voter', status: 'approved' });
    const report = store.create({ category: 'safety', ownerId: 'author', status: 'pending' }, 1);
    expect(store.respond(report, 'voter', 'confirm')?.verification.state).toBe('verified');
    store.setRule('safety', { ...defaultRule, threshold: 0.85 });
    const history = store.history(report.id);
    store.close();
    store = new ReportStore(path);
    expect(store.rule('safety').threshold).toBe(0.85);
    expect(store.findByPk(report.id)).toMatchObject({ status: 'pending', verification: { state: 'verified' } });
    expect(store.respond(report, 'voter', 'confirm')?.changed).toBe(false);
    expect(store.history(report.id)).toEqual(history);
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
