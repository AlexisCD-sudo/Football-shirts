import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize } from '../lib/catalog';
import type { ImportItem } from '../lib/importer';
import type { ImageJob, ImageJobItem, Shirt, ShirtImage, ShirtInput, Team } from '../types/shirt';
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
  friendlyError,
  inputToRow,
  rowToImage,
  rowToJob,
  rowToJobItem,
  rowToShirt,
  rowToTeam,
  type ImageFullRow,
  type JobItemRow,
  type JobRow,
  type ShirtRow,
  type TeamRow,
} from './shirtMapping';

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

  async listShirts(): Promise<Shirt[]> {
    const rows = await this.wrap<ShirtRow[]>(() =>
      this.client.from('shirts').select(SHIRT_SELECT).order('created_at', { ascending: false }),
    );
    return rows.map(rowToShirt);
  }

  async listTeams(): Promise<Team[]> {
    const rows = await this.wrap<TeamRow[]>(() =>
      this.client.from('teams').select('id,name,kind,country').order('name'),
    );
    return rows.map(rowToTeam);
  }

  private async ensureTeam(input: ShirtInput): Promise<string> {
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
    return rowToShirt(row);
  }

  async updateShirt(id: string, input: ShirtInput): Promise<Shirt> {
    const teamId = await this.ensureTeam(input);
    const rows = await this.wrap<ShirtRow[]>(() =>
      this.client.from('shirts').update(inputToRow(input, teamId)).eq('id', id).select(SHIRT_SELECT),
    );
    // Amb RLS, una fila d'un altre usuari o ja esborrada simplement no retorna res.
    if (rows.length === 0) throw new Error('La samarreta ja no existeix');
    return rowToShirt(rows[0]);
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
    const rows = await this.wrap<{ id: string }[]>(() =>
      this.client.from('shirts').delete().eq('id', id).select('id'),
    );
    if (rows.length === 0) throw new Error('La samarreta ja no existeix');
  }

  // ───────── Fotografies ─────────
  async listImages(): Promise<ShirtImage[]> {
    const rows = await this.wrap<ImageFullRow[]>(() => this.client.from('shirt_images').select('*'));
    return rows.map(rowToImage);
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

  async deleteImage(imageId: string): Promise<void> {
    await this.wrap(() => this.client.from('shirt_images').delete().eq('id', imageId).select('id'));
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
}
