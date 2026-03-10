import express from 'express';
import { pollClassCharts } from './poller';
import { watchGmail } from './gmail';

const app = express();
app.use(express.json());

// Pub/Sub push endpoint
app.post('/', async (req, res) => {
  console.log('Poll triggered via Pub/Sub');
  try {
    // Run both in parallel
    await Promise.all([
      pollClassCharts(),
      watchGmail(),
    ]);
    res.status(204).send();
  } catch (err) {
    console.error('Poll failed:', err);
    // Return 200 to avoid Pub/Sub retry storm — we handle retry logic internally
    res.status(200).json({ error: String(err) });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Poller listening on ${PORT}`));
