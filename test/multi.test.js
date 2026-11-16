const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const assert = require('assert');
const E = require('../js/engine.js');

const dictJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dictionaries.json'), 'utf8'));
const D = E.loadDict(dictJson);

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name} ->`, err.message);
  }
}

// 1. Test role detection
test('E.detectFileRole recognizes keywords', () => {
  assert.strictEqual(E.detectFileRole('inscrits_2026.pdf'), 'inscriptions');
  assert.strictEqual(E.detectFileRole('famille_et_contacts.xlsx'), 'contacts');
  assert.strictEqual(E.detectFileRole('ListEleve ARABE BOTI.xlsx'), 'massar');
  assert.strictEqual(E.detectFileRole('random.csv'), 'generic');
});

// 2. Test Arabic transliteration
test('E.translitArToFr transliterates names accurately', () => {
  const tr1 = E.translitArToFr('عشاكي مصطفى', D);
  assert.ok(tr1.includes('ACHAGUI') || tr1.includes('MOSTAFA'));
  const tr2 = E.translitArToFr('الادريسي إسراء', D);
  assert.ok(tr2.includes('IDRISSI'));
});

// 3. Test contact phone parsing
test('E.parseContactPhones extracts Moroccan mobile & secondary phones', () => {
  const c = {
    resp: 'PÈRE P: 06 61 11 12 91 M: 05 23 33 44 55',
    conj: 'MÈRE P: 06 73 21 12 13'
  };
  const parsed = E.parseContactPhones(c);
  assert.strictEqual(parsed.gsm_papa, '06 61 11 12 91');
  assert.strictEqual(parsed.autre_tel_papa, '05 23 33 44 55');
  assert.strictEqual(parsed.gsm_maman, '06 73 21 12 13');
  assert.strictEqual(parsed.nom_papa, 'Père');
  assert.strictEqual(parsed.nom_maman, 'Mère');
});

// 4. Test multi reconciliation on sample dataset
test('E.reconcileMulti fuses inscriptions, contacts, and massar correctly', () => {
  const inscriptions = [
    { matricule: '1001', nom_complet: 'ACHAGUI MOSTAFA', classe_ecole: 'PS-1', date_inscription: '01/09/2026' },
    { matricule: '1002', nom_complet: 'EL MANSOURI IMRANE', classe_ecole: 'PS-1', date_inscription: '02/09/2026' },
    { matricule: '1003', nom_complet: 'NOUVEL ELEVE ECOLE', classe_ecole: 'PS-1', date_inscription: '03/09/2026' }
  ];
  const contacts = [
    { matricule: '1001', resp: 'PÈRE P: 0661111291', conj: 'MÈRE P: 0670001122' },
    { matricule: '1002', resp: 'PÈRE P: 0662223344' }
  ];
  const massar = [
    { cne: 'F261050194', nom_ar: 'عشاكي', prenom_ar: 'مصطفى', genre: 'Garçon', date_naiss: '2023/09/02', classe_massar: 'DEPE-1' },
    { cne: 'F261085317', nom_ar: 'المنصوري', prenom_ar: 'عمران', genre: 'Garçon', date_naiss: '2023/05/10', classe_massar: 'DEPE-1' },
    { cne: 'F999999999', nom_ar: 'قديم', prenom_ar: 'تلميذ', genre: 'Garçon', date_naiss: '2023/01/01', classe_massar: 'DEPE-1' }
  ];

  const result = E.reconcileMulti([
    { role: 'inscriptions', rows: inscriptions },
    { role: 'contacts', rows: contacts },
    { role: 'massar', rows: massar }
  ], D);

  assert.strictEqual(result.stats.total, 4); // 2 matched + 1 ecole seule + 1 massar seul
  assert.strictEqual(result.stats.ok, 2);
  assert.strictEqual(result.stats.ecoleSeule, 1);
  assert.strictEqual(result.stats.massarSeul, 1);

  const matchedAchagui = result.rows.find(r => r.matricule === '1001');
  assert.ok(matchedAchagui);
  assert.strictEqual(matchedAchagui.code_massar, 'F261050194');
  assert.strictEqual(matchedAchagui.gsm_papa, '06 61 11 12 91');
  assert.strictEqual(matchedAchagui.gsm_maman, '06 70 00 11 22');
  assert.strictEqual(matchedAchagui.statut, 'OK');

  const xlsxBuf = E.exportMulti(XLSX, result);
  const size = xlsxBuf ? (xlsxBuf.byteLength || xlsxBuf.length || 0) : 0;
  assert.ok(size > 0);
  const testWb = XLSX.read(xlsxBuf, { type: 'array' });
  assert.deepStrictEqual(testWb.SheetNames, ['Élèves & Parents', 'À vérifier', 'Notes']);
});

console.log(`Multi-Reconciliation : ${passed}/${passed + failed} réussis, ${failed} échecs`);
if (failed > 0) process.exit(1);
