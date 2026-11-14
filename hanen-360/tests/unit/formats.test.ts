import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from '../../src/lib/csv';
import { readXlsx, writeXlsx } from '../../src/lib/xlsx';
import { buildPdf } from '../../src/lib/pdf';
import { validate, normaliseDate } from '../../src/lib/http';
import { totp, base32Encode, base32Decode, hashPassword, verifyPassword, passwordProblems } from '../../src/lib/crypto';
import { mapHeaders, ENTITIES } from '../../src/api/entities';
import { extractPlainText } from '../../src/jobs/email';

describe('CSV', () => {
  it('parses French Excel exports (semicolon, quotes, BOM)', () => {
    const rows = parseCsv('﻿fournisseur;prix;notes\r\n"Papiers du Sahel";"1 250,5";"dit ""ok""; urgent"\r\n');
    expect(rows).toEqual([['fournisseur', 'prix', 'notes'], ['Papiers du Sahel', '1 250,5', 'dit "ok"; urgent']]);
  });
  it('round-trips', () => {
    expect(parseCsv(toCsv([['a', 'b;c'], [1, 'x"y']]))).toEqual([['a', 'b;c'], ['1', 'x"y']]);
  });
});

describe('XLSX', () => {
  it('writes a workbook that it can read back', async () => {
    const bytes = writeXlsx([{ name: 'Offres', rows: [['grade', 'prix', 'note'], ['SWL', 1250.5, 'é & <ok>'], ['HWS', 990, null]] }]);
    const rows = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(rows).toEqual([['grade', 'prix', 'note'], ['SWL', '1250.5', 'é & <ok>'], ['HWS', '990']]);
  });
});

describe('PDF', () => {
  it('produces a valid PDF structure with xref', () => {
    const pdf = buildPdf('Test', [{ kind: 'h1', text: 'Rapport coût PM1 — économie' }, { kind: 'table', rows: [['A', 'B'], [1, 'deux']] }, ...Array.from({ length: 80 }, (_, i) => ({ kind: 'p' as const, text: `ligne ${i}` }))]);
    const s = new TextDecoder('latin1').decode(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toMatch(/\/Count [2-9]/);
    const xref = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(xref, xref + 4)).toBe('xref');
  });
});

describe('validation', () => {
  it('coerces French numbers and dates and reports errors', () => {
    const { value, errors } = validate(ENTITIES.offers.schema, { supplier_id: '3', category: 'recovered', grade: 'SWL', offer_date: '14/11/2026', price: '1 250,50', currency: 'EUR', moisture_pct: 'abc' });
    expect(value.price).toBe(1250.5);
    expect(value.offer_date).toBe('2026-11-14');
    expect(errors.moisture_pct).toBeDefined();
    expect(normaliseDate('2026-02-30')).toBeNull();
    expect(normaliseDate('46000')).toBe('2025-12-09');
  });
  it('maps French spreadsheet headers', () => {
    expect(mapHeaders(ENTITIES.production, ['Machine', 'Début', 'Fin', 'Tonnage vendable', 'kWh', 'colonne inconnue'])).toEqual(['machine', 'period_start', 'period_end', 'saleable_t', 'electricity_kwh', null]);
  });
});

describe('crypto', () => {
  it('TOTP matches RFC 6238 test vector (SHA-1)', async () => {
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    expect(base32Decode(secret)).toEqual(new TextEncoder().encode('12345678901234567890'));
    expect(await totp(secret, 59 * 1000)).toBe('287082');
    expect(await totp(secret, 1111111109 * 1000)).toBe('081804');
  });
  it('hashes and verifies passwords', async () => {
    const h = await hashPassword('Correct-Horse-9');
    expect(await verifyPassword('Correct-Horse-9', h.hash, h.salt, h.iterations)).toBe(true);
    expect(await verifyPassword('wrong', h.hash, h.salt, h.iterations)).toBe(false);
    expect(passwordProblems('short')).not.toBeNull();
    expect(passwordProblems('alllowercaseletters')).not.toBeNull();
    expect(passwordProblems('Azur-Papier-2026')).toBeNull();
  });
});

describe('email', () => {
  it('extracts the text/plain part of a multipart quotation email', () => {
    const raw = 'Subject: Offre SWL\r\nContent-Type: multipart/alternative; boundary="b1"\r\n\r\n--b1\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nPrix SWL : 1 180 TND/t, validit=C3=A9 30 jours\r\n--b1\r\nContent-Type: text/html\r\n\r\n<p>x</p>\r\n--b1--';
    expect(extractPlainText(raw)).toContain('validité 30 jours');
  });
});
