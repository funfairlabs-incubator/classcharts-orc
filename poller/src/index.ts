import express from 'express';
import { pollClassCharts } from './poller.js';
import { sendHomeworkDigest } from './digest.js';

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  res.status(200).send('OK'); // ack immediately

  try {
    // Decode Pub/Sub message
    const body = req.body?.message?.data
      ? JSON.parse(Buffer.from(req.body.message.data, 'base64').toString())
      : req.body ?? {};

    const trigger = body?.trigger ?? 'scheduled';
    console.log(`Received trigger: ${trigger}`);

    if (trigger === 'digest') {
      await sendHomeworkDigest();
    } else {
      await pollClassCharts();
    }
  } catch (err) {
    console.error('Poll error:', err);
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => console.log(`Poller listening on :${PORT}`));
