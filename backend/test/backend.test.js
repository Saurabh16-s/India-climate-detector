import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.LINK_SECRET = 'x'.repeat(40);
process.env.TABLE_SUBSCRIBERS = 'subs';
process.env.TABLE_ALERTS = 'alerts';
process.env.SENDER_EMAIL = 'alerts@example.com';

const { mockClient } = await import('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } =
  await import('@aws-sdk/lib-dynamodb');
const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
const { sign, verify, link } = await import('../src/lib/sign.js');
const { evaluate, shouldSend } = await import('../src/lib/evaluate.js');
const { findDistrict } = await import('../src/lib/data.js');
const { handler: subscribe } = await import('../src/subscribe.js');
const { confirm, unsubscribe } = await import('../src/manage.js');
const { handler: checkAlerts } = await import('../src/checkAlerts.js');

const ddb = mockClient(DynamoDBDocumentClient);
const ses = mockClient(SESv2Client);
beforeEach(() => { ddb.reset(); ses.reset(); ses.on(SendEmailCommand).resolves({}); });

const KEY = 'Assam#Lakhimpur';
const api = { requestContext: { domainName: 'abc.execute-api.ap-south-1.amazonaws.com', http: { method: 'POST' } } };

test('signed links verify and reject tampering', () => {
  const s = sign('confirm', KEY, 'a@b.co');
  assert.ok(verify('confirm', KEY, 'a@b.co', s));
  assert.ok(!verify('confirm', KEY, 'other@b.co', s));
  assert.ok(!verify('unsubscribe', KEY, 'a@b.co', s));
  assert.ok(!verify('confirm', KEY, 'a@b.co', 'bad'));
});

test('findDistrict validates input', () => {
  assert.equal(findDistrict('Assam', 'Lakhimpur').rank, 1);
  assert.equal(findDistrict('Assam', 'Nowhere'), null);
  assert.equal(findDistrict('__proto__', 'x'), null);
  assert.equal(findDistrict({}, []), null);
});

test('evaluate: flood thresholds, drought only in June', () => {
  const flood = { hazard: 'Flood' };
  const t = ['d1', 'd2', 'd3', 'd4', 'd5'];
  assert.equal(evaluate(flood, { time: t, precipitation_sum: [1, 30, 60, 0, 0] }), null);
  assert.equal(evaluate(flood, { time: t, precipitation_sum: [1, 70, 0, 0, 0] }).level, 'heavy');
  assert.equal(evaluate(flood, { time: t, precipitation_sum: [1, 70, 130, 0, 0] }).level, 'very_heavy');
  const dry = { hazard: 'Drought' };
  assert.equal(evaluate(dry, null, new Date('2026-06-10T05:00:00Z')).level, 'season');
  assert.equal(evaluate(dry, null, new Date('2026-10-11T05:00:00Z')), null);
});

test('shouldSend: cooldown and escalation', () => {
  const now = Date.now();
  assert.ok(shouldSend('heavy', undefined, now));
  assert.ok(!shouldSend('heavy', { level: 'heavy', sentAt: now - 3600_000 }, now));
  assert.ok(shouldSend('very_heavy', { level: 'heavy', sentAt: now - 3600_000 }, now));
  assert.ok(shouldSend('heavy', { level: 'heavy', sentAt: now - 80 * 3600_000 }, now));
});

test('subscribe: stores pending row and emails a signed confirm link', async () => {
  ddb.on(GetCommand).resolves({});
  ddb.on(PutCommand).resolves({});
  const res = await subscribe({ ...api, body: JSON.stringify({ state: 'Assam', district: 'Lakhimpur', email: ' A@B.co ' }) });
  assert.equal(res.statusCode, 200);
  const put = ddb.commandCalls(PutCommand)[0].args[0].input.Item;
  assert.equal(put.email, 'a@b.co');
  assert.equal(put.status, 'pending');
  assert.ok(put.expiresAt > Date.now() / 1000);
  const mail = ses.commandCalls(SendEmailCommand)[0].args[0].input;
  assert.ok(mail.Content.Simple.Body.Text.Data.includes('/confirm?'));
});

test('subscribe: rejects bad email / unknown district, stays quiet for confirmed', async () => {
  const bad = await subscribe({ ...api, body: JSON.stringify({ state: 'Assam', district: 'Lakhimpur', email: 'nope' }) });
  assert.equal(bad.statusCode, 400);
  const unk = await subscribe({ ...api, body: JSON.stringify({ state: 'Assam', district: 'Zzz', email: 'a@b.co' }) });
  assert.equal(unk.statusCode, 400);
  ddb.on(GetCommand).resolves({ Item: { status: 'confirmed', createdAt: 0 } });
  const again = await subscribe({ ...api, body: JSON.stringify({ state: 'Assam', district: 'Lakhimpur', email: 'a@b.co' }) });
  assert.equal(again.statusCode, 200);
  assert.equal(ses.commandCalls(SendEmailCommand).length, 0);
  assert.equal(ddb.commandCalls(PutCommand).length, 0);
});

const qs = (action) => ({ d: KEY, e: 'a@b.co', s: sign(action, KEY, 'a@b.co') });

test('confirm: GET shows button only, POST confirms, bad sig rejected', async () => {
  ddb.on(UpdateCommand).resolves({});
  const get = await confirm({ requestContext: { http: { method: 'GET' } }, queryStringParameters: qs('confirm') });
  assert.equal(get.statusCode, 200);
  assert.ok(get.body.includes('<form'));
  assert.equal(ddb.commandCalls(UpdateCommand).length, 0);
  const post = await confirm({ requestContext: { http: { method: 'POST' } }, queryStringParameters: qs('confirm') });
  assert.equal(post.statusCode, 200);
  assert.equal(ddb.commandCalls(UpdateCommand).length, 1);
  const bad = await confirm({ requestContext: { http: { method: 'POST' } }, queryStringParameters: { ...qs('confirm'), s: 'x' } });
  assert.equal(bad.statusCode, 400);
});

test('confirm: expired (missing) row returns 404', async () => {
  const err = Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' });
  ddb.on(UpdateCommand).rejects(err);
  const res = await confirm({ requestContext: { http: { method: 'POST' } }, queryStringParameters: qs('confirm') });
  assert.equal(res.statusCode, 404);
});

test('unsubscribe: POST deletes the row', async () => {
  ddb.on(DeleteCommand).resolves({});
  const res = await unsubscribe({ requestContext: { http: { method: 'POST' } }, queryStringParameters: qs('unsubscribe') });
  assert.equal(res.statusCode, 200);
  assert.equal(ddb.commandCalls(DeleteCommand).length, 1);
});

test('checkAlerts: sends once for heavy rain, then respects cooldown', async () => {
  ddb.on(ScanCommand).resolves({ Items: [{ district: KEY, email: 'a@b.co', status: 'confirmed', apiBase: 'https://x.example' }] });
  ddb.on(PutCommand).resolves({});
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ daily: { time: ['d1', 'd2', 'd3', 'd4', 'd5'], precipitation_sum: [2, 70, 5, 0, 0] } }),
  });

  ddb.on(GetCommand).resolves({});
  const first = await checkAlerts();
  assert.equal(first.alerts[0].sent, 1);
  const mail = ses.commandCalls(SendEmailCommand)[0].args[0].input;
  assert.match(mail.Content.Simple.Subject.Data, /Heavy rain forecast for Lakhimpur/);
  assert.ok(mail.Content.Simple.Headers.some((h) => h.Name === 'List-Unsubscribe'));
  assert.equal(ddb.commandCalls(PutCommand)[0].args[0].input.Item.level, 'heavy');

  ses.resetHistory();
  ddb.on(GetCommand).resolves({ Item: { district: KEY, level: 'heavy', sentAt: Date.now() } });
  const second = await checkAlerts();
  assert.equal(second.alerts.length, 0);
  assert.equal(ses.commandCalls(SendEmailCommand).length, 0);
});

test('checkAlerts: a failing forecast does not stop other districts', async () => {
  ddb.on(ScanCommand).resolves({
    Items: [
      { district: KEY, email: 'a@b.co', status: 'confirmed', apiBase: 'https://x.example' },
      { district: 'Bihar#Madhubani', email: 'c@d.co', status: 'confirmed', apiBase: 'https://x.example' },
    ],
  });
  ddb.on(GetCommand).resolves({});
  ddb.on(PutCommand).resolves({});
  let n = 0;
  globalThis.fetch = async () => {
    if (n++ === 0) throw new Error('network');
    return { ok: true, json: async () => ({ daily: { time: ['a', 'b', 'c', 'd', 'e'], precipitation_sum: [130, 0, 0, 0, 0] } }) };
  };
  const out = await checkAlerts();
  assert.equal(out.checked, 2);
  assert.equal(out.alerts.length, 1);
  assert.equal(out.alerts[0].district, 'Bihar#Madhubani');
});
