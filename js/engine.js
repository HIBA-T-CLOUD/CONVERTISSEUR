(function(g){
const E={};
const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().replace(/['’\-_.:\/()]+/g,' ').replace(/[^a-z0-9\u0600-\u06FF ]+/g,' ').replace(/\s+/g,' ').trim();
const lev=(a,b)=>{const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]};
const sim=(a,b)=>a||b?1-lev(a,b)/Math.max(a.length,b.length):0;
E.norm=norm;E.sim=sim;
E.loadDict=j=>{const S=a=>new Set(a.map(norm));
 const syn=[];for(const k in j.fields)j.fields[k].forEach(s=>syn.push({k,s:norm(s)}));
 return{syn,extra:new Map(),f:S([...j.first_names_fr,...j.first_names_en,...j.first_names_ar]),c:S(j.compound_first_names),s:S(j.moroccan_surnames),p:S(j.name_prefixes),ar_fr_names:j.ar_fr_names||null}};
const isAr=x=>{const t=String(x);const a=(t.match(/[\u0600-\u06FF]/g)||[]).length,l=(t.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF]/g)||[]).length;return l>0&&a/l>.5};E.isAr=isAr;
const PAR=/(^| )(pere|mere|parent|parents|tuteur|tutrice|father|mother|guardian|papa|maman|ولي|الاب|الام|الوالد|الوالده)( |$)/;
E.owner=t=>{const n=norm(t);if(/(^| )(pere|papa|father|dad|الاب|الوالد)( |$)/.test(n))return'papa';if(/(^| )(mere|maman|mother|mom|الام|الوالده)( |$)/.test(n))return'maman';const m=n.match(/(^| )parents? ([12])( |$)/);return m?(m[2]==='1'?'papa':'maman'):null};
E.recognize=(h,D)=>{const n=norm(h);if(!n)return null;
 if(D.extra.has(n))return{key:D.extra.get(n),score:1,method:'intitulé identique au modèle'};
 let best=null;
 for(const{k,s}of D.syn){let sc=0,m='';
  if(n===s){sc=1;m='correspondance exacte'}
  else if((' '+n+' ').includes(' '+s+' ')){sc=.7+.18*s.length/n.length;m='contenu'}
  else{let x=sim(n,s)*.92;if(n.length>=3&&n.split('').sort().join('')===s.split('').sort().join(''))x=Math.max(x,.8);if(x>=.75){sc=x;m='fuzzy'}}
  if(sc&&(!best||sc>best.score||(sc===best.score&&s.length>best.l)))best={key:k,score:+sc.toFixed(2),method:m,l:s.length}}
 if(!best)return null;let key=best.key,note='';
 if(PAR.test(n)){const o=E.owner(h),b=key==='tel_parent'?'telephone':key==='nom_parent'?'nom_complet':key;
  if(o&&['telephone','nom_complet','nom','prenom','email','cin','fonction'].includes(b)){key=o+'_'+(b==='telephone'?'tel':b);note=/parents? [12]/.test(n)?' + '+(o==='papa'?'parent 1 = papa (supposé)':'parent 2 = maman (supposé)'):' + '+o}
  else if(b==='telephone')key='tel_parent';else if(['nom','prenom','nom_complet'].includes(b))key='nom_parent'}
 else if(/(^| )(ar|arabe|arabic)( |$)/.test(n)&&['nom_complet','nom','prenom'].includes(key))key+='_ar';
 return{key,score:best.score,method:best.method+note}};
E.readSheet=(X,ws)=>{const rg=X.utils.decode_range(ws['!ref']||'A1');rg.s.r=0;rg.s.c=0;const a=X.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:true,range:rg});
 (ws['!merges']||[]).forEach(m=>{const v=(a[m.s.r]||[])[m.s.c];for(let r=m.s.r;r<=m.e.r;r++){a[r]=a[r]||[];for(let c=m.s.c;c<=m.e.c;c++)if(!(r===m.s.r&&c===m.s.c))a[r][c]=v}});return a};
E.detectHeader=(a,D)=>{let best=-1e9,br=-1,low=false;
 for(let r=0;r<Math.min(40,a.length);r++){const st=(a[r]||[]).filter(x=>typeof x==='string'&&x.trim());if(st.length<2)continue;
  const rec=st.filter(c=>E.recognize(c,D)).length;const nx=(a[r+1]||[]).filter(x=>x!=='').length;
  const sc=rec*3+st.length*.5-(nx?0:5);if(sc>best){best=sc;br=r;low=rec===0}}
 return{row:br,lowConfidence:low}};
const PH=/^(\+?212|0)?[5-7]\d{8}$/,DT=/^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$/;
E.analyzeSheet=(X,wb,name,D,forceRow)=>{const a=E.readSheet(X,wb.Sheets[name]);const h=forceRow!=null?{row:forceRow,lowConfidence:false}:E.detectHeader(a,D);
 if(h.row<0)return{sheet:name,headerRow:-1,headers:[],rows:[],mapping:[],score:0};
 const hd=(a[h.row]||[]).map(x=>String(x).trim());const rows=a.slice(h.row+1).filter(r=>r.some(x=>String(x).trim()!==''));
 const used={};const mapping=[];let rec=0;
 hd.forEach((H,i)=>{if(!H)return;let r=E.recognize(H,D);const vals=rows.slice(0,30).map(r=>String(r[i]??'').replace(/\s/g,'')).filter(Boolean);
  if(!r&&vals.length){const ph=vals.filter(v=>PH.test(v.replace(/[.\-]/g,''))).length/vals.length,dt=vals.filter(v=>DT.test(v)).length/vals.length,em=vals.filter(v=>/^\S+@\S+\.\S+$/.test(v)).length/vals.length;
   if(ph>.7)r={key:'telephone',score:.6,method:'contenu : téléphones'};
   else if(dt>.7){const isEntry=/(entree|entrée|inscription|admission|arrivee|arrivée|debut|début|scolar|دخول|التحاق|تسجيل)/i.test(H)||mapping.some(m=>m.key==='date_naissance');r=isEntry?{key:'date_inscription',score:.75,method:'contenu : date d\'entrée / inscription'}:{key:'date_naissance',score:.6,method:'contenu : dates'}}
   else if(em>.7)r={key:'email',score:.65,method:'contenu : emails'}}
  if(r)rec++;mapping.push({col:i,header:H,key:r?r.key:'',score:r?r.score:0,method:r?r.method:'non reconnue',sample:vals.slice(0,3)})});
 mapping.forEach(m=>{if(!m.key)return;if(used[m.key]!=null){const o=mapping.find(x=>x.col===used[m.key]);if(m.score>o.score){o.key='';o.method='doublon de cible';used[m.key]=m.col}else{m.key='';m.method='doublon de cible'}}else used[m.key]=m.col});
 const idc=mapping.filter(m=>/(^|_)(nom_complet|nom|prenom|massar|matricule)(_ar)?$/.test(m.key)).map(m=>m.col);let ign=0;
 const kept=idc.length?rows.filter(r=>{if(!idc.some(c=>String(r[c]??'').trim()!=='')&&r.filter(x=>String(x).trim()!=='').length<=2){ign++;return false}return true}):rows;
 const rawSheet=wb.Sheets[name]||{};let headerStyle=null;const colStyles=[];
 const headerRowHeight=(rawSheet['!rows']&&rawSheet['!rows'][h.row])?rawSheet['!rows'][h.row]:null;
 for(let c=0;c<hd.length;c++){const cell=rawSheet[X.utils.encode_cell({r:h.row,c})],s=cell&&cell.s?cell.s:null;colStyles[c]=s;if(!headerStyle&&s&&(s.fill||s.fgColor||s.font))headerStyle=s}
 return{sheet:name,headerRow:h.row,lowConfidence:h.lowConfidence,headers:hd,rows:kept,ignored:ign,raw:a,mapping,headerStyle,colStyles,headerRowHeight,score:rec*3+kept.length/1e4}};
E.analyze=(X,wb,D,sheet,forceRow)=>{const names=sheet?[sheet]:wb.SheetNames;const r=names.map(n=>E.analyzeSheet(X,wb,n,D,forceRow));r.sort((a,b)=>b.score-a.score);r[0].allSheets=wb.SheetNames;return r[0]};
E.templateInfo=(X,wb,D)=>{const t=E.analyze(X,wb,D),a=t.raw,hr=t.headerRow;
 const base=t.headers.map(h=>{const r=h&&E.recognize(h,D);return r?r.key:''}),cnt={};base.forEach(k=>{if(k)cnt[k.replace(/_ar$/,'')]=(cnt[k.replace(/_ar$/,'')]||0)+1});
 const grp=[];let cur='';(hr>0?a[hr-1]||[]:[]).forEach((x,i)=>{const q=String(x||'').trim();if(q)cur=q;grp[i]=cur});
 t.keys=t.headers.map((h,i)=>{if(!h)return'';let k=base[i];if(!k)return'raw:'+norm(h);
  if(isAr(h)&&['nom','prenom','nom_complet'].includes(k))k+='_ar';
  const b=k.replace(/_ar$/,'');if(cnt[b]>1&&grp[i]){const o=E.owner(grp[i])||norm(grp[i]).replace(/ /g,'_');return o+'_'+(b==='telephone'?'tel':b)+(k.endsWith('_ar')?'_ar':'')}return k});
 t.labels=t.headers.map((h,i)=>grp[i]&&t.keys[i].includes('_')&&/^(papa|maman)_/.test(t.keys[i])?grp[i]+' · '+h:h);return t};
E.useTemplateKeys=(D,t)=>{t.headers.forEach((h,i)=>{if(h&&t.keys[i].startsWith('raw:'))D.extra.set(norm(h),t.keys[i])})};
E.segment=(full,D,opt)=>{const raw=String(full||'').replace(/\s+/g,' ').trim(),t=raw?raw.split(' '):[],n=t.map(norm);
 if(!t.length)return{prenom:'',nom:'',score:0,method:'vide',ambiguous:true};
 const iF=x=>D.f.has(x),iS=x=>D.s.has(x),iP=x=>D.p.has(x);
 if(t.length===1){const isS=iS(n[0]);return{prenom:isS?'':raw,nom:isS?raw:'',score:35,method:'mot unique : '+(isS?'prénom absent':'nom de famille absent'),ambiguous:true}};
 const defaultOrder=(opt&&opt.order)||'nom_first';
 const up=x=>/^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\-]+$/.test(x),H=[];
 for(let k=1;k<t.length;k++){
  const pAr=t.slice(0,k),pAn=n.slice(0,k),pBr=t.slice(k),pBn=n.slice(k);
  const cA=D.c.has(pAn.join(' ')),cB=D.c.has(pBn.join(' '));
  const upA=pAr.every(up)&&!pBr.some(up),upB=pBr.every(up)&&!pAr.some(up);
  {let s=(defaultOrder==='nom_first'?0.4:0);const w=[];
   if(upA){s+=4;w.push('convention NOM Prénom (majuscules)')}
   if(cB){s+=3;w.push('prénom composé connu')}
   if(cA){s-=3}
   for(let i=0;i<pAn.length;i++){const x=pAn[i];if(iP(x)){s+=(i===0?2.5:1);w.push('préfixe nom « '+pAr[i]+' »')}else if(iS(x)){s+=1.8;w.push('nom connu')}else if(iF(x)){s-=1.2}else if(/^(ال|بن)./.test(x)&&x.length>3){s+=1.2;w.push('forme de nom')}}
   for(let i=0;i<pBn.length;i++){const x=pBn[i];if(iP(x)&&!cB){s-=2.5}else if(iF(x)){s+=1.5;w.push('prénom connu')}else if(iS(x)){s-=1}}
   s+=(k===1?0.2:k===2?0.1:-0.5*(k-2));
   H.push({order:'nom_first',k,s,nom:pAr.join(' '),prenom:pBr.join(' '),why:w})}
  {let s=(defaultOrder==='prenom_first'?0.4:0);const w=[];
   if(upB){s+=4;w.push('convention Prénom NOM (majuscules)')}
   if(cA){s+=3;w.push('prénom composé connu')}
   if(cB){s-=3}
   for(let i=0;i<pAn.length;i++){const x=pAn[i];if(iP(x)&&!cA){s-=3;w.push('préfixe dans le prénom')}else if(iF(x)){s+=1.5;w.push('prénom connu')}else if(iS(x)){s-=1.2}}
   for(let i=0;i<pBn.length;i++){const x=pBn[i];if(iP(x)){s+=(i===0?2.5:1);w.push('préfixe nom « '+pBr[i]+' »')}else if(iS(x)){s+=1.8;w.push('nom connu')}else if(iF(x)){s-=1.2}else if(/^(ال|بن)./.test(x)&&x.length>3){s+=1.2;w.push('forme de nom')}}
   const pl=pAr.length;s+=(pl===1?0.2:pl===2?0.1:-0.5*(pl-2));
   H.push({order:'prenom_first',k,s,nom:pBr.join(' '),prenom:pAr.join(' '),why:w})}
 }
 H.sort((a,b)=>b.s-a.s);const b=H[0],margin=b.s-(H[1]?H[1].s:b.s-3);
 const known=n.filter(x=>iF(x)||iS(x)||iP(x)).length;let sc=Math.min(98,Math.max(10,Math.round(45+margin*8+known*8)));
 const amb=margin<1.0||known===0;if(amb)sc=Math.min(sc,65);
 const alt=H[1]?{prenom:H[1].prenom,nom:H[1].nom}:null;
 return{prenom:b.prenom,nom:b.nom,score:sc,method:(b.why.join(', ')||(b.order==='nom_first'?'convention NOM Prénom':'convention Prénom NOM'))+' ; '+H.length+' hypothèse(s)',ambiguous:amb,alt,order:b.order}};
E.parseDate=v=>{let d,m,y,warn='';
 if(typeof v==='number'&&v>20000&&v<60000){const D=new Date(Math.round((v-25569)*864e5));d=D.getUTCDate();m=D.getUTCMonth()+1;y=D.getUTCFullYear()}
 else{const s=String(v).trim();let x=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);if(x){y=+x[1];m=+x[2];d=+x[3]}
  else if(x=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)){d=+x[1];m=+x[2];y=+x[3];if(y<100)y+=y>30?1900:2000;if(d<=12&&m<=12&&d!==m)warn='format jj/mm supposé'}else return{err:'date illisible'}}
 const T=new Date(Date.UTC(y,m-1,d));if(m<1||m>12||T.getUTCDate()!==d)return{err:'date invalide'};
 const val=String(d).padStart(2,'0')+'/'+String(m).padStart(2,'0')+'/'+y;
 return{val,warn:(y<1990||y>new Date().getFullYear())?'année peu plausible':warn}};
E.parsePhone=v=>{let s=String(v).replace(/[^\d+]/g,'');s=s.replace(/^00212/,'').replace(/^\+?212/,'');if(/^[5-7]\d{8}$/.test(s))s='0'+s;return/^0[5-7]\d{8}$/.test(s)?{val:s}:{val:String(v).trim(),err:'téléphone invalide'}};
const cnt=q=>{const w=String(q||'').split(/\s+/).filter(Boolean);return w.filter((x,i)=>!(['el','al'].includes(norm(x))&&i<w.length-1)).length};
E.build=(tbl,mapping,D,cfg)=>{cfg=cfg||{};const tk=cfg.targetKeys||[],req=(cfg.required||['prenom','nom']).filter(k=>!tk.length||tk.includes(k)),rows=[];
 const nameOrder=cfg.nameOrder||'nom_first';
 const ord=k=>k.endsWith('nom_complet')?1:k.endsWith('nom_complet_ar')?2:0;
 const ms=[...mapping.filter(m=>m.key)].sort((a,b)=>ord(a.key)-ord(b.key));
 const lat=ms.find(m=>m.key==='nom_complet');let capsFirst=false;
 if(lat){const vs=tbl.rows.map(r=>String(r[lat.col]??'').trim()).filter(x=>x&&!isAr(x));capsFirst=vs.length>0&&vs.filter(x=>E.segment(x,D,{order:nameOrder}).order==='nom_first').length/vs.length>=.5}
 tbl.rows.forEach((r,ri)=>{const v={},is=[],ns=[];
  ms.forEach(m=>{const x=r[m.col];if(x===''||x==null||String(x).trim()==='')return;const k=m.key,P=(k.match(/^(papa_|maman_)/)||[''])[0],xs=String(x).trim();
   if(/nom_complet(_ar)?$/.test(k)){
    if(P&&/(^|[^A-Za-z0-9])P\s?[12]([^A-Za-z0-9]|$)/.test(xs)){is.push({lvl:'avertissement',msg:'nom de parent générique non transféré : '+xs});return}
    if(tk.includes(P+'nom_complet')&&!tk.includes(P+'prenom')){v[P+'nom_complet']=xs;return}
    const ar=isAr(xs)||k.endsWith('_ar');let s;
    if(ar&&tk.includes(P+'prenom_ar')){const t=xs.split(/\s+/),kf=cnt(v[P+'prenom']),kn=cnt(v[P+'nom']);
     if(kf&&kn&&t.length===kf+kn)s=capsFirst?{prenom:t.slice(kn).join(' '),nom:t.slice(0,kn).join(' '),score:85,method:'alignement avec le nom latin (nom en premier)',ambiguous:false}:{prenom:t.slice(0,kf).join(' '),nom:t.slice(kf).join(' '),score:85,method:'alignement avec le nom latin',ambiguous:false};
     else{s=E.segment(xs,D,{order:nameOrder});s.ambiguous=true;s.score=Math.min(s.score,60);s.method+=' (ordre non vérifié)'}
     v[P+'prenom_ar']=s.prenom;v[P+'nom_ar']=s.nom}
    else{s=E.segment(xs,D,{order:nameOrder});if(!v[P+'prenom']&&!v[P+'nom']){v[P+'prenom']=s.prenom;v[P+'nom']=s.nom}}
    if(!P)ns.push(s.score);if(s.ambiguous)is.push({lvl:'info',msg:'Segmentation ambiguë : '+s.method})}
   else if(k==='date_naissance'||k==='date_inscription'){const p=E.parseDate(x);if(p.err){is.push({lvl:'erreur',msg:p.err+' : '+x});v[k]=xs}else{v[k]=p.val;if(p.warn)is.push({lvl:'avertissement',msg:p.warn})}}
   else if(/(^|_)(telephone|tel|tel_parent)$/.test(k)){const p=E.parsePhone(x);if(p.err){is.push({lvl:'avertissement',msg:p.err+' ('+k+') : '+xs});v[k]=xs.replace(/\D/g,'').length>=6?p.val:''}else v[k]=p.val}
   else if(/(^|_)(prenom|nom)$/.test(k)&&isAr(xs)&&tk.includes(k+'_ar'))v[k+'_ar']=xs;
   else v[k]=xs});
  req.forEach(k=>{if(!v[k])is.push({lvl:'erreur',msg:'champ obligatoire absent : '+k})});
  const parts=[...ns,...ms.filter(m=>v[m.key]!=null&&!/nom_complet/.test(m.key)).map(m=>m.score*100)];
  rows.push({i:ri,orig:tbl.headers.map((h,i)=>r[i]),v,issues:is,nameScore:ns.length?Math.min(...ns):null,score:parts.length?Math.round(Math.min(...parts)):0})});
 const seen={};rows.forEach(r=>{[['massar',r.v.massar,'Massar répété'],['mat',r.v.matricule,'matricule répété'],['nm',norm((r.v.prenom||'')+' '+(r.v.nom||''))+'|'+(r.v.date_naissance||''),'doublon potentiel (nom + date)']].forEach(([t,k,msg])=>{if(!k||k==='|')return;const key=t+k;if(seen[key]!=null){r.issues.push({lvl:'avertissement',msg:msg+' avec la ligne '+(seen[key]+1)});r.dup=true}else seen[key]=r.i})});
 rows.forEach(r=>{r.status=r.issues.some(x=>x.lvl==='erreur')?'erreur':(r.issues.length||r.score<(cfg.medium||60))?'à vérifier':'valide'});return rows};
E.level=(s,t)=>{t=t||{vh:95,h:80,m:60};return s>=t.vh?'très haute':s>=t.h?'haute':s>=t.m?'moyenne':'faible'};
const covered=(k,tk)=>tk.includes(k)||/nom_complet(_ar)?$/.test(k)&&tk.some(x=>x.startsWith(k.replace(/nom_complet(_ar)?$/,'')+'prenom'));
E.report=(src,tpl,rows,ms)=>{const c=s=>rows.filter(r=>r.status===s).length,tk=tpl.keys||[];return{fichier_source:src.name||'',modele:tpl.name||'',feuille:src.sheet,ligne_entete:src.headerRow+1,lignes_detectees:src.rows.length,lignes_ignorees_parasites:src.ignored||0,lignes_converties:rows.length,lignes_valides:c('valide'),lignes_a_verifier:c('à vérifier'),erreurs_bloquantes:c('erreur'),doublons_potentiels:rows.filter(r=>r.dup).length,colonnes_reconnues:ms.filter(m=>m.key).length,colonnes_non_reconnues:ms.filter(m=>!m.key).length,colonnes_sans_cible_dans_le_modele:tk.length?ms.filter(m=>m.key&&!covered(m.key,tk)).map(m=>m.header):[],taux_mapping_auto:ms.length?Math.round(100*ms.filter(m=>m.key).length/ms.length):0}};
E.export=(X,tplWb,tpl,rows,src)=>{const ws=tplWb.Sheets[tpl.sheet];const aoa=rows.map(r=>tpl.keys.map(k=>r.v[k]==null?'':r.v[k]));
 X.utils.sheet_add_aoa(ws,aoa,{origin:{r:tpl.headerRow+1,c:0}});
 const isDark=rgb=>{if(!rgb||rgb.length<6)return true;const h=rgb.replace('#',''),r=parseInt(h.slice(0,2),16)||0,g=parseInt(h.slice(2,4),16)||0,b=parseInt(h.slice(4,6),16)||0;return(0.299*r+0.587*g+0.114*b)<150};
 const hr=tpl.headerRow;
 const srcStyle=(src&&(src.headerStyle||(src.colStyles&&src.colStyles.find(Boolean))))||null;
 const bgRgb=(srcStyle&&srcStyle.fill&&srcStyle.fill.fgColor&&srcStyle.fill.fgColor.rgb)||(srcStyle&&srcStyle.fgColor&&srcStyle.fgColor.rgb)||'1F3A8A';
 const defFont=(srcStyle&&srcStyle.font&&srcStyle.font.color&&srcStyle.font.color.rgb)||(isDark(bgRgb)?'FFFFFF':'1D2433');
 const baseHdr={fill:{fgColor:{rgb:bgRgb},patternType:'solid'},font:{bold:true,color:{rgb:defFont},name:(srcStyle&&srcStyle.font&&srcStyle.font.name)||'Calibri',sz:11},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{top:{style:'thin',color:{rgb:'D0D6E2'}},bottom:{style:'medium',color:{rgb:isDark(bgRgb)?'0F1D43':'666666'}},left:{style:'thin',color:{rgb:'D0D6E2'}},right:{style:'thin',color:{rgb:'D0D6E2'}}}};
 for(let c=0;c<tpl.keys.length;c++){const ref=X.utils.encode_cell({r:hr,c});if(!ws[ref])ws[ref]={t:'s',v:tpl.headers[c]||''};
  let cs=null;if(src&&src.mapping&&src.colStyles){const tk=tpl.keys[c],m=src.mapping.find(x=>x.key===tk)||(tk&&(tk.includes('prenom')||tk.includes('nom'))?src.mapping.find(x=>/nom_complet/.test(x.key)):null);if(m&&src.colStyles[m.col])cs=src.colStyles[m.col]}
  const fin=Object.assign({},baseHdr);if(cs){const cRgb=(cs.fill&&cs.fill.fgColor&&cs.fill.fgColor.rgb)||(cs.fgColor&&cs.fgColor.rgb);if(cRgb){fin.fill={fgColor:{rgb:cRgb},patternType:'solid'};fin.font=Object.assign({},fin.font,{color:{rgb:isDark(cRgb)?'FFFFFF':'1D2433'}})}}
  ws[ref].s=fin}
 ws['!rows']=ws['!rows']||[];ws['!rows'][hr]=(src&&src.headerRowHeight)?src.headerRowHeight:{hpt:26,hpx:26};
 if(hr>0){ws['!rows'][hr-1]={hpt:22,hpx:22};for(let c=0;c<tpl.keys.length;c++){const gRef=X.utils.encode_cell({r:hr-1,c});if(ws[gRef]&&ws[gRef].v)ws[gRef].s=Object.assign({},baseHdr,{font:Object.assign({},baseHdr.font,{sz:12}),alignment:{horizontal:'center',vertical:'center'}})}}
 ws['!cols']=tpl.keys.map((k,i)=>{const ml=Math.max((tpl.headers[i]||'').length,...rows.slice(0,50).map(r=>String(r.v[k]||'').length));return{wch:Math.min(38,Math.max(14,ml+3))}});
 return X.write(tplWb,{type:'array',bookType:'xlsx',cellStyles:true})};
E.flipNames=rows=>{if(!rows)return rows;rows.forEach(r=>{[['prenom','nom'],['prenom_ar','nom_ar'],['papa_prenom','papa_nom'],['maman_prenom','maman_nom']].forEach(([p,n])=>{if(r.v[p]!=null||r.v[n]!=null){const tmp=r.v[p];r.v[p]=r.v[n]||'';r.v[n]=tmp||''}});r.edited=1});return rows};

// === MODULE MULTI-FICHIERS (FUSION, RÉCONCILIATION & PDF) ===
E.parsePdf = async function(data, pdfLib) {
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
    yGroups.sort((a,b) => b.y - a.y);
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
      g.items.sort((a,b) => a.transform[4] - b.transform[4]);
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

E.parseContactPhones = function(contact) {
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
        const formatted = cur.slice(0,2) + ' ' + cur.slice(2,4) + ' ' + cur.slice(4,6) + ' ' + cur.slice(6,8) + ' ' + cur.slice(8,10);
        nums.push({ role, type, num: formatted });
        cur = '';
        type = 'P';
      } else if (cur.length > 10) {
        const ten = cur.slice(0, 10);
        if (/^0[5-7]/.test(ten)) {
          nums.push({ role, type, num: ten.slice(0,2)+' '+ten.slice(2,4)+' '+ten.slice(4,6)+' '+ten.slice(6,8)+' '+ten.slice(8,10) });
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
    const digits = String(val).replace(/\D/g, '');
    if (digits.length === 10 && /^0[5-7]/.test(digits)) {
      return digits.slice(0,2)+' '+digits.slice(2,4)+' '+digits.slice(4,6)+' '+digits.slice(6,8)+' '+digits.slice(8,10);
    }
    if (digits.length === 9 && /^[5-7]/.test(digits)) {
      const d = '0' + digits;
      return d.slice(0,2)+' '+d.slice(2,4)+' '+d.slice(4,6)+' '+d.slice(6,8)+' '+d.slice(8,10);
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

  return res;
};

E.parseMassarWorkbook = function(X, wb) {
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
        if (idx !== -1 && row[idx+2]) niveau = String(row[idx+2]).trim();
      }
      if (str.includes('القسم')) {
        const idx = row.findIndex(c => String(c).includes('القسم'));
        if (idx !== -1 && row[idx+2]) classe = String(row[idx+2]).trim();
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

E.detectFileRole = function(name, rows) {
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

E.translitArToFr = function(ar, D) {
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

E.reconcileMulti = function(sources, D, cfg) {
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
    for (let c of candidates) {
      if (obj[c] != null && String(obj[c]).trim() !== '') return String(obj[c]).trim();
      const lc = c.toLowerCase();
      for (let k of Object.keys(obj)) {
        if (k.toLowerCase() === lc && obj[k] != null && String(obj[k]).trim() !== '') {
          return String(obj[k]).trim();
        }
      }
    }
    return '';
  }

  function getExtraCols(obj) {
    const extra = {};
    const std = ['matricule','mat','cne','code_massar','nom','prenom','nom_complet','eleve','classe','niveau','date_inscription','date_naissance','genre','sexe','resp','conj','gsm_papa','gsm_maman','autre_tel_papa','autre_tel_maman','nom_papa','nom_maman','prenom_papa','prenom_maman'];
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

  for (let ins of inscritsRows) {
    const mat = getFld(ins, 'matricule', 'mat', 'id');
    const rawNom = getFld(ins, 'nom_complet', 'eleve', 'nom');
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
      const p = E.parseContactPhones(ins);
      if (!existing.gsm_papa && p.gsm_papa) existing.gsm_papa = p.gsm_papa;
      if (!existing.gsm_maman && p.gsm_maman) existing.gsm_maman = p.gsm_maman;
      Object.assign(existing.extra, extra);
    } else {
      let nom_fr = '', prenom_fr = '';
      if (D && rawNom) {
        const seg = E.segment(rawNom, D, { order: nameOrder });
        nom_fr = seg.nom;
        prenom_fr = seg.prenom;
      } else {
        const parts = rawNom.split(/\s+/);
        nom_fr = parts[0] || '';
        prenom_fr = parts.slice(1).join(' ') || '';
      }

      const contact = contactsByMat[mat] || {};
      const phones = E.parseContactPhones({ ...contact, ...ins });

      const newStudent = {
        matricule: mat,
        nom_complet_ecole: rawNom,
        nom_fr: getFld(ins, 'nom_fr', 'nom') || nom_fr,
        prenom_fr: getFld(ins, 'prenom_fr', 'prenom') || prenom_fr,
        date_inscription: getFld(ins, 'date_inscription'),
        date_naissance: getFld(ins, 'date_naissance'),
        genre: getFld(ins, 'genre', 'sexe'),
        niveau_ecole: getFld(ins, 'niveau_ecole', 'niveau'),
        classe_ecole: getFld(ins, 'classe_ecole', 'classe', 'groupe'),
        extra,
        ...phones
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
        extra: sch.extra || {}
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
        extra: sch.extra || {}
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

E.exportMulti = function(X, recResult) {
  const wb = X.utils.book_new();
  const colsDef = [
    { k: 'matricule', h: 'Matricule', w: 12 },
    { k: 'code_massar', h: 'Code Massar', w: 14 },
    { k: 'nom_fr', h: 'Nom (FR)', w: 18 },
    { k: 'prenom_fr', h: 'Prénom (FR)', w: 18 },
    { k: 'nom_ar', h: 'النسب (AR)', w: 16 },
    { k: 'prenom_ar', h: 'الإسم (AR)', w: 16 },
    { k: 'genre', h: 'Genre', w: 10 },
    { k: 'date_naissance', h: 'Date de naissance', w: 15 },
    { k: 'niveau_massar', h: 'Niveau (Massar)', w: 26 },
    { k: 'classe_massar', h: 'Classe (Massar)', w: 14 },
    { k: 'niveau_ecole', h: 'Niveau (école)', w: 20 },
    { k: 'classe_ecole', h: 'Classe (école)', w: 14 },
    { k: 'date_inscription', h: "Date d'inscription", w: 15 },
    { k: 'nom_maman', h: 'Nom Maman', w: 12 },
    { k: 'prenom_maman', h: 'Prénom Maman', w: 12 },
    { k: 'gsm_maman', h: 'GSM Maman', w: 16 },
    { k: 'autre_tel_maman', h: 'Autre tél. Maman', w: 16 },
    { k: 'nom_papa', h: 'Nom Papa', w: 12 },
    { k: 'prenom_papa', h: 'Prénom Papa', w: 12 },
    { k: 'gsm_papa', h: 'GSM Papa', w: 16 },
    { k: 'autre_tel_papa', h: 'Autre tél. Papa', w: 16 },
    { k: 'statut', h: 'Statut liaison', w: 28 },
    { k: 'nom_ecole', h: 'Nom dans le PDF école', w: 24 }
  ];

  const baseHdr = {
    fill: { fgColor: { rgb: '1F3A8A' }, patternType: 'solid' },
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'D0D6E2' } },
      bottom: { style: 'medium', color: { rgb: '0F1D43' } },
      left: { style: 'thin', color: { rgb: 'D0D6E2' } },
      right: { style: 'thin', color: { rgb: 'D0D6E2' } }
    }
  };

  const allExtraKeys = new Set();
  (recResult.rows || []).forEach(r => {
    if (r.extra) Object.keys(r.extra).forEach(k => allExtraKeys.add(k));
  });
  const fullCols = [...colsDef];
  for (let xk of allExtraKeys) {
    fullCols.push({
      k: 'extra_' + xk,
      h: xk,
      w: Math.max(14, xk.length + 3),
      isExtra: true,
      origKey: xk
    });
  }

  function makeSheet(rows) {
    const aoa = [fullCols.map(c => c.h)];
    rows.forEach(r => {
      aoa.push(fullCols.map(c => {
        if (c.isExtra) return (r.extra && r.extra[c.origKey] != null ? r.extra[c.origKey] : '');
        return r[c.k] != null ? r[c.k] : '';
      }));
    });
    const ws = X.utils.aoa_to_sheet(aoa);
    for (let c = 0; c < fullCols.length; c++) {
      const ref = X.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = baseHdr;
    }
    ws['!rows'] = [{ hpt: 26, hpx: 26 }];
    ws['!cols'] = fullCols.map(c => ({ wch: c.w }));
    return ws;
  }

  // Sheet 1: Élèves & Parents
  X.utils.book_append_sheet(wb, makeSheet(recResult.rows), 'Élèves & Parents');

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
if(typeof module!=='undefined')module.exports=E;else g.BotiEngine=E})(this);
