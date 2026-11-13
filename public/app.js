import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createStudio, finishMaterials } from './studio.js';
import { createFinishing } from './finishing.js';

const $ = (id) => document.getElementById(id);
const viewer = $('viewer'), toggle = $('toggle'), slider = $('spread'), reset = $('reset');
const label = $('piece-label'), leader = $('leader');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const compactRenderer = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
let showroomVisible = true, renderFrame = 0;
let renderer, scene, camera, controls, model, studio, finishing;
let parts = [], hitMeshes = [], progress = 0, target = 0, ready = false, selected = null;
let animation = null, framePending = false, pointerDown = null, lastHover = 0, dragging = false;
let focused = null, cameraTransition = null;
let compactDistance = 4, explodedDistance = 7, touchPinned = false;
let explodedSize = 5.9;
const explodedCenter = new THREE.Vector3();
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const expandedBoxes = [];
const VARIANTS = [
  {id:'classique',name:'Classique',description:'Quatre places.',asset:'rosalie-cycleup.glb',partCount:13},
  {id:'cargo',name:'Cargo',description:'Une place et un grand bac de rangement.',asset:'rosalie-cargo.glb',partCount:14},
  {id:'pluie',name:'Protection pluie',description:'Quatre places sous une toile transparente.',asset:'rosalie-pluie.glb',partCount:17},
];
const records=new Map(),pendingLoads=new Map(),meshParts=new WeakMap(),previews=new Map(),variantMemory=new Map();
let loader,draco,activeRecord=null,activeIndex=-1,requestedIndex=0,switchToken=0,switching=false;
let previewScene,previewCamera,previewQuad;
const wrap=index=>(index%VARIANTS.length+VARIANTS.length)%VARIANTS.length;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function fail(error) {
  console.error(error);
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-detail').textContent = !renderer ? 'Ce navigateur ne permet pas l’affichage 3D. Essayez avec un navigateur récent.' : 'Vérifiez votre connexion puis réessayez.';
}

function requestFrame() {
  if (framePending || !showroomVisible || document.hidden) return;
  framePending = true;
  renderFrame = requestAnimationFrame(render);
}

function updateLabel() {
  if (!selected) return;
  const { width, height } = viewer.getBoundingClientRect();
  const anchor = selected.center.clone().addScaledVector(selected.offset, progress).project(camera);
  if (anchor.z > 1 || anchor.z < -1) { label.hidden = true; leader.style.display = 'none'; return; }
  const x = (anchor.x + 1) * width / 2, y = (1 - anchor.y) * height / 2;
  const boxWidth = Math.min(width - 32, innerWidth <= 700 ? 206 : 242);
  const onRight = x < width * .58;
  const lx = THREE.MathUtils.clamp(x + (onRight ? 62 : -boxWidth - 62), 16, width-boxWidth-16);
  const ly = THREE.MathUtils.clamp(y-66, 8, height-68);
  label.style.left = `${lx}px`; label.style.top = `${ly}px`;
  label.hidden = false; leader.style.display = 'block';
  const endX = onRight ? lx : lx + boxWidth, endY = ly + 25;
  const elbowX = onRight ? endX - 20 : endX + 20;
  leader.querySelector('path').setAttribute('d', `M${x},${y} L${elbowX},${endY} L${endX},${endY}`);
  leader.querySelector('circle').setAttribute('cx', x); leader.querySelector('circle').setAttribute('cy', y);
}

function selectPart(part) {
  if (selected === part && (!part || part !== focused)) return;
  if (selected) selected.meshes.forEach(m => { m.material = selected.originalMaterials.get(m); });
  selected = part;
  if (!part) { label.hidden = true; leader.style.display = 'none'; requestFrame(); return; }
  if(part !== focused) part.meshes.forEach(m => {
    if (!part.highlightMaterials.has(m)) {
      const highlight = mat => { const copy=mat.clone(); copy.emissive.set('#b06a31'); copy.emissiveIntensity=.035; return copy; };
      const original=part.originalMaterials.get(m);
      part.highlightMaterials.set(m, Array.isArray(original) ? original.map(highlight) : highlight(original));
    }
    m.material = part.highlightMaterials.get(m);
  });
  $('piece-name').textContent = part.object.userData.partName;
  $('piece-reference').textContent = part.object.userData.partSubtitle;
  updateLabel(); requestFrame();
}

function pick(clientX, clientY) {
  const rect=viewer.getBoundingClientRect();
  pointer.set((clientX-rect.left)/rect.width*2-1, -(clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(hitMeshes,false)[0];
  return hit ? meshParts.get(hit.object)??null : null;
}

function refreshUI(value) {
  const percent=Math.round(value*100);
  slider.value=String(percent); $('spread-value').textContent=`${percent} %`;
  slider.setAttribute('aria-valuetext', `${percent === 0 ? 'Assemblée' : 'Vue éclatée'}, ${percent} %`);
  toggle.setAttribute('aria-pressed', String(target > 0));
  toggle.querySelector('span').textContent=target > 0 ? 'Réassembler' : 'Décomposer';
  $('mode').textContent = value < .005 ? '01 — ASSEMBLÉE' : '02 — VUE ÉCLATÉE';
  $('instruction').textContent = focused
    ? 'Recliquez sur la pièce pour revenir à la vue d’ensemble.'
    : (value < .005 ? 'Cliquez sur le modèle pour le décomposer.' : 'Cliquez sur une pièce pour zoomer.');
  $('reset-label').hidden = !focused;
  reset.classList.toggle('has-focus',Boolean(focused));
  reset.setAttribute('aria-label',focused ? 'Revenir à la vue d’ensemble' : 'Recentrer la vue');
  reset.title=focused ? 'Vue d’ensemble' : 'Recentrer la vue';
}

function applyProgress(value) {
  progress=value;
  if(activeRecord)activeRecord.progress=value;
  for (const part of parts) part.object.position.copy(part.rest).addScaledVector(part.localOffset,value);
  model?.updateMatrixWorld(true);
  studio?.update(value);
  refreshUI(value);
}

function clearFocus() {
  focused=null;touchPinned=false;selectPart(null);
  refreshUI(progress);
}

function framingDistance(boxes,center,direction,padding,viewCamera=camera,horizontalPadding=padding) {
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(viewCamera.fov)/2),tanH=tanV*viewCamera.aspect;
  let distance=.6;
  for(const box of boxes)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const point=new THREE.Vector3(x,y,z).sub(center);
    const depth=point.dot(direction);
    distance=Math.max(distance,depth+Math.max(horizontalPadding*Math.abs(point.dot(right))/tanH,padding*Math.abs(point.dot(up))/tanV));
  }
  return distance;
}

function assembledDistance(direction) {
  if(!activeRecord?.frameMeshes.length)return fitDistance(activeRecord?.size??2.5);
  const key=[camera.aspect,...direction.toArray()].map(v=>v.toFixed(5)).join(':');
  if(activeRecord.fitCache.has(key))return activeRecord.fitCache.get(key);
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
  const planes=[
    direction.clone().addScaledVector(right,1.20/(tanV*camera.aspect)),
    direction.clone().addScaledVector(right,-1.20/(tanV*camera.aspect)),
    direction.clone().addScaledVector(up,1.035/tanV),
    direction.clone().addScaledVector(up,-1.035/tanV),
  ];
  let distance=.6;
  // Evaluate the actual silhouette; coarse box corners leave unnecessary space.
  // Rest transforms keep the result valid while parts are exploded or inspected.
  for(const {position,matrix} of activeRecord.frameMeshes){
    const e=matrix.elements;
    const coefficients=planes.map(n=>[
      n.x*e[0]+n.y*e[1]+n.z*e[2],n.x*e[4]+n.y*e[5]+n.z*e[6],
      n.x*e[8]+n.y*e[9]+n.z*e[10],n.x*e[12]+n.y*e[13]+n.z*e[14],
    ]);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      for(const c of coefficients)distance=Math.max(distance,c[0]*x+c[1]*y+c[2]*z+c[3]);
    }
  }
  if(activeRecord.fitCache.size>=16)activeRecord.fitCache.clear();
  activeRecord.fitCache.set(key,distance);
  return distance;
}

function overviewDistance(direction) {
  return expandedBoxes.length ? Math.max(compactDistance,framingDistance(expandedBoxes,explodedCenter,direction,1.06)) : fitDistance(explodedSize);
}

function focusedPose(part,direction) {
  const box=new THREE.Box3().setFromObject(part.object);
  const center=box.getCenter(new THREE.Vector3());
  const distance=framingDistance([box],center,direction,1.28);
  return {target:center,position:center.clone().addScaledVector(direction,distance)};
}

function moveCamera(pose) {
  cameraTransition=null;
  // Flush the last orbit damping step before a programmatic movement.
  controls.enableDamping=false;controls.update();
  if(reducedMotion){
    camera.position.copy(pose.position);controls.target.copy(pose.target);controls.update();controls.enableDamping=true;
  }else{
    cameraTransition={start:performance.now(),fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),toPosition:pose.position,toTarget:pose.target};
  }
  requestFrame();
}

function focusPart(part) {
  animation=null;
  const direction=camera.position.clone().sub(controls.target).normalize();
  focused=part;touchPinned=true;selectPart(part);refreshUI(progress);
  moveCamera(focusedPose(part,direction));
}

function showOverview() {
  if(!ready)return;
  animation=null;
  const direction=new THREE.Vector3(3.1,2,4.3).normalize();
  clearFocus();
  compactDistance=assembledDistance(direction);
  explodedDistance=overviewDistance(direction);
  const center=explodedCenter.clone().multiplyScalar(progress);
  const distance=compactDistance+(explodedDistance-compactDistance)*progress;
  moveCamera({target:center,position:center.clone().addScaledVector(direction,distance)});
}

function setSpread(value, animate=true) {
  if (!ready) return;
  const direction=camera.position.clone().sub(controls.target).normalize();
  cameraTransition=null;controls.enableDamping=true;clearFocus();
  target=THREE.MathUtils.clamp(value,0,1);
  touchPinned=false; selectPart(null);
  compactDistance=assembledDistance(direction);
  explodedDistance=overviewDistance(direction);
  const distance=compactDistance+(explodedDistance-compactDistance)*target;
  if (animate && !reducedMotion) {
    animation={start:performance.now(),from:progress,to:target,fromDistance:camera.position.distanceTo(controls.target),toDistance:distance,fromTarget:controls.target.clone(),toTarget:explodedCenter.clone().multiplyScalar(target),direction};
  } else {
    animation=null; applyProgress(target);
    controls.target.copy(explodedCenter).multiplyScalar(target);
    camera.position.copy(controls.target).addScaledVector(direction,distance);
    controls.update();
  }
  refreshUI(progress); requestFrame();
}

function render(now) {
  framePending=false;renderFrame=0;
  if (!renderer || !showroomVisible || document.hidden) return;
  if (animation) {
    const t=THREE.MathUtils.clamp((now-animation.start)/1550,0,1);
    const ease=t*t*(3-2*t);
    applyProgress(THREE.MathUtils.lerp(animation.from,animation.to,ease));
    controls.target.lerpVectors(animation.fromTarget,animation.toTarget,ease);
    camera.position.copy(controls.target).addScaledVector(animation.direction,THREE.MathUtils.lerp(animation.fromDistance,animation.toDistance,ease));
    if (t >= 1) animation=null;
  }
  if(cameraTransition){
    const t=THREE.MathUtils.clamp((now-cameraTransition.start)/850,0,1),ease=t*t*(3-2*t);
    camera.position.lerpVectors(cameraTransition.fromPosition,cameraTransition.toPosition,ease);
    controls.target.lerpVectors(cameraTransition.fromTarget,cameraTransition.toTarget,ease);
    if(t>=1){cameraTransition=null;controls.enableDamping=true;}
  }
  controls.update();
  updateLabel();
  finishing.render();
  drawNeighborPreviews();
  if (animation||cameraTransition) requestFrame();
}

function resize() {
  const {width,height}=viewer.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect=width/height; camera.updateProjectionMatrix();
  renderer.setSize(width,height);
  finishing?.setSize(width,height);
  if (ready) {
    cameraTransition=null;controls.enableDamping=true;
    const direction=camera.position.clone().sub(controls.target).normalize();
    compactDistance=assembledDistance(direction);
    explodedDistance = overviewDistance(direction);
    if(focused){
      const pose=focusedPose(focused,direction);camera.position.copy(pose.position);controls.target.copy(pose.target);
    }else{
      camera.position.copy(controls.target).addScaledVector(direction,compactDistance+(explodedDistance-compactDistance)*progress);
    }
    controls.update();
  }
  requestFrame();
}
function fitDistance(size) { return size / (2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)) / Math.min(camera.aspect*.78,1); }

function updateVariantUI() {
  const variant=VARIANTS[requestedIndex];
  $('model-number').textContent=`${String(requestedIndex+1).padStart(2,'0')} / 03`;
  $('model-name').textContent=variant.name;$('model-description').textContent=variant.description;
  $('previous-model').setAttribute('aria-label',`Modèle précédent : ${VARIANTS[wrap(requestedIndex-1)].name}`);
  $('next-model').setAttribute('aria-label',`Modèle suivant : ${VARIANTS[wrap(requestedIndex+1)].name}`);
  document.querySelectorAll('[data-model]').forEach(button=>{
    if(Number(button.dataset.model)===requestedIndex)button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  });
}

function loadPreviews() {
  // The faint neighbours use existing product renders, not two additional
  // multi-million-vertex models. The selected vehicle remains fully interactive.
  const textureLoader=new THREE.TextureLoader();
  VARIANTS.forEach((variant,index)=>textureLoader.load(`./assets/journey/rosalie-${variant.id==='pluie'?'pluie':variant.id}.webp`,texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    previews.set(index,{texture,aspect:texture.image.width/texture.image.height});requestFrame();
  }));
}

function trimModelCache() {
  while(records.size>2){
    const oldest=[...records.keys()].find(index=>index!==activeIndex&&index!==requestedIndex);
    if(oldest===undefined)break;
    const record=records.get(oldest);
    variantMemory.set(oldest,{progress:record.progress,direction:record.direction.clone()});
    new Set(record.meshes.map(mesh=>mesh.geometry)).forEach(geometry=>geometry.dispose());
    records.delete(oldest);
  }
}

function drawNeighborPreviews() {
  if(!ready||!previewScene)return;
  const {width,height}=viewer.getBoundingClientRect();
  const slotWidth=Math.min(width*.42,height*.9);
  const oldAuto=renderer.autoClear;renderer.autoClear=false;renderer.setRenderTarget(null);renderer.setScissorTest(true);
  for(const direction of [-1,1]){
    const record=previews.get(wrap(activeIndex+direction));if(!record)continue;
    const slotHeight=slotWidth/record.aspect;
    previewQuad.material.map=record.texture;
    const x=direction<0?-slotWidth*.47:width-slotWidth*.53;
    renderer.setViewport(x,(height-slotHeight)/2,slotWidth,slotHeight);
    renderer.setScissor(direction<0?0:width*.87,0,width*.13,height);
    renderer.render(previewScene,previewCamera);
  }
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.autoClear=oldAuto;
}

async function loadRecord(index) {
  if(records.has(index))return records.get(index);
  if(pendingLoads.has(index))return pendingLoads.get(index);
  const task=(async()=>{
    const variant=VARIANTS[index];
    const gltf=await loader.loadAsync(`./assets/${variant.asset}`,e=>{
      if(index!==requestedIndex||ready||!e.total)return;
      const percent=Math.round(e.loaded/e.total*100);$('load-bar').style.width=`${percent}%`;
      $('load-text').textContent=percent<100?`Chargement · ${variant.name} · ${percent} %`:'Chargement du modèle…';
    });
    const root=gltf.scene;root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());
    root.position.sub(center);root.updateMatrixWorld(true);
    const record={index,model:root,parts:[],meshes:[],boxes:[],frameMeshes:[],fitCache:new Map(),progress:0,preview:null,direction:new THREE.Vector3(3.1,2,4.3).normalize(),ground:box.min.y-center.y,size:Math.max(2.5,box.getSize(new THREE.Vector3()).length()*.86)};
    const explodedBox=new THREE.Box3();
    root.traverse(object=>{
      if(object.userData.partId===undefined)return;
      const bounds=new THREE.Box3().setFromObject(object),c=bounds.getCenter(new THREE.Vector3());
      const offset=new THREE.Vector3(...object.userData.explodeOffset),expanded=bounds.clone().translate(offset);
      record.boxes.push(expanded);explodedBox.union(expanded);
      const rotation=new THREE.Quaternion();object.parent.getWorldQuaternion(rotation).invert();
      const part={object,rest:object.position.clone(),center:c,offset,localOffset:offset.clone().applyQuaternion(rotation),meshes:[],originalMaterials:new Map(),highlightMaterials:new Map()};
      object.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();finishMaterials(mesh,object.userData.partKey);
        record.frameMeshes.push({position:mesh.geometry.getAttribute('position'),matrix:mesh.matrixWorld.clone()});
        meshParts.set(mesh,part);part.meshes.push(mesh);record.meshes.push(mesh);part.originalMaterials.set(mesh,mesh.material);
      });
      record.parts.push(part);
    });
    if(record.parts.length!==variant.partCount)throw new Error(`Import incomplet pour ${variant.name} : ${record.parts.length} éléments`);
    record.explodedCenter=explodedBox.getCenter(new THREE.Vector3());record.explodedSize=Math.max(5.9,explodedBox.getSize(new THREE.Vector3()).length());
    const memory=variantMemory.get(index);
    if(memory){record.progress=memory.progress;record.direction.copy(memory.direction);}
    records.set(index,record);trimModelCache();return record;
  })();
  pendingLoads.set(index,task);
  try{return await task;}finally{pendingLoads.delete(index);}
}

async function showVariant(index,direction=1) {
  requestedIndex=wrap(index);const token=++switchToken;switching=true;
  if(activeRecord&&ready){activeRecord.progress=progress;activeRecord.direction.copy(camera.position).sub(controls.target).normalize();}
  animation=null;cameraTransition=null;clearFocus();ready=false;target=progress;
  toggle.disabled=true;slider.disabled=true;reset.disabled=true;controls.enabled=false;
  updateVariantUI();$('error').hidden=true;$('load-bar').style.width='0%';
  $('load-text').textContent=`Chargement · ${VARIANTS[requestedIndex].name}…`;
  const loadingTimer=setTimeout(()=>{if(token===switchToken)$('loading').hidden=false;},120);
  if(activeRecord&&!reducedMotion){renderer.domElement.style.opacity='0';renderer.domElement.style.transform=`translateX(${-direction*26}px)`;}
  try{
    const [record]=await Promise.all([loadRecord(requestedIndex),wait(activeRecord&&!reducedMotion?150:0)]);
    if(token!==switchToken)return;
    clearTimeout(loadingTimer);
    if(model)scene.remove(model);
    activeRecord=record;activeIndex=record.index;model=record.model;parts=record.parts;hitMeshes=record.meshes;
    expandedBoxes.splice(0,expandedBoxes.length,...record.boxes);explodedCenter.copy(record.explodedCenter);explodedSize=record.explodedSize;
    scene.add(model);studio.setGround(record.ground);
    progress=target=record.progress;controls.target.copy(explodedCenter).multiplyScalar(progress);
    camera.position.copy(controls.target).addScaledVector(record.direction,5);
    // Bake the ground shadow in the assembled pose even when this variant's
    // saved explosion state is being restored.
    for(const part of parts)part.object.position.copy(part.rest);
    model.updateMatrixWorld(true);studio.bakeContact();
    ready=true;resize();applyProgress(progress);
    controls.enabled=true;toggle.disabled=false;slider.disabled=false;reset.disabled=false;
    $('piece-count').textContent=`${parts.length} éléments principaux`;$('loading').hidden=true;$('error').hidden=true;
    if(!reducedMotion&&direction){renderer.domElement.style.transition='none';renderer.domElement.style.transform=`translateX(${direction*26}px)`;renderer.domElement.getBoundingClientRect();renderer.domElement.style.transition='';}
    renderer.domElement.style.opacity='1';renderer.domElement.style.transform='translateX(0)';switching=false;requestFrame();
    trimModelCache();
  }catch(error){if(token===switchToken){clearTimeout(loadingTimer);switching=false;renderer.domElement.style.opacity='1';renderer.domElement.style.transform='';fail(error);}}
}

function stepVariant(direction) { return showVariant(requestedIndex+direction,direction); }

async function init() {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:compactRenderer?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,compactRenderer?1.25:1.5));
  viewer.dataset.renderQuality=compactRenderer?'mobile':'desktop';
  viewer.dataset.pixelRatio=String(renderer.getPixelRatio());
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  viewer.prepend(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(34,1,.01,100);
  camera.position.set(3.1,2.0,4.3);
  controls=new OrbitControls(camera,renderer.domElement);
  // A normal wheel gesture continues the page; Ctrl/Meta/Alt keeps 3D zoom.
  renderer.domElement.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey&&!event.altKey)event.stopImmediatePropagation();
  },{capture:true,passive:true});
  renderer.domElement.style.touchAction='pan-y';
  controls.enableDamping=true; controls.dampingFactor=.12;
  controls.enablePan=true; controls.minDistance=.35; controls.maxDistance=30;
  controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI/2-.025;
  controls.target.set(0,0,0);
  controls.addEventListener('change', requestFrame);
  controls.addEventListener('start',()=>{if(animation){animation=null;target=progress;refreshUI(progress);}cameraTransition=null;controls.enableDamping=true;});
  studio=createStudio(renderer,scene,{compact:compactRenderer});
  finishing=createFinishing(renderer,scene,camera,{compact:compactRenderer});
  previewScene=new THREE.Scene();previewCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,5);previewCamera.position.z=1;
  previewQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({transparent:true,opacity:.12,depthWrite:false,depthTest:false,toneMapped:false}));
  previewScene.add(previewQuad);
  resize();
  new ResizeObserver(resize).observe(viewer);
  const syncVisibility=()=>{
    viewer.dataset.renderPaused=String(!showroomVisible||document.hidden);
    if(!showroomVisible||document.hidden){cancelAnimationFrame(renderFrame);renderFrame=0;framePending=false;}
    else requestFrame();
  };
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{showroomVisible=entries[0].isIntersecting;syncVisibility();}).observe(viewer);
  document.addEventListener('visibilitychange',syncVisibility);
  draco=new DRACOLoader();
  draco.setDecoderPath('./vendor/examples/jsm/libs/draco/gltf/');
  draco.setDecoderConfig({type:'wasm'}); draco.setWorkerLimit(2);
  loader=new GLTFLoader();loader.setDRACOLoader(draco);
  $('previous-model').addEventListener('click',()=>stepVariant(-1));
  $('next-model').addEventListener('click',()=>stepVariant(1));
  document.querySelectorAll('[data-model]').forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.model);if(index!==requestedIndex)showVariant(index,index>requestedIndex?1:-1);
  }));
  $('retry').addEventListener('click',()=>showVariant(requestedIndex,0));
  window.addEventListener('cycleup:show-model',event=>{
    const index=event.detail?.index;
    if(Number.isInteger(index)&&index>=0&&index<VARIANTS.length)showVariant(index,index>requestedIndex?1:-1);
  });

  renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};dragging=false;});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!ready)return;
    if(pointerDown && Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6)dragging=true;
    if(dragging || e.buttons || touchPinned || focused)return;
    // Assembled models need no per-triangle hover query. Picking still runs
    // on click and for individual parts after decomposition.
    if(progress<=.02||animation||cameraTransition){renderer.domElement.style.cursor='grab';return;}
    if(performance.now()-lastHover<65)return;
    lastHover=performance.now();
    const part=pick(e.clientX,e.clientY);
    renderer.domElement.style.cursor=part?'pointer':'grab';
    if(progress>.02 && !animation)selectPart(part);
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    const moved=dragging;pointerDown=null;dragging=false;
    if(moved || !ready)return;
    const part=pick(e.clientX,e.clientY);
    if(part){
      if(progress<.005)setSpread(1);
      else if(part===focused)showOverview();
      else focusPart(part);
    }
    else if(focused)showOverview();
    else {touchPinned=false;selectPart(null);}
  });
  renderer.domElement.addEventListener('pointerleave',()=>{pointerDown=null;dragging=false;if(!touchPinned)selectPart(null);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('WebGL context lost'));});
  toggle.addEventListener('click',()=>setSpread(target>.01?0:1));
  slider.addEventListener('input',()=>setSpread(Number(slider.value)/100,false));
  reset.addEventListener('click',showOverview);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(focused)showOverview();else{touchPinned=false;selectPart(null);}}
    const inShowroom=viewer.closest('.showroom').getBoundingClientRect().bottom>innerHeight*.5;
    if(inShowroom&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();stepVariant(e.key==='ArrowRight'?1:-1);}
  });
  // Read-only diagnostics make validation possible without changing the experience.
  window.rosalieViewer={get partCount(){return parts.length;},get progress(){return progress;},get selectedName(){return selected?.object.userData.partName??null;},get focusedName(){return focused?.object.userData.partName??null;},get meshCount(){return hitMeshes.length;},get ready(){return ready;},get modelId(){return VARIANTS[activeIndex]?.id??null;},get modelIndex(){return activeIndex;},get requestedIndex(){return requestedIndex;},get modelCount(){return VARIANTS.length;},get loadedModels(){return records.size;},get previewCount(){return previews.size;},get switching(){return switching;},get variantStates(){return Object.fromEntries([...variantMemory,...records].map(([i,r])=>[VARIANTS[i].id,r.progress]));}};
  // Bind the controls before loading, so navigating away from the first model
  // while it downloads never leaves a newly loaded variant without handlers.
  const initialModel = VARIANTS.findIndex(model => model.id === new URLSearchParams(location.search).get('modele'));
  await showVariant(initialModel >= 0 ? initialModel : 0,0);
  loadPreviews();
}
init().catch(fail);
