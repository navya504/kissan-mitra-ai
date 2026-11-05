export type ProfitInputs = {
  stage: '' | 'growing' | 'ready' | 'stored';
  quantityQuintals: string;
  cultivationCost: string;
  routes: { market: string; pricePerQuintal: string; sellingCost: string; quotedOn: string }[];
};

export type ProfitRoute = {
  rank: number;
  market: string;
  quotedOn: string;
  quantityQuintals: number;
  pricePerQuintal: number;
  revenue: number;
  cultivationCost: number;
  sellingCost: number;
  netProfit: number;
  profitAtLowerPrice: number;
  breakEvenPrice: number;
  checklist: string[];
  reasoning?: string;
  guidanceSource: 'ai' | 'standard';
};

export type ProfitPlan = {
  status: 'needs-details' | 'ready';
  missing: string[];
  routes: ProfitRoute[];
  assumptions: string[];
};

export function indiaDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function amount(value: unknown, max: number, allowZero = false): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number <= max && (allowZero ? number >= 0 : number > 0) ? number : null;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function recentQuote(value: unknown, today: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const age = (Date.parse(`${today}T00:00:00Z`) - date.getTime()) / 86400000;
  return age >= 0 && age <= 7;
}

export function wantsProfit(text: string) {
  return /profit|income|earnings?|selling route|sell.*best|best.*sell|मुनाफ|लाभ|कमाई|లాభ|లాబ|வருமான|லாப|ಲಾಭ|നേട്ട|ലാഭ|নাফা|লাভ|નફો|ਮੁਨਾਫ਼|ଲାଭ/i.test(text);
}

// The model explains the options; this function owns every financial calculation.
export function buildProfitPlan(input: unknown, options: { now?: Date; rainRisk?: boolean; weatherAvailable?: boolean } = {}): ProfitPlan {
  const source = input && typeof input === 'object' ? input as Partial<ProfitInputs> : {};
  const quantity = amount(source.quantityQuintals, 1_000_000);
  const cultivationCost = amount(source.cultivationCost, 1_000_000_000, true);
  const stage = source.stage;
  const missing: string[] = [];
  if (!['growing', 'ready', 'stored'].includes(stage ?? '')) missing.push('Current crop stage: growing, ready to harvest, or stored');
  if (quantity === null) missing.push('Expected saleable harvest in quintals (one quintal is 100 kg)');
  if (cultivationCost === null) missing.push('Total cultivation cost in rupees, including money already spent and remaining costs');
  const candidates = Array.isArray(source.routes) ? source.routes.slice(0, 5) : [];
  const today = indiaDate(options.now);
  const routes: ProfitRoute[] = [];
  const names = new Set<string>();
  for (let index = 0; index < candidates.length; index++) {
    const route = candidates[index];
    if (!route || typeof route !== 'object') { missing.push(`Buyer option ${index + 1} details`); continue; }
    // A completely empty second option is optional; a partially entered one needs finishing.
    if (!route.market && !route.pricePerQuintal && !route.sellingCost) continue;
    const market = typeof route.market === 'string' ? route.market.trim().slice(0, 120) : '';
    const price = amount(route.pricePerQuintal, 1_000_000);
    const sellingCost = amount(route.sellingCost, 1_000_000_000, true);
    const validDate = recentQuote(route.quotedOn, today);
    if (!market) missing.push(`Buyer option ${index + 1}: market or buyer name`);
    if (price === null) missing.push(`Buyer option ${index + 1}: confirmed offer in rupees per quintal`);
    if (sellingCost === null) missing.push(`Buyer option ${index + 1}: total transport, handling, storage, fees and deductions in rupees`);
    if (!validDate) missing.push(`Buyer option ${index + 1}: a valid offer date within the last seven days (YYYY-MM-DD)`);
    if (names.has(market.toLowerCase())) missing.push('Use different buyer names for the options you compare');
    names.add(market.toLowerCase());
    if (!market || price === null || sellingCost === null || !validDate || quantity === null || cultivationCost === null) continue;
    const revenue = money(quantity * price);
    routes.push({
      rank: 0, market, quotedOn: route.quotedOn, quantityQuintals: quantity, pricePerQuintal: price,
      revenue, cultivationCost, sellingCost, netProfit: money(revenue - cultivationCost - sellingCost),
      profitAtLowerPrice: money(quantity * price * 0.9 - cultivationCost - sellingCost),
      breakEvenPrice: Math.ceil((cultivationCost + sellingCost) / quantity),
      guidanceSource: 'standard',
      checklist: [
        stage === 'growing' ? 'Confirm harvest timing and update expected saleable quantity before booking transport.' : stage === 'ready' ? 'Confirm harvest readiness, then dry and grade the crop to the buyer’s requirements.' : 'Inspect stored grain for moisture, pests and weight loss before agreeing on quantity.',
        `Confirm the ${market} offer for your crop, variety, grade and moisture; get the final deductions in writing.`,
        'Verify transport, labour, drying, bags, commission, storage and interest costs; do not count any cost twice.',
        options.rainRisk ? 'Rain is possible in the next three forecast days: check the latest local forecast and arrange covered drying, storage and transport.' : options.weatherAvailable ? 'Recheck the local forecast before harvesting, drying and transporting the crop.' : 'Weather is unavailable here: check the local forecast before harvesting or transporting.',
        'Confirm buyer availability, weighing arrangements, payment timing and collection terms before dispatch.',
      ],
    });
  }
  if (!candidates.some(route => route && (route.market || route.pricePerQuintal || route.sellingCost))) missing.push('At least one buyer option with a current offer and all selling costs; add a second to compare');
  const assumptions = [
    'Estimates use farmer-entered buyer offers and costs, not verified live quotes or guaranteed sale prices.',
    'Net profit = saleable quintals × offered rupees per quintal − total cultivation cost − option-specific selling costs.',
    'Cultivation costs include spent and remaining seed, labour, rent, irrigation, inputs, harvesting and interest. Selling costs must not duplicate them.',
    'Only the supplied options are ranked. A 10% lower sale-price check is a stress test, not a forecast.',
    ...(stage === 'growing' ? ['The crop is still growing: today’s offers may change before harvest. Refresh quantity, costs and offers when ready to sell.'] : []),
    ...(!options.weatherAvailable ? ['Current local weather could not be loaded.'] : []),
  ];
  return { status: missing.length ? 'needs-details' : 'ready', missing, assumptions,
    routes: missing.length ? [] : routes.sort((a, b) => b.netProfit - a.netProfit || a.sellingCost - b.sellingCost).slice(0, 2).map((route, index) => ({ ...route, rank: index + 1 })) };
}

// AI supplies farm-specific reasoning/actions while computed ranks and money remain authoritative.
export function addProfitGuidance(plan: ProfitPlan, guidance: unknown): ProfitPlan {
  if (plan.status !== 'ready' || !Array.isArray(guidance)) return plan;
  return { ...plan, routes: plan.routes.map(route => {
    const matches = guidance.filter(item => item && typeof item === 'object' && item.rank === route.rank);
    if (matches.length !== 1) return route;
    const item = matches[0];
    const reasoning = typeof item.why === 'string' ? item.why.trim() : '';
    const checklist: unknown[] = Array.isArray(item.checklist) ? item.checklist : [];
    if (!reasoning || reasoning.length > 500 || checklist.length < 3 || checklist.length > 6 ||
      !checklist.every(step => typeof step === 'string' && step.trim().length > 0 && step.length <= 400)) return route;
    return { ...route, reasoning, checklist: checklist.map(step => (step as string).trim()), guidanceSource: 'ai' };
  }) };
}
