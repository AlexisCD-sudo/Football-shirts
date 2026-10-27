import { describe, expect, it } from 'vitest';
import { emptyFormValues, parseShirtForm } from '../src/lib/shirtSchema';

const base = { ...emptyFormValues, teamName: 'Barça' };

describe('parseShirtForm', () => {
  it('accepta només l’equip i deixa la resta com a null', () => {
    const r = parseShirtForm(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.teamName).toBe('Barça');
      expect(r.data.season).toBeNull();
      expect(r.data.price).toBeNull();
      expect(r.data.squadNumber).toBeNull();
      expect(r.data.kitType).toBeNull();
    }
  });

  it('exigeix equip', () => {
    const r = parseShirtForm({ ...base, teamName: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.teamName).toBeDefined();
  });

  it('rebutja formats de temporada incorrectes', () => {
    const r = parseShirtForm({ ...base, season: '2005-2006' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.season).toMatch(/AAAA-AA/);
  });

  it('valida el dorsal', () => {
    expect(parseShirtForm({ ...base, squadNumber: '100' }).ok).toBe(false);
    expect(parseShirtForm({ ...base, squadNumber: '7.5' }).ok).toBe(false);
    const ok = parseShirtForm({ ...base, squadNumber: '7' });
    expect(ok.ok && ok.data.squadNumber).toBe(7);
  });

  it('accepta decimals amb coma i rebutja negatius o text', () => {
    const ok = parseShirtForm({ ...base, price: '59,90' });
    expect(ok.ok && ok.data.price).toBe(59.9);
    expect(parseShirtForm({ ...base, price: '-1' }).ok).toBe(false);
    expect(parseShirtForm({ ...base, price: 'molt' }).ok).toBe(false);
  });

  it('elimina els espais sobrants', () => {
    const r = parseShirtForm({ ...base, teamName: '  Dinamarca ', brand: ' Adidas ' });
    expect(r.ok && r.data.teamName).toBe('Dinamarca');
    expect(r.ok && r.data.brand).toBe('Adidas');
  });
});
