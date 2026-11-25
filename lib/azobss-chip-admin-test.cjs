'use strict';

const { randomUUID } = require('node:crypto');
const { createChipAdapter } = require('./azobss-chip-collect.cjs');
const { getChipCallbackKey, readChipCallback, paymentError } = require('./azobss-business-payments.cjs');

const AMOUNT_SEN = 100;
const TEST_ID = /^chip-test-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function createChipAdminTest({ getDb, frontendBase, callbackUrl, env=process.env, fetchImpl=globalThis.fetch, now=Date.now }) {
  let adapter;
  let callbackKey;

  function configuration() {
    const apiKey = String(env.CHIP_TEST_API_KEY || '').trim();
    const brandId = String(env.CHIP_TEST_BRAND_ID || '').trim();
    if (!apiKey || !brandId) return 'missing_credentials';
    if (apiKey === String(env.CHIP_API_KEY || '').trim()) return 'live_key_reused';
    return 'configured';
  }

  function testAdapter() {
    const state = configuration();
    if (state === 'missing_credentials') throw paymentError('Set CHIP_TEST_API_KEY and CHIP_TEST_BRAND_ID in Render.', 503);
    if (state === 'live_key_reused') throw paymentError('The test key must be different from the live key.', 503);
    adapter ||= createChipAdapter({ apiKey:env.CHIP_TEST_API_KEY.trim(), brandId:env.CHIP_TEST_BRAND_ID.trim(), fetchImpl, testMode:true });
    return adapter;
  }

  async function testCallbackKey() {
    testAdapter();
    callbackKey ||= await getChipCallbackKey(env.CHIP_TEST_API_KEY.trim(), fetchImpl);
    return callbackKey;
  }

  function doc(orderId) {
    const db = getDb();
    if (!db) throw paymentError('Test payment storage is unavailable.', 503);
    return db.collection('chipAdminTestPayments').doc(orderId);
  }

  async function create(ownerUid) {
    const chip = testAdapter();
    await testCallbackKey();
    const orderId = 'chip-test-' + randomUUID();
    const start = now();
    const due = Math.floor(start / 1000) + 30 * 60;
    const returnUrl = new URL('/admin/', frontendBase);
    returnUrl.searchParams.set('chipTest', orderId);
    const order = { orderId, ownerUid, amountSen:AMOUNT_SEN, status:'creating', createdAtMs:start, due };
    const ref = doc(orderId);
    await ref.set(order);
    try {
      const payment = await chip.create({
        orderId, amountSen:AMOUNT_SEN, productName:'AZOBSS sandbox checkout test', email:'chip-test@example.com',
        successUrl:returnUrl.href, cancelUrl:returnUrl.href, callbackUrl, due
      });
      await ref.set({ chipPurchaseId:payment.purchaseId, status:'pending' }, { merge:true });
      return { testId:orderId, amountSen:AMOUNT_SEN, status:'pending', paymentUrl:payment.paymentUrl };
    } catch (error) {
      await ref.set({ status:'failed' }, { merge:true });
      throw error;
    }
  }

  async function load(orderId, ownerUid) {
    if (!TEST_ID.test(orderId || '')) throw paymentError('Invalid CHIP test reference.', 400);
    const ref = doc(orderId);
    const order = (await ref.get()).data();
    if (!order || ownerUid && order.ownerUid !== ownerUid) throw paymentError('CHIP test payment not found.', 404);
    return { ref, order };
  }

  async function refresh({ref,order}) {
    if (order.status === 'pending') {
      const result = await testAdapter().verify(order);
      if (result.paid) {
        await ref.set({ status:'paid', verifiedAtMs:now() }, { merge:true });
        return 'paid';
      }
      if (result.reason !== 'not_paid') throw paymentError('CHIP test payment could not be verified.', 409);
      return order.due * 1000 <= now() ? 'expired' : 'pending';
    }
    return order.status;
  }

  async function status(orderId, ownerUid) {
    const record = await load(orderId, ownerUid);
    return { testId:orderId, amountSen:record.order.amountSen, status:await refresh(record) };
  }

  async function callback(req) {
    const event = await readChipCallback(req, testCallbackKey);
    if (event?.is_test !== true) throw paymentError('A CHIP test event is required.', 409);
    const record = await load(event.reference);
    if (!record.order.chipPurchaseId || event.id !== record.order.chipPurchaseId) {
      throw paymentError('CHIP test purchase not found.', 404);
    }
    return await refresh(record) === 'paid';
  }

  return { configuration, create, status, callback };
}

module.exports = { createChipAdminTest };

