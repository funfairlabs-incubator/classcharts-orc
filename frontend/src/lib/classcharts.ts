import { getClientForPupil, loginAllParents } from '@classcharts/shared';
import type { ClassChartsParentClient, CCStudent } from '@classcharts/shared';

// ── In-memory cache (lives for the duration of the Cloud Run instance) ──
// Cloud Run instances are long-lived between requests, so this avoids
// re-authenticating on every page load.

interface CachedSession {
  pupils: CCStudent[];
  clients: Map<number, ClassChartsParentClient>;
  expiresAt: number;
}

let cache: CachedSession | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getSession(): Promise<CachedSession> {
  if (cache && Date.now() < cache.expiresAt) return cache;

  const parents = await loginAllParents();
  const pupils: CCStudent[] = [];
  const clients = new Map<number, ClassChartsParentClient>();

  for (const { client, pupils: parentPupils } of parents) {
    for (const pupil of parentPupils) {
      pupils.push(pupil);
      clients.set(pupil.id, client);
    }
  }

  cache = { pupils, clients, expiresAt: Date.now() + CACHE_TTL_MS };
  return cache;
}

export async function getPupils(): Promise<CCStudent[]> {
  const session = await getSession();
  return session.pupils;
}

export async function getClientFor(pupilId: number): Promise<ClassChartsParentClient> {
  const session = await getSession();
  const client = session.clients.get(pupilId);
  if (!client) throw new Error(`No client found for pupil ${pupilId}`);
  client.selectPupil(pupilId);
  return client;
}

export async function getFirstPupilId(): Promise<number> {
  const pupils = await getPupils();
  if (pupils.length === 0) throw new Error('No pupils found');
  return pupils[0].id;
}

// ── Date helpers ─────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

export function daysAheadStr(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split('T')[0];
}
