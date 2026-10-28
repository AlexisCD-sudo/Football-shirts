import type { Shirt, ShirtInput } from '../src/types/shirt';

export function makeInput(over: Partial<ShirtInput> = {}): ShirtInput {
  return {
    teamName: 'Barça',
    teamKind: 'club',
    country: null,
    season: null,
    competition: null,
    brand: null,
    model: null,
    kitType: null,
    version: 'unknown',
    playerName: null,
    squadNumber: null,
    size: null,
    manufactureYear: null,
    condition: null,
    authenticity: 'unverified',
    provenance: null,
    purchaseDate: null,
    price: null,
    shippingCost: null,
    seller: null,
    estimatedValue: null,
    location: null,
    notes: null,
    curiosities: null,
    ...over,
  };
}

let n = 0;
/** Samarreta de prova (només per a les proves; mai per a la col·lecció real). */
export function makeShirt(over: Partial<Shirt> & { teamName?: string; country?: string | null } = {}): Shirt {
  const { teamName = 'Barça', country = null, ...rest } = over;
  n += 1;
  return {
    id: `id-${n}`,
    team: { id: `team-${teamName}`, name: teamName, kind: 'club', country },
    season: null,
    competition: null,
    brand: null,
    model: null,
    kitType: null,
    version: 'unknown',
    playerName: null,
    squadNumber: null,
    size: null,
    manufactureYear: null,
    condition: null,
    authenticity: 'unverified',
    provenance: null,
    purchaseDate: null,
    price: null,
    shippingCost: null,
    seller: null,
    estimatedValue: null,
    location: null,
    notes: null,
    curiosities: null,
    photoUrl: null,
    importBatchId: null,
    sourceRow: null,
    originalData: null,
    createdAt: `2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`,
    updatedAt: `2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`,
    ...rest,
  };
}
