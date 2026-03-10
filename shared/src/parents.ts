import { ClassChartsParentClient } from './classcharts';
import type { CCStudent } from './types';

export interface ParentConfig {
  email: string;
  password: string;
}

/**
 * Read parent credentials from environment variables.
 * Supports CLASSCHARTS_PARENT1_EMAIL/PASSWORD and CLASSCHARTS_PARENT2_EMAIL/PASSWORD.
 * Throws if none are configured.
 */
export function getParentConfigs(): ParentConfig[] {
  const configs: ParentConfig[] = [];

  for (let i = 1; i <= 5; i++) {
    const email = process.env[`CLASSCHARTS_PARENT${i}_EMAIL`];
    const password = process.env[`CLASSCHARTS_PARENT${i}_PASSWORD`];
    if (email && password) configs.push({ email, password });
  }

  if (configs.length === 0) {
    throw new Error('No ClassCharts parent credentials configured. Set CLASSCHARTS_PARENT1_EMAIL and CLASSCHARTS_PARENT1_PASSWORD.');
  }

  return configs;
}

export interface AuthenticatedParent {
  client: ClassChartsParentClient;
  pupils: CCStudent[];
}

/**
 * Login all configured parents and return their clients + pupils.
 * Deduplicates pupils by ID across parents.
 */
export async function loginAllParents(): Promise<AuthenticatedParent[]> {
  const configs = getParentConfigs();
  const results: AuthenticatedParent[] = [];
  const seenPupilIds = new Set<number>();

  for (const config of configs) {
    const client = new ClassChartsParentClient(config.email, config.password);
    const allPupils = await client.login();

    // Deduplicate — both parents may see the same children
    const uniquePupils = allPupils.filter(p => {
      if (seenPupilIds.has(p.id)) return false;
      seenPupilIds.add(p.id);
      return true;
    });

    if (uniquePupils.length > 0) {
      results.push({ client, pupils: uniquePupils });
    }
  }

  return results;
}

/**
 * Get a single authenticated client with a specific pupil selected.
 * Tries each parent config until it finds one that has access to the pupil.
 */
export async function getClientForPupil(pupilId: number): Promise<ClassChartsParentClient> {
  const configs = getParentConfigs();

  for (const config of configs) {
    const client = new ClassChartsParentClient(config.email, config.password);
    const pupils = await client.login();
    if (pupils.some(p => p.id === pupilId)) {
      client.selectPupil(pupilId);
      return client;
    }
  }

  throw new Error(`No parent account has access to pupil ${pupilId}`);
}
