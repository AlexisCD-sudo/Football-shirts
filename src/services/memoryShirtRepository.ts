import { normalize } from '../lib/catalog';
import type { Shirt, ShirtInput, Team } from '../types/shirt';
import type { ShirtRepository } from './shirtRepository';

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

  async deleteShirt(id: string): Promise<void> {
    if (!this.shirts.delete(id)) throw new Error('La samarreta ja no existeix');
  }
}
