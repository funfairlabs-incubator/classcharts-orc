import { google } from 'googleapis';
import { getGmailState, saveGmailState } from './state.js';
import { sendPushover } from './pushover.js';

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

export async function watchGmail(): Promise<void> {
  const gmail = getGmailClient();
  const { lastEmailId } = await getGmailState();

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:noreply@classcharts.com is:unread',
    maxResults: 20,
  });

  const messages = res.data.messages ?? [];
  if (messages.length === 0) return;

  // Filter to only messages newer than last processed
  const newMessages = lastEmailId
    ? messages.filter(m => m.id! > lastEmailId)
    : messages;

  if (newMessages.length === 0) return;

  for (const msg of newMessages) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From'],
    });

    const headers = full.data.payload?.headers ?? [];
    const subject = headers.find(h => h.name === 'Subject')?.value ?? 'ClassCharts notification';

    // Mark as read — we handle it now
    await gmail.users.messages.modify({
      userId: 'me',
      id: msg.id!,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });

    // Only push emails that aren't already covered by the API poll
    // (e.g. two-way messages, letters, things not in the API)
    const isActivityEmail = /new (behaviour|homework|award|attendance)/i.test(subject);
    if (!isActivityEmail) {
      await sendPushover({
        title: '📧 ClassCharts',
        message: subject,
        priority: 0,
      });
    }
  }

  // Save the latest message ID
  await saveGmailState(newMessages[0].id!);
  console.log(`Gmail: processed ${newMessages.length} new message(s)`);
}
