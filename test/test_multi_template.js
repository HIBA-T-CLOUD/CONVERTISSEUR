const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const assert = require('assert');
const E = require('../js/engine.js');

const dictJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dictionaries.json'), 'utf8'));
const D = E.loadDict(dictJson);

console.log('--- TEST: MULTI-FILE TO CUSTOM OUTPUT TEMPLATE ---');

// 1. Create a custom Boti output template workbook in memory
const tplHeaders = ['Matricule', 'Prénom', 'Nom', 'Classe', 'Téléphone Père', 'Téléphone Mère', 'Date de Naissance', 'Ligne Bus'];
const tplWb = XLSX.utils.book_new();
const tplWs = XLSX.utils.aoa_to_sheet([tplHeaders]);
XLSX.utils.book_append_sheet(tplWb, tplWs, 'Eleves');

const tplInfo = E.templateInfo(XLSX, tplWb, D);
console.log('Detected template keys:', tplInfo.keys);

// 2. Multi-source files: Inscriptions + Contacts + Transport
const sources = [
  {
    name: 'inscrits.xlsx',
    rows: [
      { Matricule: '3001', 'Nom complet': 'BENJELLOUN SAMI', Classe: 'EB-1' },
      { Matricule: '3002', 'Nom complet': 'TAZI LINA', Classe: 'EB-2' }
    ]
  },
  {
    name: 'contacts.xlsx',
    rows: [
      { Matricule: '3001', 'Tél Père': '06 61 11 22 33', 'Tél Mère': '06 70 44 55 66' },
      { Matricule: '3002', 'Tél Père': '06 62 99 88 77' }
    ]
  },
  {
    name: 'transport.xlsx',
    rows: [
      { Matricule: '3001', 'Ligne Bus': 'Bus 05 - Anfa' },
      { Matricule: '3002', 'Ligne Bus': 'Bus 08 - Gauthier' }
    ]
  }
];

// Enhanced getFld for testing
function getFld(obj, ...candidates) {
  if (!obj || typeof obj !== 'object') return '';
  const candNorm = candidates.map(c => E.norm(c));
  for (let [k, v] of Object.entries(obj)) {
    if (v == null || String(v).trim() === '') continue;
    const nk = E.norm(k);
    if (candNorm.some(cn => cn === nk || nk.replace(/\s+/g, '_') === cn || cn.replace(/\s+/g, '_') === nk)) {
      return String(v).trim();
    }
    if (D) {
      const rec = E.recognize(k, D);
      if (rec) {
        const rk = E.norm(rec.key);
        if (candNorm.some(cn => cn === rk || rk.replace(/\s+/g, '_') === cn || cn.replace(/\s+/g, '_') === rk)) {
          return String(v).trim();
        }
      }
    }
  }
  return '';
}

// Ingest sources
const entMap = new Map();
for (let s of sources) {
  for (let r of s.rows) {
    const mat = getFld(r, 'matricule');
    if (!mat) continue;
    let ent = entMap.get(mat);
    if (!ent) {
      const nom_comp = getFld(r, 'nom_complet');
      const seg = nom_comp ? E.segment(nom_comp, D) : { nom: '', prenom: '' };
      ent = {
        matricule: mat,
        nom_complet: nom_comp,
        nom_fr: seg.nom,
        prenom_fr: seg.prenom,
        classe_ecole: getFld(r, 'classe'),
        gsm_papa: getFld(r, 'papa_tel', 'gsm_papa'),
        gsm_maman: getFld(r, 'maman_tel', 'gsm_maman'),
        extra: {}
      };
      entMap.set(mat, ent);
    } else {
      if (!ent.classe_ecole) ent.classe_ecole = getFld(r, 'classe');
      if (!ent.gsm_papa) ent.gsm_papa = getFld(r, 'papa_tel', 'gsm_papa');
      if (!ent.gsm_maman) ent.gsm_maman = getFld(r, 'maman_tel', 'gsm_maman');
    }
    // extra fields
    for (let [k, v] of Object.entries(r)) {
      if (!['matricule','nom complet','classe','tél père','tél mère'].includes(E.norm(k))) {
        ent.extra[k] = String(v).trim();
      }
    }
  }
}

const entities = Array.from(entMap.values());
console.log('Entities parsed:', entities);

// Project to template
const projected = entities.map((ent, idx) => {
  const v = {};
  for (let i = 0; i < tplInfo.keys.length; i++) {
    const k = tplInfo.keys[i];
    const h = tplInfo.headers[i];
    let val = '';
    if (k === 'matricule') val = ent.matricule;
    else if (k === 'nom') val = ent.nom_fr;
    else if (k === 'prenom') val = ent.prenom_fr;
    else if (k === 'classe') val = ent.classe_ecole;
    else if (k === 'papa_tel') val = ent.gsm_papa;
    else if (k === 'maman_tel') val = ent.gsm_maman;
    else if (ent.extra && ent.extra[h] != null) val = ent.extra[h];
    v[k] = val != null ? String(val) : '';
  }
  return { i: idx, v, status: 'valide', score: 95 };
});

console.log('Projected to template:', projected[0].v);
assert.strictEqual(projected[0].v.matricule, '3001');
assert.strictEqual(projected[0].v.nom, 'BENJELLOUN');
assert.strictEqual(projected[0].v.prenom, 'SAMI');
assert.strictEqual(projected[0].v.classe, 'EB-1');
assert.strictEqual(projected[0].v.papa_tel, '06 61 11 22 33');
assert.strictEqual(projected[0].v.maman_tel, '06 70 44 55 66');
assert.strictEqual(projected[0].v['raw:ligne bus'], 'Bus 05 - Anfa');

// Export using E.export
const outBuf = E.export(XLSX, tplWb, tplInfo, projected, null);
const outWb = XLSX.read(outBuf, { type: 'array' });
const sRows = XLSX.utils.sheet_to_json(outWb.Sheets['Eleves']);
console.log('Exported sheet rows:', sRows);

assert.strictEqual(sRows.length, 2);
assert.strictEqual(sRows[0]['Matricule'], '3001');
assert.strictEqual(sRows[0]['Prénom'], 'SAMI');
assert.strictEqual(sRows[0]['Nom'], 'BENJELLOUN');
assert.strictEqual(sRows[0]['Classe'], 'EB-1');
assert.strictEqual(sRows[0]['Téléphone Père'], '06 61 11 22 33');
assert.strictEqual(sRows[0]['Téléphone Mère'], '06 70 44 55 66');
assert.strictEqual(sRows[0]['Ligne Bus'], 'Bus 05 - Anfa');

console.log('TEST PASSED! Custom template output for multi-files verified!');
