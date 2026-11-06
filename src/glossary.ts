// Plain-English definitions for every input and output in the app.
// The ⓘ button (<Info term="..." />) shows these. Fee numbers come from rates.json so they stay in sync.
import ratesJson from './data/rates.json'
import type { Rates } from './engine'
import { pct, usd } from './format'

const { fees } = ratesJson as unknown as Rates

export interface GlossaryEntry {
  term: string
  definition: string
}

const entries = {
  // ── Inputs: your business ──────────────────────────────────────────
  cash: {
    term: 'Cash on hand',
    definition: 'The money you have available today to pay for this order. The cash check starts from this balance on the order date.',
  },
  buffer: {
    term: 'Safety buffer',
    definition: 'The lowest bank balance you are comfortable with. We flag every week your cash falls below it.',
  },
  apr: {
    term: 'Loan APR',
    definition:
      'The yearly interest rate you would pay to borrow, for example on a credit line, if cash runs short. Used only to estimate the cost of bridging a dip below your buffer.',
  },
  orderDate: {
    term: 'Order date',
    definition: 'The day you place the order and pay the deposit. Every other date (ship, arrival, payments) counts from here as day 0.',
  },
  productName: {
    term: 'Product',
    definition: 'A name for something in this order. Only used for labels.',
  },
  htsCode: {
    term: 'HTS code',
    definition:
      'The product’s code in the U.S. Harmonized Tariff Schedule. Customs uses it to decide the base tariff rate. Pick the code that best matches the product.',
  },
  baseTariff: {
    term: 'Base tariff',
    definition: 'The normal duty rate for the product’s HTS code, charged on the product value. It is the same whichever country it comes from.',
  },
  qty: {
    term: 'Quantity',
    definition: 'How many units of this product you are ordering.',
  },
  sellPrice: {
    term: 'Sell price',
    definition: 'What you charge your customer per unit. Used to work out cash coming back in from sales.',
  },
  salesPerWeek: {
    term: 'Sales per week',
    definition: 'How many units you expect to sell each week once the stock arrives. Sales stop when the stock runs out.',
  },

  // ── Inputs: supplier quotes ────────────────────────────────────────
  supplierName: {
    term: 'Supplier',
    definition: 'A name for the factory or vendor giving you this quote.',
  },
  country: {
    term: 'Ships from',
    definition: 'The country the goods come from. It decides the extra tariff.',
  },
  unitPrice: {
    term: 'Unit price (FOB)',
    definition:
      'The supplier’s price per unit, “free on board”: the goods are loaded on the ship at their port, and you pay freight from there. Tariffs are charged on this price.',
  },
  freight: {
    term: 'Freight quote',
    definition: 'The cost to ship the whole order from the supplier’s port to yours. Paid on the ship day.',
  },
  deposit: {
    term: 'Deposit',
    definition: 'The share of the product cost you pay the supplier on the order date. The rest is the balance.',
  },
  balanceDays: {
    term: 'Balance due',
    definition:
      'How many days after the goods ship you pay the rest of the product cost. 0 means you pay the balance on the ship day.',
  },
  leadTime: {
    term: 'Lead time',
    definition: 'Days from placing the order until the supplier ships it (making and packing the goods).',
  },
  transit: {
    term: 'Transit',
    definition: 'Days the shipment spends travelling, from leaving the supplier’s port until it arrives at yours.',
  },

  // ── Outputs: landed cost ───────────────────────────────────────────
  productCost: {
    term: 'Product cost (customs value)',
    definition:
      'Unit price times quantity, added up over all products. This is the FOB value customs charges tariffs on. It leaves out freight and insurance.',
  },
  totalTariff: {
    term: 'Tariffs',
    definition: 'All duty on the order: the base tariff for each product’s HTS code plus the extra tariff for the supplier’s country.',
  },
  totalTariffRate: {
    term: 'Tariff rate',
    definition: 'Base tariff rate plus extra tariff rate, as a share of the product’s unit price.',
  },
  htsDuty: {
    term: 'Base tariff (HTS duty)',
    definition: 'Each product’s value times its HTS base rate, added up over the order.',
  },
  extraTariff: {
    term: 'Extra tariff',
    definition:
      'An added duty on goods from certain countries (for example Section 301 tariffs). Charged as the country’s rate times the product cost.',
  },
  insurance: {
    term: 'Insurance',
    definition: `Cargo insurance for the trip, estimated at ${pct(fees.insurance.rate)} of the product cost. Paid with the freight.`,
  },
  freightInsurance: {
    term: 'Freight + insurance',
    definition: `The freight quote plus cargo insurance (${pct(fees.insurance.rate)} of product cost). Both are paid on the ship day.`,
  },
  customsFees: {
    term: 'Customs fees',
    definition: 'The merchandise processing fee, the harbor maintenance fee and the customs broker’s fee, together.',
  },
  mpf: {
    term: 'Merchandise processing fee (MPF)',
    definition: `A U.S. Customs fee of ${pct(fees.mpf.rate, 4)} of the product cost, kept between ${usd(fees.mpf.min, true)} and ${usd(fees.mpf.max, true)} per entry.`,
  },
  hmf: {
    term: 'Harbor maintenance fee (HMF)',
    definition: `A fee of ${pct(fees.hmf.rate, 3)} of the product cost, charged on goods arriving by ocean.`,
  },
  broker: {
    term: 'Customs broker fee',
    definition: `A flat fee, assumed ${usd(fees.broker.amount)}, for the broker who files your customs entry.`,
  },
  landedTotal: {
    term: 'Landed total',
    definition: 'Everything you pay to get the order to your door: product cost, tariffs, customs fees, insurance, freight and broker.',
  },
  landedUnit: {
    term: 'Landed cost per unit',
    definition:
      'What one unit really costs at your door. Its price plus its tariffs and insurance, plus its share of freight and fixed fees, split by share of product value.',
  },
  avgUnit: {
    term: 'Per unit (average)',
    definition: 'Landed total divided by the number of units in the order, across all products.',
  },
  markup: {
    term: 'Markup on quote',
    definition: 'How much more a unit costs landed than the supplier’s quoted price. For example, +40% means a $10 quote costs $14 at your door.',
  },
  lineTotal: {
    term: 'Line total',
    definition: 'Landed cost per unit times quantity for this product.',
  },
  gapToCheapest: {
    term: 'Gap to cheapest',
    definition: 'How much more this supplier’s landed total is than the cheapest supplier’s.',
  },
  units: {
    term: 'Units',
    definition: 'Total number of units across all products in the order.',
  },
  daysToArrive: {
    term: 'Time to arrive',
    definition: 'Lead time plus transit: days from placing the order until the goods reach your port.',
  },

  // ── Outputs: cash check ────────────────────────────────────────────
  lowestBalance: {
    term: 'Lowest balance',
    definition: 'The lowest your bank balance gets at the end of any week, after paying for this order and before sales catch up.',
  },
  belowBuffer: {
    term: 'Below buffer by',
    definition: 'How far the lowest balance falls under your safety buffer. This is roughly how much you would need to borrow.',
  },
  weeksBelowBuffer: {
    term: 'Weeks below buffer',
    definition: 'How many weeks end with your balance under the safety buffer.',
  },
  headroom: {
    term: 'Headroom',
    definition: 'How far your lowest balance stays above your safety buffer. Money you could still spend without dipping below it.',
  },
  goodsArrive: {
    term: 'Goods arrive',
    definition: 'The day the shipment reaches your port: order date plus lead time plus transit.',
  },
  interest: {
    term: 'Interest to bridge',
    definition:
      'A rough cost of borrowing the shortfall: amount below buffer × APR × days below buffer ÷ 365. Assumes you borrow the full shortfall for every week below the buffer.',
  },
  extraUnits: {
    term: 'Extra units affordable',
    definition: 'How many more average units you could add to this order and still stay above your safety buffer.',
  },
  salesStart: {
    term: 'Sales start',
    definition: 'The first full week starting on or after the goods arrive. Cash from sales comes in from that week on.',
  },
  depositPayment: {
    term: 'Deposit payment',
    definition: 'Deposit % times the product cost, paid on the order date.',
  },
  balancePayment: {
    term: 'Balance payment',
    definition: 'The rest of the product cost, paid on the ship day plus the balance days in the terms.',
  },
  dutyPayment: {
    term: 'Duty and customs fees',
    definition: `All tariffs plus MPF, HMF and broker fee. Paid ${fees.dutyPaymentDays.days} days after the goods arrive.`,
  },

  // ── Outputs: tariff what-if ────────────────────────────────────────
  tariffChange: {
    term: 'Extra tariff change',
    definition: 'A what-if: raise or lower a country’s extra tariff, in percentage points, to see how the landed totals move.',
  },
  breakEven: {
    term: 'Break-even tariff rise',
    definition: 'How many percentage points the cheapest supplier’s extra tariff would have to rise before the runner-up becomes cheaper.',
  },
} satisfies Record<string, GlossaryEntry>

export type GlossaryKey = keyof typeof entries
export const glossary: Record<GlossaryKey, GlossaryEntry> = entries
