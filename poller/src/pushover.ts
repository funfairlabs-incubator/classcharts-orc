import axios from 'axios';

type PushoverPriority = -1 | 0 | 1 | 2;

export async function sendPushover(
  title: string,
  message: string,
  priority: PushoverPriority = 0
): Promise<void> {
  const keys = [
    process.env.PUSHOVER_USER_KEY,
    process.env.PUSHOVER_USER_KEY_2,
  ].filter(Boolean);

  for (const userKey of keys) {
    await axios.post('https://api.pushover.net/1/messages.json', {
      token: process.env.PUSHOVER_API_TOKEN,
      user: userKey,
      title,
      message,
      priority,
      // For priority 2 (emergency), require acknowledgement
      ...(priority === 2 ? { retry: 60, expire: 3600 } : {}),
    });
  }
}
