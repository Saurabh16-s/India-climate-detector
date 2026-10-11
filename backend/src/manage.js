import { UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './lib/clients.js';
import { parseKey } from './lib/data.js';
import { verify } from './lib/sign.js';
import { page } from './lib/http.js';

// Links arrive as GET (shows a button) and the button POSTs. Mail clients' one-click
// unsubscribe also POSTs. Scanners that only GET links change nothing.
const method = (event) => event.requestContext?.http?.method;

function read(event, action) {
  const { d, e, s } = event.queryStringParameters ?? {};
  if (!d || !e || !verify(action, d, e, s)) return null;
  const dist = parseKey(d);
  return { district: d, email: e, label: dist ? `${dist.name}, ${dist.state}` : 'this district' };
}

export const confirm = async (event) => {
  const p = read(event, 'confirm');
  if (!p) return page(400, 'Link not valid', 'This confirmation link is invalid.');
  if (method(event) !== 'POST') {
    return page(200, 'Confirm alerts', `Start receiving climate risk alerts for ${p.label}?`, 'Confirm subscription');
  }
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: process.env.TABLE_SUBSCRIBERS,
        Key: { district: p.district, email: p.email },
        UpdateExpression: 'SET #s = :c REMOVE expiresAt',
        ConditionExpression: 'attribute_exists(district)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':c': 'confirmed' },
      })
    );
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return page(404, 'Link expired', 'This request has expired. Please subscribe again from the tracker.');
    }
    throw err;
  }
  return page(200, 'You are subscribed', `You will get alerts for ${p.label}. Every email has an unsubscribe link.`);
};

export const unsubscribe = async (event) => {
  const p = read(event, 'unsubscribe');
  if (!p) return page(400, 'Link not valid', 'This unsubscribe link is invalid.');
  if (method(event) !== 'POST') {
    return page(200, 'Unsubscribe', `Stop alerts for ${p.label}?`, 'Unsubscribe');
  }
  await ddb.send(
    new DeleteCommand({
      TableName: process.env.TABLE_SUBSCRIBERS,
      Key: { district: p.district, email: p.email },
    })
  );
  return page(200, 'Unsubscribed', `You will no longer get alerts for ${p.label}.`);
};
