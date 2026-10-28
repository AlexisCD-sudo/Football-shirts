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

  describe('importShirts', () => {
    const meta = { filename: 'x.csv', columnMapping: { Equip: 'teamName' }, summary: { total: 2 } };
    const items = [
      { input: makeInput({ teamName: 'Barça', season: '2010-11' }), sourceRow: 2, original: { Equip: 'Barça' } },
      { input: makeInput({ teamName: 'Roma', teamKind: 'club', country: 'Itàlia' }), sourceRow: 3, original: { Equip: 'Roma' } },
      { input: makeInput({ teamName: 'roma' }), sourceRow: 4, original: { Equip: 'roma' } },
    ];

    it('crea el lot, només els equips que falten i insereix amb la fila original', async () => {
      const { client, calls } = fakeClient((c) => {
        if (c.table === 'import_batches') return { data: { id: 'b1' }, error: null };
        if (c.table === 'teams' && c.action === 'select')
          return { data: [{ id: 't1', name: 'Barça', kind: 'club', country: null }], error: null };
        if (c.table === 'teams' && c.action === 'insert') return { data: [{ id: 't2', name: 'Roma' }], error: null };
        if (c.table === 'shirts' && c.action === 'insert') return { data: [], error: null };
        throw new Error('crida inesperada');
      });
      const progress: number[] = [];
      const report = await new SupabaseShirtRepository(client).importShirts(items, meta, (d) => progress.push(d));
      expect(report).toEqual({ batchId: 'b1', imported: 3, failed: [] });
      expect(progress).toEqual([3]);
      const teamInsert = calls.find((c) => c.table === 'teams' && c.action === 'insert');
      expect(teamInsert?.payload).toHaveLength(1); // «Roma» i «roma» són el mateix equip nou
      expect(calls.some((c) => c.table === 'teams' && c.action === 'update')).toBe(false); // no toca els existents
      const shirtInsert = calls.find((c) => c.table === 'shirts' && c.action === 'insert');
      const rows = shirtInsert?.payload as unknown as Record<string, unknown>[];
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ team_id: 't1', import_batch_id: 'b1', source_row: 2, original_data: { Equip: 'Barça' } });
      expect(rows[1]).toMatchObject({ team_id: 't2' });
      for (const r of rows) expect(r).not.toHaveProperty('owner_id');
    });

    it('si falla un bloc, ho reintenta fila per fila i informa de les que fallen', async () => {
      let single = 0;
      const { client } = fakeClient((c) => {
        if (c.table === 'import_batches') return { data: { id: 'b1' }, error: null };
        if (c.table === 'teams' && c.action === 'select') return { data: [{ id: 't1', name: 'Barça', kind: 'club', country: null }, { id: 't2', name: 'Roma', kind: 'club', country: null }], error: null };
        if (c.table === 'shirts' && c.action === 'insert') {
          if (Array.isArray(c.payload)) return { data: null, error: { message: 'bloc rebutjat' } };
          single += 1;
          return single === 2 ? { data: null, error: { code: '23505', message: 'duplicat' } } : { data: [], error: null };
        }
        throw new Error('crida inesperada');
      });
      const report = await new SupabaseShirtRepository(client).importShirts(items, meta);
      expect(report.imported).toBe(2);
      expect(report.failed).toHaveLength(1);
      expect(report.failed[0].sourceRow).toBe(3);
    });

    it('no fa res si no hi ha files', async () => {
      const { client, calls } = fakeClient(() => {
        throw new Error('no s\u2019hauria de cridar');
      });
      expect(await new SupabaseShirtRepository(client).importShirts([], meta)).toEqual({ batchId: '', imported: 0, failed: [] });
      expect(calls).toHaveLength(0);
    });
  });
});
