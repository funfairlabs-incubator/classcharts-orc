import { google } from 'googleapis';
import { Firestore } from '@google-cloud/firestore';
import { sendPushover } from './pushover';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

export async function watchGmail(): Promise<void> {
  const gmail = getGmailClient();

  // Get last processed email ID from Firestore
  const stateDoc = await db.collection('poll_state').doc('gmail').get();
  const lastEmailId: string = stateDoc.exists ? stateDoc.data()?.lastEmailId ?? '' : '';

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:noreply@classcharts.com is:unread',
    maxResults: 10,
  });

  const messages = res.data.messages ?? [];
  const newMessages = lastEmailId
    ? messages.filter(m => m.id! > lastEmailId)
    : messages;

  for (const msg of newMessages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
    const headers = full.data.payload?.headers ?? [];
    const subject = headers.find(h => h.name === 'Subject')?.value ?? 'ClassCharts notification';

    // Mark as read
    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id!,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });

    // Only send Pushover if it's not something we already caught via API polling
    // (announcements and comms that don't appear in the API)
    if (!subject.toLowerCase().includes('new activity')) {
      await sendPushover('📧 ClassCharts Email', subject, 0);
    }
  }

  if (newMessages.length > 0) {
    const latestId = newMessages[0].id!;
    await db.collection('poll_state').doc('gmail').set({
      lastEmailId: latestId,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Gmail: processed ${newMessages.length} new messages`);
  }
}
