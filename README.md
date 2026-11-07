# Landfall - One stop for small importers: landed cost, tariffs, and cash 

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

The workflow sets the Vite `base` to `/<repo-name>/` automatically, so renaming the repo needs no code change. Routing uses hashes (`/#/order/compare`), so page refreshes work on Pages.

If tests fail, the deploy stops. That is on purpose: a wrong number never goes live.

## Where things live

| Path | What it is |
|---|---|
| `src/engine/index.ts` | All the math. Every screen calls this. |
| `src/engine/portfolio.ts` | Dashboard math: saved orders sharing one bank balance, under one set of tariffs. Built on the engine above. |
| `src/screens/DashboardScreen.tsx` | Home screen: one swim lane per saved order, tariff sliders, combined cash flow and the borrow / no-borrow verdict. |
| `src/components/OrderModal.tsx` | The order pop-up: steps 1 to 6 as tabs, Back/Next, and Save order. Route `/#/order/<step>`. |
| `src/engine/engine.test.ts` | Tests locked to the expected results, to the cent. |
| `src/data/rates.json` | Every tariff and fee, with source and date. Tasks B1 and B2 update this. |
| `public/hts/` | The full USITC Harmonized Tariff Schedule for the HTS code picker. Written by `scripts/sync-hts.mjs`; don't edit by hand. |
| `src/components/HtsPicker.tsx`, `src/hts/` | HTS code picker: search by code or words, or browse Section → Chapter → Heading → line. |
| `src/data/sample.json` | The menswear sample scenario (Load sample button). |
| `src/summaries/index.ts` | Template sentences built from engine numbers. No AI. |
| `src/screens/` | Business, Supplier quotes, Compare, Cash check, Tariff what-if, Summary. |
| `src/state.tsx` | Shared app state; runs the engine whenever inputs change. |

## Dashboard

The app opens on the dashboard. **+ New order** opens steps 1 to 5 (plus the summary) in a pop-up; **Save order** in the pop-up's footer (from step 5) adds it to the dashboard. Closing the pop-up keeps the draft.

- **Order lanes**: placed orders are done deals, shown with the supplier they went to at today's tariffs. Lanes share one time axis: payment dots (sized by amount), arrival, and the selling period. Amber bands mark weeks when combined cash is under the safety buffer. **Edit** reopens an order in the pop-up.
- **Tariffs: plan your next orders**: one slider per country. This is future state only. It doesn't change placed orders or the cash plan; it lists, for each order, which supplier to use if you buy the same items again.
- **Cash flow**: all placed orders draw on one balance (company cash, buffer and APR under *Company cash settings*, set from your first saved order). The banner says whether you need to borrow, how much, by when, and when you can repay.

Saved orders live in the browser (localStorage key `landed-cost:orders:v1`).

## Changing a rate

Edit `src/data/rates.json`, keep `source` and `date` filled in, then run `npm test`. If a sample rate changed on purpose, update the expected numbers in both `CONTEXT.md` and `engine.test.ts`.

## HTS data (daily sync)

`.github/workflows/hts-sync.yml` runs every day. It asks the [USITC HTS API](https://hts.usitc.gov/reststop/releaseList) for the current release and, only if it changed, runs `scripts/sync-hts.mjs`, commits `public/hts/` and `data/hts/chapter99.json` to `main`, and starts the Pages deploy. If Chapter 99 (Section 301 and other extra tariffs) changed, it opens an issue so someone re-checks `extraTariffs` in `rates.json` by hand; those country rates are not updated automatically.

Run it by hand with `node scripts/sync-hts.mjs` (add `--force` to regenerate the same release). In GitHub, use **Actions > Sync HTS data > Run workflow**.

**Limitations.** Estimates use the general (most-favored-nation) rate only, and only when it is a percent of value or Free (about 89% of rated lines). Lines charged per kg, per unit (pair, dozen, each), per liter, or a mix such as `49.7¢/kg + 19.7%` are shown in the picker but can't be picked; they cluster in food and farm products, wool apparel, some footwear and watches. Trade-agreement (special) rates and value brackets (e.g. "valued over $12/pair") are not checked against your prices. Search matches the schedule's own wording plus a short list of everyday words (sneakers, laptop, jeans); use Browse when search comes up empty.
