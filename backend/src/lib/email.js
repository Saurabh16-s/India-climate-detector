import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ses } from './clients.js';

export async function sendEmail({ to, subject, text, html, unsubscribeUrl }) {
  const Headers = unsubscribeUrl
    ? [
        { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ]
    : undefined;
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.SENDER_EMAIL,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
          Headers,
        },
      },
    })
  );
}
