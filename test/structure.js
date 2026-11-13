// Structure inspirée d'un cas réel (données fictives) : titres, en-tête décalé, modèle à groupes PAPA/MAMAN, nom arabe en ordre "nom prénom"
const X=(()=>{try{return require('xlsx-js-style')}catch(e){return require('xlsx')}})(),fs=require('fs'),E=require('../js/engine.js');
const D=E.loadDict(JSON.parse(fs.readFileSync(__dirname+'/../data/dictionaries.json','utf8')));
let ok=0,ko=0;const t=(n,c,d)=>{c?ok++:(ko++,console.log('ÉCHEC',n,d||''))};
const wb=(aoa,r0,merges)=>{const w=X.utils.book_new(),ws={};X.utils.sheet_add_aoa(ws,aoa,{origin:{r:r0,c:0}});if(merges)ws['!merges']=merges;X.utils.book_append_sheet(w,ws,'S');return w};
const th=['ID','Sexe','Massar','Matricule','Nom','Prénom','الإسم','النسب','Adresse','Date de naissance','Niveau','Groupe',"Date d'inscription",'Ancien établissement'];const pg=['Nom','Prénom','Tel','Email','CIN','Fonction'];
const tw=wb([[...Array(14).fill(''),'PAPA',...Array(5).fill(''),'MAMAN'],[...th,...pg,...pg]],0,[{s:{r:0,c:14},e:{r:0,c:19}},{s:{r:0,c:20},e:{r:0,c:25}}]);
const tpl=E.templateInfo(X,tw,D);E.useTemplateKeys(D,tpl);
t('modèle : 26 clés uniques',new Set(tpl.keys).size===26&&tpl.keys[14]==='papa_nom'&&tpl.keys[22]==='maman_tel'&&tpl.keys[6]==='prenom_ar'&&tpl.keys[7]==='nom_ar',tpl.keys.join());
const H=['N°','Matricule','Code massar','Nom et prénom','Nom et prénom (ar)','Niveau','Classe','Sexe','Date de naissance','Date d\'entrée','Nom et prénom parent 1','Tél parent 1','Nom et prénom parent 2','Tél parent 2','Der. établissement'];
const src=wb([['Liste globale'],['2025/2026'],[],[],[],[],[],H,
 [1,'M1','F1','AABOUCH Yazan','اعبوش يزان','CE6','6A','Garçon','2014-06-27','','AABOUCH P1 - Yazan',212667781968,'   ','Tél parent 1','École X'],
 [2,'M2','F2','EL FASSI Mohamed Amine','الفاسي محمد أمين','CM1','5B','Garçon','15/03/2015','','EL FASSI Karim','06 61 23 45 67','BENALI Sara','0612345678','École X'],
 ['','','','','','','','','','','','','','','École X']],1,[{s:{r:9,c:6},e:{r:10,c:6}}]);
const a=E.analyze(X,src,D);t('en-tête absolu (ligne 9)',a.headerRow===8,a.headerRow);t('ligne parasite ignorée',a.ignored===1&&a.rows.length===2,a.ignored+'/'+a.rows.length);
const R=E.build(a,a.mapping,D,{targetKeys:tpl.keys});const v=R[0].v,w=R[1].v;
t('nom MAJUSCULES en premier',v.prenom==='Yazan'&&v.nom==='AABOUCH'&&w.prenom==='Mohamed Amine'&&w.nom==='EL FASSI');
t('arabe nom-prénom aligné',v.prenom_ar==='يزان'&&v.nom_ar==='اعبوش'&&w.prenom_ar==='محمد أمين'&&w.nom_ar==='الفاسي',JSON.stringify(w));
t('parents papa/maman',w.papa_nom==='EL FASSI'&&w.papa_prenom==='Karim'&&w.papa_tel==='0661234567'&&w.maman_nom==='BENALI'&&w.maman_tel==='0612345678');
t('parent générique non transféré',!v.papa_nom&&!v.papa_prenom&&v.papa_tel==='0667781968'&&R[0].issues.some(i=>/générique/.test(i.msg)));
t('téléphone corrompu vidé + alerte',v.maman_tel===''&&R[0].issues.some(i=>/téléphone invalide/.test(i.msg)));
const out=X.read(E.export(X,tw,tpl,R),{type:'array'}),g=X.utils.sheet_to_json(out.Sheets.S,{header:1});
t('export aligné sur le modèle',g[1][4]==='Nom'&&g[2][4]==='AABOUCH'&&g[2][14]===''&&g[3][14]==='EL FASSI'&&g.length===4&&out.Sheets.S['!merges'].length===2);
console.log(ok+' réussis, '+ko+' échecs');process.exit(ko?1:0)
