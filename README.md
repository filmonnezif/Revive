# Revive Autonomous MVP

Revive is a single-page app with Vercel serverless APIs for quote generation, booking, and AI concierge chat.

## Gemini AI Chat Setup

1. Create a Gemini API key in Google AI Studio.
2. In Vercel project settings, add environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional, default is `gemini-flash-latest`)
3. Redeploy the project.

If Gemini is unavailable, the app falls back to deterministic local chat replies.

## API Routes

- `POST /api/quote` - calculates and returns a quote.
- `POST /api/bookings` - creates a meeting booking.
- `POST /api/chat` - generates AI concierge reply (Gemini + fallback).
- `GET /api/health` - health check endpoint.

## Local Development

Use Vercel dev so static page and API routes run together:

```bash
vercel dev
```

Then open the local URL shown by Vercel.

## Deployment

Push this folder to a git repository and import it in Vercel.
`vercel.json` uses the official Vercel schema, and API functions in `api/` use the default supported Node.js runtime automatically.
