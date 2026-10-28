import { describe, expect, it } from 'vitest';
import { friendlyError, inputToRow, rowToShirt, type ShirtRow } from '../src/services/shirtMapping';
import { makeInput } from './helpers';

const row: ShirtRow = {
  id: 's1',
  season: '2010-11',
  competition: null,
  brand: 'Nike',
  model: null,
  kit_type: 'home',
  version: 'unknown',
  player_name: 'Messi',
  squad_number: 10,
  size: null,
  manufacture_year: null,
  condition: null,
  authenticity: 'unverified',
  provenance: null,
  purchase_date: null,
  price: '59.90',
  shipping_cost: null,
  seller: null,
  estimated_value: 120,
  location: null,
  notes: null,
  curiosities: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  teams: { id: 't1', name: 'Barça', kind: 'club', country: 'Espanya' },
  shirt_images: [],
};

describe('rowToShirt', () => {
  it('converteix una fila amb equip i imports numèrics', () => {
    const s = rowToShirt(row);
    expect(s.team).toEqual({ id: 't1', name: 'Barça', kind: 'club', country: 'Espanya' });
    expect(s.price).toBe(59.9);
    expect(s.estimatedValue).toBe(120);
    expect(s.shippingCost).toBeNull();
    expect(s.playerName).toBe('Messi');
    expect(s.squadNumber).toBe(10);
    expect(s.photoUrl).toBeNull();
  });

  it('només usa la imatge principal confirmada com a foto', () => {
    const s = rowToShirt({
      ...row,
      shirt_images: [
        { image_url: 'https://x/candidata.jpg', is_primary: false, status: 'candidate' },
        { image_url: 'https://x/rebutjada.jpg', is_primary: false, status: 'rejected' },
        { image_url: 'https://x/bona.jpg', is_primary: true, status: 'confirmed' },
      ],
    });
    expect(s.photoUrl).toBe('https://x/bona.jpg');
    expect(rowToShirt({ ...row, shirt_images: [{ image_url: 'https://x/c.jpg', is_primary: false, status: 'candidate' }] }).photoUrl).toBeNull();
  });

  it('falla si falta l’equip', () => {
    expect(() => rowToShirt({ ...row, teams: null })).toThrow();
  });
});

describe('inputToRow', () => {
  it('no envia mai owner_id ni id', () => {
    const r = inputToRow(makeInput({ season: '2010-11', price: 10 }), 't1');
    expect(r).not.toHaveProperty('owner_id');
    expect(r).not.toHaveProperty('id');
    expect(r.team_id).toBe('t1');
    expect(r.price).toBe(10);
    expect(r.kit_type).toBeNull();
  });
});

describe('friendlyError', () => {
  it('tradueix errors de xarxa', () => {
    expect(friendlyError(new TypeError('Failed to fetch')).message).toMatch(/connexió/);
  });
  it('tradueix errors de permisos RLS', () => {
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy' }).message).toMatch(/permís/);
  });
  it('conserva altres missatges', () => {
    expect(friendlyError({ message: 'Altra cosa' }).message).toBe('Altra cosa');
  });
});
