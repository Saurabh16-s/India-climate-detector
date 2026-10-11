import { ScanCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './lib/clients.js';
import { parseKey } from './lib/data.js';
import { getForecast } from './lib/forecast.js';
import { evaluate, shouldSend } from './lib/evaluate.js';
import { buildAlert } from './lib/message.js';
import { link } from './lib/sign.js';
import { sendEmail } from './lib/email.js';

// Confirmed subscribers grouped by district key. A Scan is fine for a small list;
// add a status index if this grows to many thousands of subscribers.
async function loadSubscribers() {
  const byDistrict = new Map();
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: process.env.TABLE_SUBSCRIBERS,
        FilterExpression: '#s = :c',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':c': 'confirmed' },
        ExclusiveStartKey,
      })
    );
    for (const item of out.Items ?? []) {
      if (!byDistrict.has(item.district)) byDistrict.set(item.district, []);
      byDistrict.get(item.district).push({ email: item.email, apiBase: item.apiBase });
    }
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return byDistrict;
}

// Runs once a day (EventBridge Scheduler).
export const handler = async () => {
  const summary = [];
  const byDistrict = await loadSubscribers();

  for (const [key, subs] of byDistrict) {
    try {
      const dist = parseKey(key);
      if (!dist) continue;

      const forecast = dist.hazard === 'Flood' ? await getForecast(dist) : null;
      const result = evaluate(dist, forecast);
      if (!result) continue;

      const { Item: state } = await ddb.send(
        new GetCommand({ TableName: process.env.TABLE_ALERTS, Key: { district: key } })
      );
      if (!shouldSend(result.level, state)) continue;

      let sent = 0;
      for (const sub of subs) {
        try {
          const unsubscribeUrl = link(sub.apiBase, 'unsubscribe', key, sub.email);
          await sendEmail({ to: sub.email, unsubscribeUrl, ...buildAlert(dist, result, unsubscribeUrl) });
          sent++;
        } catch (err) {
          console.error(`Email failed for ${key}`, err);
        }
      }
      if (sent > 0) {
        await ddb.send(
          new PutCommand({
            TableName: process.env.TABLE_ALERTS,
            Item: { district: key, level: result.level, sentAt: Date.now() },
          })
        );
      }
      summary.push({ district: key, level: result.level, sent });
    } catch (err) {
      console.error(`Check failed for ${key}`, err); // one bad district must not stop the rest
    }
  }
  console.log(JSON.stringify({ checked: byDistrict.size, alerts: summary }));
  return { checked: byDistrict.size, alerts: summary };
};
