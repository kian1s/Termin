import { useSyncExternalStore } from 'react';

import { getDeviceId } from '@/lib/coach';

// Uses left of each limited AI feature, for the credit pills. The Worker keeps
// the real counts (POST /usage); each feature's own response updates its count
// right after a use. Unknown (offline) counts are left out, so no pill shows.

const COACH_URL = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');

export type CreditKind = 'check' | 'rewrite' | 'snap' | 'explain' | 'fromText';
export type Credit = { left: number; limit: number; period: 'day' | 'lifetime' };
type Credits = Partial<Record<CreditKind, Credit | null>>;

let credits: Credits = {};
const listeners = new Set<() => void>();

function set(next: Credits) {
  credits = next;
  listeners.forEach((l) => l());
}

let refreshing: Promise<void> | null = null;

export function refreshCredits(isPremium: boolean) {
  if (!COACH_URL) return Promise.resolve();
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${COACH_URL}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: await getDeviceId(), isPro: isPremium }),
      });
      if (res.ok) set((await res.json()) as Credits);
    } catch {
      // Offline: keep the last known counts.
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// After a use, the feature's own response says how many are left.
export function setCreditLeft(kind: CreditKind, left: number) {
  const current = credits[kind];
  if (current) set({ ...credits, [kind]: { ...current, left: Math.max(0, left) } });
}

export function useCredit(kind: CreditKind): Credit | null | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => credits[kind]
  );
}
