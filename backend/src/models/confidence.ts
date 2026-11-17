import type { ReportResponseValue } from '../validation/report-response.js';

export const defaultRule = {
  threshold: 0.70,
  creatorWeight: 0.30,
  proximityWeight: 0.25,
  socialWeight: 0.35,
};
export type ConfidenceRule = typeof defaultRule;

export function validRule(input: unknown): input is ConfidenceRule {
  if (!input || typeof input !== 'object') return false;
  const keys = Object.keys(defaultRule);
  if (Object.keys(input).length !== keys.length ||
      !keys.every(key => {
        const value = Object.getOwnPropertyDescriptor(input, key)?.value;
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
      })) return false;
  const { threshold, creatorWeight, proximityWeight, socialWeight } = input as ConfidenceRule;
  const sum = creatorWeight + proximityWeight + socialWeight;
  return threshold > 0 && threshold <= sum + 1e-12 && sum <= 1 + 1e-12;
}

export function proximityFactor(meters: number) {
  return Math.max(0, Math.min(1, (1_000 - meters) / 800));
}

export interface Contribution {
  response: ReportResponseValue;
  reputation: number;
  updatedAt: string;
}

export function evaluateConfidence(rule: ConfidenceRule, creatorReputation: number, proximity: number,
  contributions: Contribution[]) {
  const confirmations = contributions.filter(entry => entry.response === 'confirm');
  const social = contributions.length
    ? confirmations.reduce((total, entry) => total + entry.reputation, 0) / contributions.length : 0;
  const times = confirmations.map(entry => Date.parse(entry.updatedAt)).sort((a, b) => a - b);
  const rapid = times.some((time, index) => index >= 2 && time - times[index - 2] < 30_000);
  const raw = rule.creatorWeight * creatorReputation + rule.proximityWeight * proximity
    + rule.socialWeight * social - (rapid ? 0.40 : 0);
  const score = Math.round((Math.max(0, raw) + Number.EPSILON) * 100) / 100;
  return { score, state: score >= rule.threshold ? 'verified' as const : 'pending' as const };
}
