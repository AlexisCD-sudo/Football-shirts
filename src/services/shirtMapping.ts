import type {
  Authenticity,
  ImageJob,
  ImageJobItem,
  ImageStatus,
  JobStatus,
  KitType,
  Shirt,
  ShirtCondition,
  ShirtImage,
  ShirtInput,
  ShirtVersion,
  Team,
  TeamKind,
} from '../types/shirt';

export interface TeamRow {
  id: string;
  name: string;
  kind: TeamKind;
  country: string | null;
}

export interface ImageRow {
  image_url: string | null;
  is_primary: boolean;
  status: string;
}

export interface ShirtRow {
  id: string;
  season: string | null;
  competition: string | null;
  brand: string | null;
  model: string | null;
  kit_type: KitType | null;
  version: ShirtVersion;
  player_name: string | null;
  squad_number: number | null;
  size: string | null;
  manufacture_year: number | null;
  condition: ShirtCondition | null;
  authenticity: Authenticity;
  provenance: string | null;
  purchase_date: string | null;
  price: number | string | null;
  shipping_cost: number | string | null;
  seller: string | null;
  estimated_value: number | string | null;
  location: string | null;
  notes: string | null;
  curiosities: string | null;
  created_at: string;
  updated_at: string;
  import_batch_id?: string | null;
  source_row?: number | null;
  original_data?: Record<string, string> | null;
  teams: TeamRow | null;
  shirt_images?: ImageRow[] | null;
}

/** Columnes que es demanen sempre: la samarreta, el seu equip i les imatges confirmades. */
export const SHIRT_SELECT = '*, teams(id,name,kind,country), shirt_images(image_url,is_primary,status)';

const num = (v: number | string | null): number | null => (v === null || v === undefined ? null : Number(v));

export function rowToTeam(r: TeamRow): Team {
  return { id: r.id, name: r.name, kind: r.kind, country: r.country };
}

export function rowToShirt(r: ShirtRow): Shirt {
  if (!r.teams) throw new Error('La samarreta no té equip associat');
  const primary = (r.shirt_images ?? []).find((i) => i.is_primary && i.status === 'confirmed');
  return {
    id: r.id,
    team: rowToTeam(r.teams),
    season: r.season,
    competition: r.competition,
    brand: r.brand,
    model: r.model,
    kitType: r.kit_type,
    version: r.version,
    playerName: r.player_name,
    squadNumber: r.squad_number,
    size: r.size,
    manufactureYear: r.manufacture_year,
    condition: r.condition,
    authenticity: r.authenticity,
    provenance: r.provenance,
    purchaseDate: r.purchase_date,
    price: num(r.price),
    shippingCost: num(r.shipping_cost),
    seller: r.seller,
    estimatedValue: num(r.estimated_value),
    location: r.location,
    notes: r.notes,
    curiosities: r.curiosities,
    photoUrl: primary?.image_url ?? null,
    importBatchId: r.import_batch_id ?? null,
    sourceRow: r.source_row ?? null,
    originalData: r.original_data ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Columnes editables. `owner_id` NO s'envia mai: el posa la base de dades (auth.uid()). */
export function inputToRow(input: ShirtInput, teamId: string) {
  return {
    team_id: teamId,
    season: input.season,
    competition: input.competition,
    brand: input.brand,
    model: input.model,
    kit_type: input.kitType,
    version: input.version,
    player_name: input.playerName,
    squad_number: input.squadNumber,
    size: input.size,
    manufacture_year: input.manufactureYear,
    condition: input.condition,
    authenticity: input.authenticity,
    provenance: input.provenance,
    purchase_date: input.purchaseDate,
    price: input.price,
    shipping_cost: input.shippingCost,
    seller: input.seller,
    estimated_value: input.estimatedValue,
    location: input.location,
    notes: input.notes,
    curiosities: input.curiosities,
  };
}

/** Converteix errors de Supabase/xarxa en missatges en català. */
export function friendlyError(e: unknown): Error {
  const message =
    e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return new Error('No hi ha connexió amb el servidor. Revisa Internet i torna-ho a provar.');
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new Error('No tens permís per fer aquesta operació. Torna a iniciar la sessió.');
  }
  if (code === '23505') return new Error('Ja existeix un registre amb aquestes dades.');
  if (code === '23503') return new Error('No es pot eliminar: hi ha dades que en depenen.');
  if (/jwt|expired/i.test(message)) return new Error('La sessió ha caducat. Torna a iniciar-la.');
  return new Error(message || 'S’ha produït un error inesperat');
}

// ───────── Fotografies i feines per lots ─────────

export interface ImageFullRow {
  id: string;
  shirt_id: string;
  origin: 'external' | 'stored';
  status: ImageStatus;
  is_primary: boolean;
  image_url: string | null;
  thumbnail_url: string | null;
  source_page_url: string | null;
  source: string | null;
  author: string | null;
  license: string | null;
  license_url: string | null;
  match_score: number | string | null;
  retrieved_at: string | null;
  selected_at: string | null;
}

export function rowToImage(r: ImageFullRow): ShirtImage {
  return {
    id: r.id,
    shirtId: r.shirt_id,
    origin: r.origin,
    status: r.status,
    isPrimary: r.is_primary,
    imageUrl: r.image_url,
    thumbnailUrl: r.thumbnail_url,
    sourcePageUrl: r.source_page_url,
    source: r.source,
    author: r.author,
    license: r.license,
    licenseUrl: r.license_url,
    matchScore: r.match_score === null ? null : Number(r.match_score),
    retrievedAt: r.retrieved_at,
    selectedAt: r.selected_at,
  };
}

export interface JobRow {
  id: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  created_at: string;
}

export interface JobItemRow {
  id: string;
  job_id: string;
  shirt_id: string;
  status: JobStatus;
  attempts: number;
  last_error: string | null;
  candidates_found: number;
}

export const rowToJob = (r: JobRow): ImageJob => ({
  id: r.id,
  status: r.status,
  total: r.total,
  done: r.done,
  failed: r.failed,
  createdAt: r.created_at,
});

export const rowToJobItem = (r: JobItemRow): ImageJobItem => ({
  id: r.id,
  jobId: r.job_id,
  shirtId: r.shirt_id,
  status: r.status,
  attempts: r.attempts,
  lastError: r.last_error,
  candidatesFound: r.candidates_found,
});
