# AI explanation Worker

A Cloudflare Worker with one endpoint, `POST /explain`. The app sends it the engine's results as JSON; the Worker
asks Claude to put them into plain English and returns six short fields (`headline`, `supplier_choice`,
`cash_outlook`, `tariff_risk`, `next_steps`, `caveat`). Claude never calculates anything: the prompt forbids it, and
the app re-checks every `$` and `%` in the answer against the engine results before showing it.

If anything goes wrong (not configured, over budget, slower than 5 s, a bad answer), the app shows its standard
template summary instead. The demo never depends on the AI.

## Safeguards

| What | How | Setting |
|---|---|---|
| Who can call it | CORS allowlist; other browser origins get 403 | `ALLOWED_ORIGINS` |
| Daily spending cap | Real cost of each call (from token usage) added up in KV; once the day's total reaches the cap, calls stop until 00:00 UTC | `DAILY_BUDGET_USD` (default $1) |
| Per-visitor limit | Requests per IP per hour | `IP_PER_HOUR` (default 20) |
| Hard backstop | Monthly spend limit on the Anthropic Console (step 2 below) | Console |
| Speed | 4.5 s timeout to Anthropic, no retries; the app gives up at 5 s | `UPSTREAM_TIMEOUT_MS` |
| Repeat clicks | Same scenario = cached answer from KV, free and instant | `CACHE_TTL_S` (default 7 days) |
| Input size | 20 KB body limit; strings capped at 80 characters | code |

The API key is a Worker **secret**. It never reaches the browser or the repo.

## Setup (one time)

1. **Anthropic API key.** At <https://console.anthropic.com> → API keys, create a key for this project
   (a separate key from the map chat makes its usage easy to track and revoke).
2. **Anthropic spend limit.** Console → Settings → Limits: set a monthly spend limit you're comfortable with
   (for example $10). This is the backstop if the Worker's daily cap is ever exceeded.
3. **Log in to Cloudflare** (same account as the map chat):
   ```bash
   cd worker && npm install && npx wrangler login
   ```
4. **Create the KV namespace** for limits and the cache, then paste the printed `id` into `wrangler.jsonc`
   (replace `PASTE_KV_NAMESPACE_ID_HERE`):
   ```bash
   npx wrangler kv namespace create KV
   ```
5. **Store the API key as a secret** (it prompts for the value):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
6. **Check `ALLOWED_ORIGINS`** in `wrangler.jsonc`. It must list the exact site origin (scheme + host, no path, no
   trailing slash). GitHub Pages for this repo is `https://katytseng.github.io`; keep `http://localhost:5173` for local
   development.
7. **Deploy:**
   ```bash
   npx wrangler deploy
   ```
   It prints the URL, e.g. `https://landed-cost-explain.<your-subdomain>.workers.dev`. Check it:
   `curl https://landed-cost-explain.<your-subdomain>.workers.dev/health` should return `{"ok":true}`.
8. **Point the app at it.**
   - Local: create `.env.local` in the repo root with
     `VITE_EXPLAIN_URL=https://landed-cost-explain.<your-subdomain>.workers.dev/explain`, then restart `npm run dev`.
   - GitHub Pages: repo → Settings → Secrets and variables → Actions → **Variables** → New repository variable
     `EXPLAIN_URL` = the same `/explain` URL. The next deploy picks it up. (A variable, not a secret: the URL is
     visible in the browser anyway.)

## Model, speed and cost

The Worker uses `claude-haiku-5-5` at effort `low` (the same model as the campus map chat), chosen so answers
reliably land inside the 5 s budget. To try a different model, change `"MODEL"` in `wrangler.jsonc` and redeploy,
for example `claude-opus-5-5` for richer wording at the risk of more timeouts (the owner then sees the standard
summary). Prices are built in for Haiku 5.5, Sonnet 5.5 and Opus 5.5, so the daily cap stays accurate when you switch.

Rough cost per uncached explanation at effort `low`: about 3,000 input + up to ~1,000 output tokens, so under
$0.001 on Haiku 5.5 (about $0.03 on Opus 5.5). The system prompt is cached, and repeat scenarios are served from KV.
At $1/day that is well over a thousand explanations.

If you switch to Opus 5.5, Sonnet 5.5 or Fable, the Worker also turns on Anthropic's server-side refusal fallback
(`fallbacks: "default"`): if a safety classifier declines a request, it is re-run on a recommended fallback model.
Haiku 5.5 has no server-side fallback, so a declined request simply shows the standard summary.

## Local development

```bash
cd worker
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars   # gitignored
npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://localhost:5175
```
Then start the app against it with the `dev-with-local-worker` entry in `.claude/launch.json`
(or `VITE_EXPLAIN_URL=http://localhost:8787/explain npm run dev -- --port 5175`).

```bash
npm test          # Worker unit tests (CORS, caps, cost, payload checks, answer parsing)
npm run typecheck
```

## Changing the prompt

The prompt is in `src/prompt.ts`: the owner rules, a section that explains how the engine calculates each input
field, and the output format. Bump `PROMPT_VERSION` when you change it so cached answers from the old prompt are
not reused. If you add a field to the output, add it to `OUTPUT_FIELDS` here and `EXPLAIN_FIELDS` in
`src/ai/explain.ts`.
