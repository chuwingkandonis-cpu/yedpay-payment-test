// Demo travel-insurance catalogue — shared between frontend (quote form)
// and backend (premium recomputation). Prices are HKD.

export interface TravelPlan {
  id: string;
  name: string;
  nameZh: string;
  /** Base premium per traveller, 1–3 day trip. */
  baseRate: number;
  /** Extra premium per additional day band of 4 days (or part). */
  perBand: number;
  blurb: string;
  blurbZh: string;
  glyph: string;
}

export const TRAVEL_PLANS: TravelPlan[] = [
  {
    id: "basic",
    name: "Basic",
    nameZh: "基本計劃",
    baseRate: 68,
    perBand: 22,
    blurb: "Essential medical & trip cancellation cover",
    blurbZh: "基本醫療及取消旅程保障",
    glyph: "◇",
  },
  {
    id: "standard",
    name: "Standard",
    nameZh: "標準計劃",
    baseRate: 128,
    perBand: 38,
    blurb: "Adds baggage delay, personal accident cover",
    blurbZh: "附加行李延誤、個人意外保障",
    glyph: "◆",
  },
  {
    id: "premium",
    name: "Premium",
    nameZh: "尊貴計劃",
    baseRate: 218,
    perBand: 62,
    blurb: "Highest limits, rental-car excess, adventure sports",
    blurbZh: "最高保額、租車自負額、業餘運動保障",
    glyph: "✦",
  },
];

export interface TravelAddon {
  id: string;
  name: string;
  nameZh: string;
  /** Flat premium per traveller. */
  price: number;
  glyph: string;
}

export const TRAVEL_ADDONS: TravelAddon[] = [
  { id: "cruise", name: "Cruise Cover", nameZh: "郵輪保障", price: 60, glyph: "≋" },
  { id: "winter", name: "Winter Sports", nameZh: "冬季運動", price: 80, glyph: "❄" },
  { id: "gadget", name: "Gadget Cover", nameZh: "電子產品保障", price: 45, glyph: "▣" },
];

export interface TravelQuoteInput {
  planId: string;
  travellers: number;
  days: number;
  addonIds: string[];
}

/**
 * Recompute the premium for a quote. The backend always recomputes from the
 * catalogue — the client only sends ids / counts.
 */
export function computeTravelPremium(q: TravelQuoteInput): {
  amount: string;
  breakdown: string[];
} {
  const plan = TRAVEL_PLANS.find((p) => p.id === q.planId);
  if (!plan) throw new Error(`Unknown plan: ${q.planId}`);
  const travellers = Math.min(Math.max(Math.trunc(q.travellers), 1), 9);
  const days = Math.min(Math.max(Math.trunc(q.days), 1), 180);
  const bands = Math.max(1, Math.ceil(days / 4));
  const planRate = plan.baseRate + plan.perBand * (bands - 1);
  const addons = TRAVEL_ADDONS.filter((a) => q.addonIds.includes(a.id));
  const perTraveller = planRate + addons.reduce((s, a) => s + a.price, 0);
  const total = perTraveller * travellers;
  const breakdown = [
    `${plan.name} × ${travellers} traveller${travellers > 1 ? "s" : ""} × ${days} day${days > 1 ? "s" : ""} — HKD ${planRate}/traveller`,
    ...addons.map((a) => `${a.name} — HKD ${a.price}/traveller`),
  ];
  return { amount: total.toFixed(2), breakdown };
}

export function travelItemsSummary(q: TravelQuoteInput): string {
  const plan = TRAVEL_PLANS.find((p) => p.id === q.planId);
  const addons = TRAVEL_ADDONS.filter((a) => q.addonIds.includes(a.id));
  return JSON.stringify([
    {
      productId: `travel-${q.planId}`,
      name: `Travel Insurance — ${plan?.name ?? q.planId}`,
      qty: q.travellers,
    },
    ...addons.map((a) => ({ productId: `addon-${a.id}`, name: a.name, qty: q.travellers })),
  ]);
}
