'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { Readable } = require('node:stream');
const path = require('node:path');
const { createBusinessPayments } = require('../lib/azobss-business-payments.cjs');

const root = path.join(__dirname, '..');
const testKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = testKeys.publicKey.export({ type: 'spki', format: 'pem' });
const env = { CHIP_CHECKOUT_ENABLED:'1', CHIP_API_KEY:'synthetic', CHIP_BRAND_ID:'11111111-1111-1111-1111-111111111111' };

function fixture(methods) {
  let stored;
  const settingsDoc = { get: async () => ({ data: () => stored }), set: async data => { stored = data; } };
  const getDb = () => ({ collection: () => ({ doc: () => settingsDoc }) });
  const fetchImpl = async url => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/payment_methods/')) return Response.json({ available_payment_methods: methods });
    if (pathname.endsWith('/public_key/')) return Response.json(pem);
    throw new Error('Unexpected provider call');
  };
  return createBusinessPayments({ root, getDb, stripeReady: () => true, toyyibReady: () => true, env, fetchImpl });
}

test('verified business payment details and independently controlled backup options', async () => {
  const payments = fixture(['fpx']);
  const options = await payments.options();
  assert.equal(options.chip, true);
  assert.equal(options.bank.holder, 'AZOBSS ENTERPRISE');
  assert.equal(options.bank.account, '562405751585');
  assert.match(options.bank.qrUrl, /azobss-enterprise-duitnow-qr\.jpg$/);
  assert.equal(options.toyyibpay, true);
  assert.equal(options.stripe, true);
  await payments.saveBackups({ toyyibpay:false, stripe:true });
  assert.equal((await payments.options()).toyyibpay, false);
  assert.equal((await payments.options()).stripe, true);
  await assert.rejects(payments.requireVisible('toyyibpay'), { statusCode:403 });
  await payments.requireVisible('stripe');
});

test('empty live CHIP methods leave the QR and configured backup providers available', async () => {
  const options = await fixture([]).options();
  assert.equal(options.chip, false);
  assert.ok(options.bank);
  assert.equal(options.toyyibpay, true);
  assert.equal(options.stripe, true);
});

test('CHIP verifies exact callback bytes before parsing JSON', async () => {
  const payments = fixture(['fpx']);
  const original = Buffer.from('{\n "reference":"fixture", "id":"synthetic"\n}');
  const signature = sign('RSA-SHA256', original, testKeys.privateKey).toString('base64');
  const req = content => Object.assign(Readable.from([content]), { headers:{ 'x-signature':signature } });
  assert.equal((await payments.readSignedCallback(req(original))).reference, 'fixture');
  await assert.rejects(payments.readSignedCallback(req(Buffer.from('{"reference":"fixture","id":"synthetic"}'))), { statusCode:401 });
});
