import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { pollClassCharts } from './poller.js';
import { sendHomeworkDigest } from './digest.js';

// Initialise Firebase Admin once at startup (uses Application Default Credentials on GCP)
if (!getApps().length) initializeApp();

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  res.status(200).send('OK'); // ack immediately
  console.log('Request received, body:', JSON.stringify(req.body).slice(0, 200));

  try {
    // Decode Pub/Sub message
    const body = req.body?.message?.data
      ? JSON.parse(Buffer.from(req.body.message.data, 'base64').toString())
      : req.body ?? {};

    const trigger = body?.trigger ?? 'scheduled';
    console.log(`Received trigger: ${trigger}`);

    console.log('Starting poll, trigger:', trigger);
    if (trigger === 'digest') {
      await sendHomeworkDigest();
    } else {
      await pollClassCharts();
    }
    console.log('Poll completed successfully');
  } catch (err) {
    console.error('Poll error:', String(err));
    console.error('Stack:', err instanceof Error ? err.stack : 'no stack');
    // Write crash to Firestore so status page can show it
    try {
      const { Firestore } = await import('@google-cloud/firestore');
      const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
      await db.collection('status').doc('poller').set({
        polledAt: new Date().toISOString(),
        pupils: [],
        dependencies: { classcharts: 'error', firestore: 'ok', pubsub: 'ok', anthropic: 'ok', fcm: 'ok', gcs: 'ok', gcal: 'ok', gtasks: 'ok', secretmanager: 'ok' },
        errors: [`CRASH: ${String(err)}`],
        updatedAt: new Date().toISOString(),
      });
      console.log('Crash written to Firestore');
    } catch (fsErr) {
      console.error('Failed to write crash to Firestore:', String(fsErr));
    }
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, version: '4' }));

// Return last error from status doc for remote debugging
app.get('/last-error', async (_req, res) => {
  try {
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
    const doc = await db.collection('status').doc('poller').get();
    res.json(doc.exists ? doc.data() : { error: 'No status doc' });
  } catch (err) {
    res.json({ error: String(err) });
  }
});

// Manual trigger for testing — requires same auth as Pub/Sub
app.post('/trigger', async (_req, res) => {
  res.status(200).json({ triggered: true, at: new Date().toISOString() });
  try {
    console.log('Manual trigger received');
    await pollClassCharts();
  } catch (err) {
    console.error('Manual trigger failed:', err);
  }
});

const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => console.log(`Poller listening on :${PORT}`));
