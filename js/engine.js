(function(g){
const E={};
const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().replace(/['’\-_.:\/()]+/g,' ').replace(/[^a-z0-9\u0600-\u06FF ]+/g,' ').replace(/\s+/g,' ').trim();
const lev=(a,b)=>{const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]};
const sim=(a,b)=>a||b?1-lev(a,b)/Math.max(a.length,b.length):0;
E.norm=norm;E.sim=sim;
E.loadDict=j=>{const S=a=>new Set(a.map(norm));
 const syn=[];for(const k in j.fields)j.fields[k].forEach(s=>syn.push({k,s:norm(s)}));
 return{syn,extra:new Map(),f:S([...j.first_names_fr,...j.first_names_en,...j.first_names_ar]),c:S(j.compound_first_names),s:S(j.moroccan_surnames),p:S(j.name_prefixes)}};
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
if(typeof module!=='undefined')module.exports=E;else g.BotiEngine=E})(this);
