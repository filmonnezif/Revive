const validCampuses = new Set(['hct-abudhabi', 'aus-sharjah', 'uaeu-alain', 'ku-abudhabi']);

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

function makeBookingId() {
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = Date.now().toString().slice(-5);
  return 'RV-' + stamp + randomPart;
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

  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const campus = String(body.campus || '').trim();
  const pointName = String(body.pointName || '').trim();
  const date = String(body.date || '').trim();
  const time = String(body.time || '').trim();
  const notes = String(body.notes || '').trim();
  const quotePrice = Number(body.quotePrice || 0);

  if (!fullName || !phone || !email || !campus || !pointName || !date || !time || !quotePrice) {
    return sendJson(res, 400, { ok: false, error: 'Missing required booking fields' });
  }

  if (!validCampuses.has(campus)) {
    return sendJson(res, 400, { ok: false, error: 'Unsupported campus' });
  }

  const booking = {
    bookingId: makeBookingId(),
    fullName,
    phone,
    email,
    campus,
    pointName,
    date,
    time,
    notes,
    quotePrice,
    status: 'booked',
    createdAt: new Date().toISOString()
  };

  return sendJson(res, 201, {
    ok: true,
    booking
  });
};
