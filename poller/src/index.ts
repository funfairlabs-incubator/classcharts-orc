import express from 'express';
import { pollClassCharts } from './poller.js';
import { watchGmail } from './gmail.js';

const app = express();
app.use(express.json());

// Pub/Sub push endpoint — Cloud Scheduler publishes here every N mins
app.post('/', async (_req, res) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Poll triggered`);

  try {
    await Promise.allSettled([
      pollClassCharts(),
      watchGmail(),
    ]);
    console.log(`Poll complete in ${Date.now() - start}ms`);
    res.status(204).send();
  } catch (err) {
    console.error('Unhandled poll error:', err);
    // Return 200 to avoid Pub/Sub retry storm — errors are logged
    res.status(200).json({ error: String(err) });
  }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  version: process.env.K_REVISION ?? 'local',
  ts: new Date().toISOString(),
}));

const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => console.log(`Poller listening on :${PORT}`));
