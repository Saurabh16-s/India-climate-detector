import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './lib/clients.js';
import { findDistrict, districtKey } from './lib/data.js';
import { link } from './lib/sign.js';
import { json, esc } from './lib/http.js';
import { sendEmail } from './lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER_MS = 10 * 60 * 1000;
const PENDING_TTL_SECONDS = 48 * 3600;


export const handler = async (event) => {
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
    body = JSON.parse(raw || '{}');
  } catch {
    return json(400, { message: 'Invalid request.' });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json(400, { message: 'Please enter a valid email address.' });
  }
  const dist = findDistrict(body.state, body.district);
  if (!dist) return json(400, { message: 'Unknown district.' });


  const ok = json(200, {
    message: 'Check your inbox for a confirmation email. Alerts start once you confirm.',
  });

  const key = districtKey(dist.state, dist.name);
  const apiBase = `https://${event.requestContext.domainName}`;
  const now = Date.now();

  const { Item: existing } = await ddb.send(
    new GetCommand({ TableName: process.env.TABLE_SUBSCRIBERS, Key: { district: key, email } })
  );
  if (existing?.status === 'confirmed') return ok;
  if (existing && now - existing.createdAt < RESEND_AFTER_MS) return ok;

  await ddb.send(
    new PutCommand({
      TableName: process.env.TABLE_SUBSCRIBERS,
      Item: {
        district: key,
        email,
        status: 'pending',
        apiBase,
        createdAt: now,
        expiresAt: Math.floor(now / 1000) + PENDING_TTL_SECONDS, 
      },
    })
  );

  const confirmUrl = link(apiBase, 'confirm', key, email);
  const where = `${dist.name}, ${dist.state}`;
  try {
    await sendEmail({
      to: email,
      subject: `Confirm alerts for ${where}`,
      text: `Please confirm you want climate risk alerts for ${where}:\n\n${confirmUrl}\n\nIf you didn't ask for this, ignore this email and nothing will happen.`,
      html: `<p>Please confirm you want climate risk alerts for <b>${esc(where)}</b>.</p><p><a href="${esc(confirmUrl)}">Confirm my subscription</a></p><p style="color:#6b7280;font-size:12px">If you didn't ask for this, ignore this email and nothing will happen.</p>`,
    });
  } catch (err) {
    console.error('Could not send confirmation email', err);
    return json(502, { message: 'Could not send the confirmation email right now. Please try again later.' });
  }
  return ok;
};
