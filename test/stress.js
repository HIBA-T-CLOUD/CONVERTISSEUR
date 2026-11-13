const fs=require('fs'),E=require('../js/engine.js');
const D=E.loadDict(JSON.parse(fs.readFileSync(__dirname+'/../data/dictionaries.json','utf8')));
const N=[
['Mohamed Reda El Idrissi','Mohamed Reda','El Idrissi'],['Khadija Bennani','Khadija','Bennani'],['Youssef Ben El Arbi','Youssef','Ben El Arbi'],
['Hajar Ait Ouali','Hajar','Ait Ouali'],['Anas Bou Zidi','Anas','Bou Zidi'],['Imane El-Fassi','Imane','El-Fassi'],['Omar Ait-Taleb','Omar','Ait-Taleb'],
['Meryem Ben Ali','Meryem','Ben Ali'],['Adam Tazi','Adam','Tazi'],['Salma Lahlou','Salma','Lahlou'],['Ilyas Chraibi','Ilyas','Chraibi'],
['Fatima Zahra Ait Benhaddou','Fatima Zahra','Ait Benhaddou'],['Nour El Houda Berrada','Nour El Houda','Berrada'],['Sara Lahrichi','Sara','Lahrichi'],
['Hamza Ouazzani','Hamza','Ouazzani'],['Rania Slimani','Rania','Slimani'],['Ayoub El Khayat','Ayoub','El Khayat'],['John Smith','John','Smith'],
['Marie Dupont','Marie','Dupont'],['BENALI Fatima Zahra','Fatima Zahra','BENALI'],['EL FASSI Mohamed Amine','Mohamed Amine','EL FASSI'],
['أمينة الإدريسي','أمينة','الإدريسي'],['عبد الله بن يوسف','عبد الله','بن يوسف'],['ياسين أيت علي','ياسين','أيت علي'],['خديجة آل سعود','خديجة','آل سعود'],
['فاطمة الزهراء الفاسي','فاطمة الزهراء','الفاسي'],['محمد رضا بنعلي','محمد رضا','بنعلي'],['سارة المنصوري','سارة','المنصوري'],
['Mohamed-Amine Alaoui','Mohamed-Amine','Alaoui'],['Yassine Bouzid Alami','Yassine','Bouzid Alami'],['Zineb Kettani','Zineb','Kettani'],['Soufiane Rhazi','Soufiane','Rhazi']];
let g=0,amb=0,wrongConf=0;N.forEach(([f,p,n])=>{const s=E.segment(f,D),a=s.prenom===p&&s.nom===n;g+=a;if(!a){console.log((s.ambiguous?'~amb ':'XX    ')+f+' → ['+s.prenom+'] ['+s.nom+'] '+s.score);if(!s.ambiguous)wrongConf++}else if(s.ambiguous)amb++});
console.log('Exact '+g+'/'+N.length+' | corrects mais signalés ambigus: '+amb+' | FAUX sans alerte: '+wrongConf);
