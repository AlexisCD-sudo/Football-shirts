import type { Budget, Shirt, WishlistItem } from '../types/shirt';

export interface YearFinance {
  year: number;
  count: number;
  spent: number;
  budget: number | null;
  /** Pressupost menys despesa; `null` si no hi ha pressupost. Pot ser negatiu (s'ha superat). */
  remaining: number | null;
}

export interface Finance {
  /** Samarretes amb preu conegut. */
  priced: number;
  /** Samarretes sense preu: no es compten ni se'ls inventa cap valor. */
  unpriced: number;
  totalPrice: number;
  totalShipping: number;
  totalSpent: number;
  averagePrice: number | null;
  estimatedTotal: number;
  estimatedCount: number;
  /** Valor estimat − despesa, només de les samarretes que tenen les dues dades. */
  balance: number | null;
  balanceCount: number;
  byYear: YearFinance[];
  mostExpensive: { id: string; label: string; total: number }[];
  /** Despesa sense data de compra (no entra a cap any). */
  undatedSpent: number;
}

const round = (n: number) => Math.round(n * 100) / 100;
const cost = (s: Shirt) => (s.price ?? 0) + (s.shippingCost ?? 0);
const hasCost = (s: Shirt) => s.price !== null || s.shippingCost !== null;

export function purchaseYear(s: Shirt): number | null {
  const m = s.purchaseDate ? /^(\d{4})-/.exec(s.purchaseDate) : null;
  return m ? Number(m[1]) : null;
}

export function computeFinance(shirts: Shirt[], budgets: Budget[]): Finance {
  const withPrice = shirts.filter((s) => s.price !== null);
  const totalPrice = withPrice.reduce((a, s) => a + (s.price as number), 0);
  const totalShipping = shirts.reduce((a, s) => a + (s.shippingCost ?? 0), 0);
  const estimated = shirts.filter((s) => s.estimatedValue !== null);
  const both = shirts.filter((s) => s.estimatedValue !== null && hasCost(s));

  const years = new Map<number, { count: number; spent: number }>();
  let undatedSpent = 0;
  for (const s of shirts) {
    if (!hasCost(s)) continue;
    const y = purchaseYear(s);
    if (y === null) {
      undatedSpent += cost(s);
      continue;
    }
    const cur = years.get(y) ?? { count: 0, spent: 0 };
    cur.count += 1;
    cur.spent += cost(s);
    years.set(y, cur);
  }
  for (const b of budgets) if (!years.has(b.year)) years.set(b.year, { count: 0, spent: 0 });
  const budgetOf = new Map(budgets.map((b) => [b.year, b.amount]));
  const byYear = [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, v]) => {
      const budget = budgetOf.get(year) ?? null;
      return {
        year,
        count: v.count,
        spent: round(v.spent),
        budget,
        remaining: budget === null ? null : round(budget - v.spent),
      };
    });

  return {
    priced: withPrice.length,
    unpriced: shirts.length - withPrice.length,
    totalPrice: round(totalPrice),
    totalShipping: round(totalShipping),
    totalSpent: round(totalPrice + totalShipping),
    averagePrice: withPrice.length ? round(totalPrice / withPrice.length) : null,
    estimatedTotal: round(estimated.reduce((a, s) => a + (s.estimatedValue as number), 0)),
    estimatedCount: estimated.length,
    balance: both.length ? round(both.reduce((a, s) => a + (s.estimatedValue as number) - cost(s), 0)) : null,
    balanceCount: both.length,
    byYear,
    mostExpensive: shirts
      .filter(hasCost)
      .map((s) => ({ id: s.id, label: `${s.team.name}${s.season ? ` ${s.season}` : ''}`, total: round(cost(s)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    undatedSpent: round(undatedSpent),
  };
}

/** Suma dels preus màxims de la llista de desitjos activa (desitjades o en seguiment). Les que no tenen preu es compten a part. */
export function wishlistBudget(items: WishlistItem[]): { total: number; withPrice: number; withoutPrice: number } {
  const active = items.filter((i) => i.status === 'wanted' || i.status === 'watching');
  const priced = active.filter((i) => i.maxPrice !== null);
  return {
    total: round(priced.reduce((a, i) => a + (i.maxPrice as number), 0)),
    withPrice: priced.length,
    withoutPrice: active.length - priced.length,
  };
}
