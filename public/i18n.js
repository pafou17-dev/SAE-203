import {messages} from './translations.js';

export const languages=['fr','en','es'];
const localeCodes={fr:'fr-FR',en:'en-GB',es:'es-ES'};
const normalise=text=>String(text).replace(/\s+/g,' ').trim();
const cache=new Map();
const reverseMessages=new Map();
Object.entries(messages).forEach(([fr,pair])=>pair.forEach(value=>{if(!Object.hasOwn(messages,value))reverseMessages.set(normalise(value),fr);}));
function canonical(source){
  const key=normalise(source);
  if(['Failed to fetch','NetworkError when attempting to fetch resource.','Load failed'].includes(key))return 'Impossible de joindre le service. Réessayez.';
  if(Object.hasOwn(messages,key))return source;
  if(reverseMessages.has(key))return reverseMessages.get(key);
  if(key.includes(' → '))return source.split(/(\s+→\s+)/).map((part,index)=>index%2?part:canonical(part)).join('');
  if(key.includes(' · '))return source.split(/(\s+·\s+)/).map((part,index)=>index%2?part:canonical(part)).join('');
  return source;
}
const modelName=(value,lang)=>translate(value,lang);
const patterns=[
  [/^Afficher (.+)$/, (m,l)=>l==='en'?`Show ${translate(m[1],l)}`:`Mostrar ${translate(m[1],l)}`],
  [/^Agrandir la photo : (.+)$/, (m,l)=>l==='en'?`Enlarge photo: ${translate(m[1],l)}`:`Ampliar foto: ${translate(m[1],l)}`],
  [/^Personnage illustré du profil (.+)$/, (m,l)=>l==='en'?`Illustration for the ${translate(m[1],l)} profile`:`Personaje ilustrado del perfil ${translate(m[1],l)}`],
  [/^Voir le modèle (.+)$/, (m,l)=>l==='en'?`View the ${modelName(m[1],l)} model`:`Ver el modelo ${modelName(m[1],l)}`],
  [/^Explorer la version (.+) en 3D$/, (m,l)=>l==='en'?`Explore ${modelName(m[1],l)} in 3D`:`Explorar ${modelName(m[1],l)} en 3D`],
  [/^Modèle (précédent|suivant) : (.+)$/, (m,l)=>`${l==='en'?(m[1]==='précédent'?'Previous':'Next'):(m[1]==='précédent'?'Modelo anterior':'Modelo siguiente')}${l==='en'?' model':''}: ${modelName(m[2],l)}`],
  [/^Rosalie (.+), vue de trois quarts\.$/, (m,l)=>l==='en'?`${modelName(m[1],l)} Rosalie, three-quarter view.`:`Rosalie ${modelName(m[1],l)}, vista de tres cuartos.`],
  [/^(\d+) éléments principaux$/, (m,l)=>l==='en'?`${m[1]} main parts`:`${m[1]} elementos principales`],
  [/^(Assemblé|Assemblée|Vue éclatée), (\d+) %$/, (m,l)=>`${translate(m[1],l)}, ${m[2]}${l==='en'?'%':' %'}`],
  [/^Chargement · (.+?)(?: · (\d+) %|…)$/, (m,l)=>`${l==='en'?'Loading':'Cargando'} · ${modelName(m[1],l)}${m[2]?` · ${m[2]}${l==='en'?'%':' %'}`:'…'}`],
  [/^Votre choix : (.+)$/, (m,l)=>`${l==='en'?'Your choice':'Tu elección'}: ${modelName(m[1],l)}`],
  [/^Part des votes pour (.+)$/, (m,l)=>l==='en'?`Share of votes for ${modelName(m[1],l)}`:`Porcentaje de votos para ${modelName(m[1],l)}`],
  [/^(\d+) votes? sur (\d+), (\d+) %$/, (m,l)=>l==='en'?`${m[1]} ${m[1]==='1'?'vote':'votes'} out of ${m[2]}, ${m[3]}%`:`${m[1]} ${m[1]==='1'?'voto':'votos'} de ${m[2]}, ${m[3]} %`],
  [/^(\d+) (votes?|commentaires?)$/, (m,l)=>`${m[1]} ${m[2].startsWith('vote')?(l==='en'?'vote':'voto'):(l==='en'?'comment':'comentario')}${m[1]==='1'?'':'s'}`],
  [/^(\d[\d\s]*) \/ 1 200$/, (m,l)=>`${Number(m[1].replace(/\s/g,'')).toLocaleString(localeCodes[l])} / ${Number(1200).toLocaleString(localeCodes[l])}`],
  [/^(\d+) %$/, (m,l)=>`${m[1]}${l==='en'?'%':' %'}`],
  [/^vers (.+)$/, (m,l)=>`${l==='en'?'towards':'hacia'} ${translate(m[1],l)}`],
  [/^Lignes (.+)$/, (m,l)=>`${l==='en'?'Routes':'Líneas'} ${m[1]}`],
  [/^Marcher jusqu’à (.+)$/, (m,l)=>`${l==='en'?'Walk to':'Caminar hasta'} ${m[1]}`],
  [/^Correspondance à (.+)$/, (m,l)=>`${l==='en'?'Change at':'Enlace en'} ${m[1]}`],
  [/^(\d+) arrêts$/, (m,l)=>`${m[1]} ${l==='en'?'stops':'paradas'}`],
  [/^(\d+) min d’attente$/, (m,l)=>`${m[1]} min ${l==='en'?'wait':'de espera'}`],
  [/^(\d+) min à pied$/, (m,l)=>`${m[1]} min ${l==='en'?'on foot':'a pie'}`],
  [/^(\d+) étapes$/, (m,l)=>`${m[1]} ${l==='en'?'stages':'etapas'}`],
  [/^retard (\d+) min$/, (m,l)=>l==='en'?`${m[1]} min delay`:`retraso de ${m[1]} min`],
  [/^(\d+) sur (\d+) places$/, (m,l)=>l==='en'?`${m[1]} of ${m[2]} seats`:`${m[1]} de ${m[2]} plazas`],
  [/^ : toutes les (\d+) min$/, (m,l)=>l==='en'?`: every ${m[1]} min`:`: cada ${m[1]} min`],
  [/^(T\d+|960) : toutes les (\d+) min$/, (m,l)=>l==='en'?`${m[1]}: every ${m[2]} min`:`${m[1]}: cada ${m[2]} min`],
  [/^à (.+?)( de vous| du point de départ)?$/, (m,l)=>`${translate(m[1],l)}${m[2]?(l==='en'?(m[2]===' de vous'?' from you':' from the departure point'):(m[2]===' de vous'?' desde tu ubicación':' desde el punto de salida')):''}`],
  [/^Arrêt de bus · (.+)$/, (m,l)=>`${l==='en'?'Bus stop':'Parada de autobús'} · ${translate(m[1],l)}`],
  [/^, à (.+)$/, (m,l)=>`, ${translate('à '+m[1],l)}`],
  [/^Partir à (\d+ h \d+) · arrivée (\d+ h \d+) · (\d+) min · (\d+) correspondances?$/, (m,l)=>l==='en'?`Depart ${m[1].replace(' h ',':')} · arrive ${m[2].replace(' h ',':')} · ${m[3]} min · ${m[4]} ${m[4]==='1'?'connection':'connections'}`:`Salida ${m[1].replace(' h ',':')} · llegada ${m[2].replace(' h ',':')} · ${m[3]} min · ${m[4]} ${m[4]==='1'?'enlace':'enlaces'}`],
  [/^Station vélos — (.+)$/, (m,l)=>`${l==='en'?'Bike station':'Estación de bicicletas'} — ${m[1]}`],
  [/^Aire de covoiturage — (.+)$/, (m,l)=>`${l==='en'?'Car-sharing area':'Área de coche compartido'} — ${m[1]}`],
  [/^Arrêt (.+), lignes (.+)$/, (m,l)=>`${l==='en'?'Stop':'Parada'} ${m[1]}, ${l==='en'?'routes':'líneas'} ${m[2].replace(/ et /g,l==='en'?' and ':' y ')}`],
  [/^(.+), (\d+) vélos disponibles$/, (m,l)=>`${translate(m[1],l)}, ${m[2]} ${l==='en'?'bikes available':'bicicletas disponibles'}`],
  [/^Rosalie (\d+) : (.+), (\d+) disponibles?$/, (m,l)=>`Rosalie ${m[1]}: ${translate(m[2],l)}, ${m[3]} ${l==='en'?'available':(m[3]==='1'?'disponible':'disponibles')}`],
  [/^Itinéraire de la Rosalie (\d+)$/, (m,l)=>l==='en'?`Route of Rosalie ${m[1]}`:`Itinerario de Rosalie ${m[1]}`],
  [/^Arrivée de la Rosalie (\d+) : (.+)$/, (m,l)=>l==='en'?`Arrival of Rosalie ${m[1]}: ${m[2]}`:`Llegada de Rosalie ${m[1]}: ${m[2]}`],
  [/^Le fond « (.+) » ne répond pas : passage au fond « (.+) »\.$/, (m,l)=>l==='en'?`The ‘${m[1]}’ map layer is unavailable. Switching to ‘${m[2]}’.`:`El fondo «${m[1]}» no responde. Se utiliza «${m[2]}».`]
];

export function translate(source,language='fr'){
  source=canonical(String(source));
  const key=normalise(source);
  if(language==='fr'||!languages.includes(language)||!key)return String(source);
  const cacheKey=language+'|'+key;
  if(cache.has(cacheKey))return cache.get(cacheKey);
  let translated=messages[key]?.[language==='en'?0:1];
  if(translated===undefined){
    for(const [pattern,render] of patterns){const match=key.match(pattern);if(match){translated=render(match,language);break;}}
  }
  if(translated===undefined&&key.includes(' · '))translated=key.split(' · ').map(part=>translate(part,language)).join(' · ');
  if(translated===undefined&&key.includes(' → '))translated=key.split(' → ').map(part=>translate(part,language)).join(' → ');
  if(translated===undefined)translated=key.replace(/(\d{1,2}) h (\d{2})/g,'$1:$2');
  if(language==='en')translated=translated.replace(/(\d),(\d+)(?=\s*(?:km|%))/g,'$1.$2');
  if(cache.size>4000)cache.clear();cache.set(cacheKey,translated);return translated;
}

export function hasTranslation(source){
  const key=normalise(source);
  return Object.hasOwn(messages,key)||patterns.some(([pattern])=>pattern.test(key));
}

if(typeof document!=='undefined')initialise();

function initialise(){
  const storageKey='cycleup-language';
  let language='fr';
  try{const requested=new URL(location.href).searchParams.get('lang');language=languages.includes(requested)?requested:(localStorage.getItem(storageKey)||'fr');if(languages.includes(requested))localStorage.setItem(storageKey,language);}catch{}
  if(!languages.includes(language))language='fr';
  const textBindings=new WeakMap(),attributeBindings=new WeakMap();
  const attributes=['aria-label','aria-valuetext','title','alt','placeholder'];
  const ignored='script,style,svg,textarea,input,code,pre,[data-no-translate],.comment-meta strong,.comment-item p';
  function translateNode(node){
    if(!node.parentElement||node.parentElement.closest(ignored)||!/[\p{L}]/u.test(node.data))return;
    if(node.parentElement.closest('time[datetime]'))return;
    let binding=textBindings.get(node);
    if(!binding||node.data!==binding.last)binding={source:canonical(node.data),last:node.data};
    const source=binding.source,key=normalise(source);
    const value=language==='fr'?source:(source.match(/^\s*/)?.[0]||'')+translate(key,language)+(source.match(/\s*$/)?.[0]||'');
    binding.last=value;textBindings.set(node,binding);
    if(node.data!==value)node.data=value;
  }
  function translateAttributes(element){
    if(element.matches('script,style,[data-no-translate]')||element.closest('.comment-meta strong,.comment-item p'))return;
    let bindings=attributeBindings.get(element);if(!bindings){bindings=new Map();attributeBindings.set(element,bindings);}
    const names=element.matches('meta[name="description"]')?[...attributes,'content']:attributes;
    for(const name of names){
      const current=element.getAttribute(name);if(!current)continue;
      let binding=bindings.get(name);
      if(!binding||binding.last!==current)binding={source:canonical(current),last:current};
      const value=translate(binding.source,language);binding.last=value;bindings.set(name,binding);
      if(value!==current)element.setAttribute(name,value);
    }
  }
  function translateTime(element){
    const value=new Date(element.dateTime);
    if(!Number.isNaN(value.getTime())){
      const text=new Intl.DateTimeFormat(localeCodes[language],{day:'numeric',month:'short',year:'numeric'}).format(value);
      if(element.textContent!==text)element.textContent=text;
    }
  }
  function translateElement(root){
    if(root.nodeType===Node.TEXT_NODE){translateNode(root);return;}
    if(!(root instanceof Element)||root.matches('script,style,svg,[data-no-translate]'))return;
    translateAttributes(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())translateNode(walker.currentNode);
    root.querySelectorAll('[aria-label],[aria-valuetext],[title],[alt],[placeholder],meta[name="description"]').forEach(translateAttributes);
    if(root.matches('time[datetime]'))translateTime(root);
    root.querySelectorAll('time[datetime]').forEach(translateTime);
  }
  function translateDemoInputs(){
    document.querySelectorAll('[data-cu="de"],[data-cu="a"]').forEach(input=>{
      const source=canonical(input.value);
      if(['Séméac — départ (exemple)','IUT de Tarbes'].includes(source))input.value=translate(source,language);
    });
  }
  function applyLanguage(next,persist=false){
    if(!languages.includes(next))return;
    language=next;document.documentElement.lang=language;
    document.querySelectorAll('[data-language-select]').forEach(select=>{select.value=language;});
    translateElement(document.head);translateElement(document.body);translateDemoInputs();
    if(persist){
      try{localStorage.setItem(storageKey,language);}catch{}
      const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(history.state,'',url);
    }
    document.dispatchEvent(new CustomEvent('cycleup:languagechange',{detail:{language}}));
  }
  document.querySelectorAll('[data-language-select]').forEach(select=>select.addEventListener('change',()=>applyLanguage(select.value,true)));
  document.addEventListener('input',event=>{
    const field=event.target;
    if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)field.setCustomValidity('');
  });
  document.addEventListener('invalid',event=>{
    const field=event.target;
    if(field.id!=='opinion-body')return;
    const message=field.validity.valueMissing?'Écrivez un commentaire.':field.validity.tooShort?'Le commentaire doit contenir au moins 12 caractères.':'';
    field.setCustomValidity(translate(message,language));
  },true);

  // Observe text and accessibility changes only. Scroll transforms, WebGL frames,
  // SVG path geometry and animation styles do not trigger this observer.
  const observer=new MutationObserver(records=>{
    const roots=new Set();
    for(const record of records){
      if(record.type==='characterData')translateNode(record.target);
      else if(record.type==='attributes')translateAttributes(record.target);
      else record.addedNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)translateNode(node);else if(node instanceof Element)roots.add(node);});
    }
    roots.forEach(translateElement);
    if(roots.size)translateDemoInputs();
  });
  window.CycleUpI18n={translate:text=>translate(text,language),translateElement,setLanguage:next=>applyLanguage(next,true),get language(){return language;},get locale(){return localeCodes[language];}};
  applyLanguage(language);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
}
