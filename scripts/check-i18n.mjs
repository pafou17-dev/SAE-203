import fs from 'node:fs';
import assert from 'node:assert/strict';
import {translate,hasTranslation} from '../public/i18n.js';
import {messages} from '../public/translations.js';
const proper=new Set(['65200 Bagnères-de-Bigorre','Bus T2','Bus T8','CYCLE’UP PYRÉNÉES','Cycle’Up','Cycle’Up Pyrénées','Cycle’Up Pyrénées.','Haute-Bigorre','IUT','Rosalie','Français','English','Español','FR','EN','ES']);
const decode=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
let checked=0;
for(const file of ['public/index.html','public/boite-a-idees/index.html','public/contact/index.html']){
 const html=fs.readFileSync(file,'utf8').replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const texts=[...html.matchAll(/>([^<>]+)</g)].map(m=>decode(m[1]));
 texts.push(...[...html.matchAll(/(?:aria-label|aria-valuetext|alt|title|placeholder|content)="([^"]*)"/g)].map(m=>decode(m[1])));
 for(const text of texts){
  if(!/[\p{L}]/u.test(text)||/^#|^width=/.test(text)||proper.has(text))continue;
  assert.ok(hasTranslation(text),`${file}: missing translation for ${text}`);checked++;
 }
 assert.ok(html.includes('data-language-select'),`${file}: missing picker`);
}
for(const [source,pair] of Object.entries(messages)){
 assert.equal(pair.length,2);pair.forEach(value=>assert.ok(value.trim(),source));
 assert.equal(translate(source,'fr'),source,'French must round-trip unchanged');
}
for(const name of ['rosalie-cycleup.glb','rosalie-cargo.glb','rosalie-pluie.glb']){
 const b=fs.readFileSync('public/assets/'+name),length=b.readUInt32LE(12),model=JSON.parse(b.subarray(20,20+length));
 for(const node of model.nodes)for(const key of ['partName','partSubtitle'])if(node.extras?.[key]&&node.extras[key]!=='Bafang M400')assert.ok(hasTranslation(node.extras[key]),node.extras[key]);
}
assert.equal(translate('Classique','en'),'Classic');
assert.equal(translate('Protection pluie','es'),'Antilluvia');
assert.equal(translate('17 éléments principaux','es'),'17 elementos principales');
assert.equal(translate('Votre choix : Protection pluie','en'),'Your choice: Rain cover');
assert.equal(translate('Modèle suivant : Protection pluie','es'),'Modelo siguiente: Antilluvia');
assert.equal(translate('Chargement · Protection pluie · 80 %','en'),'Loading · Rain cover · 80%');
assert.equal(translate('3 commentaires','es'),'3 comentarios');
assert.equal(translate('Partir à 7 h 30 · arrivée 8 h 18 · 48 min · 1 correspondance','en'),'Depart 7:30 · arrive 8:18 · 48 min · 1 connection');
assert.equal(translate('6,4 km · 4 étapes','en'),'6.4 km · 4 stages');
assert.equal(translate('Failed to fetch','fr'),'Impossible de joindre le service. Réessayez.');
assert.equal(translate('Séméac — departure (example) → IUT de Tarbes','es'),'Séméac — salida (ejemplo) → IUT de Tarbes');
console.log(`PASS: ${checked} static texts/accessibility labels, ${Object.keys(messages).length} complete translation pairs, all 3D part names, model/loading/vote/map templates and exact French fallback.`);
