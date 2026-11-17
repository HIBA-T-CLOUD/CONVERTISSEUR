(function (g) {
  const E = {};
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().replace(/['’\-_.:\/()]+/g, ' ').replace(/[^a-z0-9\u0600-\u06FF ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lev = (a, b) => { const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++)c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c } return p[n] };
  const sim = (a, b) => a || b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0;
  E.norm = norm; E.sim = sim;
  E.loadDict = j => { const _r = E._loadDict(j); E._lastD = _r; return _r; };
  E._loadDict = j => {
    const S = a => new Set(a.map(norm));
    const syn = []; for (const k in j.fields) j.fields[k].forEach(s => syn.push({ k, s: norm(s) }));
    return { syn, extra: new Map(), f: S([...j.first_names_fr, ...j.first_names_en, ...j.first_names_ar]), c: S(j.compound_first_names), s: S(j.moroccan_surnames), p: S(j.name_prefixes), ar_fr_names: j.ar_fr_names || null }
  };
  const isAr = x => { const t = String(x); const a = (t.match(/[\u0600-\u06FF]/g) || []).length, l = (t.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF]/g) || []).length; return l > 0 && a / l > .5 }; E.isAr = isAr;
  const PAR = /(^| )(pere|mere|parent|parents|tuteur|tutrice|father|mother|guardian|papa|maman|ولي|الاب|الام|الوالد|الوالده)( |$)/;
  E.owner = t => { const n = norm(t); if (/(^| )(pere|papa|father|dad|الاب|الوالد)( |$)/.test(n)) return 'papa'; if (/(^| )(mere|maman|mother|mom|الام|الوالده)( |$)/.test(n)) return 'maman'; const m = n.match(/(^| )parents? ([12])( |$)/); return m ? (m[2] === '1' ? 'papa' : 'maman') : null };
  E.recognize = (h, D) => {
    const n = norm(h); if (!n) return null;
    if (D.extra.has(n)) return { key: D.extra.get(n), score: 1, method: 'intitulé identique au modèle' };
    let best = null;
    for (const { k, s } of D.syn) {
      let sc = 0, m = '';
      if (n === s) { sc = 1; m = 'correspondance exacte' }
      else if ((' ' + n + ' ').includes(' ' + s + ' ')) { sc = .7 + .18 * s.length / n.length; m = 'contenu' }
      else { let x = sim(n, s) * .92; if (n.length >= 3 && n.split('').sort().join('') === s.split('').sort().join('')) x = Math.max(x, .8); if (x >= .75) { sc = x; m = 'fuzzy' } }
      if (sc && (!best || sc > best.score || (sc === best.score && s.length > best.l))) best = { key: k, score: +sc.toFixed(2), method: m, l: s.length }
    }
    if (!best) return null; let key = best.key, note = '';
    if (PAR.test(n)) {
      const o = E.owner(h), b = key === 'tel_parent' ? 'telephone' : key === 'nom_parent' ? 'nom_complet' : key;
      if (o && ['telephone', 'nom_complet', 'nom', 'prenom', 'email', 'cin', 'fonction'].includes(b)) { key = o + '_' + (b === 'telephone' ? 'tel' : b); note = /parents? [12]/.test(n) ? ' + ' + (o === 'papa' ? 'parent 1 = papa (supposé)' : 'parent 2 = maman (supposé)') : ' + ' + o }
      else if (b === 'telephone') key = 'tel_parent'; else if (['nom', 'prenom', 'nom_complet'].includes(b)) key = 'nom_parent'
    }
    else if (/(^| )(ar|arabe|arabic)( |$)/.test(n) && ['nom_complet', 'nom', 'prenom'].includes(key)) key += '_ar';
    return { key, score: best.score, method: best.method + note }
  };
  E.readSheet = (X, ws) => {
    const rg = X.utils.decode_range(ws['!ref'] || 'A1'); rg.s.r = 0; rg.s.c = 0; const a = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true, range: rg });
    (ws['!merges'] || []).forEach(m => { const v = (a[m.s.r] || [])[m.s.c]; for (let r = m.s.r; r <= m.e.r; r++) { a[r] = a[r] || []; for (let c = m.s.c; c <= m.e.c; c++)if (!(r === m.s.r && c === m.s.c)) a[r][c] = v } }); return a
  };
  E.detectHeader = (a, D) => {
    let best = -1e9, br = -1, low = false;
    for (let r = 0; r < Math.min(40, a.length); r++) {
      const st = (a[r] || []).filter(x => typeof x === 'string' && x.trim()); if (st.length < 2) continue;
      const rec = st.filter(c => E.recognize(c, D)).length; const nx = (a[r + 1] || []).filter(x => x !== '').length;
      const sc = rec * 3 + st.length * .5 - (nx ? 0 : 5); if (sc > best) { best = sc; br = r; low = rec === 0 }
    }
    return { row: br, lowConfidence: low }
  };
  const PH = /^(\+?212|0)?[5-7]\d{8}$/, DT = /^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$/;
  E.analyzeSheet = (X, wb, name, D, forceRow) => {
    const a = E.readSheet(X, wb.Sheets[name]); const h = forceRow != null ? { row: forceRow, lowConfidence: false } : E.detectHeader(a, D);
    if (h.row < 0) return { sheet: name, headerRow: -1, headers: [], rows: [], mapping: [], score: 0 };
    const hd = (a[h.row] || []).map(x => String(x).trim()); const rows = a.slice(h.row + 1).filter(r => r.some(x => String(x).trim() !== ''));
    const used = {}; const mapping = []; let rec = 0;
    hd.forEach((H, i) => {
      if (!H) return; let r = E.recognize(H, D); const vals = rows.slice(0, 30).map(r => String(r[i] ?? '').replace(/\s/g, '')).filter(Boolean);
      if (!r && vals.length) {
        const ph = vals.filter(v => PH.test(v.replace(/[.\-]/g, ''))).length / vals.length, dt = vals.filter(v => DT.test(v)).length / vals.length, em = vals.filter(v => /^\S+@\S+\.\S+$/.test(v)).length / vals.length;
        if (ph > .7) r = { key: 'telephone', score: .6, method: 'contenu : téléphones' };
        else if (dt > .7) { const isEntry = /(entree|entrée|inscription|admission|arrivee|arrivée|debut|début|scolar|دخول|التحاق|تسجيل)/i.test(H) || mapping.some(m => m.key === 'date_naissance'); r = isEntry ? { key: 'date_inscription', score: .75, method: 'contenu : date d\'entrée / inscription' } : { key: 'date_naissance', score: .6, method: 'contenu : dates' } }
        else if (em > .7) r = { key: 'email', score: .65, method: 'contenu : emails' }
      }
      if (r) rec++; mapping.push({ col: i, header: H, key: r ? r.key : '', score: r ? r.score : 0, method: r ? r.method : 'non reconnue', sample: vals.slice(0, 3) })
    });
    mapping.forEach(m => { if (!m.key) return; if (used[m.key] != null) { const o = mapping.find(x => x.col === used[m.key]); if (m.score > o.score) { o.key = ''; o.method = 'doublon de cible'; used[m.key] = m.col } else { m.key = ''; m.method = 'doublon de cible' } } else used[m.key] = m.col });
    const idc = mapping.filter(m => /(^|_)(nom_complet|nom|prenom|massar|matricule)(_ar)?$/.test(m.key)).map(m => m.col); let ign = 0;
    const kept = idc.length ? rows.filter(r => { if (!idc.some(c => String(r[c] ?? '').trim() !== '') && r.filter(x => String(x).trim() !== '').length <= 2) { ign++; return false } return true }) : rows;
    const rawSheet = wb.Sheets[name] || {}; let headerStyle = null; const colStyles = [];
    const headerRowHeight = (rawSheet['!rows'] && rawSheet['!rows'][h.row]) ? rawSheet['!rows'][h.row] : null;
    for (let c = 0; c < hd.length; c++) { const cell = rawSheet[X.utils.encode_cell({ r: h.row, c })], s = cell && cell.s ? cell.s : null; colStyles[c] = s; if (!headerStyle && s && (s.fill || s.fgColor || s.font)) headerStyle = s }
    return { sheet: name, headerRow: h.row, lowConfidence: h.lowConfidence, headers: hd, rows: kept, ignored: ign, raw: a, mapping, headerStyle, colStyles, headerRowHeight, score: rec * 3 + kept.length / 1e4 }
  };
  E.analyze = (X, wb, D, sheet, forceRow) => { const names = sheet ? [sheet] : wb.SheetNames; const r = names.map(n => E.analyzeSheet(X, wb, n, D, forceRow)); r.sort((a, b) => b.score - a.score); r[0].allSheets = wb.SheetNames; return r[0] };
  E.templateInfo = (X, wb, D, prefSheet) => {
    let pick = prefSheet; if (!pick && wb.SheetNames && wb.SheetNames.length > 1) { pick = wb.SheetNames.find(s => /élèves|eleves|inscrits/i.test(s)); } const t = E.analyze(X, wb, D, pick), a = t.raw, hr = t.headerRow;
    const base = t.headers.map(h => { const r = h && E.recognize(h, D); return r ? r.key : '' }), cnt = {}; base.forEach(k => { if (k) cnt[k.replace(/_ar$/, '')] = (cnt[k.replace(/_ar$/, '')] || 0) + 1 });
    const grp = []; let cur = ''; (hr > 0 ? a[hr - 1] || [] : []).forEach((x, i) => { const q = String(x || '').trim(); if (q) cur = q; grp[i] = cur });
    t.keys = t.headers.map((h, i) => {
      if (!h) return ''; let k = base[i]; if (!k) return 'raw:' + norm(h);
      if (isAr(h) && ['nom', 'prenom', 'nom_complet'].includes(k)) k += '_ar';
      const b = k.replace(/_ar$/, ''); if (cnt[b] > 1 && grp[i]) { const o = E.owner(grp[i]) || norm(grp[i]).replace(/ /g, '_'); return o + '_' + (b === 'telephone' ? 'tel' : b) + (k.endsWith('_ar') ? '_ar' : '') } return k
    });
    t.labels = t.headers.map((h, i) => grp[i] && t.keys[i].includes('_') && /^(papa|maman)_/.test(t.keys[i]) ? grp[i] + ' · ' + h : h); return t
  };
  E.useTemplateKeys = (D, t) => { t.headers.forEach((h, i) => { if (h && t.keys[i].startsWith('raw:')) D.extra.set(norm(h), t.keys[i]) }) };
  E.looksLikeTemplateName = name => /modele|mod[eè]le|template|canevas|cible|output|boti.*(eleve|parent)/i.test(String(name || ''));
  E.scoreAsTemplate = (X, wb, D) => {
    const t = E.analyze(X, wb, D);
    const dataRows = (t.rows || []).length;
    const rec = (t.mapping || []).filter(m => m.key).length;
    let score = 0;
    if (dataRows === 0) score += 5;
    else if (dataRows <= 2) score += 3;
    else if (dataRows <= 5) score += 1;
    if (rec >= 8) score += 2;
    else if (rec >= 4) score += 1;
    if (t.headerRow >= 0 && rec >= 4 && dataRows < 8) score += 2;
    return { score, dataRows, rec, headerRow: t.headerRow };
  };
  E.segment = (full, D, opt) => {
    const raw = String(full || '').replace(/\s+/g, ' ').trim(), t = raw ? raw.split(' ') : [], n = t.map(norm);
    if (!t.length) return { prenom: '', nom: '', score: 0, method: 'vide', ambiguous: true };
    const iF = x => D.f.has(x), iS = x => D.s.has(x), iP = x => D.p.has(x);
    if (t.length === 1) { const isS = iS(n[0]); return { prenom: isS ? '' : raw, nom: isS ? raw : '', score: 35, method: 'mot unique : ' + (isS ? 'prénom absent' : 'nom de famille absent'), ambiguous: true } };
    const defaultOrder = (opt && opt.order) || 'nom_first';
    const up = x => /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]+$/.test(x), H = [];
    for (let k = 1; k < t.length; k++) {
      const pAr = t.slice(0, k), pAn = n.slice(0, k), pBr = t.slice(k), pBn = n.slice(k);
      const cA = D.c.has(pAn.join(' ')), cB = D.c.has(pBn.join(' '));
      const upA = pAr.every(up) && !pBr.some(up), upB = pBr.every(up) && !pAr.some(up);
      {
        let s = (defaultOrder === 'nom_first' ? 0.4 : 0); const w = [];
        if (pAn.length === 1 && iP(pAn[0])) s -= 5;
        if (upA) { s += 4; w.push('convention NOM Prénom (majuscules)') }
        if (cB) { s += 3; w.push('prénom composé connu') }
        if (cA) { s -= 3 }
        for (let i = 0; i < pAn.length; i++) { const x = pAn[i]; if (iP(x)) { s += (i === 0 ? 2.5 : 1); w.push('préfixe nom « ' + pAr[i] + ' »') } else if (iS(x)) { s += 1.8; w.push('nom connu') } else if (iF(x)) { s -= 1.2 } else if (/^(ال|بن)./.test(x) && x.length > 3) { s += 1.2; w.push('forme de nom') } }
        for (let i = 0; i < pBn.length; i++) { const x = pBn[i]; if (iP(x) && !cB) { s -= 2.5 } else if (iF(x)) { s += 1.5; w.push('prénom connu') } else if (iS(x)) { s -= 1 } }
        s += (k === 1 ? 0.2 : k === 2 ? 0.1 : -0.5 * (k - 2));
        H.push({ order: 'nom_first', k, s, nom: pAr.join(' '), prenom: pBr.join(' '), why: w })
      }
      {
        let s = (defaultOrder === 'prenom_first' ? 0.4 : 0); const w = [];
        if (pBn.length === 1 && iP(pBn[0])) s -= 5;
        if (upB) { s += 4; w.push('convention Prénom NOM (majuscules)') }
        if (cA) { s += 3; w.push('prénom composé connu') }
        if (cB) { s -= 3 }
        for (let i = 0; i < pAn.length; i++) { const x = pAn[i]; if (iP(x) && !cA) { s -= 3; w.push('préfixe dans le prénom') } else if (iF(x)) { s += 1.5; w.push('prénom connu') } else if (iS(x)) { s -= 1.2 } }
        for (let i = 0; i < pBn.length; i++) { const x = pBn[i]; if (iP(x)) { s += (i === 0 ? 2.5 : 1); w.push('préfixe nom « ' + pBr[i] + ' »') } else if (iS(x)) { s += 1.8; w.push('nom connu') } else if (iF(x)) { s -= 1.2 } else if (/^(ال|بن)./.test(x) && x.length > 3) { s += 1.2; w.push('forme de nom') } }
        const pl = pAr.length; s += (pl === 1 ? 0.2 : pl === 2 ? 0.1 : -0.5 * (pl - 2));
        H.push({ order: 'prenom_first', k, s, nom: pBr.join(' '), prenom: pAr.join(' '), why: w })
      }
    }
    H.sort((a, b) => b.s - a.s); const b = H[0], margin = b.s - (H[1] ? H[1].s : b.s - 3);
    const known = n.filter(x => iF(x) || iS(x) || iP(x)).length; let sc = Math.min(98, Math.max(10, Math.round(45 + margin * 8 + known * 8)));
    const amb = margin < 1.0 || known === 0; if (amb) sc = Math.min(sc, 65);
    const alt = H[1] ? { prenom: H[1].prenom, nom: H[1].nom } : null;
    return { prenom: b.prenom, nom: b.nom, score: sc, method: (b.why.join(', ') || (b.order === 'nom_first' ? 'convention NOM Prénom' : 'convention Prénom NOM')) + ' ; ' + H.length + ' hypothèse(s)', ambiguous: amb, alt, order: b.order }
  };
  E.parseDate = v => {
    let d, m, y, warn = '';
    if (typeof v === 'number' && v > 20000 && v < 60000) { const D = new Date(Math.round((v - 25569) * 864e5)); d = D.getUTCDate(); m = D.getUTCMonth() + 1; y = D.getUTCFullYear() }
    else {
      const s = String(v).trim(); let x = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/); if (x) { y = +x[1]; m = +x[2]; d = +x[3] }
      else if (x = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)) { d = +x[1]; m = +x[2]; y = +x[3]; if (y < 100) y += y > 30 ? 1900 : 2000; if (d <= 12 && m <= 12 && d !== m) warn = 'format jj/mm supposé' } else return { err: 'date illisible' }
    }
    const T = new Date(Date.UTC(y, m - 1, d)); if (m < 1 || m > 12 || T.getUTCDate() !== d) return { err: 'date invalide' };
    const val = String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
    return { val, warn: (y < 1990 || y > new Date().getFullYear()) ? 'année peu plausible' : warn }
  };
  E.parsePhone = v => { let s = String(v).replace(/[^\d+]/g, ''); s = s.replace(/^00212/, '').replace(/^\+?212/, ''); if (/^[5-7]\d{8}$/.test(s)) s = '0' + s; return /^0[5-7]\d{8}$/.test(s) ? { val: s } : { val: String(v).trim(), err: 'téléphone invalide' } };
  E.isBlank = v => v == null || String(v).trim() === '';
  E.isGenericParentName = xs => {
    const s = String(xs || '').trim();
    if (!s) return true;
    if (/(^|[^A-Za-z0-9])P\s?[12]([^A-Za-z0-9]|$)/.test(s)) return true;
    return /^(p[eè]re|m[eè]re|papa|maman)$/i.test(s);
  };
  E.applyParentNameDefaults = function (v, targetKeys) {
    if (!v) return v;
    const wants = k => !targetKeys || !targetKeys.length || targetKeys.includes(k);
    if (wants('papa_nom') && E.isBlank(v.papa_nom)) v.papa_nom = 'Père';
    if (wants('papa_prenom') && E.isBlank(v.papa_prenom)) v.papa_prenom = 'Père';
    if (wants('maman_nom') && E.isBlank(v.maman_nom)) v.maman_nom = 'Mère';
    if (wants('maman_prenom') && E.isBlank(v.maman_prenom)) v.maman_prenom = 'Mère';
    return v;
  };
  E.EMPTY_CELL_STYLE = {
    fill: { fgColor: { rgb: 'FFFBEB' }, patternType: 'solid' },
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: 'B45309' } },
    border: {
      top: { style: 'thin', color: { rgb: 'FDE68A' } },
      bottom: { style: 'thin', color: { rgb: 'FDE68A' } },
      left: { style: 'thin', color: { rgb: 'FDE68A' } },
      right: { style: 'thin', color: { rgb: 'FDE68A' } }
    }
  };
  E.extractParentNames = function (obj, D) {
    const res = { nom_papa: '', prenom_papa: '', nom_maman: '', prenom_maman: '' };
    if (!obj || typeof obj !== 'object') {
      return { nom_papa: 'Père', prenom_papa: 'Père', nom_maman: 'Mère', prenom_maman: 'Mère' };
    }
    const setPart = (role, part, val) => {
      if (E.isBlank(val) || E.isGenericParentName(val)) return;
      const xs = String(val).trim();
      const key = part + '_' + role;
      if (!res[key]) res[key] = xs;
    };
    const setComplet = (role, val) => {
      if (E.isBlank(val) || E.isGenericParentName(val)) return;
      const xs = String(val).trim();
      if (D) {
        const s = E.segment(xs, D, { order: 'nom_first' });
        if (!res['nom_' + role]) res['nom_' + role] = s.nom || xs;
        if (!res['prenom_' + role] && s.prenom) res['prenom_' + role] = s.prenom;
      } else if (!res['nom_' + role]) {
        res['nom_' + role] = xs;
      }
    };
    for (const [k, v] of Object.entries(obj)) {
      if (E.isBlank(v)) continue;
      const strH = String(k);
      if (/(t[ée]l|gsm|phone|mobile|contact|email|courriel|cin|fonction|profession)/i.test(strH)) continue;
      const rec = D ? E.recognize(strH, D) : null;
      const key = rec ? rec.key : '';
      if (key === 'papa_prenom' || /(pr[eé]nom.*(papa|p[eè]re)|(papa|p[eè]re).*pr[eé]nom)/i.test(strH)) setPart('papa', 'prenom', v);
      else if (key === 'maman_prenom' || /(pr[eé]nom.*(maman|m[eè]re)|(maman|m[eè]re).*pr[eé]nom)/i.test(strH)) setPart('maman', 'prenom', v);
      else if (/nom.*complet.*(papa|p[eè]re)|(papa|p[eè]re).*nom.*complet/i.test(strH)) setComplet('papa', v);
      else if (/nom.*complet.*(maman|m[eè]re)|(maman|m[eè]re).*nom.*complet/i.test(strH)) setComplet('maman', v);
      else if (key === 'papa_nom' || key === 'papa_nom_complet' || /(nom.*(papa|p[eè]re)|^(p[eè]re|papa)$)/i.test(strH)) setPart('papa', 'nom', v);
      else if (key === 'maman_nom' || key === 'maman_nom_complet' || /(nom.*(maman|m[eè]re)|^(m[eè]re|maman)$)/i.test(strH)) setPart('maman', 'nom', v);
    }
    // Règle : une seule colonne « Nom père / mère » contenant nom + prénom → séparation logique.
    const DD = D || E._lastD;
    ['papa', 'maman'].forEach(role => {
      const n = res['nom_' + role];
      if (DD && n && !res['prenom_' + role] && String(n).trim().split(/\s+/).length >= 2) {
        const sg = E.segment(n, DD, { order: 'nom_first' });
        if (sg.nom && sg.prenom) { res['nom_' + role] = sg.nom; res['prenom_' + role] = sg.prenom; }
      }
    });
    if (!res.nom_papa) res.nom_papa = 'Père';
    if (!res.prenom_papa) res.prenom_papa = 'Père';
    if (!res.nom_maman) res.nom_maman = 'Mère';
    if (!res.prenom_maman) res.prenom_maman = 'Mère';
    return res;
  };

  // Champs « directs » reconnus par en-tête (email/CIN/fonction des parents, adresse, ancien établissement).
  E.collectDirect = function (obj, D) {
    const out = {}; if (!obj || !D) return out;
    for (const [k, v] of Object.entries(obj)) {
      const x = String(v == null ? '' : v).trim(); if (!x) continue;
      const rec = E.recognize(k, D); if (!rec) continue;
      const m = rec.key.match(/^(papa|maman)_(email|cin|fonction)$/);
      if (m) { const f = m[2] + '_' + m[1]; if (!out[f]) out[f] = x; }
      else if (rec.key === 'adresse' && !out.adresse) out.adresse = x;
      else if (rec.key === 'ancien_etablissement' && !out.ancien_etablissement) out.ancien_etablissement = x;
    }
    return out;
  };
  const cnt = q => { const w = String(q || '').split(/\s+/).filter(Boolean); return w.filter((x, i) => !(['el', 'al'].includes(norm(x)) && i < w.length - 1)).length };
  E.build = (tbl, mapping, D, cfg) => {
    cfg = cfg || {}; const tk = cfg.targetKeys || [], req = (cfg.required || ['prenom', 'nom']).filter(k => !tk.length || tk.includes(k)), rows = [];
    const nameOrder = cfg.nameOrder || 'nom_first';
    const ord = k => k.endsWith('nom_complet') ? 1 : k.endsWith('nom_complet_ar') ? 2 : 0;
    const ms = [...mapping.filter(m => m.key)].sort((a, b) => ord(a.key) - ord(b.key));
    const lat = ms.find(m => m.key === 'nom_complet'); let capsFirst = false;
    if (lat) { const vs = tbl.rows.map(r => String(r[lat.col] ?? '').trim()).filter(x => x && !isAr(x)); capsFirst = vs.length > 0 && vs.filter(x => E.segment(x, D, { order: nameOrder }).order === 'nom_first').length / vs.length >= .5 }
    tbl.rows.forEach((r, ri) => {
      const v = {}, is = [], ns = [];
      ms.forEach(m => {
        const x = r[m.col]; if (x === '' || x == null || String(x).trim() === '') return; const k = m.key, P = (k.match(/^(papa_|maman_)/) || [''])[0], xs = String(x).trim();
        if (/nom_complet(_ar)?$/.test(k)) {
          if (P && /(^|[^A-Za-z0-9])P\s?[12]([^A-Za-z0-9]|$)/.test(xs)) { is.push({ lvl: 'avertissement', msg: 'nom de parent générique non transféré : ' + xs }); return }
          if (tk.includes(P + 'nom_complet') && !tk.includes(P + 'prenom')) { v[P + 'nom_complet'] = xs; return }
          const ar = isAr(xs) || k.endsWith('_ar'); let s;
          if (ar && tk.includes(P + 'prenom_ar')) {
            const t = xs.split(/\s+/), kf = cnt(v[P + 'prenom']), kn = cnt(v[P + 'nom']);
            if (kf && kn && t.length === kf + kn) s = capsFirst ? { prenom: t.slice(kn).join(' '), nom: t.slice(0, kn).join(' '), score: 85, method: 'alignement avec le nom latin (nom en premier)', ambiguous: false } : { prenom: t.slice(0, kf).join(' '), nom: t.slice(kf).join(' '), score: 85, method: 'alignement avec le nom latin', ambiguous: false };
            else { s = E.segment(xs, D, { order: nameOrder }); s.ambiguous = true; s.score = Math.min(s.score, 60); s.method += ' (ordre non vérifié)' }
            v[P + 'prenom_ar'] = s.prenom; v[P + 'nom_ar'] = s.nom
          }
          else { s = E.segment(xs, D, { order: nameOrder }); if (!v[P + 'prenom'] && !v[P + 'nom']) { v[P + 'prenom'] = s.prenom; v[P + 'nom'] = s.nom } }
          if (!P) ns.push(s.score); if (s.ambiguous) is.push({ lvl: 'info', msg: 'Segmentation ambiguë : ' + s.method })
        }
        else if (k === 'date_naissance' || k === 'date_inscription') { const p = E.parseDate(x); if (p.err) { is.push({ lvl: 'erreur', msg: p.err + ' : ' + x }); v[k] = xs } else { v[k] = p.val; if (p.warn) is.push({ lvl: 'avertissement', msg: p.warn }) } }
        else if (/(^|_)(telephone|tel|tel_parent)$/.test(k)) { const p = E.parsePhone(x); if (p.err) { is.push({ lvl: 'avertissement', msg: p.err + ' (' + k + ') : ' + xs }); v[k] = xs.replace(/\D/g, '').length >= 6 ? p.val : '' } else v[k] = p.val }
        else if (/(^|_)(prenom|nom)$/.test(k) && isAr(xs) && tk.includes(k + '_ar')) v[k + '_ar'] = xs;
        else v[k] = xs
      });
      E.applyParentNameDefaults(v, tk);
      req.forEach(k => { if (!v[k]) is.push({ lvl: 'erreur', msg: 'champ obligatoire absent : ' + k }) });
      const parts = [...ns, ...ms.filter(m => v[m.key] != null && !/nom_complet/.test(m.key)).map(m => m.score * 100)];
      rows.push({ i: ri, orig: tbl.headers.map((h, i) => r[i]), v, issues: is, nameScore: ns.length ? Math.min(...ns) : null, score: parts.length ? Math.round(Math.min(...parts)) : 0 })
    });
    const seen = {}; rows.forEach(r => { [['massar', r.v.massar, 'Massar répété'], ['mat', r.v.matricule, 'matricule répété'], ['nm', norm((r.v.prenom || '') + ' ' + (r.v.nom || '')) + '|' + (r.v.date_naissance || ''), 'doublon potentiel (nom + date)']].forEach(([t, k, msg]) => { if (!k || k === '|') return; const key = t + k; if (seen[key] != null) { r.issues.push({ lvl: 'avertissement', msg: msg + ' avec la ligne ' + (seen[key] + 1) }); r.dup = true } else seen[key] = r.i }) });
    rows.forEach(r => { r.status = r.issues.some(x => x.lvl === 'erreur') ? 'erreur' : (r.issues.length || r.score < (cfg.medium || 60)) ? 'à vérifier' : 'valide' }); return rows
  };
  E.level = (s, t) => { t = t || { vh: 95, h: 80, m: 60 }; return s >= t.vh ? 'très haute' : s >= t.h ? 'haute' : s >= t.m ? 'moyenne' : 'faible' };
  const covered = (k, tk) => tk.includes(k) || /nom_complet(_ar)?$/.test(k) && tk.some(x => x.startsWith(k.replace(/nom_complet(_ar)?$/, '') + 'prenom'));
  E.report = (src, tpl, rows, ms) => { const c = s => rows.filter(r => r.status === s).length, tk = tpl.keys || []; return { fichier_source: src.name || '', modele: tpl.name || '', feuille: src.sheet, ligne_entete: src.headerRow + 1, lignes_detectees: src.rows.length, lignes_ignorees_parasites: src.ignored || 0, lignes_converties: rows.length, lignes_valides: c('valide'), lignes_a_verifier: c('à vérifier'), erreurs_bloquantes: c('erreur'), doublons_potentiels: rows.filter(r => r.dup).length, colonnes_reconnues: ms.filter(m => m.key).length, colonnes_non_reconnues: ms.filter(m => !m.key).length, colonnes_sans_cible_dans_le_modele: tk.length ? ms.filter(m => m.key && !covered(m.key, tk)).map(m => m.header) : [], taux_mapping_auto: ms.length ? Math.round(100 * ms.filter(m => m.key).length / ms.length) : 0 } };
  E.export = (X, tplWb, tpl, rows, src) => {
    const ws = tplWb.Sheets[tpl.sheet];
    const aoa = rows.map(r => tpl.keys.map(k => r.v[k] == null ? '' : r.v[k]));
    X.utils.sheet_add_aoa(ws, aoa, { origin: { r: tpl.headerRow + 1, c: 0 } });
    const isDark = rgb => { if (!rgb || rgb.length < 6) return true; const h = rgb.replace('#', ''), r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0; return (0.299 * r + 0.587 * g + 0.114 * b) < 150 };
    const hr = tpl.headerRow;
    const srcStyle = (src && (src.headerStyle || (src.colStyles && src.colStyles.find(Boolean)))) || null;
    const bgRgb = (srcStyle && srcStyle.fill && srcStyle.fill.fgColor && srcStyle.fill.fgColor.rgb) || (srcStyle && srcStyle.fgColor && srcStyle.fgColor.rgb) || '1F3A8A';
    const defFont = (srcStyle && srcStyle.font && srcStyle.font.color && srcStyle.font.color.rgb) || (isDark(bgRgb) ? 'FFFFFF' : '1D2433');
    const baseHdr = { fill: { fgColor: { rgb: bgRgb }, patternType: 'solid' }, font: { bold: true, color: { rgb: defFont }, name: (srcStyle && srcStyle.font && srcStyle.font.name) || 'Calibri', sz: 11 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'D0D6E2' } }, bottom: { style: 'medium', color: { rgb: isDark(bgRgb) ? '0F1D43' : '666666' } }, left: { style: 'thin', color: { rgb: 'D0D6E2' } }, right: { style: 'thin', color: { rgb: 'D0D6E2' } } } };
    for (let c = 0; c < tpl.keys.length; c++) {
      const ref = X.utils.encode_cell({ r: hr, c }); if (!ws[ref]) ws[ref] = { t: 's', v: tpl.headers[c] || '' };
      let cs = null; if (src && src.mapping && src.colStyles) { const tk = tpl.keys[c], m = src.mapping.find(x => x.key === tk) || (tk && (tk.includes('prenom') || tk.includes('nom')) ? src.mapping.find(x => /nom_complet/.test(x.key)) : null); if (m && src.colStyles[m.col]) cs = src.colStyles[m.col] }
      const fin = Object.assign({}, baseHdr); if (cs) { const cRgb = (cs.fill && cs.fill.fgColor && cs.fill.fgColor.rgb) || (cs.fgColor && cs.fgColor.rgb); if (cRgb) { fin.fill = { fgColor: { rgb: cRgb }, patternType: 'solid' }; fin.font = Object.assign({}, fin.font, { color: { rgb: isDark(cRgb) ? 'FFFFFF' : '1D2433' } }) } }
      ws[ref].s = fin
    }

    for (let rIdx = 0; rIdx < aoa.length; rIdx++) {
      const row = aoa[rIdx];
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        if (E.isBlank(row[cIdx])) {
          const cellRef = X.utils.encode_cell({ r: hr + 1 + rIdx, c: cIdx });
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
          ws[cellRef].s = E.EMPTY_CELL_STYLE;
        }
      }
    }

    ws['!rows'] = ws['!rows'] || []; ws['!rows'][hr] = (src && src.headerRowHeight) ? src.headerRowHeight : { hpt: 26, hpx: 26 };
    if (hr > 0) { ws['!rows'][hr - 1] = { hpt: 22, hpx: 22 }; for (let c = 0; c < tpl.keys.length; c++) { const gRef = X.utils.encode_cell({ r: hr - 1, c }); if (ws[gRef] && ws[gRef].v) ws[gRef].s = Object.assign({}, baseHdr, { font: Object.assign({}, baseHdr.font, { sz: 12 }), alignment: { horizontal: 'center', vertical: 'center' } }) } }
    ws['!cols'] = tpl.keys.map((k, i) => { const ml = Math.max((tpl.headers[i] || '').length, ...rows.slice(0, 50).map(r => String(r.v[k] || '').length)); return { wch: Math.min(38, Math.max(14, ml + 3)) } });
    return X.write(tplWb, { type: 'array', bookType: 'xlsx', cellStyles: true })
  };
  E.flipNames = rows => { if (!rows) return rows; rows.forEach(r => { [['prenom', 'nom'], ['prenom_ar', 'nom_ar'], ['papa_prenom', 'papa_nom'], ['maman_prenom', 'maman_nom']].forEach(([p, n]) => { if (r.v[p] != null || r.v[n] != null) { const tmp = r.v[p]; r.v[p] = r.v[n] || ''; r.v[n] = tmp || '' } }); r.edited = 1 }); return rows };

  // === MODULE MULTI-FICHIERS (FUSION, RÉCONCILIATION & PDF) ===
  E.parsePdf = async function (data, pdfLib) {
    const lib = pdfLib || (typeof window !== 'undefined' ? window.pdfjsLib : (typeof require !== 'undefined' ? require('pdfjs-dist/legacy/build/pdf.js') : null));
    if (!lib) throw new Error("Bibliothèque PDF.js non disponible");
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
      if (typeof window !== 'undefined') lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    }
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const doc = await lib.getDocument({ data: u8 }).promise;
    const pages = [];

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items.filter(i => i.str.trim().length > 0);
      const yGroups = [];
      items.forEach(it => {
        const y = it.transform[5];
        if (y > 740 || y < 25) return;
        let g = yGroups.find(g => Math.abs(g.y - y) <= 4);
        if (!g) { g = { y, items: [] }; yGroups.push(g); }
        g.items.push(it);
      });
      yGroups.sort((a, b) => b.y - a.y);
      pages.push({ pageNum: p, yGroups });
    }

    const sampleText = pages.slice(0, 3).flatMap(p => p.yGroups.flatMap(g => g.items.map(i => i.str))).join(' ');
    let detectedRole = 'generic';
    if (/annuaire\s+t[ée]l[ée]phonique|responsable\s+l[ée]gal|conjoint/i.test(sampleText)) {
      detectedRole = 'contacts';
    } else if (/liste\s+des\s+[ée]l[èe]ves\s+inscrits|date\s+d['’]inscription/i.test(sampleText)) {
      detectedRole = 'inscriptions';
    } else if (/massar|الرمز|القسم|المستوى/i.test(sampleText)) {
      detectedRole = 'massar';
    }

    const rows = [];
    let curNiveau = '', curClasse = '';

    for (let p of pages) {
      for (let g of p.yGroups) {
        g.items.sort((a, b) => a.transform[4] - b.transform[4]);
        const line = g.items.map(i => i.str.trim()).join(' ');

        if (/Niveau\s*:/i.test(line)) {
          const mN = line.match(/Niveau\s*:\s*([^:|]+?)(?=\s*Classe|\s*Matricule|\s*N°|$)/i);
          if (mN) curNiveau = mN[1].replace(/\bClasse\b.*$/i, '').trim();
          if (/Classe\s*:/i.test(line)) {
            const mC = line.match(/Classe\s*:\s*([^:|]+?)(?=\s*Date|\s*Elève|\s*Matricule|\s*N°|$)/i);
            curClasse = mC ? mC[1].trim() : '';
          } else {
            curClasse = '';
          }
          continue;
        } else if (/Classe\s*:/i.test(line)) {
          const mC = line.match(/Classe\s*:\s*([^:|]+?)(?=\s*Date|\s*Elève|\s*Matricule|\s*N°|$)/i);
          if (mC) curClasse = mC[1].trim();
          continue;
        }
        if (/N°Ordre|Date d'inscription|Annuaire téléphonique|N°\s+Mat\./i.test(line)) continue;

        if (detectedRole === 'inscriptions') {
          let num = '', date = '', mat = '', nom = [];
          g.items.forEach(it => {
            const x = it.transform[4];
            if (x < 140) num += ' ' + it.str.trim();
            else if (x < 245) date += ' ' + it.str.trim();
            else if (x < 305) mat += ' ' + it.str.trim();
            else nom.push(it.str.trim());
          });
          num = num.trim(); date = date.trim(); mat = mat.trim();
          const nomStr = nom.join(' ').trim();
          if (/^\d{1,3}$/.test(num) && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
            rows.push({
              matricule: mat,
              nom_complet: nomStr,
              date_inscription: date,
              niveau_ecole: curNiveau,
              classe_ecole: curClasse
            });
          }
        } else if (detectedRole === 'contacts') {
          let num = '', mat = '', eleve = [], resp = [], conj = [], autr = [];
          g.items.forEach(it => {
            const x = it.transform[4];
            const s = it.str.trim();
            if (x < 28) num += s;
            else if (x < 55) mat += s;
            else if (x < 195) eleve.push(s);
            else if (x < 315) resp.push(s);
            else if (x < 450) conj.push(s);
            else autr.push(s);
          });
          mat = mat.trim();
          if (/^\d{3,5}$/.test(mat)) {
            rows.push({
              matricule: mat,
              eleve: eleve.join(' '),
              resp: resp.join(' '),
              conj: conj.join(' '),
              autr: autr.join(' '),
              niveau_ecole: curNiveau,
              classe_ecole: curClasse
            });
          }
        } else {
          rows.push(g.items.map(i => i.str.trim()));
        }
      }
    }

    return { role: detectedRole, rows, totalPages: doc.numPages };
  };

  E.parseContactPhones = function (contact) {
    const res = {
      nom_papa: 'Père', prenom_papa: 'Père', gsm_papa: '', autre_tel_papa: '',
      nom_maman: 'Mère', prenom_maman: 'Mère', gsm_maman: '', autre_tel_maman: ''
    };
    if (!contact) return res;

    function parseField(str, roleHint) {
      if (!str) return [];
      const nums = [];
      const s = str.replace(/\.{2,}/g, ' ');
      const tokens = s.split(/\s+/);
      let cur = '', role = roleHint, type = 'P';

      for (let tok of tokens) {
        if (/^PÈRE/i.test(tok)) role = 'papa';
        else if (/^MÈRE/i.test(tok)) role = 'maman';
        else if (/^[PM]:/i.test(tok)) {
          type = tok[0].toUpperCase();
          const rem = tok.slice(2).replace(/\D/g, '');
          cur += rem;
        } else if (/\d+/.test(tok)) {
          cur += tok.replace(/\D/g, '');
        }
        if (cur.length === 10 && /^0[5-7]/.test(cur)) {
          const formatted = cur.slice(0, 2) + ' ' + cur.slice(2, 4) + ' ' + cur.slice(4, 6) + ' ' + cur.slice(6, 8) + ' ' + cur.slice(8, 10);
          nums.push({ role, type, num: formatted });
          cur = '';
          type = 'P';
        } else if (cur.length > 10) {
          const ten = cur.slice(0, 10);
          if (/^0[5-7]/.test(ten)) {
            nums.push({ role, type, num: ten.slice(0, 2) + ' ' + ten.slice(2, 4) + ' ' + ten.slice(4, 6) + ' ' + ten.slice(6, 8) + ' ' + ten.slice(8, 10) });
          }
          cur = cur.slice(10);
        }
      }
      return nums;
    }

    const rNums = parseField(contact.resp || '', 'papa');
    const cNums = parseField(contact.conj || '', 'maman');
    const allNums = [...rNums, ...cNums];

    for (let n of allNums) {
      if (n.role === 'papa') {
        if (!res.gsm_papa && n.type === 'P') res.gsm_papa = n.num;
        else if (!res.gsm_papa && !res.autre_tel_papa) res.gsm_papa = n.num;
        else if (!res.autre_tel_papa) res.autre_tel_papa = n.num;
        else res.autre_tel_papa += ' / ' + n.num;
      } else {
        if (!res.gsm_maman && n.type === 'P') res.gsm_maman = n.num;
        else if (!res.gsm_maman && !res.autre_tel_maman) res.gsm_maman = n.num;
        else if (!res.autre_tel_maman) res.autre_tel_maman = n.num;
        else res.autre_tel_maman += ' / ' + n.num;
      }
    }

    function cleanPhone(val) {
      if (!val) return '';
      let digits = String(val).replace(/\D/g, '').replace(/^00212/, '0').replace(/^212/, '0');
      if (digits.length === 10 && /^0[5-7]/.test(digits)) {
        return digits.slice(0, 2) + ' ' + digits.slice(2, 4) + ' ' + digits.slice(4, 6) + ' ' + digits.slice(6, 8) + ' ' + digits.slice(8, 10);
      }
      if (digits.length === 9 && /^[5-7]/.test(digits)) {
        const d = '0' + digits;
        return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8, 10);
      }
      return String(val).trim();
    }

    function pick(o, ...ks) {
      if (!o) return '';
      for (let k of ks) {
        if (o[k] != null && String(o[k]).trim()) return String(o[k]).trim();
        const lk = k.toLowerCase();
        for (let act of Object.keys(o)) {
          if (act.toLowerCase() === lk && o[act] != null && String(o[act]).trim()) return String(o[act]).trim();
        }
      }
      return '';
    }

    const dPapa = pick(contact, 'gsm_papa', 'papa_tel', 'Tél Père', 'Tel Pere', 'Téléphone Père', 'هاتف الأب');
    if (dPapa && !res.gsm_papa) res.gsm_papa = cleanPhone(dPapa);
    const dMaman = pick(contact, 'gsm_maman', 'maman_tel', 'Tél Mère', 'Tel Mere', 'Téléphone Mère', 'هاتف الأم');
    if (dMaman && !res.gsm_maman) res.gsm_maman = cleanPhone(dMaman);
    const dAutreP = pick(contact, 'autre_tel_papa', 'Autre tél. Papa', 'Autre tel Papa');
    if (dAutreP && !res.autre_tel_papa) res.autre_tel_papa = cleanPhone(dAutreP);
    const dAutreM = pick(contact, 'autre_tel_maman', 'Autre tél. Maman', 'Autre tel Maman');
    if (dAutreM && !res.autre_tel_maman) res.autre_tel_maman = cleanPhone(dAutreM);
    const dGen = pick(contact, 'telephone', 'gsm', 'tel', 'Téléphone', 'الهاتف');
    if (dGen && !res.gsm_papa) res.gsm_papa = cleanPhone(dGen);

    const names = E.extractParentNames(contact);
    res.nom_papa = names.nom_papa;
    res.prenom_papa = names.prenom_papa;
    res.nom_maman = names.nom_maman;
    res.prenom_maman = names.prenom_maman;

    return res;
  };

  E.parseMassarWorkbook = function (X, wb) {
    const students = [];
    for (let sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws['!ref']) continue;
      const rows = X.utils.sheet_to_json(ws, { header: 1 });
      let niveau = '', classe = sheetName;
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r] || [];
        const str = row.join(' ');
        if (str.includes('المستوى')) {
          const idx = row.findIndex(c => String(c).includes('المستوى'));
          if (idx !== -1 && row[idx + 2]) niveau = String(row[idx + 2]).trim();
        }
        if (str.includes('القسم')) {
          const idx = row.findIndex(c => String(c).includes('القسم'));
          if (idx !== -1 && row[idx + 2]) classe = String(row[idx + 2]).trim();
        }
      }

      let hIdx = -1;
      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const row = rows[r] || [];
        if (row.some(c => String(c).includes('الرمز') || /cne|massar/i.test(String(c)))) {
          hIdx = r;
          break;
        }
      }
      if (hIdx === -1) continue;

      const header = rows[hIdx].map(c => String(c || '').trim());
      const cneIdx = header.findIndex(h => h.includes('الرمز') || /cne|massar/i.test(h));
      const nomArIdx = header.findIndex(h => h.includes('النسب') || /nom.*ar/i.test(h));
      const prenomArIdx = header.findIndex(h => h.includes('الإسم') || h.includes('الاسم') || /prenom.*ar/i.test(h));
      const nomFrIdx = header.findIndex(h => /nom/i.test(h) && !/ar/i.test(h) && !/prenom/i.test(h));
      const prenomFrIdx = header.findIndex(h => /prenom/i.test(h) && !/ar/i.test(h));
      const genreIdx = header.findIndex(h => h.includes('النوع') || /genre|sexe/i.test(h));
      const naissIdx = header.findIndex(h => h.includes('الإزدياد') || h.includes('الازدياد') || /naissance/i.test(h));

      for (let r = hIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const cne = String(row[cneIdx] || '').trim();
        if (!cne) continue;
        const gRaw = String(row[genreIdx] || '').trim();
        const genre = gRaw.includes('ذكر') ? 'Garçon' : gRaw.includes('أنثى') ? 'Fille' : gRaw;

        let dt = String(row[naissIdx] || '').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(dt)) {
          dt = dt.slice(0, 10).replace(/-/g, '/');
        }

        students.push({
          cne,
          nom_ar: nomArIdx !== -1 ? String(row[nomArIdx] || '').trim() : '',
          prenom_ar: prenomArIdx !== -1 ? String(row[prenomArIdx] || '').trim() : '',
          nom_fr: nomFrIdx !== -1 ? String(row[nomFrIdx] || '').trim() : '',
          prenom_fr: prenomFrIdx !== -1 ? String(row[prenomFrIdx] || '').trim() : '',
          genre,
          date_naiss: dt,
          classe_massar: classe,
          niveau_massar: niveau
        });
      }
    }
    return students;
  };

  E.detectFileRole = function (name, rows) {
    const n = (name || '').toLowerCase();
    if (/massar|cne|listeleve/i.test(n)) return 'massar';
    if (/famille|contact|annuaire|parent/i.test(n)) return 'contacts';
    if (/inscrit|inscription|eleve/i.test(n)) return 'inscriptions';
    if (Array.isArray(rows) && rows.length > 0) {
      const r0 = rows[0] || {};
      if (r0.cne || r0.code_massar || r0['الرمز'] || r0['Code Massar']) return 'massar';
      if (r0.resp || r0.conj || r0.gsm_papa || r0.gsm_maman) return 'contacts';
      if (r0.date_inscription || r0.matricule) return 'inscriptions';
    }
    return 'generic';
  };

  E.translitArToFr = function (ar, D) {
    if (!ar) return '';
    const arFr = (D && D.ar_fr_names) || (typeof BotiArFrNames !== 'undefined' ? BotiArFrNames : null);
    const clean = ar.replace(/[\u064B-\u065F\u0670]/g, '');
    const words = clean.split(/\s+/).map(w => {
      if (arFr) {
        if (arFr.arToFrFirstNames && arFr.arToFrFirstNames[w]) return arFr.arToFrFirstNames[w];
        if (arFr.arToFrSurnames && arFr.arToFrSurnames[w]) return arFr.arToFrSurnames[w];
      }
      let r = w.replace(/^ال/, 'EL ');
      const m = {
        'ب': 'B', 'ت': 'T', 'ث': 'TH', 'ج': 'J', 'ح': 'H', 'خ': 'KH',
        'د': 'D', 'ذ': 'Z', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'CH',
        'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A', 'غ': 'GH',
        'ف': 'F', 'ق': 'K', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
        'ه': 'H', 'و': 'OU', 'ي': 'I', 'أ': 'A', 'إ': 'I', 'آ': 'A',
        'ء': '', 'ئ': 'I', 'ؤ': 'OU', 'ة': 'A', 'ى': 'A', 'ا': 'A'
      };
      let out = '';
      for (let c of r) out += m[c] !== undefined ? m[c] : c;
      return out;
    });
    return words.join(' ').replace(/\s+/g, ' ').trim();
  };

  function classCompatible(schCl, massarCl) {
    if (!schCl || !massarCl) return false;
    const s = norm(schCl), m = norm(massarCl);
    if (s === m) return true;
    if (/^PS\s*-?1$/i.test(s) && /^DEPE\s*-?1$/i.test(m)) return true;
    if (/^MS\s*-?1$/i.test(s) && /^PS1\s*-?1$/i.test(m)) return true;
    if (/^MS\s*-?2$/i.test(s) && /^PS1\s*-?2$/i.test(m)) return true;
    if (/^GS\s*-?1$/i.test(s) && /^PS2\s*-?1$/i.test(m)) return true;
    if (/^GS\s*-?2$/i.test(s) && /^PS2\s*-?2$/i.test(m)) return true;
    const numS = s.match(/\d+/), numM = m.match(/\d+/);
    if (numS && numM && numS[0] === numM[0]) {
      if ((s.includes('AEP') || s.includes('APG')) && (m.includes('APG') || m.includes('AEP'))) return true;
      if (s.includes('BAC') && m.includes('BAC')) return true;
      if (s.includes('TC') && m.includes('TC')) return true;
    }
    return false;
  }

  E.reconcileMulti = function (sources, D, cfg) {
    cfg = cfg || {};
    const nameOrder = cfg.nameOrder || 'nom_first';

    let inscritsRows = [];
    let contactsRows = [];
    let massarRawRows = [];

    let srcList = [];
    if (Array.isArray(sources)) {
      srcList = sources;
    } else if (sources && typeof sources === 'object') {
      for (let [k, v] of Object.entries(sources)) {
        if (Array.isArray(v)) srcList.push({ role: k, rows: v });
        else if (v && Array.isArray(v.rows)) srcList.push({ role: v.role || k, rows: v.rows, name: v.name });
        else if (v) srcList.push(v);
      }
    }

    function getFld(obj, ...candidates) {
      if (!obj || typeof obj !== 'object') return '';
      const candNorm = candidates.map(c => norm(c));
      for (let [k, v] of Object.entries(obj)) {
        if (v == null || String(v).trim() === '') continue;
        const nk = norm(k);
        if (candNorm.some(cn => cn === nk || nk.replace(/\s+/g, '_') === cn || cn.replace(/\s+/g, '_') === nk)) {
          return String(v).trim();
        }
        if (D) {
          const rec = E.recognize(k, D);
          if (rec) {
            const rk = norm(rec.key);
            if (candNorm.some(cn => cn === rk || rk.replace(/\s+/g, '_') === cn || cn.replace(/\s+/g, '_') === rk)) {
              return String(v).trim();
            }
          }
        }
      }
      return '';
    }

    function getExtraCols(obj) {
      const extra = {};
      const std = ['matricule', 'mat', 'cne', 'code_massar', 'nom', 'prenom', 'nom_complet', 'eleve', 'classe', 'niveau', 'date_inscription', 'date_naissance', 'genre', 'sexe', 'resp', 'conj', 'gsm_papa', 'gsm_maman', 'autre_tel_papa', 'autre_tel_maman', 'nom_papa', 'nom_maman', 'prenom_papa', 'prenom_maman'];
      for (let [k, v] of Object.entries(obj)) {
        if (v == null || String(v).trim() === '') continue;
        const rec = D ? E.recognize(k, D) : null;
        const target = rec ? rec.key : k.toLowerCase().replace(/['’\-_.:\/()]+/g, '_').trim();
        if (!rec && !std.includes(target) && !k.startsWith('extra_')) {
          extra[k] = String(v).trim();
        }
      }
      return extra;
    }

    for (let s of srcList) {
      if (!s) continue;
      const r = s.role || 'generic';
      const rows = s.rows || (Array.isArray(s) ? s : []);
      if (r === 'inscriptions') inscritsRows.push(...rows);
      else if (r === 'contacts') contactsRows.push(...rows);
      else if (r === 'massar' || r === 'massar_ar' || r === 'massar_fr') massarRawRows.push(...rows);
      else {
        for (let row of rows) {
          if (!row) continue;
          const cne = getFld(row, 'cne', 'code_massar', 'Code Massar', 'الرمز');
          const hasContact = row.resp || row.conj || getFld(row, 'gsm_papa', 'gsm_maman', 'Tél Père', 'Tél Mère');
          if (cne && !getFld(row, 'matricule', 'mat')) massarRawRows.push(row);
          else if (hasContact && !getFld(row, 'nom_complet', 'eleve', 'nom')) contactsRows.push(row);
          else inscritsRows.push(row);
        }
      }
    }

    // Deduplicate and merge massar rows by CNE
    const massarByCne = new Map();
    for (let m of massarRawRows) {
      const cne = String(m.cne || m.code_massar || m['الرمز'] || m['Code Massar'] || '').trim();
      if (!cne) continue;
      if (!massarByCne.has(cne)) {
        massarByCne.set(cne, {
          cne,
          nom_fr: m.nom_fr || m['Nom (FR)'] || '',
          prenom_fr: m.prenom_fr || m['Prénom (FR)'] || '',
          nom_ar: m.nom_ar || m['النسب'] || m['النسب (AR)'] || '',
          prenom_ar: m.prenom_ar || m['الإسم'] || m['الإسم (AR)'] || '',
          genre: m.genre || m['النوع'] || m['Genre'] || '',
          date_naiss: m.date_naiss || m['تاريخ الإزدياد'] || m['Date de naissance'] || '',
          classe_massar: m.classe_massar || m['القسم'] || m['Classe (Massar)'] || '',
          niveau_massar: m.niveau_massar || m['المستوى'] || m['Niveau (Massar)'] || ''
        });
      } else {
        const ex = massarByCne.get(cne);
        ex.nom_fr = ex.nom_fr || m.nom_fr || m['Nom (FR)'];
        ex.prenom_fr = ex.prenom_fr || m.prenom_fr || m['Prénom (FR)'];
        ex.nom_ar = ex.nom_ar || m.nom_ar || m['النسب'] || m['النسب (AR)'];
        ex.prenom_ar = ex.prenom_ar || m.prenom_ar || m['الإسم'] || m['الإسم (AR)'];
        ex.genre = ex.genre || m.genre || m['النوع'] || m['Genre'];
        ex.date_naiss = ex.date_naiss || m.date_naiss || m['تاريخ الإزدياد'] || m['Date de naissance'];
        ex.classe_massar = ex.classe_massar || m.classe_massar || m['القسم'] || m['Classe (Massar)'];
        ex.niveau_massar = ex.niveau_massar || m.niveau_massar || m['المستوى'] || m['Niveau (Massar)'];
      }
    }
    const massarRows = Array.from(massarByCne.values());

    // Ensure transliterated names on massar rows
    for (let m of massarRows) {
      if (!m.nom_fr && m.nom_ar) m.nom_fr = E.translitArToFr(m.nom_ar, D);
      if (!m.prenom_fr && m.prenom_ar) m.prenom_fr = E.translitArToFr(m.prenom_ar, D);
      m.nom_complet_fr = ((m.nom_fr || '') + ' ' + (m.prenom_fr || '')).trim();
    }

    const contactsByMat = {};
    for (let c of contactsRows) {
      const mat = getFld(c, 'matricule', 'mat', 'id');
      if (mat) {
        if (!contactsByMat[mat]) contactsByMat[mat] = { ...c };
        else Object.assign(contactsByMat[mat], c);
      }
    }

    const studentByMat = new Map();
    const studentByName = new Map();
    const schoolStudents = [];

    function applyParentIdentity(target, srcObj) {
      const names = E.extractParentNames(srcObj, D);
      if (!target.nom_papa || target.nom_papa === 'Père') target.nom_papa = names.nom_papa;
      if (!target.prenom_papa || target.prenom_papa === 'Père') target.prenom_papa = names.prenom_papa;
      if (!target.nom_maman || target.nom_maman === 'Mère') target.nom_maman = names.nom_maman;
      if (!target.prenom_maman || target.prenom_maman === 'Mère') target.prenom_maman = names.prenom_maman;
    }

    for (let ins of inscritsRows) {
      const mat = getFld(ins, 'matricule', 'mat', 'id');
      const rawComplet = getFld(ins, 'nom_complet', 'eleve');
      const colNom = getFld(ins, 'nom_fr', 'nom');
      const colPrenom = getFld(ins, 'prenom_fr', 'prenom');
      const rawNom = rawComplet || [colNom, colPrenom].filter(Boolean).join(' ');
      if (!mat && !rawNom) continue;

      const extra = getExtraCols(ins);

      let existing = null;
      if (mat && studentByMat.has(mat)) existing = studentByMat.get(mat);
      else if (rawNom && studentByName.has(norm(rawNom))) existing = studentByName.get(norm(rawNom));

      if (existing) {
        if (!existing.matricule && mat) existing.matricule = mat;
        if (!existing.classe_ecole) existing.classe_ecole = getFld(ins, 'classe_ecole', 'classe', 'groupe');
        if (!existing.niveau_ecole) existing.niveau_ecole = getFld(ins, 'niveau_ecole', 'niveau');
        if (!existing.date_inscription) existing.date_inscription = getFld(ins, 'date_inscription');
        if (!existing.date_naissance) existing.date_naissance = getFld(ins, 'date_naissance');
        if (!existing.genre) existing.genre = getFld(ins, 'genre', 'sexe');
        if (!existing.nom_fr && colNom) existing.nom_fr = colNom;
        if (!existing.prenom_fr && colPrenom) existing.prenom_fr = colPrenom;
        const p = E.parseContactPhones(ins);
        if (!existing.gsm_papa && p.gsm_papa) existing.gsm_papa = p.gsm_papa;
        if (!existing.gsm_maman && p.gsm_maman) existing.gsm_maman = p.gsm_maman;
        applyParentIdentity(existing, { ...ins });
        Object.assign(existing.extra, extra);
        const mo = E.collectDirect({ ...contactsByMat[mat], ...ins }, D); existing.more = existing.more || {};
        for (const kk in mo) if (!existing.more[kk]) existing.more[kk] = mo[kk];
      } else {
        let nom_fr = '', prenom_fr = '';
        if (colNom && colPrenom) {
          nom_fr = colNom;
          prenom_fr = colPrenom;
        } else if (D && rawComplet) {
          const seg = E.segment(rawComplet, D, { order: nameOrder });
          nom_fr = seg.nom;
          prenom_fr = seg.prenom;
        } else if (rawNom) {
          const parts = rawNom.split(/\s+/);
          nom_fr = colNom || parts[0] || '';
          prenom_fr = colPrenom || parts.slice(1).join(' ') || '';
        }

        const contact = contactsByMat[mat] || {};
        const phones = E.parseContactPhones({ ...contact, ...ins });
        const names = E.extractParentNames({ ...contact, ...ins }, D);

        const newStudent = {
          matricule: mat,
          nom_complet_ecole: rawNom,
          nom_fr: colNom || nom_fr,
          prenom_fr: colPrenom || prenom_fr,
          date_inscription: getFld(ins, 'date_inscription'),
          date_naissance: getFld(ins, 'date_naissance'),
          genre: getFld(ins, 'genre', 'sexe'),
          niveau_ecole: getFld(ins, 'niveau_ecole', 'niveau'),
          classe_ecole: getFld(ins, 'classe_ecole', 'classe', 'groupe'),
          extra,
          more: E.collectDirect({ ...contact, ...ins }, D),
          ...phones,
          nom_papa: names.nom_papa,
          prenom_papa: names.prenom_papa,
          nom_maman: names.nom_maman,
          prenom_maman: names.prenom_maman
        };

        if (mat) studentByMat.set(mat, newStudent);
        if (rawNom) studentByName.set(norm(rawNom), newStudent);
        schoolStudents.push(newStudent);
      }
    }

    const massarMatched = new Set();
    const reconciled = [];

    function scoreCandidate(sch, m) {
      const schNorm = norm(sch.nom_complet_ecole);
      const schTokens = schNorm.split(' ').filter(Boolean);
      const mNorm = norm((m.nom_fr || '') + ' ' + (m.prenom_fr || ''));
      const mNormRev = norm((m.prenom_fr || '') + ' ' + (m.nom_fr || ''));
      const mTokens = mNorm.split(' ').filter(Boolean);

      let score = 0;
      if (mNorm === schNorm || mNormRev === schNorm) {
        score = 1.0;
      } else {
        const overlap = schTokens.filter(t => mTokens.includes(t) || mTokens.some(mt => mt.includes(t) || t.includes(mt))).length;
        if (overlap >= 2 && overlap >= Math.min(schTokens.length, mTokens.length)) {
          score = 0.94;
        } else if (overlap >= 1 && schTokens.length === 1 && mTokens.length === 1) {
          score = 0.90;
        } else {
          const s1 = sim(schNorm, mNorm);
          const s2 = sim(schNorm, mNormRev);
          const bestS = Math.max(s1, s2);
          if (bestS >= 0.75) score = bestS * 0.9;
        }
      }

      if (score > 0.6 && classCompatible(sch.classe_ecole, m.classe_massar)) {
        score = Math.min(1.0, score + 0.1);
      }
      return score;
    }

    function findMassarMatch(sch) {
      let best = null, bestScore = 0;

      // 1st pass: search within compatible class
      if (sch.classe_ecole) {
        for (let i = 0; i < massarRows.length; i++) {
          if (massarMatched.has(i)) continue;
          const m = massarRows[i];
          if (classCompatible(sch.classe_ecole, m.classe_massar)) {
            const s = scoreCandidate(sch, m);
            if (s > bestScore && s >= 0.72) {
              bestScore = s;
              best = { idx: i, student: m, score: s, classMatched: true };
            }
          }
        }
      }
      if (best && bestScore >= 0.8) return best;

      // 2nd pass: global search across all massar students
      for (let i = 0; i < massarRows.length; i++) {
        if (massarMatched.has(i)) continue;
        const m = massarRows[i];
        const s = scoreCandidate(sch, m);
        if (s > bestScore && s >= 0.75) {
          bestScore = s;
          best = { idx: i, student: m, score: s, classMatched: false };
        }
      }

      return bestScore >= 0.75 ? best : null;
    }

    for (let sch of schoolStudents) {
      const match = findMassarMatch(sch);
      if (match) {
        massarMatched.add(match.idx);
        const m = match.student;

        let statut = 'OK';
        let nomEcoleRef = '';

        const schN = norm(sch.nom_complet_ecole);
        const mN = norm((m.nom_fr || '') + ' ' + (m.prenom_fr || ''));
        const mNRev = norm((m.prenom_fr || '') + ' ' + (m.nom_fr || ''));

        if (match.score < 0.82 && !match.classMatched) {
          statut = 'À vérifier : orthographe différente';
          nomEcoleRef = sch.nom_complet_ecole;
        } else if (!match.classMatched && sch.classe_ecole && m.classe_massar && !classCompatible(sch.classe_ecole, m.classe_massar)) {
          statut = 'À vérifier : classe différente';
          nomEcoleRef = sch.nom_complet_ecole;
        }

        reconciled.push({
          matricule: sch.matricule,
          code_massar: m.cne,
          nom_fr: sch.nom_fr || m.nom_fr,
          prenom_fr: sch.prenom_fr || m.prenom_fr,
          nom_ar: m.nom_ar || '',
          prenom_ar: m.prenom_ar || '',
          genre: m.genre || '',
          date_naissance: m.date_naiss || '',
          niveau_massar: m.niveau_massar || '',
          classe_massar: m.classe_massar || '',
          niveau_ecole: sch.niveau_ecole,
          classe_ecole: sch.classe_ecole,
          date_inscription: sch.date_inscription,
          nom_maman: sch.nom_maman || 'Mère',
          prenom_maman: sch.prenom_maman || 'Mère',
          gsm_maman: sch.gsm_maman || '',
          autre_tel_maman: sch.autre_tel_maman || '',
          nom_papa: sch.nom_papa || 'Père',
          prenom_papa: sch.prenom_papa || 'Père',
          gsm_papa: sch.gsm_papa || '',
          autre_tel_papa: sch.autre_tel_papa || '',
          statut,
          nom_ecole: nomEcoleRef,
          extra: sch.extra || {}, ...(sch.more || {})
        });
      } else {
        reconciled.push({
          matricule: sch.matricule,
          code_massar: '',
          nom_fr: sch.nom_fr,
          prenom_fr: sch.prenom_fr,
          nom_ar: '',
          prenom_ar: '',
          genre: sch.genre || '',
          date_naissance: sch.date_naissance || '',
          niveau_massar: '',
          classe_massar: '',
          niveau_ecole: sch.niveau_ecole,
          classe_ecole: sch.classe_ecole,
          date_inscription: sch.date_inscription,
          nom_maman: sch.nom_maman || 'Mère',
          prenom_maman: sch.prenom_maman || 'Mère',
          gsm_maman: sch.gsm_maman || '',
          autre_tel_maman: sch.autre_tel_maman || '',
          nom_papa: sch.nom_papa || 'Père',
          prenom_papa: sch.prenom_papa || 'Père',
          gsm_papa: sch.gsm_papa || '',
          autre_tel_papa: sch.autre_tel_papa || '',
          statut: massarRows.length > 0 ? 'École seule (pas de code Massar)' : 'OK',
          nom_ecole: sch.nom_complet_ecole,
          extra: sch.extra || {}, ...(sch.more || {})
        });
      }
    }

    for (let i = 0; i < massarRows.length; i++) {
      if (!massarMatched.has(i)) {
        const m = massarRows[i];
        reconciled.push({
          matricule: '',
          code_massar: m.cne,
          nom_fr: m.nom_fr,
          prenom_fr: m.prenom_fr,
          nom_ar: m.nom_ar || '',
          prenom_ar: m.prenom_ar || '',
          genre: m.genre || '',
          date_naissance: m.date_naiss || '',
          niveau_massar: m.niveau_massar || '',
          classe_massar: m.classe_massar || '',
          niveau_ecole: '',
          classe_ecole: '',
          date_inscription: '',
          nom_maman: 'Mère',
          prenom_maman: 'Mère',
          gsm_maman: '',
          autre_tel_maman: '',
          nom_papa: 'Père',
          prenom_papa: 'Père',
          gsm_papa: '',
          autre_tel_papa: '',
          statut: 'Massar seul (pas de matricule)',
          nom_ecole: ''
        });
      }
    }

    const toVerify = reconciled.filter(r => r.statut.startsWith('À vérifier'));
    const stats = {
      total: reconciled.length,
      ok: reconciled.filter(r => r.statut === 'OK').length,
      toVerify: reconciled.filter(r => r.statut.startsWith('À vérifier')).length,
      ecoleSeule: reconciled.filter(r => r.statut.startsWith('École seule')).length,
      massarSeul: reconciled.filter(r => r.statut.startsWith('Massar seul')).length
    };

    return { rows: reconciled, toVerify, stats };
  };

  /**
   * Version asynchrone de reconcileMulti qui yield le thread tous les CHUNK élèves
   * pour ne pas bloquer l'UI sur de gros volumes (500+ lignes).
   * onProgress(pct, msg) est optionnel.
   */
  E.reconcileMultiAsync = async function (sources, D, cfg, onProgress) {
    const CHUNK = 50; // traiter 50 élèves puis yield
    const yield_ = () => new Promise(r => setTimeout(r, 0));

    // On réutilise la logique synchrone pour tout sauf la boucle principale
    // en appelant d'abord reconcileMulti sur un sous-ensemble vide pour init,
    // puis on rebuild la boucle critique ici de façon async.
    // Approche plus simple : wrapper avec découpage de la liste sources.
    const totalRows = sources.reduce((s, src) => s + (src.rows ? src.rows.length : 0), 0);
    if (totalRows <= CHUNK * 2) {
      // Petit volume : synchrone suffit
      return E.reconcileMulti(sources, D, cfg);
    }

    // Grand volume : on split sources en chunks pour relâcher le thread
    // en réalité on appelle reconcileMulti par paquet de CHUNK lignes côté inscrits
    cfg = cfg || {};
    const nameOrder = cfg.nameOrder || 'nom_first';

    // Extraire les listes de lignes depuis sources (même logique que reconcileMulti)
    let inscritsRows = [], contactsRows = [], massarRawRows = [];
    const srcList = Array.isArray(sources) ? sources : Object.values(sources).map(v => (v && Array.isArray(v.rows)) ? v : { rows: v });
    for (let s of srcList) {
      if (!s) continue;
      const r = s.role || 'generic';
      const rows = s.rows || (Array.isArray(s) ? s : []);
      if (r === 'inscriptions') inscritsRows.push(...rows);
      else if (r === 'contacts') contactsRows.push(...rows);
      else if (r === 'massar' || r === 'massar_ar' || r === 'massar_fr') massarRawRows.push(...rows);
      else inscritsRows.push(...rows);
    }

    // Découper inscritsRows en chunks et appeler reconcileMulti sur chaque chunk
    const allReconciled = [];
    const totalChunks = Math.ceil(inscritsRows.length / CHUNK);
    for (let ci = 0; ci < totalChunks; ci++) {
      const chunk = inscritsRows.slice(ci * CHUNK, (ci + 1) * CHUNK);
      const chunkSources = [
        { role: 'inscriptions', rows: chunk },
        ...contactsRows.length ? [{ role: 'contacts', rows: contactsRows }] : [],
        ...massarRawRows.length ? [{ role: 'massar', rows: massarRawRows }] : []
      ];
      const partial = E.reconcileMulti(chunkSources, D, cfg);
      allReconciled.push(...partial.rows);
      const pct = Math.round(85 + 13 * (ci + 1) / totalChunks);
      if (onProgress) onProgress(pct, `Fusion… ${Math.min((ci + 1) * CHUNK, inscritsRows.length)}/${inscritsRows.length} élèves`);
      await yield_();
    }

    const toVerify = allReconciled.filter(r => r.statut.startsWith('À vérifier'));
    const stats = {
      total: allReconciled.length,
      ok: allReconciled.filter(r => r.statut === 'OK').length,
      toVerify: allReconciled.filter(r => r.statut.startsWith('À vérifier')).length,
      ecoleSeule: allReconciled.filter(r => r.statut.startsWith('École seule')).length,
      massarSeul: allReconciled.filter(r => r.statut.startsWith('Massar seul')).length
    };
    return { rows: allReconciled, toVerify, stats };
  };

  E.mapRecordToColumn = function (r, k, h, D) {
    const strH = String(h || '').trim();
    const normH = E.norm(strH);

    // 1. Precise key match (first priority, 100% unambiguous)
    if (k === 'id') return r.id || r.matricule || '';
    if (k === 'sexe') return r.genre || '';
    if (k === 'massar') return r.code_massar || '';
    if (k === 'matricule') return r.matricule || '';
    if (k === 'nom' || k === 'nom_fr') return r.nom_fr || '';
    if (k === 'prenom' || k === 'prenom_fr') return r.prenom_fr || '';
    if (k === 'prenom_ar') return r.prenom_ar || '';
    if (k === 'nom_ar') return r.nom_ar || '';
    if (k === 'nom_complet') return ((r.nom_fr || '') + ' ' + (r.prenom_fr || '')).trim() || r.nom_ecole || '';
    if (k === 'nom_complet_ar') return ((r.nom_ar || '') + ' ' + (r.prenom_ar || '')).trim();
    if (k === 'adresse') return r.adresse || (r.extra && r.extra['Adresse']) || '';
    if (k === 'date_naissance') return r.date_naissance || '';
    if (k === 'niveau') return r.niveau_ecole || r.niveau_massar || '';
    if (k === 'classe' || k === 'groupe') return r.classe_ecole || r.classe_massar || '';
    if (k === 'date_inscription') return r.date_inscription || '';
    if (k === 'ancien_etablissement') return r.ancien_etablissement || (r.extra && r.extra['Ancien établissement']) || '';

    // Parents PAPA
    if (k === 'papa_nom') return r.nom_papa || 'Père';
    if (k === 'papa_prenom') return r.prenom_papa || 'Père';
    if (k === 'papa_tel') return r.gsm_papa || '';
    if (k === 'papa_email') return r.email_papa || (r.extra && (r.extra['Email Papa'] || r.extra['Email Père'] || r.extra['Email'])) || '';
    if (k === 'papa_cin') return r.cin_papa || (r.extra && (r.extra['CIN Papa'] || r.extra['CIN Père'] || r.extra['CIN'])) || '';
    if (k === 'papa_fonction') return r.fonction_papa || (r.extra && (r.extra['Fonction Papa'] || r.extra['Fonction Père'] || r.extra['Profession Papa'])) || '';

    // Parents MAMAN
    if (k === 'maman_nom') return r.nom_maman || 'Mère';
    if (k === 'maman_prenom') return r.prenom_maman || 'Mère';
    if (k === 'maman_tel') return r.gsm_maman || '';
    if (k === 'maman_email') return r.email_maman || (r.extra && (r.extra['Email Maman'] || r.extra['Email Mère'])) || '';
    if (k === 'maman_cin') return r.cin_maman || (r.extra && (r.extra['CIN Maman'] || r.extra['CIN Mère'])) || '';
    if (k === 'maman_fonction') return r.fonction_maman || (r.extra && (r.extra['Fonction Maman'] || r.extra['Fonction Mère'] || r.extra['Profession Maman'])) || '';

    // 2. Fallback matching by header text
    if (/^id$|^identifiant$/i.test(normH)) return r.id || r.matricule || '';
    if (/matricule|num.*inscr|code.*eleve|id.*eleve/i.test(strH)) return r.matricule || '';
    if (/massar|cne/i.test(strH) || normH === 'massar' || normH === 'cne' || normH === 'code massar') return r.code_massar || '';

  // Parents Téléphones & Contacts (check before names so 'Téléphone Père' isn't treated as Père's name)
  if (/autre.*t[ée]l.*papa|fixe.*p[eè]re|urgence.*p[eè]re/i.test(strH)) return r.autre_tel_papa || '';
  if (/autre.*t[ée]l.*maman|fixe.*m[eè]re|urgence.*m[eè]re/i.test(strH)) return r.autre_tel_maman || '';
  if (/(gsm.*papa|t[ée]l.*papa|t[ée]l.*p[eè]re|gsm.*p[eè]re|t[ée]l[eé]phone.*p[eè]re)/i.test(strH)) return r.gsm_papa || '';
  if (/(gsm.*maman|t[ée]l.*maman|t[ée]l.*m[eè]re|gsm.*m[eè]re|t[ée]l[eé]phone.*m[eè]re)/i.test(strH)) return r.gsm_maman || '';
  if (/(email.*(papa|p[eè]re)|courriel.*(papa|p[eè]re))/i.test(strH)) return r.email_papa || (r.extra && r.extra['Email Papa']) || '';
  if (/(email.*(maman|m[eè]re)|courriel.*(maman|m[eè]re))/i.test(strH)) return r.email_maman || (r.extra && r.extra['Email Maman']) || '';
  if (/(cin.*(papa|p[eè]re))/i.test(strH)) return r.cin_papa || (r.extra && r.extra['CIN Papa']) || '';
  if (/(cin.*(maman|m[eè]re))/i.test(strH)) return r.cin_maman || (r.extra && r.extra['CIN Maman']) || '';
  if (/(fonction.*(papa|p[eè]re)|profession.*(papa|p[eè]re))/i.test(strH)) return r.fonction_papa || (r.extra && r.extra['Fonction Papa']) || '';
  if (/(fonction.*(maman|m[eè]re)|profession.*(maman|m[eè]re))/i.test(strH)) return r.fonction_maman || (r.extra && r.extra['Fonction Maman']) || '';

  // Parents Noms & Prénoms
  if (/(pr[eé]nom.*(papa|p[eè]re)|(^|[\s_])(papa|p[eè]re).*pr[eé]nom)/i.test(strH)) return r.prenom_papa || 'Père';
  if (/(nom.*(papa|p[eè]re)|(^|[\s_])(p[eè]re|papa|parent\s*1|tuteur)($|[\s_]))/i.test(strH)) return r.nom_papa || 'Père';
  if (/(pr[eé]nom.*(maman|m[eè]re)|(^|[\s_])(maman|m[eè]re).*pr[eé]nom)/i.test(strH)) return r.prenom_maman || 'Mère';
  if (/(nom.*(maman|m[eè]re)|(^|[\s_])(m[eè]re|maman|parent\s*2)($|[\s_]))/i.test(strH)) return r.nom_maman || 'Mère';

    // French student names
    if (/pr[eé]nom/i.test(strH)) return r.prenom_fr || '';
    if (/nom.*complet/i.test(strH)) return ((r.nom_fr || '') + ' ' + (r.prenom_fr || '')).trim() || r.nom_ecole || '';
    if (/(^|[\s_])nom(\s*\(fr\)|_fr|\s*$)/i.test(strH) || normH === 'nom') return r.nom_fr || '';

    // Demographic & school fields
    if (/genre|sexe/i.test(strH)) return r.genre || '';
    if (/date.*naiss/i.test(strH)) return r.date_naissance || '';
    if (/adresse|domicile/i.test(strH)) return r.adresse || (r.extra && r.extra['Adresse']) || '';
    if (/niveau.*massar/i.test(strH)) return r.niveau_massar || r.niveau_ecole || '';
    if (/niveau.*[ée]cole/i.test(strH)) return r.niveau_ecole || r.niveau_massar || '';
    if (/niveau/i.test(strH)) return r.niveau_ecole || r.niveau_massar || '';
    if (/classe.*massar/i.test(strH)) return r.classe_massar || r.classe_ecole || '';
    if (/classe.*[ée]cole/i.test(strH)) return r.classe_ecole || r.classe_massar || '';
    if (/classe|groupe/i.test(strH)) return r.classe_ecole || r.classe_massar || '';
    if (/date.*inscr/i.test(strH)) return r.date_inscription || '';
    if (/ancien.*[ée]tablissement/i.test(strH)) return r.ancien_etablissement || (r.extra && r.extra['Ancien établissement']) || '';

    // Generic contact
    if (/^t[ée]l/i.test(strH) || /^gsm/i.test(strH)) return r.gsm_papa || r.gsm_maman || '';
    if (/^email|^courriel/i.test(strH)) return r.email_papa || r.email_maman || '';
    if (/statut.*liaison|statut/i.test(strH)) return r.statut || 'OK';
    if (/nom.*pdf|nom.*[ée]cole.*ref|nom.*original/i.test(strH)) return r.nom_ecole || ((r.nom_fr || '') + ' ' + (r.prenom_fr || '')).trim();

    // Extras
    if (r.extra) {
      if (r.extra[strH] != null) return String(r.extra[strH]);
      for (let [ek, ev] of Object.entries(r.extra)) {
        if (E.norm(ek) === normH) return String(ev);
      }
    }

    // Fallback
    return '';
  };

  E.projectToTemplate = function (rows, tplInfo, D) {
    return (rows || []).map((r, idx) => {
      const v = {};
      if (!r._row) r._row = {};
      for (let i = 0; i < tplInfo.headers.length; i++) {
        const h = tplInfo.headers[i];
        const k = tplInfo.keys ? tplInfo.keys[i] : '';
        const colKey = k || (tplInfo.grp && tplInfo.grp[i] ? `${tplInfo.grp[i]}_${h}` : h);
        if (r._row[colKey] == null && r._row[h] == null) {
          r._row[colKey] = E.mapRecordToColumn(r, k, h, D);
        }
        v[colKey] = r._row[colKey] != null ? r._row[colKey] : r._row[h];
      }
      return { i: idx, v, status: r.statut || 'OK', score: 95, origRecord: r };
    });
  };

  E.BOTI_DEFAULT_COLS = [
    // 0-13 : Élève
    { group: '', k: 'id', h: 'ID', w: 8 },
    { group: '', k: 'sexe', h: 'Sexe', w: 10 },
    { group: '', k: 'massar', h: 'Massar', w: 14 },
    { group: '', k: 'matricule', h: 'Matricule', w: 12 },
    { group: '', k: 'nom', h: 'Nom', w: 16 },
    { group: '', k: 'prenom', h: 'Prénom', w: 16 },
    { group: '', k: 'prenom_ar', h: 'الإسم', w: 14 },
    { group: '', k: 'nom_ar', h: 'النسب', w: 14 },
    { group: '', k: 'adresse', h: 'Adresse', w: 22 },
    { group: '', k: 'date_naissance', h: 'Date de naissance', w: 16 },
    { group: '', k: 'niveau', h: 'Niveau', w: 18 },
    { group: '', k: 'groupe', h: 'Groupe', w: 12 },
    { group: '', k: 'date_inscription', h: "Date d'inscription", w: 16 },
    { group: '', k: 'ancien_etablissement', h: 'Ancien établissement', w: 20 },
    // 14-19 : PAPA
    { group: 'PAPA', k: 'papa_nom', h: 'Nom', w: 14, defaultVal: 'Père' },
    { group: 'PAPA', k: 'papa_prenom', h: 'Prénom', w: 14, defaultVal: 'Père' },
    { group: 'PAPA', k: 'papa_tel', h: 'Tel', w: 16 },
    { group: 'PAPA', k: 'papa_email', h: 'Email', w: 20 },
    { group: 'PAPA', k: 'papa_cin', h: 'CIN', w: 12 },
    { group: 'PAPA', k: 'papa_fonction', h: 'Fonction', w: 16 },
    // 20-25 : MAMAN
    { group: 'MAMAN', k: 'maman_nom', h: 'Nom', w: 14, defaultVal: 'Mère' },
    { group: 'MAMAN', k: 'maman_prenom', h: 'Prénom', w: 14, defaultVal: 'Mère' },
    { group: 'MAMAN', k: 'maman_tel', h: 'Tel', w: 16 },
    { group: 'MAMAN', k: 'maman_email', h: 'Email', w: 20 },
    { group: 'MAMAN', k: 'maman_cin', h: 'CIN', w: 12 },
    { group: 'MAMAN', k: 'maman_fonction', h: 'Fonction', w: 16 }
  ];

  E.exportMulti = function (X, recResult, tplInfo, tplWb, D, opts) {
    const emptyStyle = E.EMPTY_CELL_STYLE;

    if (tplWb && tplInfo) {
      const targetWb = X.read(X.write(tplWb, { type: 'array', bookType: 'xlsx', cellStyles: true }), { type: 'array', cellStyles: true });

      function fillSheet(sName, rows) {
        if (!targetWb.Sheets[sName]) return;
        const ws = targetWb.Sheets[sName];
        const sInfo = (tplInfo && sName === tplInfo.sheet && tplInfo.headers) ? tplInfo : E.templateInfo(X, targetWb, D, sName);
        const hr = sInfo.headerRow >= 0 ? sInfo.headerRow : 0;
        const headers = sInfo.headers;
        const keys = sInfo.keys;

        // Clean existing data rows below headerRow
        if (ws['!ref']) {
          const range = X.utils.decode_range(ws['!ref']);
          for (let R = hr + 1; R <= range.e.r; ++R) {
            for (let C = 0; C <= range.e.c; ++C) {
              delete ws[X.utils.encode_cell({ c: C, r: R })];
            }
          }
          range.e.r = hr;
          ws['!ref'] = X.utils.encode_range(range);
        }

        // Build data aoa prioritizing r._row (any UI edits)
        const aoa = rows.map(r => headers.map((h, i) => {
          const k = keys ? keys[i] : '';
          const colKey = k || (sInfo.grp && sInfo.grp[i] ? `${sInfo.grp[i]}_${h}` : h);
          if (r._row && r._row[colKey] != null) return r._row[colKey];
          if (r._row && r._row[h] != null && (!keys || keys.filter(x => x === k).length <= 1)) return r._row[h];
          return E.mapRecordToColumn(r, k, h, D);
        }));
        X.utils.sheet_add_aoa(ws, aoa, { origin: { r: hr + 1, c: 0 } });

        // Highlight empty cells with warm amber color
        for (let rIdx = 0; rIdx < aoa.length; rIdx++) {
          const row = aoa[rIdx];
          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const val = row[cIdx];
            if (E.isBlank(val)) {
              const cellRef = X.utils.encode_cell({ r: hr + 1 + rIdx, c: cIdx });
              if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
              ws[cellRef].s = emptyStyle;
            }
          }
        }
      }

      const hasEleves = targetWb.SheetNames.some(s => /élèves|eleves/i.test(s));
      const hasVerify = targetWb.SheetNames.some(s => /vérifier|verifier/i.test(s));

      if (hasEleves && hasVerify) {
        const elSheet = targetWb.SheetNames.find(s => /élèves|eleves/i.test(s));
        const verSheet = targetWb.SheetNames.find(s => /vérifier|verifier/i.test(s));
        fillSheet(elSheet, recResult.rows || []);
        fillSheet(verSheet, recResult.toVerify || []);
      } else {
        const mainSheet = tplInfo.sheet && targetWb.Sheets[tplInfo.sheet] ? tplInfo.sheet : targetWb.SheetNames[0];
        fillSheet(mainSheet, recResult.rows || []);
      }

      return X.write(targetWb, { type: 'array', bookType: 'xlsx', cellStyles: true });
    }

    const wb = X.utils.book_new();
    const colsDef = E.BOTI_DEFAULT_COLS;

    const baseHdr = {
      fill: { fgColor: { rgb: '0C0C5E' }, patternType: 'solid' },
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '3B4A7A' } },
        bottom: { style: 'medium', color: { rgb: '0C0C5E' } },
        left: { style: 'thin', color: { rgb: '3B4A7A' } },
        right: { style: 'thin', color: { rgb: '3B4A7A' } }
      }
    };

    const papaHdr = {
      fill: { fgColor: { rgb: '2B28DE' }, patternType: 'solid' },
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } }
      }
    };

    const mamanHdr = {
      fill: { fgColor: { rgb: '8A3CF9' }, patternType: 'solid' },
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } }
      }
    };

    function makeSheet(rows) {
      const allExtraKeys = new Set();
      (rows || []).forEach(r => {
        if (r.extra) Object.keys(r.extra).forEach(k => allExtraKeys.add(k));
      });
      const extraCols = [];
      for (let xk of allExtraKeys) {
        extraCols.push({ group: '', k: 'extra_' + xk, h: xk, w: Math.max(14, xk.length + 3), isExtra: true, origKey: xk });
      }
      const fullCols = [...colsDef, ...extraCols];

      // Row 0: super-headers (PAPA, MAMAN)
      const r0 = fullCols.map((c, idx) => {
        if (idx === 14) return 'PAPA';
        if (idx === 20) return 'MAMAN';
        return '';
      });

      // Row 1: column headers
      const r1 = fullCols.map(c => c.h);

      const aoa = [r0, r1];

      rows.forEach(r => {
        const rowData = fullCols.map(c => {
          const rowKey = c.group ? `${c.group}_${c.h}` : c.h;
          if (r._row && r._row[rowKey] != null) return r._row[rowKey];
          if (r._row && r._row[c.h] != null && !c.group) return r._row[c.h];
          if (c.isExtra) return (r.extra && r.extra[c.origKey] != null ? r.extra[c.origKey] : '');
          return E.mapRecordToColumn(r, c.k, c.h, D);
        });
        aoa.push(rowData);
      });

      const ws = X.utils.aoa_to_sheet(aoa);

      // Style row 0: PAPA (O1..T1) and MAMAN (U1..Z1)
      for (let c = 14; c <= 19; c++) {
        const ref = X.utils.encode_cell({ r: 0, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: (c === 14 ? 'PAPA' : '') };
        ws[ref].s = papaHdr;
      }
      for (let c = 20; c <= 25; c++) {
        const ref = X.utils.encode_cell({ r: 0, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: (c === 20 ? 'MAMAN' : '') };
        ws[ref].s = mamanHdr;
      }

      // Merges
      ws['!merges'] = [
        { s: { r: 0, c: 14 }, e: { r: 0, c: 19 } },
        { s: { r: 0, c: 20 }, e: { r: 0, c: 25 } }
      ];

      // Style row 1: column headers
      for (let c = 0; c < fullCols.length; c++) {
        const ref = X.utils.encode_cell({ r: 1, c });
        if (ws[ref]) ws[ref].s = baseHdr;
      }

      // Highlight empty data cells with warm amber color
      for (let rIdx = 2; rIdx < aoa.length; rIdx++) {
        const row = aoa[rIdx];
        for (let cIdx = 0; cIdx < fullCols.length; cIdx++) {
          const val = row[cIdx];
          if (E.isBlank(val)) {
            const cellRef = X.utils.encode_cell({ r: rIdx, c: cIdx });
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
            ws[cellRef].s = emptyStyle;
          }
        }
      }

      ws['!rows'] = [{ hpt: 24, hpx: 24 }, { hpt: 26, hpx: 26 }];
      ws['!cols'] = fullCols.map(c => ({ wch: c.w }));
      return ws;
    }

    // Sheet 1: Élèves & Parents
    X.utils.book_append_sheet(wb, makeSheet(recResult.rows), 'Élèves & Parents');

    if (opts && opts.onlyMain) return X.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });

    // Sheet 2: À vérifier
    X.utils.book_append_sheet(wb, makeSheet(recResult.toVerify || []), 'À vérifier');

    // Sheet 3: Notes
    const notesAoa = [
      ['Comment ce fichier a été construit'],
      ['Sources : listes Massar, liste des inscrits et annuaire des parents.'],
      ['Liaison Inscrits ↔ Parents : liée par le Matricule de l\'école.'],
      ['Liaison École ↔ Massar : effectuée par réconciliation sémantique des noms et validation croisée par niveau/classe.'],
      ['GSM Parents : formaté selon le standard marocain (06/07...). Numéro personnel (P:) en priorité, maison (M:) en second numéro.'],
      ['Statut « OK » : liaison certaine validée.'],
      ['Statut « À vérifier » : liaison probable mais orthographe ou niveau différent — voir l\'onglet À vérifier.'],
      ['Statut « Massar seul » / « École seule » : élève présent dans une seule source, aucune correspondance trouvée.'],
      [''],
      ['--- STATISTIQUES DE FUSION ---'],
      ['Total élèves consolidés :', recResult.stats.total],
      ['Élèves validés (OK) :', recResult.stats.ok],
      ['Cas à vérifier :', recResult.stats.toVerify],
      ['Élèves école seule (non présents sur Massar) :', recResult.stats.ecoleSeule],
      ['Élèves Massar seul (non inscrits école) :', recResult.stats.massarSeul]
    ];
    const wsNotes = X.utils.aoa_to_sheet(notesAoa);
    wsNotes['!cols'] = [{ wch: 35 }, { wch: 15 }];
    X.utils.book_append_sheet(wb, wsNotes, 'Notes');

    return X.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  };

  E.TEMPLATES = {
    boti_eleves_parents: {
      id: 'boti_eleves_parents',
      name: 'Élèves & Parents (Standard BOTI)',
      tag: 'Recommandé · 26 colonnes',
      available: true,
      icon: '🎓',
      desc: 'Canevas officiel de référence BOTI avec toutes les coordonnées élèves et fiches PAPA & MAMAN.',
      cols: E.BOTI_DEFAULT_COLS,
      sheet: 'Élèves & Parents',
      hasSuperHeaders: true
    },
    encaissements: {
      id: 'encaissements',
      name: 'Encaissements & Règlements Scolaires',
      tag: 'Comptabilité & Frais · données partielles',
      available: true, partial: true,
      icon: '💳',
      desc: 'Suivi financier des frais de scolarité, tranches réglées, reste dû et modes de paiement.',
      cols: [
        { group: '', k: 'matricule', h: 'Matricule', w: 12 },
        { group: '', k: 'nom_complet', h: 'Nom & Prénom', w: 22 },
        { group: '', k: 'niveau', h: 'Niveau', w: 16 },
        { group: '', k: 'classe', h: 'Classe / Groupe', w: 14 },
        { group: '', k: 'periode', h: 'Période / Mois', w: 14 },
        { group: '', k: 'montant_total', h: 'Frais Scolarité (MAD)', w: 18 },
        { group: '', k: 'montant_paye', h: 'Montant Réglé (MAD)', w: 18 },
        { group: '', k: 'reste_du', h: 'Reste à payer (MAD)', w: 18 },
        { group: '', k: 'date_reglement', h: 'Date Règlement', w: 16 },
        { group: '', k: 'mode_paiement', h: 'Mode Paiement', w: 16 },
        { group: '', k: 'reference_recu', h: 'Réf. Reçu / Chèque', w: 18 },
        { group: '', k: 'responsable', h: 'Responsable Financier', w: 20 }
      ],
      sheet: 'Encaissements',
      hasSuperHeaders: false
    },
    enseignants: {
      id: 'enseignants',
      name: 'Base Enseignants & Personnel',
      tag: 'RH & Corps professoral · données partielles',
      available: true, partial: true,
      icon: '👨‍🏫',
      desc: 'Gestion des enseignants, disciplines enseignées, cycles scolaires et coordonnées RH.',
      cols: [
        { group: '', k: 'matricule_rh', h: 'Matricule RH', w: 14 },
        { group: '', k: 'nom', h: 'Nom', w: 16 },
        { group: '', k: 'prenom', h: 'Prénom', w: 16 },
        { group: '', k: 'sexe', h: 'Genre', w: 10 },
        { group: '', k: 'matiere', h: 'Matière / Discipline', w: 20 },
        { group: '', k: 'cycle', h: 'Cycle', w: 16 },
        { group: '', k: 'classes', h: 'Classes affectées', w: 22 },
        { group: '', k: 'telephone', h: 'Téléphone', w: 16 },
        { group: '', k: 'email', h: 'Email', w: 22 },
        { group: '', k: 'cin', h: 'CIN', w: 14 },
        { group: '', k: 'date_embauche', h: 'Date Embauche', w: 16 },
        { group: '', k: 'statut', h: 'Statut RH', w: 14 }
      ],
      sheet: 'Enseignants',
      hasSuperHeaders: false
    }
  };


  // === PARCOURS UNIQUE : validation, traçabilité, aperçu vertical ===
  E.templateHasParents = key => !!(E.TEMPLATES[key] && E.TEMPLATES[key].cols.some(c => /^(papa|maman)_/.test(c.k)));
  // Valeur d'une cellule selon le modèle choisi. « Père/Mère » par défaut uniquement si le modèle contient des parents.
  E.cellValue = function (r, col, tplKey, D) {
    if (E.templateHasParents(tplKey)) return E.mapRecordToColumn(r, col.k, col.h, D);
    if (/^(papa|maman)_/.test(col.k)) return '';
    const known = ['matricule', 'nom', 'prenom', 'nom_complet', 'niveau', 'classe', 'groupe', 'sexe', 'date_naissance', 'date_inscription', 'massar', 'adresse'];
    if (known.includes(col.k)) return E.mapRecordToColumn(r, col.k, col.h, D);
    const nh = norm(col.h); if (r.extra) for (const [ek, ev] of Object.entries(r.extra)) if (norm(ek) === nh) return String(ev);
    return '';
  };
  // Export générique (modèles autres que BOTI Élèves & Parents) : même structure que le modèle choisi.
  E.exportTemplate = function (X, tplKey, rows, D) {
    const t = E.TEMPLATES[tplKey], cols = t.cols;
    const hdr = { fill: { fgColor: { rgb: '0C0C5E' }, patternType: 'solid' }, font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    const aoa = [cols.map(c => c.h)];
    rows.forEach(r => aoa.push(cols.map(c => { const v = r._row && r._row[E.rowKey(c)]; return v != null ? v : E.cellValue(r, c, tplKey, D) })));
    const ws = X.utils.aoa_to_sheet(aoa);
    cols.forEach((c, i) => { const ref = X.utils.encode_cell({ r: 0, c: i }); if (ws[ref]) ws[ref].s = hdr });
    for (let r = 1; r < aoa.length; r++) for (let c = 0; c < cols.length; c++) if (E.isBlank(aoa[r][c])) { const ref = X.utils.encode_cell({ r, c }); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = E.EMPTY_CELL_STYLE }
    ws['!cols'] = cols.map(c => ({ wch: c.w || 14 })); ws['!rows'] = [{ hpt: 26, hpx: 26 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, t.sheet.slice(0, 31));
    return X.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  };

  E.rowKey = c => c.group ? `${c.group}_${c.h}` : c.h;

  // Contrôle d'une valeur selon la nature du champ. Retourne null si OK.
  E.validateValue = function (k, val) {
    const v = String(val == null ? '' : val).trim();
    if (!v) return null;
    if (/_tel$|^telephone$/.test(k)) {
      const d = v.replace(/\D/g, '');
      if (!(d.length === 10 && /^0[5-7]/.test(d))) return { lvl: 'erreur', msg: 'Numéro invalide « ' + v + ' »', fix: 'Saisir 10 chiffres commençant par 05, 06 ou 07 (ex : 06 12 34 56 78).' };
      return null;
    }
    if (/_email$|^email$/.test(k)) return /^\S+@\S+\.\S+$/.test(v) ? null : { lvl: 'erreur', msg: 'Email invalide « ' + v + ' »', fix: 'Format attendu : nom@domaine.ma' };
    if (/_cin$|^cin$/.test(k)) return /^[A-Za-z]{1,2}\s?\d{4,8}$/.test(v) ? null : { lvl: 'avertissement', msg: 'CIN inhabituel « ' + v + ' »', fix: 'Format courant : 1-2 lettres + 5-6 chiffres (ex : AB123456).' };
    if (k === 'date_naissance' || k === 'date_inscription') {
      const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return { lvl: 'erreur', msg: 'Date illisible « ' + v + ' »', fix: 'Format attendu : jj/mm/aaaa (ex : 15/09/2018).' };
      const d = +m[1], mo = +m[2], y = +m[3], T = new Date(Date.UTC(y, mo - 1, d));
      if (mo < 1 || mo > 12 || T.getUTCDate() !== d) return { lvl: 'erreur', msg: 'Date inexistante « ' + v + ' »', fix: 'Vérifier le jour et le mois.' };
      const now = new Date().getFullYear();
      if (k === 'date_naissance' && (y < now - 30 || y > now)) return { lvl: 'avertissement', msg: 'Année de naissance peu plausible (' + y + ')', fix: 'Vérifier l\'année dans le fichier source.' };
      return null;
    }
    if (k === 'sexe') return /^(gar[cç]on|fille|m|f|masculin|f[eé]minin|homme|femme)$/i.test(v) ? null : { lvl: 'avertissement', msg: 'Valeur de sexe inattendue « ' + v + ' »', fix: 'Utiliser « Garçon » ou « Fille ».' };
    if (k === 'massar') return /^[A-Za-z]?\d{8,10}$/.test(v) ? null : { lvl: 'avertissement', msg: 'Code Massar au format inhabituel', fix: 'Code Massar attendu : 1 lettre + 9 chiffres (ex : D130012345).' };
    if (/(^|_)(nom|prenom)$/.test(k)) {
      if (/\d/.test(v)) return { lvl: 'avertissement', msg: 'Contient des chiffres', fix: 'Un nom ne devrait pas contenir de chiffres.' };
      if (/^(P[eè]re|M[eè]re)$/i.test(v) && k.indexOf('_') > -1) return { lvl: 'info', msg: 'Valeur par défaut BOTI', fix: 'Remplacer si le nom du parent est connu.' };
      if (E.isAr(v)) return { lvl: 'avertissement', msg: 'Texte arabe dans un champ latin', fix: 'Placer cette valeur dans la colonne arabe correspondante.' };
      return null;
    }
    if (/_ar$/.test(k)) return E.isAr(v) ? null : { lvl: 'avertissement', msg: 'Texte latin dans un champ arabe', fix: 'Saisir la valeur en arabe.' };
    return null;
  };

  // D'où vient chaque champ ? (traçabilité lisible par l'utilisateur)
  E.traceField = function (sources, k, D, label) {
    const srcs = sources || [];
    const school = srcs.filter(s => s.role !== 'massar');
    const massar = srcs.filter(s => s.role === 'massar');
    const cols = s => { const seen = new Set(); (s.rows || []).slice(0, 300).forEach(r => { if (r && typeof r === 'object') Object.keys(r).forEach(c => { if (String(r[c] == null ? '' : r[c]).trim() !== '') seen.add(c) }) }); return [...seen] };
    const find = (list, test) => { for (const s of list) for (const c of cols(s)) { const rec = D ? E.recognize(c, D) : null, rk = rec ? rec.key : ''; if (test(c, rk, norm(c))) return { file: s.name || s.role, col: c } } return null };
    const ref = x => '« ' + x.col + ' » de ' + x.file;
    const R = (how, kind) => ({ how, kind: kind || 'direct' });
    const MISS = (why) => ({ how: why, kind: 'missing' });
    const isP = (n, who) => who === 'papa' ? /(pere|papa|resp|father)/.test(n) : /(mere|maman|conj|mother)/.test(n);
    let x;
    switch (k) {
      case 'nom_complet': return R('Nom + Prénom de l\'élève (colonne nom complet, ou nom et prénom réunis)', 'split');
      case 'id': return R('Identifiant interne = matricule de l\'école', 'rule');
      case 'matricule':
        x = find(school, (c, rk, n) => rk === 'matricule' || /^(mat|n mat|matricule)$/.test(n));
        return x ? R('Colonne ' + ref(x) + ' · trim()') : MISS('Aucune colonne « Matricule » dans les fichiers école');
      case 'massar':
        if (massar.length) return R('Rapprochement nom + classe avec l\'export Massar (' + massar[0].name + ') → code CNE');
        x = find(school, (c, rk) => rk === 'massar');
        return x ? R('Colonne ' + ref(x)) : MISS('Aucun export Massar déposé');
      case 'sexe':
        if (massar.length) return R('Export Massar : colonne genre (ذكر → Garçon · أنثى → Fille)');
        x = find(school, (c, rk) => rk === 'sexe'); return x ? R('Colonne ' + ref(x)) : MISS('Pas de colonne Sexe/Genre dans les fichiers');
      case 'nom': case 'prenom': {
        const one = find(school, (c, rk) => rk === 'nom_complet'), nn = find(school, (c, rk) => rk === 'nom'), pp = find(school, (c, rk) => rk === 'prenom');
        if (nn && pp) return R('Colonne ' + ref(k === 'nom' ? nn : pp) + ' · trim()');
        if (one) return R('Scindé depuis ' + ref(one) + ' : mots en MAJUSCULES = Nom, le reste = Prénom (trim + dictionnaire de prénoms)', 'split');
        if (massar.length) return R('Export Massar (nom/prénom latin, ou translittération de l\'arabe)');
        return MISS('Aucune colonne de nom reconnue');
      }
      case 'nom_ar': case 'prenom_ar':
        return massar.length ? R('Export Massar : colonne ' + (k === 'nom_ar' ? 'النسب' : 'الإسم')) : MISS('Nécessite un export Massar (noms en arabe)');
      case 'adresse': x = find(school, (c, rk) => rk === 'adresse'); return x ? R('Colonne ' + ref(x)) : MISS('Pas de colonne Adresse');
      case 'date_naissance':
        if (massar.length) return R('Export Massar : تاريخ الإزدياد → jj/mm/aaaa');
        x = find(school, (c, rk) => rk === 'date_naissance'); return x ? R('Colonne ' + ref(x) + ' → converti en jj/mm/aaaa') : MISS('Pas de date de naissance (ajouter un export Massar)');
      case 'niveau': x = find(school, (c, rk, n) => rk === 'niveau' || n === 'niveau ecole'); return x ? R('Colonne ' + ref(x)) : (massar.length ? R('Niveau de l\'export Massar') : MISS('Pas de colonne Niveau'));
      case 'classe': case 'groupe': x = find(school, (c, rk, n) => rk === 'classe' || n === 'classe ecole'); return x ? R('Colonne ' + ref(x)) : (massar.length ? R('Classe de l\'export Massar') : MISS('Pas de colonne Classe/Groupe'));
      case 'date_inscription': x = find(school, (c, rk) => rk === 'date_inscription'); return x ? R('Colonne ' + ref(x) + ' → jj/mm/aaaa') : MISS('Pas de date d\'inscription');
      case 'ancien_etablissement': x = find(school, (c, rk) => rk === 'ancien_etablissement'); return x ? R('Colonne ' + ref(x)) : MISS('Pas de colonne « Ancien établissement »');
    }
    const m = k.match(/^(papa|maman)_(nom|prenom|tel|email|cin|fonction)$/);
    if (m) {
      const who = m[1], f = m[2], whoLbl = who === 'papa' ? 'Père' : 'Mère';
      const ann = find(school, (c, rk, n) => (who === 'papa' ? n === 'resp' : n === 'conj'));
      if (f === 'tel') {
        x = find(school, (c, rk, n) => isP(n, who) && /(tel|gsm|mobile|phone|portable)/.test(n));
        if (x) return R('Colonne ' + ref(x) + ' → format 06 12 34 56 78');
        if (ann) return R('Annuaire parents : colonne ' + ref(ann) + ' (' + (who === 'papa' ? 'responsable légal' : 'conjoint') + '), n° personnel « P: » prioritaire, lié par matricule');
        x = find(school, (c, rk) => rk === 'telephone' || rk === 'tel_parent');
        return x && who === 'papa' ? R('Colonne générique ' + ref(x) + ' attribuée au père', 'split') : MISS('Aucun téléphone ' + whoLbl.toLowerCase() + ' trouvé');
      }
      if (f === 'nom' || f === 'prenom') {
        const nameCol = pr => find(school, (c, rk, n) => isP(n, who) && /(nom|pere|mere|papa|maman)/.test(n) && !/(tel|gsm|mail|cin|fonction|profession)/.test(n) && (pr ? /prenom/.test(n) : !/prenom/.test(n)));
        const cN = nameCol(false), cP = nameCol(true);
        if (cP && f === 'prenom') return R('Colonne ' + ref(cP) + ' · trim()');
        if (cN && cP) return R('Colonne ' + ref(cN) + ' · trim()');
        if (cN && !cP) return R('Scindé depuis ' + ref(cN) + ' (nom + prénom dans la même colonne) : MAJUSCULES = Nom, reste = Prénom, via dictionnaire de prénoms · trim()', 'split');
        return { how: 'Règle BOTI : ' + (f === 'nom' ? 'nom' : 'prénom') + ' ' + (who === 'papa' ? 'du père' : 'de la mère') + ' absent des fichiers → « ' + whoLbl + ' » (modèle avec parents)', kind: 'rule' };
      }
      x = find(school, (c, rk, n) => isP(n, who) && n.includes(f === 'fonction' ? '' : f) && (f === 'fonction' ? /(fonction|profession)/.test(n) : true));
      if (x) return R('Colonne ' + ref(x));
      return MISS(f.toUpperCase() === 'CIN' || f === 'cin' ? 'Aucune colonne CIN ' + whoLbl.toLowerCase() : 'Aucune colonne ' + f + ' ' + whoLbl.toLowerCase());
    }
    if (label) { const nl = norm(label); x = find(school, (c, rk, n) => n === nl || (nl.length > 3 && n.includes(nl))); if (x) return R('Colonne ' + ref(x)); return MISS('Aucune colonne « ' + label + ' » dans les fichiers déposés'); }
    return null;
  };

  const HINT = k => /_tel$/.test(k) ? 'Ajouter le fichier « parents » (annuaire) ou saisir le numéro dans le tableau final.' : /_(email|cin|fonction)$/.test(k) ? 'Info rarement présente dans les exports école : à compléter à la main si utile.' : (k === 'massar' ? 'Déposer aussi l\'export Massar pour récupérer le code.' : /_ar$/.test(k) || k === 'sexe' || k === 'date_naissance' ? 'Déposer l\'export Massar pour récupérer cette information.' : 'À compléter dans le tableau final.');

  // Tableau vertical : un champ output par ligne, exemple sur un élève, comment trouvé, contrôle.
  E.generateVerticalMapping = function (sources, templateKey, D, rows, sampleIdx) {
    const tpl = E.TEMPLATES[templateKey] || E.TEMPLATES.boti_eleves_parents;
    const list = rows || [], N = list.length, sample = list[Math.min(sampleIdx || 0, Math.max(0, N - 1))] || null;
    return tpl.cols.map((col, idx) => {
      const rk = E.rowKey(col), get = r => (r && r._row && r._row[rk] != null) ? String(r._row[rk]) : E.cellValue(r, col, templateKey, D);
      const val = sample ? String(get(sample) || '').trim() : '';
      let empty = 0, invalid = 0, byDefault = 0;
      list.forEach(r => { const v = String(get(r) || '').trim(); if (!v) empty++; else { const c = E.validateValue(col.k, v); if (c && c.lvl === 'erreur') invalid++; if (c && c.lvl === 'info') byDefault++ } });
      const tr = E.traceField(sources, col.k, D, col.h) || { how: 'Déduit de la fusion des fichiers', kind: 'direct' };
      let status = 'ok', how = tr.how, comment = '', fix = '';
      const chk = val ? E.validateValue(col.k, val) : null;
      if (!val) { status = tr.kind === 'missing' ? 'empty' : 'empty'; comment = ''; fix = HINT(col.k); if (tr.kind === 'rule') how = how.replace(/ → .*/, ''); }
      else if (chk && chk.lvl === 'erreur') { status = 'error'; comment = chk.msg; fix = chk.fix }
      else if (chk && chk.lvl === 'avertissement') { status = 'warn'; comment = chk.msg; fix = chk.fix }
      else if (chk && chk.lvl === 'info') { status = 'rule'; comment = chk.msg; fix = chk.fix }
      else if (tr.kind === 'rule') status = 'rule';
      else if (tr.kind === 'missing') { how = 'Valeur présente, source exacte non identifiée'; }
      if (status === 'ok' && (invalid || empty > N * 0.5)) { comment = invalid ? invalid + ' ligne(s) avec un format invalide sur ' + N : 'Rempli sur ' + (N - empty) + '/' + N + ' lignes seulement'; status = 'warn'; fix = invalid ? 'Voir les cellules rouges dans le tableau final.' : HINT(col.k) }
      return { idx, colKey: col.k, header: col.h, group: col.group || '', sampleValue: val, how, status, comment, fix, kind: tr.kind, filled: N - empty, total: N, invalid, byDefault };
    });
  };

  if (typeof module !== 'undefined') module.exports = E; else g.BotiEngine = E
})(this);
