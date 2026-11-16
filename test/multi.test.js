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

// 5. Test arbitrary multi-file consolidation with extra custom columns
test('E.reconcileMulti consolidates arbitrary multi-files with custom extra columns', () => {
  const fileStudents = [
    { Matricule: '2001', 'Nom complet': 'ALAMI MOHAMED', Classe: 'CP-A' },
    { Matricule: '2002', 'Nom complet': 'BENANI HOUDA', Classe: 'CP-B' }
  ];
  const fileContacts = [
    { Matricule: '2001', 'Tél Père': '06 61 00 11 22', 'Tél Mère': '06 70 33 44 55' },
    { Matricule: '2002', 'Tél Mère': '06 65 77 88 99' }
  ];
  const fileTransport = [
    { Matricule: '2001', 'Ligne Bus': 'Ligne 12 - Racine', 'Arrêt Bus': 'Clinique Badr' },
    { Matricule: '2002', 'Ligne Bus': 'Ligne 04 - Oasis' }
  ];

  const result = E.reconcileMulti([
    { name: 'eleves.xlsx', rows: fileStudents },
    { name: 'contacts.xlsx', rows: fileContacts },
    { name: 'transport.xlsx', rows: fileTransport }
  ], D);

  assert.strictEqual(result.stats.total, 2);
  const r1 = result.rows.find(r => r.matricule === '2001');
  assert.ok(r1);
  assert.strictEqual(r1.gsm_papa, '06 61 00 11 22');
  assert.strictEqual(r1.extra['Ligne Bus'], 'Ligne 12 - Racine');

  const xlsxBuf = E.exportMulti(XLSX, result);
  const wb = XLSX.read(xlsxBuf, { type: 'array' });
  const s1Rows = XLSX.utils.sheet_to_json(wb.Sheets['Élèves & Parents']);
  assert.ok(Object.keys(s1Rows[0]).includes('Ligne Bus'));
});

// 6. Test multi-file consolidation with custom output template projection
test('E.exportMulti with custom output template projects consolidated records onto template', () => {
  const fileStudents = [
    { Matricule: '3001', 'Nom complet': 'BENJELLOUN SAMI', Classe: 'EB-1' },
    { Matricule: '3002', 'Nom complet': 'TAZI LINA', Classe: 'EB-2' }
  ];
  const fileContacts = [
    { Matricule: '3001', 'Tél Père': '06 61 11 22 33', 'Tél Mère': '06 70 44 55 66' },
    { Matricule: '3002', 'Tél Père': '06 62 99 88 77' }
  ];
  const fileTransport = [
    { Matricule: '3001', 'Ligne Bus': 'Bus 05 - Anfa' },
    { Matricule: '3002', 'Ligne Bus': 'Bus 08 - Gauthier' }
  ];

  const result = E.reconcileMulti([
    { name: 'eleves.xlsx', rows: fileStudents },
    { name: 'contacts.xlsx', rows: fileContacts },
    { name: 'transport.xlsx', rows: fileTransport }
  ], D);

  // Create custom target template
  const tplHeaders = ['Matricule', 'Prénom', 'Nom', 'Classe', 'Téléphone Père', 'Téléphone Mère', 'Ligne Bus'];
  const tplWb = XLSX.utils.book_new();
  const tplWs = XLSX.utils.aoa_to_sheet([tplHeaders]);
  XLSX.utils.book_append_sheet(tplWb, tplWs, 'Eleves');

  const tplInfo = E.templateInfo(XLSX, tplWb, D);
  assert.ok(tplInfo.headers.includes('Matricule'));

  // Project to template
  const projected = E.projectToTemplate(result.rows, tplInfo, D);
  assert.strictEqual(projected.length, 2);
  assert.strictEqual(projected[0].v['matricule'], '3001');
  assert.strictEqual(projected[0].v['nom'], 'BENJELLOUN');
  assert.strictEqual(projected[0].v['prenom'], 'SAMI');
  assert.strictEqual(projected[0].v['papa_tel'], '06 61 11 22 33');
  assert.strictEqual(projected[0].v['raw:ligne bus'], 'Bus 05 - Anfa');

  // Export with template
  const outBuf = E.exportMulti(XLSX, result, tplInfo, tplWb, D);
  const size = outBuf ? (outBuf.byteLength || outBuf.length || 0) : 0;
  assert.ok(size > 0);

  const outWb = XLSX.read(outBuf, { type: 'array' });
  assert.deepStrictEqual(outWb.SheetNames, ['Eleves']);
  const outRows = XLSX.utils.sheet_to_json(outWb.Sheets['Eleves']);
  assert.strictEqual(outRows.length, 2);
  assert.strictEqual(outRows[0]['Matricule'], '3001');
  assert.strictEqual(outRows[0]['Prénom'], 'SAMI');
  assert.strictEqual(outRows[0]['Nom'], 'BENJELLOUN');
  assert.strictEqual(outRows[0]['Classe'], 'EB-1');
  assert.strictEqual(outRows[0]['Téléphone Père'], '06 61 11 22 33');
  assert.strictEqual(outRows[0]['Ligne Bus'], 'Bus 05 - Anfa');
});

console.log(`Multi-Reconciliation : ${passed}/${passed + failed} réussis, ${failed} échecs`);
if (failed > 0) process.exit(1);
