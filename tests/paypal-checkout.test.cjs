const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('script.js', 'utf8');
function frontend() {
  const calls = [], containers = new Map();
  for (const id of ['paypal-starter', 'paypal-pro', 'paypal-business', 'paypal-ai-credit-1-home', 'paypal-ai-credit-10-home']) {
    containers.set(id, { id, isConnected: true, children: [] });
  }
  const paypal = { Buttons(options) {
    const call = { options, closed: false };
    calls.push(call);
    return {
      render(container) { call.container = container; container.children.push(call); return Promise.resolve(); },
      close() { call.closed = true; return Promise.resolve(); },
    };
  } };
  const context = vm.createContext({ window: { paypal }, document: { getElementById: id => containers.get(id) }, console });
  vm.runInContext(source.slice(source.indexOf('const paypalButtonInstances ='), source.indexOf('function checkProjectLimit()')), context);
  vm.runInContext(source.slice(source.indexOf('function proResult('), source.indexOf('function showLastAnalysis(')), context);
  return { context, containers, calls };
}

test('indulás és ismételt auth/frissítés nem törli vagy kettőzi a PayPal iframe-eket', () => {
  const { context, containers, calls } = frontend();
  for (let i = 0; i < 20; i++) vm.runInContext('renderPayPal()', context);
  assert.equal(calls.length, 5);
  for (const container of containers.values()) assert.equal(container.children.length, 1);
});

test('a dinamikus kreditajánlat cseréje előbb lezárja a régi gombot, az új elem renderelhető', () => {
  const { context, containers, calls } = frontend();
  const old = { id: 'paypal-ai-credit-1', isConnected: true, children: [] };
  containers.set(old.id, old);
  vm.runInContext('renderPayPal()', context);
  const oldCall = calls.find(c => c.container === old);
  containers.set('proToolsResult', {
    querySelectorAll: () => [old],
    set innerHTML(value) {
      assert.equal(oldCall.closed, true, 'SDK close must happen before DOM removal');
      old.isConnected = false;
      containers.set(old.id, { id: old.id, isConnected: true, children: [] });
    },
  });
  vm.runInContext("proResult('replacement'); renderPayPal(); renderPayPal();", context);
  assert.equal(calls.length, 7);
  assert.equal(calls.filter(c => c.container.id === old.id && !c.closed).length, 1);
});

const edgeSource = stripTypeScriptTypes(fs.readFileSync('supabase/functions/paypal-ai-credits/index.ts', 'utf8').replace(/^import .*;\r?\n/gm, ''));
async function edgePurchase({ credits = 1, amount = 390, paidAmount = amount, currency = 'HUF', duplicate = false, authenticated = true } = {}) {
  let handler;
  const rpcCalls = [], fetchCalls = [];
  const context = vm.createContext({
    serve: fn => { handler = fn; }, Request, Response, btoa,
    Deno: { env: { get: name => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service' : 'test-value' } },
    createClient: (_url, key) => key === 'test-service' ? {
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: { credits, added: duplicate ? 0 : credits, duplicate }, error: null }; },
    } : { auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'test-user' } : null }, error: null }) } },
    fetch: async url => {
      fetchCalls.push(url);
      if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-paypal-token' });
      assert.match(url, /\/v2\/checkout\/orders\/TEST-ORDER$/);
      return Response.json({ id: 'TEST-ORDER', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ amount: { value: String(paidAmount), currency_code: currency } }] } }] });
    },
  });
  vm.runInContext(edgeSource, context);
  const response = await handler(new Request('https://example.invalid/paypal-ai-credits', {
    method: 'POST', headers: { Authorization: 'Bearer test-user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'TEST-ORDER', credits, amount }),
  }));
  return { status: response.status, body: await response.json(), rpcCalls, fetchCalls };
}

test('a meghirdetett 390 Ft-os kredit és a 2990 Ft-os tízes csomag ellenőrzött nyugtával jóváírható', async () => {
  for (const [credits, amount] of [[1, 390], [10, 2990]]) {
    const result = await edgePurchase({ credits, amount });
    assert.equal(result.status, 200);
    assert.equal(result.body.added, credits);
    assert.equal(result.rpcCalls[0].name, 'grant_ai_credits_admin');
    assert.equal(result.rpcCalls[0].args.p_amount_huf, amount);
    assert.equal(result.rpcCalls[0].args.p_user_id, 'test-user');
  }
});

test('hibás ár, eltérő PayPal-nyugta/pénznem és hiányzó belépés nem adhat kreditet', async () => {
  for (const options of [{ amount: 490 }, { paidAmount: 1 }, { currency: 'USD' }, { authenticated: false }]) {
    const result = await edgePurchase(options);
    assert.equal(result.status, options.authenticated === false ? 401 : 400);
    assert.equal(result.rpcCalls.length, 0);
  }
});

test('ismételt rendelés válasza továbbra is nulla új kreditet jelez', async () => {
  const result = await edgePurchase({ duplicate: true });
  assert.equal(result.status, 200);
  assert.equal(result.body.added, 0);
  assert.equal(result.body.duplicate, true);
});
