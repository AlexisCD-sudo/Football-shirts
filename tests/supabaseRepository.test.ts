import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SupabaseShirtRepository } from '../src/services/supabaseShirtRepository';
import type { ShirtRow } from '../src/services/shirtMapping';
import { makeInput } from './helpers';

interface Call {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  filters: [string, unknown][];
}
type Result = { data: unknown; error: unknown };

/** Client fals mínim que imita el builder encadenable de supabase-js. */
function fakeClient(handler: (c: Call) => Result) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, action: 'select', filters: [] };
      const q = {
        select: () => q,
        order: () => q,
        single: () => q,
        insert: (p: Record<string, unknown>) => {
          call.action = 'insert';
          call.payload = p;
          return q;
        },
        update: (p: Record<string, unknown>) => {
          call.action = 'update';
          call.payload = p;
          return q;
        },
        delete: () => {
          call.action = 'delete';
          return q;
        },
        eq: (k: string, v: unknown) => {
          call.filters.push([k, v]);
          return q;
        },
        then: (res: (r: Result) => unknown, rej: (e: unknown) => unknown) => {
          calls.push(call);
          return Promise.resolve(handler(call)).then(res, rej);
        },
      };
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const shirtRow: ShirtRow = {
  id: 's1', season: null, competition: null, brand: null, model: null, kit_type: null, version: 'unknown',
  player_name: null, squad_number: null, size: null, manufacture_year: null, condition: null,
  authenticity: 'unverified', provenance: null, purchase_date: null, price: null, shipping_cost: null,
  seller: null, estimated_value: null, location: null, notes: null, curiosities: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  teams: { id: 't1', name: 'Barça', kind: 'club', country: null },
};

describe('SupabaseShirtRepository', () => {
  it('crea l’equip si no existeix i després la samarreta, sense enviar owner_id', async () => {
    const { client, calls } = fakeClient((c) => {
      if (c.table === 'teams' && c.action === 'select') return { data: [], error: null };
      if (c.table === 'teams' && c.action === 'insert') return { data: { id: 't9' }, error: null };
      if (c.table === 'shirts' && c.action === 'insert') return { data: { ...shirtRow, teams: { id: 't9', name: 'Girona', kind: 'club', country: null } }, error: null };
      throw new Error('crida inesperada');
    });
    const repo = new SupabaseShirtRepository(client);
    const created = await repo.createShirt(makeInput({ teamName: ' Girona ' }));
    expect(created.team.name).toBe('Girona');
    const teamInsert = calls.find((c) => c.table === 'teams' && c.action === 'insert');
    expect(teamInsert?.payload).toMatchObject({ name: 'Girona' });
    const shirtInsert = calls.find((c) => c.table === 'shirts' && c.action === 'insert');
    expect(shirtInsert?.payload).toMatchObject({ team_id: 't9' });
    for (const c of calls) expect(c.payload ?? {}).not.toHaveProperty('owner_id');
  });

  it('reutilitza l’equip existent encara que canviïn accents o majúscules', async () => {
    const { client, calls } = fakeClient((c) => {
      if (c.table === 'teams' && c.action === 'select')
        return { data: [{ id: 't1', name: 'Barça', kind: 'club', country: null }], error: null };
      if (c.table === 'shirts' && c.action === 'insert') return { data: shirtRow, error: null };
      throw new Error('crida inesperada');
    });
    await new SupabaseShirtRepository(client).createShirt(makeInput({ teamName: 'barca' }));
    expect(calls.some((c) => c.table === 'teams' && c.action === 'insert')).toBe(false);
    expect(calls.find((c) => c.table === 'shirts' && c.action === 'insert')?.payload).toMatchObject({ team_id: 't1' });
  });

  it('informa que la samarreta ja no existeix si l’actualització no afecta cap fila (RLS o esborrada)', async () => {
    const { client } = fakeClient((c) => {
      if (c.table === 'teams') return { data: [{ id: 't1', name: 'Barça', kind: 'club', country: null }], error: null };
      return { data: [], error: null };
    });
    const repo = new SupabaseShirtRepository(client);
    await expect(repo.updateShirt('x', makeInput())).rejects.toThrow('ja no existeix');
    await expect(repo.deleteShirt('x')).rejects.toThrow('ja no existeix');
  });

  it('tradueix els errors del servidor', async () => {
    const { client } = fakeClient(() => ({ data: null, error: { code: '42501', message: 'row-level security' } }));
    await expect(new SupabaseShirtRepository(client).listShirts()).rejects.toThrow(/permís/);
  });
});
