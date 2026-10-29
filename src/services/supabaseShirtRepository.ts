import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize } from '../lib/catalog';
import type { ImportItem } from '../lib/importer';
import type {
  Budget,
  ImageJob,
  ImageJobItem,
  Shirt,
  ShirtImage,
  ShirtInput,
  Team,
  WishlistInput,
  WishlistItem,
} from '../types/shirt';
import type {
  ImageJobItemPatch,
  ImageJobPatch,
  ImportMeta,
  ImportReport,
  NewCandidate,
  ShirtRepository,
} from './shirtRepository';
import {
  SHIRT_SELECT,
  WISHLIST_SELECT,
  friendlyError,
  inputToRow,
  rowToBudget,
  rowToImage,
  rowToJob,
  rowToJobItem,
  rowToShirt,
  rowToTeam,
  rowToWishlist,
  wishlistToRow,
  type BudgetRow,
  type ImageFullRow,
  type JobItemRow,
  type JobRow,
  type ShirtRow,
  type TeamRow,
  type WishlistRow,
} from './shirtMapping';

const BUCKET = 'shirt-photos';
const SIGNED_URL_SECONDS = 3600;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Dades al núvol. La seguretat la garanteix RLS; aquí mai s'envia `owner_id`. */
export class SupabaseShirtRepository implements ShirtRepository {
  readonly persistence = 'cloud' as const;

  constructor(private readonly client: SupabaseClient) {}

  private async wrap<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    let result: { data: T | null; error: unknown };
    try {
      result = await run();
    } catch (e) {
      throw friendlyError(e);
    }
    if (result.error) throw friendlyError(result.error);
    return result.data as T;
  }

  /** URL temporals per a les fotos del bucket privat. Si falla, les fotos pròpies no es veuen però res més es trenca. */
  private async signUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(paths.filter((p): p is string => !!p))];
    const out = new Map<string, string>();
    if (unique.length === 0) return out;
    try {
      const { data, error } = await this.client.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
      if (error || !data) return out;
      for (const d of data) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
    } catch {
      /* sense URL signada: es mostrarà el marcador de posició */
    }
    return out;
  }

  private async hydrate(rows: ShirtRow[]): Promise<Shirt[]> {
    const signed = await this.signUrls(
      rows.flatMap((r) => (r.shirt_images ?? []).filter((i) => i.is_primary && i.status === 'confirmed').map((i) => i.storage_path)),
    );
    return rows.map((r) => rowToShirt(r, signed));
  }

  async listShirts(): Promise<Shirt[]> {
    const rows = await this.wrap<ShirtRow[]>(() =>
      this.client.from('shirts').select(SHIRT_SELECT).order('created_at', { ascending: false }),
    );
    return this.hydrate(rows);
  }

  async listTeams(): Promise<Team[]> {
    const rows = await this.wrap<TeamRow[]>(() =>
      this.client.from('teams').select('id,name,kind,country').order('name'),
    );
    return rows.map(rowToTeam);
  }

  private async ensureTeam(input: Pick<ShirtInput, 'teamName' | 'teamKind' | 'country'>): Promise<string> {
    const teams = await this.listTeams();
    const key = normalize(input.teamName);
    const existing = teams.find((t) => normalize(t.name) === key);
    if (existing) {
      const country = input.country ?? existing.country;
      if (existing.kind !== input.teamKind || existing.country !== country) {
        await this.wrap(() =>
          this.client.from('teams').update({ kind: input.teamKind, country }).eq('id', existing.id).select('id'),
        );
      }
      return existing.id;
    }
    const created = await this.wrap<{ id: string }>(() =>
      this.client
        .from('teams')
        .insert({ name: input.teamName.trim(), kind: input.teamKind, country: input.country })
        .select('id')
        .single(),
    );
    return created.id;
  }

  async createShirt(input: ShirtInput): Promise<Shirt> {
    const teamId = await this.ensureTeam(input);
    const row = await this.wrap<ShirtRow>(() =>
      this.client.from('shirts').insert(inputToRow(input, teamId)).select(SHIRT_SELECT).single(),
    );
    return (await this.hydrate([row]))[0];
  }

  async updateShirt(id: string, input: ShirtInput): Promise<Shirt> {
    const teamId = await this.ensureTeam(input);
    const rows = await this.wrap<ShirtRow[]>(() =>
      this.client.from('shirts').update(inputToRow(input, teamId)).eq('id', id).select(SHIRT_SELECT),
    );
    // Amb RLS, una fila d'un altre usuari o ja esborrada simplement no retorna res.
    if (rows.length === 0) throw new Error('La samarreta ja no existeix');
    return (await this.hydrate([rows[0]]))[0];
  }

  async importShirts(
    items: ImportItem[],
    meta: ImportMeta,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportReport> {
    const failed: ImportReport['failed'] = [];
    if (items.length === 0) return { batchId: '', imported: 0, failed };

    const batch = await this.wrap<{ id: string }>(() =>
      this.client
        .from('import_batches')
        .insert({ filename: meta.filename, column_mapping: meta.columnMapping, summary: meta.summary })
        .select('id')
        .single(),
    );

    // Equips: només es creen els que falten; els existents no es toquen.
    const teamIds = new Map((await this.listTeams()).map((t) => [normalize(t.name), t.id]));
    const missing = new Map<string, ImportItem['input']>();
    for (const { input } of items) {
      const key = normalize(input.teamName);
      if (!teamIds.has(key) && !missing.has(key)) missing.set(key, input);
    }
    if (missing.size > 0) {
      const created = await this.wrap<{ id: string; name: string }[]>(() =>
        this.client
          .from('teams')
          .insert([...missing.values()].map((i) => ({ name: i.teamName.trim(), kind: i.teamKind, country: i.country })))
          .select('id,name'),
      );
      for (const t of created) teamIds.set(normalize(t.name), t.id);
    }

    const toRow = (item: ImportItem) => ({
      ...inputToRow(item.input, teamIds.get(normalize(item.input.teamName)) as string),
      import_batch_id: batch.id,
      source_row: item.sourceRow,
      original_data: item.original,
    });

    let imported = 0;
    let done = 0;
    const CHUNK = 25;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      try {
        await this.wrap(() => this.client.from('shirts').insert(chunk.map(toRow)).select('id'));
        imported += chunk.length;
      } catch {
        // Si falla el bloc, es prova fila per fila per saber exactament quines fallen.
        for (const item of chunk) {
          try {
            await this.wrap(() => this.client.from('shirts').insert(toRow(item)).select('id'));
            imported += 1;
          } catch (e) {
            failed.push({ sourceRow: item.sourceRow, message: e instanceof Error ? e.message : 'Error desconegut' });
          }
        }
      }
      done += chunk.length;
      onProgress?.(done, items.length);
    }
    return { batchId: batch.id, imported, failed };
  }

  async deleteShirt(id: string): Promise<void> {
    const own = await this.wrap<{ storage_path: string | null }[]>(() =>
      this.client.from('shirt_images').select('storage_path').eq('shirt_id', id).not('storage_path', 'is', null),
    );
    const rows = await this.wrap<{ id: string }[]>(() =>
      this.client.from('shirts').delete().eq('id', id).select('id'),
    );
    if (rows.length === 0) throw new Error('La samarreta ja no existeix');
    const paths = own.map((o) => o.storage_path).filter((p): p is string => !!p);
    if (paths.length > 0) await this.client.storage.from(BUCKET).remove(paths);
  }

  // ───────── Fotografies ─────────
  async listImages(): Promise<ShirtImage[]> {
    const rows = await this.wrap<ImageFullRow[]>(() => this.client.from('shirt_images').select('*'));
    const signed = await this.signUrls(rows.map((r) => r.storage_path));
    return rows.map((r) => rowToImage(r, signed));
  }

  async addCandidates(shirtId: string, candidates: NewCandidate[]): Promise<number> {
    if (candidates.length === 0) return 0;
    // L'índex únic és parcial i no es pot usar amb upsert: es filtren abans les URL ja conegudes
    // (incloses les rebutjades, perquè no tornin a aparèixer).
    const existing = await this.wrap<{ image_url: string | null }[]>(() =>
      this.client.from('shirt_images').select('image_url').eq('shirt_id', shirtId),
    );
    const known = new Set(existing.map((e) => e.image_url));
    const fresh: NewCandidate[] = [];
    for (const c of candidates) {
      if (known.has(c.imageUrl)) continue;
      known.add(c.imageUrl);
      fresh.push(c);
    }
    if (fresh.length === 0) return 0;
    const now = new Date().toISOString();
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .insert(
          fresh.map((c) => ({
            shirt_id: shirtId,
            origin: 'external',
            status: 'candidate',
            image_url: c.imageUrl,
            thumbnail_url: c.thumbnailUrl,
            source_page_url: c.sourcePageUrl,
            source: c.source,
            author: c.author,
            license: c.license,
            license_url: c.licenseUrl,
            match_score: c.matchScore,
            retrieved_at: now,
          })),
        )
        .select('id'),
    );
    return fresh.length;
  }

  private async imageRow(imageId: string): Promise<ImageFullRow> {
    const rows = await this.wrap<ImageFullRow[]>(() => this.client.from('shirt_images').select('*').eq('id', imageId));
    if (rows.length === 0) throw new Error('La imatge ja no existeix');
    return rows[0];
  }

  private async demotePrimary(shirtId: string): Promise<void> {
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .update({ is_primary: false, status: 'candidate' })
        .eq('shirt_id', shirtId)
        .eq('is_primary', true)
        .select('id'),
    );
  }

  async confirmImage(imageId: string): Promise<void> {
    const img = await this.imageRow(imageId);
    // Primer es retira la principal anterior: hi ha un índex únic d'una sola principal per samarreta.
    await this.demotePrimary(img.shirt_id);
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .update({ status: 'confirmed', is_primary: true, selected_at: new Date().toISOString() })
        .eq('id', imageId)
        .select('id'),
    );
  }

  async unconfirmImage(imageId: string): Promise<void> {
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .update({ status: 'candidate', is_primary: false, selected_at: null })
        .eq('id', imageId)
        .select('id'),
    );
  }

  async rejectImage(imageId: string): Promise<void> {
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .update({ status: 'rejected', is_primary: false, selected_at: null })
        .eq('id', imageId)
        .select('id'),
    );
  }

  async addManualImage(shirtId: string, imageUrl: string, sourcePageUrl?: string): Promise<void> {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('L\u2019enllaç ha de començar per http:// o https://');
    const existing = await this.wrap<{ id: string }[]>(() =>
      this.client.from('shirt_images').select('id').eq('shirt_id', shirtId).eq('image_url', url),
    );
    if (existing.length > 0) {
      await this.confirmImage(existing[0].id);
      return;
    }
    await this.demotePrimary(shirtId);
    const now = new Date().toISOString();
    await this.wrap(() =>
      this.client
        .from('shirt_images')
        .insert({
          shirt_id: shirtId,
          origin: 'external',
          status: 'confirmed',
          is_primary: true,
          image_url: url,
          source_page_url: sourcePageUrl?.trim() || url,
          source: 'manual',
          retrieved_at: now,
          selected_at: now,
        })
        .select('id'),
    );
  }

  async uploadPhoto(shirtId: string, file: Blob, contentType: string): Promise<void> {
    const ext = EXTENSIONS[contentType];
    if (!ext) throw new Error('Format no admès: usa JPG, PNG o WebP.');
    let userId: string | undefined;
    try {
      userId = (await this.client.auth.getUser()).data.user?.id;
    } catch (e) {
      throw friendlyError(e);
    }
    if (!userId) throw new Error('La sessió ha caducat. Torna a iniciar-la.');
    // Ruta <usuari>/<samarreta>/<fitxer>: les polítiques del bucket només deixen tocar la carpeta pròpia.
    const path = `${userId}/${shirtId}/${crypto.randomUUID()}.${ext}`;
    const up = await this.client.storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
    if (up.error) throw friendlyError(up.error);
    try {
      await this.demotePrimary(shirtId);
      const now = new Date().toISOString();
      await this.wrap(() =>
        this.client
          .from('shirt_images')
          .insert({
            shirt_id: shirtId,
            origin: 'stored',
            status: 'confirmed',
            is_primary: true,
            source: 'upload',
            license: 'Foto pròpia',
            storage_path: path,
            retrieved_at: now,
            selected_at: now,
          })
          .select('id'),
      );
    } catch (e) {
      await this.client.storage.from(BUCKET).remove([path]); // no deixa fitxers orfes
      throw e;
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    const row = await this.imageRow(imageId);
    await this.wrap(() => this.client.from('shirt_images').delete().eq('id', imageId).select('id'));
    if (row.storage_path) await this.client.storage.from(BUCKET).remove([row.storage_path]);
  }

  // ───────── Cerca per lots ─────────
  async createImageJob(shirtIds: string[]): Promise<ImageJob> {
    const job = await this.wrap<JobRow>(() =>
      this.client.from('image_search_jobs').insert({ total: shirtIds.length }).select('*').single(),
    );
    if (shirtIds.length > 0) {
      await this.wrap(() =>
        this.client
          .from('image_search_job_items')
          .insert(shirtIds.map((shirt_id) => ({ job_id: job.id, shirt_id })))
          .select('id'),
      );
    }
    return rowToJob(job);
  }

  async getLatestImageJob(): Promise<{ job: ImageJob; items: ImageJobItem[] } | null> {
    const jobs = await this.wrap<JobRow[]>(() =>
      this.client.from('image_search_jobs').select('*').order('created_at', { ascending: false }).limit(1),
    );
    if (jobs.length === 0) return null;
    const items = await this.wrap<JobItemRow[]>(() =>
      this.client.from('image_search_job_items').select('*').eq('job_id', jobs[0].id),
    );
    return { job: rowToJob(jobs[0]), items: items.map(rowToJobItem) };
  }

  async updateImageJob(id: string, patch: ImageJobPatch): Promise<void> {
    await this.wrap(() => this.client.from('image_search_jobs').update(patch).eq('id', id).select('id'));
  }

  async updateImageJobItem(id: string, patch: ImageJobItemPatch): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.lastError !== undefined) row.last_error = patch.lastError;
    if (patch.candidatesFound !== undefined) row.candidates_found = patch.candidatesFound;
    await this.wrap(() => this.client.from('image_search_job_items').update(row).eq('id', id).select('id'));
  }

  // ───────── Llista de desitjos i pressupost ─────────
  async listWishlist(): Promise<WishlistItem[]> {
    const rows = await this.wrap<WishlistRow[]>(() =>
      this.client.from('wishlist_items').select(WISHLIST_SELECT).order('priority').order('created_at'),
    );
    return rows.map(rowToWishlist);
  }

  async createWishlistItem(input: WishlistInput): Promise<WishlistItem> {
    const teamId = await this.ensureTeam(input);
    const row = await this.wrap<WishlistRow>(() =>
      this.client.from('wishlist_items').insert(wishlistToRow(input, teamId)).select(WISHLIST_SELECT).single(),
    );
    return rowToWishlist(row);
  }

  async updateWishlistItem(id: string, input: WishlistInput): Promise<WishlistItem> {
    const teamId = await this.ensureTeam(input);
    const rows = await this.wrap<WishlistRow[]>(() =>
      this.client.from('wishlist_items').update(wishlistToRow(input, teamId)).eq('id', id).select(WISHLIST_SELECT),
    );
    if (rows.length === 0) throw new Error('El desig ja no existeix');
    return rowToWishlist(rows[0]);
  }

  async deleteWishlistItem(id: string): Promise<void> {
    const rows = await this.wrap<{ id: string }[]>(() =>
      this.client.from('wishlist_items').delete().eq('id', id).select('id'),
    );
    if (rows.length === 0) throw new Error('El desig ja no existeix');
  }

  async markWishlistAcquired(id: string, shirtId: string): Promise<WishlistItem> {
    const rows = await this.wrap<WishlistRow[]>(() =>
      this.client
        .from('wishlist_items')
        .update({ status: 'acquired', acquired_shirt_id: shirtId })
        .eq('id', id)
        .select(WISHLIST_SELECT),
    );
    if (rows.length === 0) throw new Error('El desig ja no existeix');
    return rowToWishlist(rows[0]);
  }

  async listBudgets(): Promise<Budget[]> {
    const rows = await this.wrap<BudgetRow[]>(() =>
      this.client.from('budgets').select('year,amount').order('year', { ascending: false }),
    );
    return rows.map(rowToBudget);
  }

  async setBudget(year: number, amount: number): Promise<void> {
    if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error('Any no vàlid (1990–2100)');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('L’import ha de ser 0 o més');
    // owner_id el posa la base de dades (auth.uid()); la clau única és (owner_id, year).
    await this.wrap(() =>
      this.client
        .from('budgets')
        .upsert({ year, amount: Math.round(amount * 100) / 100 }, { onConflict: 'owner_id,year' })
        .select('year'),
    );
  }

  async deleteBudget(year: number): Promise<void> {
    await this.wrap(() => this.client.from('budgets').delete().eq('year', year).select('year'));
  }
}
