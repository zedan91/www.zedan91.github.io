'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { Readable } = require('node:stream');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { createChipAdapter, CHIP_SECTIONS } = require('../lib/azobss-chip-collect.cjs');
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
    const request = new URL(url);
    if (request.pathname.endsWith('/payment_methods/')) {
      assert.equal(request.searchParams.get('amount'), '1000');
      assert.equal(request.searchParams.get('language'), 'en');
      assert.equal(request.searchParams.has('country'), false);
      return Response.json({ available_payment_methods: methods });
    }
    const pathname = request.pathname;
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
  assert.equal(options.toyyibpay, false);
  assert.equal(options.stripe, false);
  await payments.saveBackups({ toyyibpay:false, stripe:true });
  assert.equal((await payments.options()).toyyibpay, false);
  assert.equal((await payments.options()).stripe, true);
  await assert.rejects(payments.requireVisible('toyyibpay'), { statusCode:403 });
  await payments.requireVisible('stripe');
  await payments.saveBackups({ toyyibpay:true, stripe:false });
  assert.equal((await payments.options()).toyyibpay, true);
  await assert.rejects(payments.requireVisible('stripe'), { statusCode:403 });
});

test('unavailable CHIP leaves the QR visible and backups off by default', async () => {
  const options = await fixture([]).options();
  assert.equal(options.chip, false);
  assert.ok(options.bank);
  assert.equal(options.toyyibpay, false);
  assert.equal(options.stripe, false);
});

test('CHIP verifies exact callback bytes before parsing JSON', async () => {
  const payments = fixture(['fpx']);
  const original = Buffer.from('{\n "reference":"fixture", "id":"synthetic"\n}');
  const signature = sign('RSA-SHA256', original, testKeys.privateKey).toString('base64');
  const req = content => Object.assign(Readable.from([content]), { headers:{ 'x-signature':signature } });
  assert.equal((await payments.readSignedCallback(req(original))).reference, 'fixture');
  await assert.rejects(payments.readSignedCallback(req(Buffer.from('{"reference":"fixture","id":"synthetic"}'))), { statusCode:401 });
});

test('CHIP checks the actual invoice amount and creates an English section-specific checkout', async () => {
  const orderId = 'invoice-fixture';
  const purchaseId = '33333333-3333-3333-3333-333333333333';
  const amountSen = 12345;
  const expiry = 1810000000;
  const checkoutUrl = 'https://gate.chip-in.asia/p/demo/';
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url:new URL(url), options });
    if (requests.length === 1) return Response.json({ available_payment_methods:['fpx','dnqr'] });
    return Response.json({
      id:purchaseId, checkout_url:checkoutUrl, brand_id:env.CHIP_BRAND_ID, reference:orderId,
      is_test:false, purchase:{currency:'MYR',total:amountSen}
    });
  };
  const adapter = createChipAdapter({ apiKey:env.CHIP_API_KEY, brandId:env.CHIP_BRAND_ID, fetchImpl });
  const checkout = await adapter.create({
    orderId, amountSen, productName:'Invoice AZI-1', section:CHIP_SECTIONS.rentals,
    email:'customer@example.test', successUrl:'https://www.azobss.com/success',
    cancelUrl:'https://www.azobss.com/cancel', callbackUrl:'https://www.azobss.com/callback', due:expiry
  });
  assert.deepEqual(checkout,{purchaseId,paymentUrl:checkoutUrl});
  assert.equal(requests[0].url.searchParams.get('amount'),String(amountSen));
  assert.equal(requests[0].url.searchParams.has('country'),false);
  const body = JSON.parse(requests[1].options.body);
  assert.equal(body.purchase.language,'en');
  assert.equal(body.purchase.due,expiry);
  assert.equal(body.purchase.due_strict,true);
  assert.deepEqual(body.purchase.products,[{name:'Equipment Rentals — Invoice AZI-1',price:amountSen,quantity:1}]);
});

function invoiceFixture(invoice) {
  const server = readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const extract = (start, end) => server.slice(server.indexOf(start),server.indexOf(end));
  const values = { invoice:{...invoice}, booking:{invoiceDocId:'invoice'} };
  const fakeDb = {
    collection: () => ({ doc:() => 'booking' }),
    runTransaction: callback => callback({
      get: async ref => ({ data:() => structuredClone(values[ref]) }),
      update: (ref, fields) => {
        const updated = values[ref];
        for (const [key,value] of Object.entries(fields)) {
          if (key === 'chipInvoiceLink.paymentUrl') updated.chipInvoiceLink.paymentUrl = value;
          else updated[key] = value;
        }
      }
    })
  };
  const checkoutCalls = [];
  let order;
  const context = {
    CHIP_SECTIONS, azBusinessPayments:{chipReady:async () => true},
    azBusinessPaymentError:(message,statusCode) => Object.assign(new Error(message),{statusCode}),
    getAzobssBackendDb:() => fakeDb, azLoadManualInvoiceReceipt:async () => ({id:'invoice',ref:'invoice'}),
    makeId:() => 'chip-invoice-fixture', azManualInvoiceExpiryDays:() => 7,
    azValidEmailLike:email => email.includes('@'), cleanPremiumText:value => String(value ?? '').trim(),
    azManualInvoiceReceiptNo:invoiceNo => invoiceNo.replace('AZI-','AZR-'),
    azAdjustedMoneyText:amount => amount.toFixed(2),
    publicBaseUrlFromReq:() => 'https://backend.example.test',
    azStripeDigitalUrlWithQuery:(url,params) => url + '?' + new URLSearchParams(params),
    URLSearchParams, console, upsertPremiumOrder:saved => { order = saved; return order; },
    azStartChipPayment:async (...args) => {
      checkoutCalls.push(args);
      return {paymentUrl:'https://gate.chip-in.asia/p/fixture/'};
    },
    firebaseAdmin:{firestore:{FieldValue:{serverTimestamp:() => 'timestamp'}}}
  };
  const invoiceFns = runInNewContext(
    extract('function azManualInvoicePayableAmount(', 'function azIsManualSalesInvoiceOrder(') +
    extract('async function azCreateManualChipInvoiceLink(', 'async function azStartInvoiceStripePayment(') +
    '({create:azCreateManualChipInvoiceLink, settle:azSyncManualChipInvoicePaid})',context
  );
  return {
    ...invoiceFns, values, checkoutCalls,
    currentOrder:() => ({...order, paymentVerificationSource:'chip-api',paymentReference:'verified-fixture',paymentFee:2})
  };
}

const invoice = {
  status:'deposit-paid',source:'admin-manual-sale',invoiceNo:'AZI-1',customerEmail:'buyer@example.test',
  items:[{qty:1,unitPrice:500}],paidGross:250,sourceBookingId:'booking',productCost:40
};

test('manual CHIP links use the outstanding balance, reuse prior links and settle a linked booking once', async () => {
  const fixture = invoiceFixture(invoice);
  const link = await fixture.create({},'invoice','pc-service');
  assert.equal(link.section,'PC & Laptop Services');
  assert.equal(link.amountSen,25000);
  assert.equal((await fixture.create({},'invoice','pc-service')).paymentUrl,link.paymentUrl);
  assert.equal(fixture.checkoutCalls.length,1);
  await assert.rejects(fixture.create({},'invoice','rentals'),{statusCode:409});

  const record = {id:'invoice',ref:'invoice'};
  const order = fixture.currentOrder();
  assert.equal((await fixture.settle(record,order,{})).receiptNo,'AZR-1');
  assert.equal(fixture.values.invoice.paidGross,500);
  assert.equal(fixture.values.invoice.amountDue,0);
  assert.equal(fixture.values.invoice.profit,458);
  assert.equal(fixture.values.booking.paymentStatus,'paid');
  assert.equal((await fixture.settle(record,order,{})).alreadyPaid,true);
});

test('a verified CHIP payment for an edited invoice is flagged without changing the invoice or booking', async () => {
  const fixture = invoiceFixture(invoice);
  await fixture.create({},'invoice','remote-troubleshooting');
  fixture.values.invoice.paidGross = 300;
  const result = await fixture.settle({id:'invoice',ref:'invoice'},fixture.currentOrder(),{});
  assert.equal(result.issue,'invoice-changed-or-already-paid');
  assert.equal(fixture.values.invoice.status,'deposit-paid');
  assert.equal(fixture.values.booking.paymentStatus,undefined);
});
