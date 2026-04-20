const models = {
  iphone: ['iPhone 11', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 15'],
  samsung: ['Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy A53', 'Galaxy A54', 'Galaxy Z Flip 4', 'Galaxy Z Flip 5'],
  other: ['Google Pixel 6', 'Google Pixel 7', 'OnePlus 10', 'OnePlus 11', 'Xiaomi 12', 'Xiaomi 13', 'Other Android']
};

const prices = {
  iphone: { new: 520, good: 430, fair: 205, broken: 70 },
  samsung: { new: 390, good: 305, fair: 155, broken: 55 },
  other: { new: 260, good: 195, fair: 102, broken: 40 }
};

const storageAdjustments = { 64: 0, 128: 20, 256: 55, 512: 95 };
const batteryAdjustments = { excellent: 18, good: 0, weak: -28 };

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }

  return req.body;
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return sendJson(res, 204, {});
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const brand = String(body.brand || '').trim();
  const model = String(body.model || '').trim();
  const condition = String(body.condition || '').trim();
  const storage = String(body.storage || '').trim();
  const battery = String(body.battery || '').trim();
  const notes = String(body.notes || '').trim();

  if (!brand || !model || !condition || !storage || !battery) {
    return sendJson(res, 400, { ok: false, error: 'Missing required fields' });
  }

  if (!models[brand] || !models[brand].includes(model)) {
    return sendJson(res, 400, { ok: false, error: 'Unsupported brand or model' });
  }

  if (!prices[brand][condition]) {
    return sendJson(res, 400, { ok: false, error: 'Unsupported condition' });
  }

  if (storageAdjustments[storage] === undefined) {
    return sendJson(res, 400, { ok: false, error: 'Unsupported storage option' });
  }

  if (batteryAdjustments[battery] === undefined) {
    return sendJson(res, 400, { ok: false, error: 'Unsupported battery option' });
  }

  const base = prices[brand][condition];
  const storageBonus = storageAdjustments[storage];
  const batteryBonus = batteryAdjustments[battery];
  const price = Math.max(30, base + storageBonus + batteryBonus);

  const quote = {
    quoteId: 'QT-' + Date.now().toString().slice(-7),
    brand,
    model,
    condition,
    storage,
    battery,
    notes,
    price,
    lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  return sendJson(res, 200, { ok: true, quote });
};
