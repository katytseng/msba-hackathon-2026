# Landfall demo numbers sheet

Every number below is computed by the real engine from the seed data in `src/demo/data.ts`, and `src/demo/demo.test.ts` fails if any of them change.
This file is written by that test. Do not edit it by hand: change the data, then run `npx vitest run --dir src demo -u` to regenerate it.

**Fictional:** supplier names, quotes, freight, lead times, quantities, sell prices, sales speeds, the bank balance and the buffer. **Real:** every item's base tariff (USITC HTS 2026HTSRev23) and the extra tariffs per country (`rates.json`, unchanged).

## 0. Setup

- Demo day (`DEMO_TODAY`): **Wed Nov 18, 2026**. The live demo order is dated **Thu Nov 19, 2026** (DEMO_TODAY + 1).
- Company (Finances tab): cash on hand **$24,000**, safety buffer **$8,000**, loan APR **8%**.
- Extra tariffs today (unchanged): China 20%, Vietnam 12.5%, India 10%.

## 1. The demo order: items, HTS codes and tariff rates

Type items 1 and 2 by hand, then press **Fill sample** (top of the pop-up, next to Clear) on each step. Fill sample sets the typed items to exactly these values.

| # | Item | HTS code | Base tariff | Qty | Sell price | Sales / wk | Quote: Pearl Delta Outerwear (China) | Quote: Mekong Textile Works (Vietnam) | Quote: Deccan Garments (India) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cashmere sweater | `6110.12.10` | 4% | 200 | $149 | 12 | $43.85 | $44.90 | $45.00 |
| 2 | Poncho | `3926.20.60.00` | 0% | 300 | $16 | 30 | $3.61 | $3.70 | $3.91 |
| 3 | Rain jacket | `6202.40.70.00` | 7.1% | 300 | $75 | 25 | $20.93 | $21.40 | $21.61 |
| 4 | Waterproof boots | `6401.92.90.60` | 37.5% | 200 | $52 | 15 | $12.54 | $12.75 | $12.93 |
| 5 | Umbrella | `6601.91.00.00` | 0% | 300 | $16 | 30 | $3.31 | $3.40 | $3.55 |

Gross margin at full sell-through (recommended supplier): revenue $72,300, margin $45,144 (62.4%). 1,300 units.

Freight, deposits and timing per supplier:

| Supplier | Freight quote | Deposit | Balance due | Lead time | Transit |
|---|---|---|---|---|---|
| Pearl Delta Outerwear (China) | $2,350 | 30% | at shipment | 33 days | 18 days |
| Mekong Textile Works (Vietnam) | $2,350 | 30% | 7 days after shipment | 8 days | 20 days |
| Deccan Garments (India) | $2,950 | 30% | 14 days after shipment | 10 days | 31 days |

Lead times are a modelling choice: China is quoted made to order (33 days to produce); Vietnam and India ship from ready stock (8 and 10 days). That is the only way a Nov 19 ocean order reaches a US warehouse before Christmas, and only Vietnam gets there.

## 2. Compare screen (step 3)

| Supplier | Rank | Quote (product cost) | Tariffs (base + extra) | Freight + insurance | Customs fees | Landed total | Above quote | Per unit | Lead + transit | Arrives |
|---|---|---|---|---|---|---|---|---|---|---|
| Pearl Delta Outerwear (China) | 3 | $19,633.00 | $5,663.71 ($1,737.11 + $3,926.60) | $2,448.17 | $342.55 | **$28,087.42** | 43.1% | $21.61 | 33 + 18 days | Sat Jan 9, 2027 |
| Mekong Textile Works (Vietnam) | 1 | $20,080.00 | $4,281.27 ($1,771.27 + $2,510.00) | $2,450.40 | $344.66 | **$27,156.33** | 35.2% | $20.89 | 8 + 20 days | Thu Dec 17, 2026 |
| Deccan Garments (India) | 2 | $20,307.00 | $3,820.74 ($1,790.04 + $2,030.70) | $3,051.54 | $345.73 | **$27,525.01** | 35.5% | $21.17 | 10 + 31 days | Wed Dec 30, 2026 |

### Numbers for the script

- **China total quote: $19,633.00** (the lowest quote of the three).
- **China landed total: $28,087.42**, which is **43.1% above its quote**.
- **Vietnam quote vs China: +$447.00** (+2.3%).
- **Vietnam landed vs China: -$931.10** (Vietnam lands cheaper; it is the recommended supplier).
- India lands $368.68 above Vietnam and $562.42 below China.
- **Arrival dates (order dated Nov 19, 2026):** Vietnam **Thu Dec 17, 2026** (day 28, sales start Thu Dec 17, 2026), India **Wed Dec 30, 2026** (day 41), China **Sat Jan 9, 2027** (day 51).

## 3. Cash check (step 4), recommended supplier

Supplier: **Mekong Textile Works (Vietnam)**, starting from $24,000 on the order date.

- **Lowest balance: $1,469.60**
- **Which week: week 2** (week starting Thu Dec 3, 2026); sales start in week 4.
- **Shortfall below the buffer: $6,530.40**, for 3 weeks.
- **Interest to bridge: $30.06** at 8% APR.

| When | What | Amount |
|---|---|---|
| Day 0 (Thu Nov 19, 2026) | Deposit to supplier | $6,024.00 |
| Day 8 (Fri Nov 27, 2026) | Freight and insurance | $2,450.40 |
| Day 15 (Fri Dec 4, 2026) | Balance to supplier | $14,056.00 |
| Day 42 (Thu Dec 31, 2026) | Duty and customs fees | $4,625.93 |

End-of-week balances, weeks 0 to 7: $17,976.00, $15,525.60, $1,469.60, $1,469.60, $6,872.60, $12,275.60, $13,052.67, $18,455.67.

## 4. Finances tab

| State | Cash on hand | Banner | Lowest balance | Short of buffer | Weeks under buffer | Interest |
|---|---|---|---|---|---|---|
| Seed (3 existing orders) | $24,000 | No loan needed | $24,000.00 (week of Nov 18, 2026) | $0.00 | 0 | $0.00 |
| **Type $5,000 into Cash on hand** | $5,000 | **Borrow about $3,000** | $5,000.00 (week of Nov 18, 2026) | $3,000.00 | 2 | $9.21 |
| After the demo order is saved (Vietnam) | $24,000 | Borrow about $3,000 | $5,328.06 (week of Dec 2, 2026) | $2,671.94 | 1 | $4.10 |
| **Demo order saved, then type $5,000** (the script's order) | $5,000 | **Borrow about $22,000** | -$13,671.94 (week of Dec 2, 2026) | $21,671.94 | 5 | $166.25 |

- **Seed cash on hand: $24,000** (green, "No loan needed").
- **If the demo order is already saved when you type $5,000 (the order the script follows): "Borrow about $22,000 by Nov 18, 2026"**, lowest balance -$13,671.94 in the week of Dec 2, 2026, 5 weeks under the buffer, interest $166.25.
- **With only the 3 existing orders, typing $5,000: "Borrow about $3,000 by Nov 18, 2026"** (amber), estimated interest $9.21. Put it back to $24,000 (or press Fill sample on the Cash check step) before the next section.

## 5. Orders tab on the demo day

| Order | Supplier (placed) | Units | Quote | Landed | Ordered | Ships | Arrives | Breaks even | Sells out | Stage | Sales so far |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fall essentials | Ningbo Harbor Knits (China) | 800 | $9,354 | $14,764 | Sep 10, 2026 | Oct 13, 2026 | Oct 31, 2026 | Dec 3, 2026 | Feb 10, 2027 | selling | $5,960 |
| Winter layers | Ludhiana Woolworks (India) | 650 | $10,020 | $14,622 | Oct 14, 2026 | Oct 24, 2026 | Nov 24, 2026 | Dec 30, 2026 | Apr 6, 2027 | transit | $0 |
| Holiday party | Saigon Evening Wear (Vietnam) | 600 | $8,700 | $12,775 | Nov 16, 2026 | Nov 24, 2026 | Dec 14, 2026 | Jan 18, 2027 | Apr 11, 2027 | production | $0 |
| Rainy day LA | Mekong Textile Works (Vietnam) | 1300 | $20,080 | $27,156 | Nov 19, 2026 | Nov 27, 2026 | Dec 17, 2026 | Jan 21, 2027 | Apr 14, 2027 | production | $0 |

(The last row is the live demo order once saved; before that the dashboard shows the first three.)

## 6. Plan & simulate

Item table = the Plan tab's "Who to order each item from", with the demo order saved (14 items across 4 orders).

### Baseline (today's tariffs: India 10%)

**3 of 14 items are already cheaper from a different supplier than last time:** Cotton hoodie -> Binh Duong Knitwear (Vietnam); Cotton knit T-shirt -> Binh Duong Knitwear (Vietnam); Men's cotton flannel shirt -> Da Nang Apparel (Vietnam).
(With only the 3 existing orders on the dashboard it is the same 3.)

| Order | Item | Last time | Order from | Status | Landed / unit | Last / unit | Units |
|---|---|---|---|---|---|---|---|
| Fall essentials | Cotton hoodie | Ningbo Harbor Knits (China) | Binh Duong Knitwear (Vietnam) | **Switch from last time** | $25.77 | $27.05 | 300 |
| Fall essentials | Cotton knit T-shirt | Ningbo Harbor Knits (China) | Binh Duong Knitwear (Vietnam) | **Switch from last time** | $7.34 | $7.67 | 300 |
| Fall essentials | Women's cotton jeans | Ningbo Harbor Knits (China) | Ningbo Harbor Knits (China) | Same as last time | $21.74 | $21.74 | 200 |
| Winter layers | Women's corduroy blazer | Ludhiana Woolworks (India) | Ludhiana Woolworks (India) | Same as last time | $45.48 | $45.48 | 150 |
| Winter layers | Wool scarf | Ludhiana Woolworks (India) | Ludhiana Woolworks (India) | Same as last time | $13.95 | $13.95 | 300 |
| Winter layers | Men's cotton flannel shirt | Ludhiana Woolworks (India) | Da Nang Apparel (Vietnam) | **Switch from last time** | $17.26 | $18.08 | 200 |
| Holiday party | Women's party dress | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $42.63 | $42.63 | 200 |
| Holiday party | Women's cotton blouse | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $18.41 | $18.41 | 100 |
| Holiday party | Evening shawl | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $8.03 | $8.03 | 300 |
| Rainy day LA | Cashmere sweater | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $58.56 | $58.56 | 200 |
| Rainy day LA | Poncho | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $4.68 | $4.68 | 300 |
| Rainy day LA | Rain jacket | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $28.57 | $28.57 | 300 |
| Rainy day LA | Waterproof boots | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $20.90 | $20.90 | 200 |
| Rainy day LA | Umbrella | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $4.30 | $4.30 | 300 |

Totals shown: **Saved by switching $395** (1 supplier change), Reorder everything $68,921. Order level: Fall essentials: switch to Binh Duong Knitwear (Vietnam), saves $395; Winter layers: stay with Ludhiana Woolworks (India); Holiday party: stay with Saigon Evening Wear (Vietnam); Rainy day LA: stay with Mekong Textile Works (Vietnam).

### Slider: India 10% to **6%** (-4.0 points)

**Exact slider value: India 6%** (today 10%). The same flips happen anywhere from India 7% down to 4.5%.

- **Items that flip to India:** Cashmere sweater (4% base tariff), Rain jacket (7.1% base tariff), Waterproof boots (37.5% base tariff).
- **Items that stay put:** Poncho (0% base tariff), Umbrella (0% base tariff).

| Order | Item | Last time | Order from | Status | Landed / unit | Last / unit | Units |
|---|---|---|---|---|---|---|---|
| Fall essentials | Cotton hoodie | Ningbo Harbor Knits (China) | Binh Duong Knitwear (Vietnam) | **Switch from last time** | $25.77 | $27.05 | 300 |
| Fall essentials | Cotton knit T-shirt | Ningbo Harbor Knits (China) | Binh Duong Knitwear (Vietnam) | **Switch from last time** | $7.34 | $7.67 | 300 |
| Fall essentials | Women's cotton jeans | Ningbo Harbor Knits (China) | Ningbo Harbor Knits (China) | Same as last time | $21.74 | $21.74 | 200 |
| Winter layers | Women's corduroy blazer | Ludhiana Woolworks (India) | Ludhiana Woolworks (India) | Same as last time | $44.22 | $45.48 | 150 |
| Winter layers | Wool scarf | Ludhiana Woolworks (India) | Ludhiana Woolworks (India) | Same as last time | $13.56 | $13.95 | 300 |
| Winter layers | Men's cotton flannel shirt | Ludhiana Woolworks (India) | Da Nang Apparel (Vietnam) | **Switch from last time** | $17.26 | $18.08 | 200 |
| Holiday party | Women's party dress | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $42.63 | $42.63 | 200 |
| Holiday party | Women's cotton blouse | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $18.41 | $18.41 | 100 |
| Holiday party | Evening shawl | Saigon Evening Wear (Vietnam) | Saigon Evening Wear (Vietnam) | Same as last time | $8.03 | $8.03 | 300 |
| Rainy day LA | Cashmere sweater | Mekong Textile Works (Vietnam) | Deccan Garments (India) | **Switch from last time** | $57.03 | $58.56 | 200 |
| Rainy day LA | Poncho | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $4.68 | $4.68 | 300 |
| Rainy day LA | Rain jacket | Mekong Textile Works (Vietnam) | Deccan Garments (India) | **Switch from last time** | $28.06 | $28.57 | 300 |
| Rainy day LA | Waterproof boots | Mekong Textile Works (Vietnam) | Deccan Garments (India) | **Switch from last time** | $20.72 | $20.90 | 200 |
| Rainy day LA | Umbrella | Mekong Textile Works (Vietnam) | Mekong Textile Works (Vietnam) | Same as last time | $4.30 | $4.30 | 300 |

Totals shown: **Saved by switching $839** (2 supplier changes; was $395 at today's rates), Reorder everything $68,077. Order level: Fall essentials: switch to Binh Duong Knitwear (Vietnam), saves $395; Winter layers: stay with Ludhiana Woolworks (India); Holiday party: stay with Saigon Evening Wear (Vietnam); Rainy day LA: switch to Deccan Garments (India), saves $444.
If you split the demo order by item instead of buying it all from one supplier, the three India items alone are cheaper by about $495 (separate shipments not included).

How the table moves as the India slider drops (0.5-point steps, items that pick India are listed):

| India extra tariff | Items from India | Items "Switch from last time" |
|---|---|---|
| 10% | Women's corduroy blazer, Wool scarf | 3 |
| 9.5% | Women's corduroy blazer, Wool scarf | 3 |
| 9% | Women's corduroy blazer, Wool scarf, Cashmere sweater | 4 |
| 8.5% | Women's corduroy blazer, Wool scarf, Cashmere sweater | 4 |
| 8% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket | 5 |
| 7.5% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket | 5 |
| 7% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 6.5% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 6% **(scripted)** | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 5.5% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 5% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 4.5% | Women's corduroy blazer, Wool scarf, Cashmere sweater, Rain jacket, Waterproof boots | 6 |
| 4% | Cotton knit T-shirt, Women's corduroy blazer, Wool scarf, Women's cotton blouse, Cashmere sweater, Rain jacket, Waterproof boots, Umbrella | 8 |
| 3.5% | Cotton knit T-shirt, Women's corduroy blazer, Wool scarf, Women's cotton blouse, Cashmere sweater, Rain jacket, Waterproof boots, Umbrella | 8 |
| 3% | Cotton knit T-shirt, Women's corduroy blazer, Wool scarf, Women's cotton blouse, Cashmere sweater, Rain jacket, Waterproof boots, Umbrella | 8 |
| 2.5% | Cotton hoodie, Cotton knit T-shirt, Women's corduroy blazer, Wool scarf, Men's cotton flannel shirt, Women's cotton blouse, Evening shawl, Cashmere sweater, Poncho, Rain jacket, Waterproof boots, Umbrella | 9 |
| 2% | Cotton hoodie, Cotton knit T-shirt, Women's corduroy blazer, Wool scarf, Men's cotton flannel shirt, Women's party dress, Women's cotton blouse, Evening shawl, Cashmere sweater, Poncho, Rain jacket, Waterproof boots, Umbrella | 10 |

Where each demo item flips to India as the slider drops: Cashmere sweater at 9% or lower, Poncho at 2.5% or lower, Rain jacket at 8% or lower, Waterproof boots at 7% or lower, Umbrella at 4% or lower.

### Switch points (the "Switch point" column)

| Order | Last time's country | At today's tariffs | At India 6% |
|---|---|---|---|
| Fall essentials | China | cheapest changes if China's tariff drops under 15.8% | cheapest changes if China's tariff drops under 15.8% |
| Winter layers | India | cheapest changes if India's tariff passes 11.1% | cheapest changes if India's tariff passes 11.1% |
| Holiday party | Vietnam | cheapest changes if Vietnam's tariff passes 18.2% | cheapest changes if Vietnam's tariff passes 15.8% |
| Rainy day LA | Vietnam | cheapest changes if Vietnam's tariff passes 14.3% | cheapest changes if Vietnam's tariff drops under 10.3% |

One order in depth, "Rainy day LA", the cheapest supplier changes if: today China's extra tariff crosses 15.3%, Vietnam's extra tariff crosses 14.3%, India's extra tariff crosses 8.2%; at India 6% China 13%, Vietnam 10.3%, India 8.2%.

## 7. HTS code and base tariff used for every item

Rates are the USITC general (MFN) rate from `public/hts/hts.json` (2026HTSRev23). Extra tariff per country is added on top (China 20%, Vietnam 12.5%, India 10% today).

| Order | Item | HTS code | Base tariff |
|---|---|---|---|
| Rainy day LA (demo) | Cashmere sweater | `6110.12.10` | 4% |
| Rainy day LA (demo) | Poncho | `3926.20.60.00` | 0% |
| Rainy day LA (demo) | Rain jacket | `6202.40.70.00` | 7.1% |
| Rainy day LA (demo) | Waterproof boots | `6401.92.90.60` | 37.5% |
| Rainy day LA (demo) | Umbrella | `6601.91.00.00` | 0% |
| Fall essentials | Cotton hoodie | `6110.20.20` | 16.5% |
| Fall essentials | Cotton knit T-shirt | `6109.10.00` | 16.5% |
| Fall essentials | Women's cotton jeans | `6204.62.80` | 16.6% |
| Winter layers | Women's corduroy blazer | `6204.32.20` | 9.4% |
| Winter layers | Wool scarf | `6214.20.00.00` | 6.7% |
| Winter layers | Men's cotton flannel shirt | `6205.20.20` | 19.7% |
| Holiday party | Women's party dress | `6204.43.40` | 16% |
| Holiday party | Women's cotton blouse | `6206.30.30` | 15.4% |
| Holiday party | Evening shawl | `6214.30.00.00` | 5.3% |

## 8. Explain with AI (cached for the demo order)

The Summary step's "Explain with AI" answers instantly from a saved explanation. It was written by the real Worker from these numbers, and every $ and % in it is re-checked against the engine each time it is shown. If the numbers ever differ it is skipped and the normal Worker call or template summary runs.

- **headline**: Order from Mekong Textile Works; it is the cheapest landed option at $27,156.
- **supplier_choice**: Mekong Textile Works is the lowest landed total, $369 under Deccan Garments. Its shorter transit also gets goods to you sooner.
- **cash_outlook**: Cash drops to $1,470 in week 2, well below your $8,000 safety buffer, for three weeks. Borrowing to cover the gap would cost about $30, or you could delay or reduce the order.
- **tariff_risk**: The extra tariff on Vietnam could rise 1.8 percentage points before Deccan Garments becomes cheaper. Watch Vietnam tariff news before placing your next order.
- **next_steps**: Ask Mekong whether the balance payment can be pushed back, or trim quantities to keep cash above the buffer. Confirm the duty and customs payment due on 2026-12-31 is covered by sales.
- **caveat**: These are estimates, not customs or legal advice; rates were checked on 2026-11-05.
