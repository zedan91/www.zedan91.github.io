'use strict';

const { createPublicKey, verify } = require('node:crypto');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { createChipAdapter } = require('./azobss-chip-collect.cjs');

const BUSINESS_QR = '/assets/images/azobss-enterprise-duitnow-qr.jpg';
const BUSINESS_BANK = Object.freeze({ bank: 'Maybank', holder: 'AZOBSS ENTERPRISE', account: '562405751585' });
const DEFAULT_BACKUP = Object.freeze({ toyyibpay: false, stripe: false });

function paymentError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

async function getChipCallbackKey(apiKey, fetchImpl) {
  const response = await fetchImpl('https://gate.chip-in.asia/api/v1/public_key/', {
    headers: { Authorization: 'Bearer ' + apiKey },
    redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw paymentError('CHIP callback public key is unavailable.', 503);
  const key = createPublicKey(await response.json());
  if (key.asymmetricKeyType !== 'rsa') throw paymentError('Invalid CHIP callback public key.', 503);
  return key;
}

function createBusinessPayments({ root, getDb, stripeReady, toyyibReady, env = process.env, fetchImpl = globalThis.fetch }) {
  let cachedReadiness;
  let publicKey;
  let adapter;

  function chipAdapter() {
    if (!adapter) {
      adapter = createChipAdapter({ apiKey: env.CHIP_API_KEY, brandId: env.CHIP_BRAND_ID, fetchImpl });
    }
    return adapter;
  }

  async function chipKey() {
    if (publicKey) return publicKey;
    publicKey = await getChipCallbackKey(env.CHIP_API_KEY, fetchImpl);
    return publicKey;
  }

  async function chipReady() {
    if (env.CHIP_CHECKOUT_ENABLED !== '1' || !env.CHIP_API_KEY || !env.CHIP_BRAND_ID) return false;
    if (cachedReadiness && cachedReadiness.until > Date.now()) return cachedReadiness.promise;
    const promise = Promise.resolve().then(() => Promise.all([chipAdapter().methods(), chipKey()]))
      .then(([methods]) => methods.length > 0).catch(() => false);
    cachedReadiness = { promise, until: Date.now() + 30000 };
    return promise;
  }

  function settingsRef() {
    return getDb()?.collection('settings').doc('nonPaBmCheckout');
  }

  async function readBackups() {
    const snap = await settingsRef()?.get();
    const saved = snap?.data() || {};
    return { toyyibpay: saved.toyyibpay === true, stripe: saved.stripe === true };
  }

  async function saveBackups(backups) {
    if (typeof backups?.toyyibpay !== 'boolean' || typeof backups.stripe !== 'boolean') {
      throw paymentError('Select a visibility setting for both backup providers.', 400);
    }
    const ref = settingsRef();
    if (!ref) throw paymentError('Payment settings storage is unavailable.', 503);
    const values = { toyyibpay: backups.toyyibpay, stripe: backups.stripe };
    await ref.set({ ...values, updatedAtMs: Date.now() }, { merge: true });
    return values;
  }

  async function options() {
    const [backups, chip] = await Promise.all([readBackups(), chipReady()]);
    const bank = existsSync(join(root, BUSINESS_QR.slice(1))) ? { ...BUSINESS_BANK, qrUrl: BUSINESS_QR } : null;
    return { chip, bank, toyyibpay: backups.toyyibpay && !!toyyibReady(), stripe: backups.stripe && !!stripeReady() };
  }

  async function requireVisible(provider) {
    if (!Object.hasOwn(DEFAULT_BACKUP, provider)) throw paymentError('Invalid backup payment provider.', 400);
    if (!(await readBackups())[provider]) throw paymentError('This backup payment option is currently hidden.', 403);
  }

  async function chipStatus() {
    if (env.CHIP_CHECKOUT_ENABLED !== '1') return 'disabled';
    if (!env.CHIP_API_KEY || !env.CHIP_BRAND_ID) return 'missing_credentials';
    return (await chipReady()) ? 'ready' : 'provider_check_failed';
  }

  return {
    chipAdapter, chipReady, chipStatus, options, readBackups, saveBackups, requireVisible,
    readSignedCallback: req => readChipCallback(req, chipKey)
  };
}

async function readChipCallback(req, getKey) {
    const signature = req.headers['x-signature'];
    if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
      throw paymentError('CHIP callback signature required.', 401);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 256 * 1024) throw paymentError('CHIP callback is too large.', 413);
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks);
    if (!verify('RSA-SHA256', raw, await getKey(), Buffer.from(signature, 'base64'))) {
      throw paymentError('Invalid CHIP callback signature.', 401);
    }
    try { return JSON.parse(raw); }
    catch { throw paymentError('Invalid CHIP callback JSON.', 400); }
  }

module.exports = { BUSINESS_BANK, createBusinessPayments, getChipCallbackKey, readChipCallback, paymentError };
