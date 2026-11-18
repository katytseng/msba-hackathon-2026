// Renders DEMO_NUMBERS.md from computeDemoNumbers(). The snapshot test rewrites/compares that file,
// so the sheet can never drift from the engine. Don't edit DEMO_NUMBERS.md by hand.
import { DEMO_EXPLANATIONS } from '../ai/demoCache'
import { DEMO_SUPPLIERS } from './data'
import { niceDate } from '../format'
import type { DemoNumbers } from './numbers'

const usd = (x: number, cents = true) =>
  (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
const usd0 = (x: number) => usd(x, false)
const pct = (x: number) => `${x}%`
const dow = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
const day = (iso: string) => `${dow(iso)} ${niceDate(iso)}`
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

export function renderSheet(n: DemoNumbers): string {
  const { compare: c, cashCheck: cc, finances: f, plan: p } = n
  const L: string[] = []
  const push = (...x: string[]) => L.push(...x)

  push(
    '# Landfall demo numbers sheet',
    '',
    `Every number below is computed by the real engine from the seed data in \`src/demo/data.ts\`, and \`src/demo/demo.test.ts\` fails if any of them change.`,
    'This file is written by that test. Do not edit it by hand: change the data, then run `npx vitest run --dir src demo -u` to regenerate it.',
    '',
    '**Fictional:** supplier names, quotes, freight, lead times, quantities, sell prices, sales speeds, the bank balance and the buffer. **Real:** every item\'s base tariff (USITC HTS 2026HTSRev23) and the extra tariffs per country (`rates.json`, unchanged).',
    '',
    '## 0. Setup',
    '',
    `- Demo day (\`DEMO_TODAY\`): **${day(n.demoToday)}**. The live demo order is dated **${day(n.demoOrderDate)}** (DEMO_TODAY + 1).`,
    `- Company (Finances tab): cash on hand **${usd0(n.company.cash)}**, safety buffer **${usd0(n.company.buffer)}**, loan APR **${n.company.apr * 100}%**.`,
    `- Extra tariffs today (unchanged): China ${pct(n.extraTariffsPct.China)}, Vietnam ${pct(n.extraTariffsPct.Vietnam)}, India ${pct(n.extraTariffsPct.India)}.`,
    '',
    '## 1. The demo order: items, HTS codes and tariff rates',
    '',
    'Type items 1 and 2 by hand, then press **Fill sample** (top of the pop-up, next to Clear) on each step. Fill sample sets the typed items to exactly these values.',
    '',
    table(
      ['#', 'Item', 'HTS code', 'Base tariff', 'Qty', 'Sell price', 'Sales / wk', ...Object.keys(n.demoOrder.items[0].quotes).map((s) => `Quote: ${s}`)],
      n.demoOrder.items.map((i, k) => [k + 1, i.item, `\`${i.htsCode}\``, pct(i.baseTariffPct), i.qty, usd0(i.sellPrice), i.salesPerWeek, ...Object.values(i.quotes).map((q) => usd(q))]),
    ),
    '',
    `Gross margin at full sell-through (recommended supplier): revenue ${usd0(n.demoOrder.grossMarginAtFullSellThrough.revenue)}, margin ${usd0(n.demoOrder.grossMarginAtFullSellThrough.margin)} (${pct(n.demoOrder.grossMarginAtFullSellThrough.marginPct)}). ${n.demoOrder.units.toLocaleString()} units.`,
    '',
    'Freight, deposits and timing per supplier:',
    '',
    table(
      ['Supplier', 'Freight quote', 'Deposit', 'Balance due', 'Lead time', 'Transit'],
      DEMO_SUPPLIERS.map((s) => [
        `${s.name} (${s.country})`,
        usd0(s.freight),
        pct(s.depositPct * 100),
        s.balanceDays === 0 ? 'at shipment' : `${s.balanceDays} days after shipment`,
        `${s.leadTimeDays} days`,
        `${s.transitDays} days`,
      ]),
    ),
    '',
    'Lead times are a modelling choice: China is quoted made to order (33 days to produce); Vietnam and India ship from ready stock (8 and 10 days). That is the only way a Nov 19 ocean order reaches a US warehouse before Christmas, and only Vietnam gets there.',
    '',
    '## 2. Compare screen (step 3)',
    '',
    table(
      ['Supplier', 'Rank', 'Quote (product cost)', 'Tariffs (base + extra)', 'Freight + insurance', 'Customs fees', 'Landed total', 'Above quote', 'Per unit', 'Lead + transit', 'Arrives'],
      [c.china, c.vietnam, c.india].map((s) => [
        s.supplier,
        s.rank,
        usd(s.productQuote),
        `${usd(s.baseTariff + s.extraTariff)} (${usd(s.baseTariff)} + ${usd(s.extraTariff)})`,
        usd(s.freightAndInsurance),
        usd(s.customsFeesAndBroker),
        `**${usd(s.landedTotal)}**`,
        pct(s.percentAboveQuote),
        usd(s.landedPerUnit),
        `${s.leadDays} + ${s.transitDays} days`,
        day(s.arrives),
      ]),
    ),
    '',
    '### Numbers for the script',
    '',
    `- **China total quote: ${usd(c.china.productQuote)}** (the lowest quote of the three).`,
    `- **China landed total: ${usd(c.china.landedTotal)}**, which is **${pct(c.china.percentAboveQuote)} above its quote**.`,
    `- **Vietnam quote vs China: +${usd(c.vietnamQuoteVsChina)}** (+${pct(c.vietnamQuoteVsChinaPct)}).`,
    `- **Vietnam landed vs China: ${usd(c.vietnamLandedVsChina)}** (Vietnam lands cheaper; it is the recommended supplier).`,
    `- India lands ${usd(c.indiaLandedVsVietnam)} above Vietnam and ${usd(-c.indiaLandedVsChina)} below China.`,
    `- **Arrival dates (order dated ${niceDate(n.demoOrderDate)}):** Vietnam **${day(c.arrivals.vietnam.date)}** (day ${c.arrivals.vietnam.day}, sales start ${day(c.arrivals.vietnam.firstSalesWeek)}), India **${day(c.arrivals.india.date)}** (day ${c.arrivals.india.day}), China **${day(c.arrivals.china.date)}** (day ${c.arrivals.china.day}).`,
    '',
    '## 3. Cash check (step 4), recommended supplier',
    '',
    `Supplier: **${cc.supplier}**, starting from ${usd0(cc.cashOnHandAtStart)} on the order date.`,
    '',
    `- **Lowest balance: ${usd(cc.lowestBalance)}**`,
    `- **Which week: week ${cc.lowestWeek}** (week starting ${day(cc.lowestWeekStarts)}); sales start in week ${cc.salesStartWeek}.`,
    `- **Shortfall below the buffer: ${usd(cc.belowBufferBy)}**, for ${cc.weeksBelowBuffer} weeks.`,
    `- **Interest to bridge: ${usd(cc.interestToBridge)}** at ${n.company.apr * 100}% APR.`,
    '',
    table(
      ['When', 'What', 'Amount'],
      cc.payments.map((e) => [`Day ${e.day} (${day(e.date)})`, e.what, usd(e.amount)]),
    ),
    '',
    `End-of-week balances, weeks 0 to 7: ${cc.weekBalances.map((x) => usd(x)).join(', ')}.`,
    '',
    '## 4. Finances tab',
    '',
    table(
      ['State', 'Cash on hand', 'Banner', 'Lowest balance', 'Short of buffer', 'Weeks under buffer', 'Interest'],
      [
        ['Seed (3 existing orders)', usd0(f.seedThreeOrders.cashOnHand), f.seedThreeOrders.verdict, `${usd(f.seedThreeOrders.lowestBalance)} (week of ${niceDate(f.seedThreeOrders.lowestWeekOf)})`, usd(f.seedThreeOrders.shortfall), f.seedThreeOrders.weeksUnderBuffer, usd(f.seedThreeOrders.interest)],
        [`**Type ${usd0(f.afterTypingCash.cashOnHand)} into Cash on hand**`, usd0(f.afterTypingCash.cashOnHand), `**${f.afterTypingCash.verdict}**`, `${usd(f.afterTypingCash.lowestBalance)} (week of ${niceDate(f.afterTypingCash.lowestWeekOf)})`, usd(f.afterTypingCash.shortfall), f.afterTypingCash.weeksUnderBuffer, usd(f.afterTypingCash.interest)],
        ['After the demo order is saved (Vietnam)', usd0(f.afterSavingDemoOrder.cashOnHand), f.afterSavingDemoOrder.verdict, `${usd(f.afterSavingDemoOrder.lowestBalance)} (week of ${niceDate(f.afterSavingDemoOrder.lowestWeekOf)})`, usd(f.afterSavingDemoOrder.shortfall), f.afterSavingDemoOrder.weeksUnderBuffer, usd(f.afterSavingDemoOrder.interest)],
        [`**Demo order saved, then type ${usd0(f.afterSavingDemoOrderAndTypingCash.cashOnHand)}** (the script's order)`, usd0(f.afterSavingDemoOrderAndTypingCash.cashOnHand), `**${f.afterSavingDemoOrderAndTypingCash.verdict}**`, `${usd(f.afterSavingDemoOrderAndTypingCash.lowestBalance)} (week of ${niceDate(f.afterSavingDemoOrderAndTypingCash.lowestWeekOf)})`, usd(f.afterSavingDemoOrderAndTypingCash.shortfall), f.afterSavingDemoOrderAndTypingCash.weeksUnderBuffer, usd(f.afterSavingDemoOrderAndTypingCash.interest)],
      ],
    ),
    '',
    `- **Seed cash on hand: ${usd0(f.seedThreeOrders.cashOnHand)}** (green, "No loan needed").`,
    `- **If the demo order is already saved when you type ${usd0(f.afterSavingDemoOrderAndTypingCash.cashOnHand)} (the order the script follows): "${f.afterSavingDemoOrderAndTypingCash.verdict} by ${niceDate(f.afterSavingDemoOrderAndTypingCash.firstWeekUnderBuffer!)}"**, lowest balance ${usd(f.afterSavingDemoOrderAndTypingCash.lowestBalance)} in the week of ${niceDate(f.afterSavingDemoOrderAndTypingCash.lowestWeekOf)}, ${f.afterSavingDemoOrderAndTypingCash.weeksUnderBuffer} weeks under the buffer, interest ${usd(f.afterSavingDemoOrderAndTypingCash.interest)}.`,
    `- **With only the 3 existing orders, typing ${usd0(f.afterTypingCash.cashOnHand)}: "${f.afterTypingCash.verdict} by ${niceDate(f.afterTypingCash.firstWeekUnderBuffer!)}"** (amber), estimated interest ${usd(f.afterTypingCash.interest)}. Put it back to ${usd0(n.company.cash)} (or press Fill sample on the Cash check step) before the next section.`,
    '',
    '## 5. Orders tab on the demo day',
    '',
    table(
      ['Order', 'Supplier (placed)', 'Units', 'Quote', 'Landed', 'Ordered', 'Ships', 'Arrives', 'Breaks even', 'Sells out', 'Stage', 'Sales so far'],
      n.orders.map((o) => [o.order, o.supplier, o.units, usd0(o.quoteValue), usd0(o.landedTotal), niceDate(o.ordered), niceDate(o.ships), niceDate(o.arrives), o.breaksEven ? niceDate(o.breaksEven) : '-', niceDate(o.sellsOut), o.stage, usd0(o.salesSoFar)]),
    ),
    '',
    '(The last row is the live demo order once saved; before that the dashboard shows the first three.)',
    '',
    '## 6. Plan & simulate',
    '',
    'Item table = the Plan tab\'s "Who to order each item from", with the demo order saved (14 items across 4 orders).',
    '',
    `### Baseline (today's tariffs: India ${pct(p.indiaTodayPct)})`,
    '',
    `**${p.baseline.switching.length} of ${p.baseline.rows.length} items are already cheaper from a different supplier than last time:** ${p.baseline.switching.map((s) => `${s}`).join('; ')}.`,
    `(With only the 3 existing orders on the dashboard it is the same ${p.threeSeedOrders.baseline.length}.)`,
    '',
    itemTable(p.baseline.rows),
    '',
    `Totals shown: **Saved by switching ${usd0(p.baseline.totals.savedBySwitching)}** (${p.baseline.totals.suppliersChanged} supplier change${p.baseline.totals.suppliersChanged === 1 ? '' : 's'}), Reorder everything ${usd0(p.baseline.totals.reorderEverything)}. Order level: ${p.baseline.orderAdvice.map((o) => `${o.order}: ${o.savings > 0 ? `switch to ${o.best}, saves ${usd0(o.savings)}` : `stay with ${o.best}`}`).join('; ')}.`,
    '',
    `### Slider: India ${pct(p.indiaTodayPct)} to **${pct(p.sliderPct)}** (${(p.sliderPct - p.indiaTodayPct).toFixed(1)} points)`,
    '',
    `**Exact slider value: India ${pct(p.sliderPct)}** (today ${pct(p.indiaTodayPct)}). The same flips happen anywhere from India ${pct(p.sameFlipsFromPct)} down to ${pct(p.sameFlipsToPct)}.`,
    '',
    `- **Items that flip to India:** ${p.atSlider.rows.filter((r) => r.switched && r.orderFrom.includes('(India)')).map((r) => `${r.item} (${r.baseRatePct}% base tariff)`).join(', ')}.`,
    `- **Items that stay put:** ${p.atSlider.rows.filter((r) => r.order === 'Rainy day LA' && !r.switched).map((r) => `${r.item} (${r.baseRatePct}% base tariff)`).join(', ')}.`,
    '',
    itemTable(p.atSlider.rows),
    '',
    `Totals shown: **Saved by switching ${usd0(p.atSlider.totals.savedBySwitching)}** (${p.atSlider.totals.suppliersChanged} supplier changes; was ${usd0(p.baseline.totals.savedBySwitching)} at today's rates), Reorder everything ${usd0(p.atSlider.totals.reorderEverything)}. Order level: ${p.atSlider.orderAdvice.map((o) => `${o.order}: ${o.savings > 0 ? `switch to ${o.best}, saves ${usd0(o.savings)}` : `stay with ${o.best}`}`).join('; ')}.`,
    `If you split the demo order by item instead of buying it all from one supplier, the three India items alone are cheaper by about ${usd0(p.atSlider.rows.filter((r) => r.order === 'Rainy day LA' && r.switched).reduce((t, r) => t + (r.landedPerUnitLast - r.landedPerUnitNext) * r.units, 0))} (separate shipments not included).`,
    '',
    'How the table moves as the India slider drops (0.5-point steps, items that pick India are listed):',
    '',
    table(
      ['India extra tariff', 'Items from India', 'Items "Switch from last time"'],
      n.plan.sweep.filter((s) => s.india >= 2 && s.india * 10 % 5 === 0).map((s) => [pct(s.india) + (s.india === p.sliderPct ? ' **(scripted)**' : ''), s.itemsFromIndia.join(', ') || '-', s.itemsSwitchedFromLastTime]),
    ),
    '',
    `Where each demo item flips to India as the slider drops: ${p.demoFlipPoints.map((x) => `${x.item} at ${x.flipsToIndiaAtOrBelowPct === null ? 'never' : `${x.flipsToIndiaAtOrBelowPct}% or lower`}`).join(', ')}.`,
    '',
    '### Switch points (the "Switch point" column)',
    '',
    table(
      ['Order', "Last time's country", "At today's tariffs", `At India ${pct(p.sliderPct)}`],
      p.baseline.switchPoints.map((b, i) => {
        const s = p.atSlider.switchPoints[i]
        const text = (x: typeof b) => (x.rate === null ? '-' : `cheapest changes if ${x.country}'s tariff ${x.direction} ${pct(x.rate)}`)
        return [b.order, b.country, text(b), text(s)]
      }),
    ),
    '',
    `One order in depth, "Rainy day LA", the cheapest supplier changes if: today ${p.baseline.demoOrderFlips.map((x) => `${x.country}'s extra tariff crosses ${pct(x.rate)}`).join(', ')}; at India ${pct(p.sliderPct)} ${p.atSlider.demoOrderFlips.map((x) => `${x.country} ${pct(x.rate)}`).join(', ')}.`,
    '',
    '## 7. HTS code and base tariff used for every item',
    '',
    'Rates are the USITC general (MFN) rate from `public/hts/hts.json` (2026HTSRev23). Extra tariff per country is added on top (China 20%, Vietnam 12.5%, India 10% today).',
    '',
    table(
      ['Order', 'Item', 'HTS code', 'Base tariff'],
      [
        ...n.demoItems.map((i) => ['Rainy day LA (demo)', i.item, `\`${i.htsCode}\``, pct(i.baseTariffPct)]),
        ...n.seedItems.flatMap((o) => o.items.map((i) => [o.order, i.item, `\`${i.htsCode}\``, pct(i.baseTariffPct)])),
      ],
    ),
    '',
    '## 8. Explain with AI (cached for the demo order)',
    '',
    `The Summary step's "Explain with AI" answers instantly from a saved explanation. It was written by the real Worker from these numbers, and every $ and % in it is re-checked against the engine each time it is shown. If the numbers ever differ it is skipped and the normal Worker call or template summary runs.`,
    '',
    ...DEMO_EXPLANATIONS.flatMap((e) => Object.entries(e.explanation).map(([k, v]) => `- **${k}**: ${v}`)),
    '',
  )
  return L.join('\n')
}

function itemTable(rows: ReturnType<typeof import('./numbers').planItems>['rows']) {
  return table(
    ['Order', 'Item', 'Last time', 'Order from', 'Status', 'Landed / unit', 'Last / unit', 'Units'],
    rows.map((r) => [r.order, r.item, r.lastSupplier, r.orderFrom, r.switched ? '**Switch from last time**' : 'Same as last time', usd(r.landedPerUnitNext), usd(r.landedPerUnitLast), r.units]),
  )
}
