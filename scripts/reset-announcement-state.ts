#!/usr/bin/env npx ts-node
/**
 * reset-announcement-state.ts
 *
 * Resets lastAnnouncementId in Firestore for one or all pupils,
 * forcing the next poll to re-process and re-notify all announcements
 * with IDs above the new threshold.
 *
 * Usage:
 *   npm run reset-announcements              # reset to 0 for all pupils
 *   npm run reset-announcements -- --id=123  # reset to just below announcement ID 123
 *
 * Run from /scripts:
 *   cd scripts && npm run reset-announcements
 */

import { Firestore } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'classcharts';
const db = new Firestore({ projectId: PROJECT_ID });

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find(a => a.startsWith('--id='));
  const targetId = idArg ? parseInt(idArg.split('=')[1], 10) - 1 : 0;

  const snapshot = await db.collection('poll_state').get();
  const docs = snapshot.docs.filter(d => d.id !== 'gmail');

  if (docs.length === 0) {
    console.log('No poll_state documents found. Has the poller run yet?');
    process.exit(1);
  }

  console.log(`Resetting lastAnnouncementId to ${targetId} for ${docs.length} pupil(s)...\n`);

  for (const doc of docs) {
    const data = doc.data();
    const before = data.lastAnnouncementId ?? 0;
    await db.collection('poll_state').doc(doc.id).update({
      lastAnnouncementId: targetId,
      updatedAt: new Date().toISOString(),
    });
    console.log(`  Pupil ${doc.id}: ${before} → ${targetId}`);
  }

  console.log('\nDone. Next poll will re-notify any announcements above this threshold.');
  console.log('Trigger a poll now with: bash scripts/trigger-poll.sh');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
