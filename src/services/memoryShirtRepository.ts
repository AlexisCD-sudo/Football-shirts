import { normalize } from '../lib/catalog';
import type { ImportItem } from '../lib/importer';
import type { Shirt, ShirtInput, Team } from '../types/shirt';
import type { ImportMeta, ImportReport, ShirtRepository } from './shirtRepository';

type StoredShirt = Omit<Shirt, 'team'> & { teamId: string };

/**
 * Implementació provisional en memòria (fase 2). Comença BUIDA: no hi ha dades
 * de demostració a la col·lecció real. Es perd en recarregar la pàgina.
 */
export class MemoryShirtRepository implements ShirtRepository {
  readonly persistence = 'memory' as const;
  private teams = new Map<string, Team>();
  private shirts = new Map<string, StoredShirt>();

  private resolveTeam(input: ShirtInput): Team {
    const key = normalize(input.teamName);
    const existing = [...this.teams.values()].find((t) => normalize(t.name) === key);
    if (existing) {
      const updated: Team = {
        ...existing,
        kind: input.teamKind,
        country: input.country ?? existing.country,
      };
      this.teams.set(existing.id, updated);
      return updated;
    }
    const team: Team = {
      id: crypto.randomUUID(),
      name: input.teamName.trim(),
      kind: input.teamKind,
      country: input.country,
    };
    this.teams.set(team.id, team);
    return team;
  }

  private compose(s: StoredShirt): Shirt {
    const { teamId, ...rest } = s;
    const team = this.teams.get(teamId);
    if (!team) throw new Error('Equip inexistent');
    return { ...rest, team: { ...team } };
  }

  private fields(input: ShirtInput) {
    const { teamName, teamKind, country, ...rest } = input;
    void teamName;
    void teamKind;
    void country;
    return rest;
  }

  async listShirts(): Promise<Shirt[]> {
    return [...this.shirts.values()].map((s) => this.compose(s));
  }

  async listTeams(): Promise<Team[]> {
    return [...this.teams.values()].map((t) => ({ ...t }));
  }

  async createShirt(input: ShirtInput): Promise<Shirt> {
    const team = this.resolveTeam(input);
    const now = new Date().toISOString();
    const stored: StoredShirt = {
      ...this.fields(input),
      id: crypto.randomUUID(),
      teamId: team.id,
      photoUrl: null,
      importBatchId: null,
      sourceRow: null,
      originalData: null,
      createdAt: now,
      updatedAt: now,
    };
    this.shirts.set(stored.id, stored);
    return this.compose(stored);
  }

  async updateShirt(id: string, input: ShirtInput): Promise<Shirt> {
    const current = this.shirts.get(id);
    if (!current) throw new Error('La samarreta ja no existeix');
    const team = this.resolveTeam(input);
    const stored: StoredShirt = {
      ...current,
      ...this.fields(input),
      teamId: team.id,
      updatedAt: new Date().toISOString(),
    };
    this.shirts.set(id, stored);
    return this.compose(stored);
  }

  /** Troba o crea l'equip SENSE modificar-ne el tipus ni el país si ja existeix. */
  private teamForImport(input: ShirtInput): Team {
    const key = normalize(input.teamName);
    const existing = [...this.teams.values()].find((t) => normalize(t.name) === key);
    if (existing) return existing;
    return this.resolveTeam(input);
  }

  async importShirts(
    items: ImportItem[],
    _meta: ImportMeta,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportReport> {
    const batchId = crypto.randomUUID();
    const failed: ImportReport['failed'] = [];
    let imported = 0;
    for (const [i, item] of items.entries()) {
      try {
        const team = this.teamForImport(item.input);
        const now = new Date().toISOString();
        const stored: StoredShirt = {
          ...this.fields(item.input),
          id: crypto.randomUUID(),
          teamId: team.id,
          photoUrl: null,
          importBatchId: batchId,
          sourceRow: item.sourceRow,
          originalData: { ...item.original },
          createdAt: now,
          updatedAt: now,
        };
        this.shirts.set(stored.id, stored);
        imported += 1;
      } catch (e) {
        failed.push({ sourceRow: item.sourceRow, message: e instanceof Error ? e.message : 'Error desconegut' });
      }
      onProgress?.(i + 1, items.length);
    }
    return { batchId, imported, failed };
  }

  async deleteShirt(id: string): Promise<void> {
    if (!this.shirts.delete(id)) throw new Error('La samarreta ja no existeix');
  }
}
