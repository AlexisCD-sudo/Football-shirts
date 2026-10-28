import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize } from '../lib/catalog';
import type { ImportItem } from '../lib/importer';
import type { Shirt, ShirtInput, Team } from '../types/shirt';
import type { ImportMeta, ImportReport, ShirtRepository } from './shirtRepository';
import {
  SHIRT_SELECT,
  friendlyError,
  inputToRow,
  rowToShirt,
  rowToTeam,
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
}
