import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, toCsv } from '../src/lib/csv';

describe('parseCsv', () => {
  it('llegeix un CSV simple i ignora el BOM', () => {
    expect(parseCsv('﻿a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('gestiona cometes, cometes dobles i salts de línia dins de camps', () => {
    const rows = parseCsv('x,y\n"a, b","diu ""hola""\nlínia 2"\n');
    expect(rows[1]).toEqual(['a, b', 'diu "hola"\nlínia 2']);
  });
  it('detecta punt i coma i tabulador', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('accepta CRLF i CR i descarta files buides', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('conserva els camps buits', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
  });
});

describe('toCsv', () => {
  it('cita només quan cal i fa anada i tornada', () => {
    const rows = [['a', 'b,c', 'd"e', 'línia\n2'], ['1', '', '3', '4']];
    const csv = toCsv(rows);
    expect(csv).toContain('"b,c"');
    expect(parseCsv(csv)).toEqual(rows);
  });
  it('escriu null com a buit', () => {
    expect(toCsv([[null, 5, 'x']])).toBe(',5,x');
  });
});
