# Landed Cost and Cash Check

UCLA Anderson MSBA Vibathon 2026, Theme 06. A web app for small US importers: what an order really costs after tariffs, which supplier is cheapest, and whether your cash can carry the order until the stock sells.

Estimates, not customs or legal advice.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests, must match CONTEXT.md "Expected results"
npm run build    # production build into dist/
```

Node 20 or newer.

## Deploy (GitHub Pages)

1. Push to `main`.
2. One time only: in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and deploys. The site appears at `https://<owner>.github.io/<repo-name>/`.

The workflow sets the Vite `base` to `/<repo-name>/` automatically, so renaming the repo needs no code change. Routing uses hashes (`/#/compare`), so page refreshes work on Pages.

If tests fail, the deploy stops. That is on purpose: a wrong number never goes live.

## Where things live

| Path | What it is |
|---|---|
| `src/engine/index.ts` | All the math. Every screen calls this. |
| `src/engine/engine.test.ts` | Tests locked to the expected results, to the cent. |
| `src/data/rates.json` | Every tariff and fee, with source and date. Tasks B1 and B2 update this. |
| `src/data/sample.json` | The menswear sample scenario (Load sample button). |
| `src/summaries/index.ts` | Template sentences built from engine numbers. No AI. |
| `src/screens/` | Business, Supplier quotes, Compare, Cash check, Tariff what-if, Summary. |
| `src/state.tsx` | Shared app state; runs the engine whenever inputs change. |

## Changing a rate

Edit `src/data/rates.json`, keep `source` and `date` filled in, then run `npm test`. If a sample rate changed on purpose, update the expected numbers in both `CONTEXT.md` and `engine.test.ts`.
