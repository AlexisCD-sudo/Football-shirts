export type TeamKind = 'club' | 'national';
export type KitType = 'home' | 'away' | 'third' | 'goalkeeper' | 'special' | 'training' | 'other';
export type ShirtVersion = 'fan' | 'player' | 'replica' | 'unknown';
export type ShirtCondition =
  | 'new_with_tags'
  | 'new_without_tags'
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor';
export type Authenticity = 'official' | 'reissue' | 'replica' | 'unverified';

export const KIT_TYPES: KitType[] = ['home', 'away', 'third', 'goalkeeper', 'special', 'training', 'other'];
export const VERSIONS: ShirtVersion[] = ['fan', 'player', 'replica', 'unknown'];
export const CONDITIONS: ShirtCondition[] = [
  'new_with_tags',
  'new_without_tags',
  'excellent',
  'good',
  'fair',
  'poor',
];
export const AUTHENTICITIES: Authenticity[] = ['official', 'reissue', 'replica', 'unverified'];

export interface Team {
  id: string;
  name: string;
  kind: TeamKind;
  country: string | null;
}

/** Una samarreta. Els camps desconeguts són `null`: mai s'inventen valors. */
export interface Shirt {
  id: string;
  team: Team;
  season: string | null; // AAAA-AA
  competition: string | null;
  brand: string | null;
  model: string | null;
  kitType: KitType | null;
  version: ShirtVersion;
  playerName: string | null;
  squadNumber: number | null;
  size: string | null;
  manufactureYear: number | null;
  condition: ShirtCondition | null;
  authenticity: Authenticity;
  provenance: string | null;
  purchaseDate: string | null; // AAAA-MM-DD
  price: number | null;
  shippingCost: number | null;
  seller: string | null;
  estimatedValue: number | null;
  location: string | null;
  notes: string | null;
  curiosities: string | null;
  /** URL de la fotografia confirmada (fase 5). Fins llavors, sempre `null`. */
  photoUrl: string | null;
  /** Traçabilitat de la importació: la fila original completa es conserva tal qual. */
  importBatchId: string | null;
  sourceRow: number | null;
  originalData: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

/** Dades per crear o editar una samarreta (l'equip es resol pel nom). */
export interface ShirtInput {
  teamName: string;
  teamKind: TeamKind;
  country: string | null;
  season: string | null;
  competition: string | null;
  brand: string | null;
  model: string | null;
  kitType: KitType | null;
  version: ShirtVersion;
  playerName: string | null;
  squadNumber: number | null;
  size: string | null;
  manufactureYear: number | null;
  condition: ShirtCondition | null;
  authenticity: Authenticity;
  provenance: string | null;
  purchaseDate: string | null;
  price: number | null;
  shippingCost: number | null;
  seller: string | null;
  estimatedValue: number | null;
  location: string | null;
  notes: string | null;
  curiosities: string | null;
}

export type ImageStatus = 'candidate' | 'confirmed' | 'rejected';
export type ImageSource = 'wikimedia_commons' | 'openverse' | 'manual';

/** Una fotografia associada a una samarreta (candidata, confirmada o rebutjada). */
export interface ShirtImage {
  id: string;
  shirtId: string;
  /** `external`: només una referència a Internet. `stored`: còpia al bucket privat (no implementat encara). */
  origin: 'external' | 'stored';
  status: ImageStatus;
  isPrimary: boolean;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  sourcePageUrl: string | null;
  source: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  matchScore: number | null;
  retrievedAt: string | null;
  selectedAt: string | null;
}

export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ImageJob {
  id: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  createdAt: string;
}

export interface ImageJobItem {
  id: string;
  jobId: string;
  shirtId: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  candidatesFound: number;
}
