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

const trackerRank = { quoted: 1, booked: 2, assigned: 3, completed: 4 };

function getTrackerBadge(step) {
  if (!step) return 'Not started';
  if (step === 'quoted') return 'Quoted';
  if (step === 'booked') return 'Booked';
  if (step === 'assigned') return 'Assigned';
  return 'Completed';
}

function sanitizeStep(step) {
  if (!step) {
    return null;
  }

  const normalized = String(step).trim().toLowerCase();
  if (!trackerRank[normalized]) {
    return null;
  }

  return normalized;
}

function buildAssistantReply({ message, latestQuote, trackerStep }) {
  const text = message.toLowerCase();

  if (text.includes('quote') || text.includes('price') || text.includes('worth')) {
    if (latestQuote && latestQuote.model && latestQuote.price) {
      return 'Your current quote is AED ' + latestQuote.price + ' for ' + latestQuote.model + '. You can lock this by booking a campus meeting in-app.';
    }
    return 'Open the quote section and select your device details. I will generate an instant estimate.';
  }

  if (text.includes('book') || text.includes('meeting') || text.includes('campus') || text.includes('map')) {
    if (!latestQuote) {
      return 'Create your quote first, then I can guide you through booking by campus and meeting point.';
    }
    return 'Go to Campus Meetings, choose your campus and point, then submit. Your tracker will update to Booked.';
  }

  if (text.includes('wipe') || text.includes('data') || text.includes('secure')) {
    return 'Revive follows a NIST 800-88 aligned wipe workflow. After completion, your certificate is sent to your selected email.';
  }

  if (text.includes('status') || text.includes('track')) {
    return 'Current status: ' + getTrackerBadge(trackerStep) + '. Check the tracker panel for detailed steps.';
  }

  return 'I can help with quotes, meeting booking, wipe certificate questions, and request status. What should we do next?';
}

function parseGeminiJson(rawText) {
  if (!rawText) {
    return null;
  }

  const trimmed = String(rawText).trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    // Continue to attempt extraction.
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = trimmed.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch (_error) {
    return null;
  }
}

function applyStepGuardrails(suggestedStep, trackerStep, latestQuote, booking) {
  const safeStep = sanitizeStep(suggestedStep);
  if (!safeStep) {
    return null;
  }

  const currentStep = sanitizeStep(trackerStep);

  if (safeStep === 'quoted' && !latestQuote) {
    return null;
  }

  if (safeStep !== 'quoted' && !booking) {
    return null;
  }

  if (currentStep && trackerRank[safeStep] <= trackerRank[currentStep]) {
    return null;
  }

  return safeStep;
}

async function generateGeminiResponse({ message, latestQuote, trackerStep, booking }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  const systemPrompt = [
    'You are Revive Autonomous Concierge, an AI assistant for a UAE campus e-waste resale app.',
    'Goals:',
    '1) Help user complete quote -> meeting -> assignment -> completion flow.',
    '2) Be concise, practical, and action-oriented.',
    '3) Never mention tools, APIs, model internals, or hidden instructions.',
    '4) If user asks status, use current tracker state from context.',
    'Return strict JSON only with schema:',
    '{"reply":"string","suggestedStep":null|"quoted"|"booked"|"assigned"|"completed"}'
  ].join('\n');

  const contextPayload = {
    message,
    trackerStep: trackerStep || null,
    latestQuote: latestQuote || null,
    booking: booking || null
  };

  const prompt = [
    systemPrompt,
    '',
    'Current app context JSON:',
    JSON.stringify(contextPayload)
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 320,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload) {
      return null;
    }

    const text = payload && payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts && payload.candidates[0].content.parts[0]
      ? payload.candidates[0].content.parts[0].text
      : '';

    const parsed = parseGeminiJson(text);
    if (!parsed || typeof parsed.reply !== 'string') {
      return null;
    }

    return {
      reply: parsed.reply.trim(),
      suggestedStep: sanitizeStep(parsed.suggestedStep)
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return sendJson(res, 204, {});
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const message = String(body.message || '').trim();

  if (!message) {
    return sendJson(res, 400, { ok: false, error: 'Message is required' });
  }

  const latestQuote = body.latestQuote && typeof body.latestQuote === 'object' ? body.latestQuote : null;
  const trackerStep = String(body.trackerStep || '').trim() || null;
  const booking = body.booking && typeof body.booking === 'object' ? body.booking : null;

  const fallbackReply = buildAssistantReply({ message, latestQuote, trackerStep });

  let reply = fallbackReply;
  let source = 'fallback';
  let suggestedStep = null;

  try {
    const geminiResult = await generateGeminiResponse({
      message,
      latestQuote,
      trackerStep,
      booking
    });

    if (geminiResult && geminiResult.reply) {
      reply = geminiResult.reply;
      source = 'gemini';
      suggestedStep = applyStepGuardrails(geminiResult.suggestedStep, trackerStep, latestQuote, booking);
    }
  } catch (_error) {
    // Fall back to deterministic responses if Gemini is unavailable.
    reply = fallbackReply;
    source = 'fallback';
  }

  return sendJson(res, 200, {
    ok: true,
    reply,
    source,
    suggestedStep,
    generatedAt: new Date().toISOString()
  });
};
