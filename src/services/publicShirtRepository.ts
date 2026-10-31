import type { SupabaseClient } from '@supabase/supabase-js';
import { rowToImage, type ImageFullRow } from './shirtMapping';
import type { ShirtRepository } from './shirtRepository';
import type { Shirt, ShirtImage, Team } from '../types/shirt';

const BUCKET = 'shirt-photos';
const SIGNED_URL_SECONDS = 3600;

interface PublicRow {
  id: string;
  team_name: string;
  team_kind: Team['kind'];
  country: string | null;
  season: string | null;
  competition: string | null;
  brand: string | null;
  model: string | null;
  kit_type: Shirt['kitType'];
  version: Shirt['version'];
  player_name: string | null;
  squad_number: number | null;
  size: string | null;
  manufacture_year: number | null;
  condition: Shirt['condition'];
  authenticity: Shirt['authenticity'];
  notes: string | null;
  curiosities: string | null;
  created_at: string;
  updated_at: string;
  image_id: string | null;
  image_origin: 'external' | 'stored' | null;
  image_url: string | null;
  thumbnail_url: string | null;
  source_page_url: string | null;
  image_source: string | null;
  author: string | null;
  license: string | null;
  license_url: string | null;
  storage_path: string | null;
}

const readOnly = (...args: unknown[]): Promise<never> => {
  void args;
  return Promise.reject(new Error('Vista de només lectura: inicia la sessió per editar.'));
};

/**
 * Accés de NOMÉS LECTURA per a qui no ha iniciat sessió. Només llegeix la funció `public_shirts()` (columnes
 * segures, sense preus ni dades privades) i firma les fotos pròpies que la política de Storage permet veure.
 * Totes les operacions d'escriptura es rebutgen aquí, i la base de dades les bloqueja igualment (RLS).
 */
export class PublicShirtRepository implements ShirtRepository {
  readonly persistence = 'cloud' as const;
  private cache: Promise<{ shirts: Shirt[]; images: ShirtImage[] }> | null = null;

  constructor(private readonly client: SupabaseClient) {}

  private load() {
    this.cache ??= this.fetchAll().catch((e) => {
      this.cache = null;
      throw e;
    });
    return this.cache;
  }

  private async fetchAll() {
    const { data, error } = await this.client.rpc('public_shirts');
    if (error) throw new Error('No s’ha pogut carregar la col·lecció pública.');
    const rows = (data ?? []) as PublicRow[];
    const paths = [...new Set(rows.map((r) => r.storage_path).filter((p): p is string => !!p))];
    const signed = new Map<string, string>();
    if (paths.length) {
      try {
        const { data: urls } = await this.client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
        for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
      } catch {
        /* sense fotos pròpies: es mostrarà el marcador de posició */
      }
    }
    const shirts: Shirt[] = [];
    const images: ShirtImage[] = [];
    for (const r of rows) {
      const img: ShirtImage | null =
        r.image_id && r.image_origin
          ? rowToImage(
              {
                id: r.image_id, shirt_id: r.id, origin: r.image_origin, status: 'confirmed', is_primary: true,
                image_url: r.image_url, thumbnail_url: r.thumbnail_url, source_page_url: r.source_page_url,
                source: r.image_source, author: r.author, license: r.license, license_url: r.license_url,
                match_score: null, retrieved_at: null, selected_at: null, storage_path: r.storage_path,
              } as ImageFullRow,
              signed,
            )
          : null;
      if (img) images.push(img);
      shirts.push({
        id: r.id,
        team: { id: `t:${r.team_name}`, name: r.team_name, kind: r.team_kind, country: r.country },
        season: r.season, competition: r.competition, brand: r.brand, model: r.model, kitType: r.kit_type,
        version: r.version, playerName: r.player_name, squadNumber: r.squad_number, size: r.size,
        manufactureYear: r.manufacture_year, condition: r.condition, authenticity: r.authenticity,
        provenance: null, purchaseDate: null, price: null, shippingCost: null, seller: null, estimatedValue: null,
        location: null, notes: r.notes, curiosities: r.curiosities, photoUrl: img?.imageUrl ?? null,
        importBatchId: null, sourceRow: null, originalData: null, createdAt: r.created_at, updatedAt: r.updated_at,
      });
    }
    return { shirts, images };
  }

  async listShirts() {
    this.cache = null; // «Actualitza» ha de tornar a llegir
    return (await this.load()).shirts;
  }
  async listTeams(): Promise<Team[]> {
    const { shirts } = await this.load();
    return [...new Map(shirts.map((s) => [s.team.name, s.team])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async listImages() {
    return (await this.load()).images;
  }
  async listWishlist() {
    return [];
  }
  async listBudgets() {
    return [];
  }
  async getLatestImageJob() {
    return null;
  }

  createShirt = readOnly;
  updateShirt = readOnly;
  deleteShirt = readOnly;
  importShirts = readOnly;
  addCandidates = readOnly;
  confirmImage = readOnly;
  unconfirmImage = readOnly;
  rejectImage = readOnly;
  addManualImage = readOnly;
  uploadPhoto = readOnly;
  deleteImage = readOnly;
  createImageJob = readOnly;
  updateImageJob = readOnly;
  updateImageJobItem = readOnly;
  createWishlistItem = readOnly;
  updateWishlistItem = readOnly;
  deleteWishlistItem = readOnly;
  markWishlistAcquired = readOnly;
  setBudget = readOnly;
  deleteBudget = readOnly;
}
