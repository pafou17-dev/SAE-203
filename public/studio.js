import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const materialCache = new Map();
let textures;

function canvasTexture(size, draw, repeat=1) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  draw(canvas.getContext('2d'),size);
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(repeat,repeat);
  texture.anisotropy=8;
  return texture;
}

function makeTextures() {
  let seed=73;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const grain=canvasTexture(256,(ctx,size)=>{
    const data=ctx.createImageData(size,size);
    for(let i=0;i<data.data.length;i+=4){const v=112+random()*34;data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}
    ctx.putImageData(data,0,0);
  },8);
  const weave=canvasTexture(128,(ctx,size)=>{
    ctx.fillStyle='#898989';ctx.fillRect(0,0,size,size);
    for(let y=0;y<size;y+=4)for(let x=0;x<size;x+=4){
      ctx.fillStyle=(x+y)%8?'#b8b8b8':'#656565';
      ctx.fillRect(x,y,3,2);ctx.fillRect(x+1,y+2,2,2);
    }
  },14);
  const brush=canvasTexture(256,(ctx,size)=>{
    ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);
    for(let y=0;y<size;y++){
      const v=118+random()*20;ctx.fillStyle=`rgb(${v},${v},${v})`;
      ctx.fillRect(0,y,size,1);
    }
  },4);
  const solar=canvasTexture(1024,(ctx,size)=>{
    ctx.fillStyle='#0b111b';ctx.fillRect(0,0,size,size);
    const cols=10,rows=6,pad=14;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const left=pad+x*(size-pad*2)/cols+3,top=pad+y*(size-pad*2)/rows+3;
      const w=(size-pad*2)/cols-6,h=(size-pad*2)/rows-6;
      const shade=ctx.createLinearGradient(left,top,left+w,top+h);
      shade.addColorStop(0,'#1a2e48');shade.addColorStop(1,'#101d31');
      ctx.fillStyle=shade;ctx.fillRect(left,top,w,h);
      ctx.strokeStyle='#64758c';ctx.lineWidth=.8;ctx.strokeRect(left,top,w,h);
      ctx.fillStyle='#8d9aab';
      for(let bar=1;bar<=3;bar++)ctx.fillRect(left+w*bar/4,top,1,h);
      ctx.fillStyle='#64738b55';
      for(let line=1;line<12;line++)ctx.fillRect(left,top+h*line/12,w,.6);
    }
  });
  solar.wrapS=solar.wrapT=THREE.ClampToEdgeWrapping;
  solar.colorSpace=THREE.SRGBColorSpace;
  return {grain,weave,brush,solar};
}

function planarUV(geometry) {
  if(geometry.getAttribute('uv'))return;
  geometry.computeBoundingBox();
  const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3());
  const axes=[0,1,2].sort((a,b)=>size.getComponent(b)-size.getComponent(a));
  const position=geometry.getAttribute('position');const uv=new Float32Array(position.count*2);
  for(let i=0;i<position.count;i++){
    uv[i*2]=(position.getComponent(i,axes[0])-box.min.getComponent(axes[0]))/Math.max(size.getComponent(axes[0]),.0001);
    uv[i*2+1]=(position.getComponent(i,axes[1])-box.min.getComponent(axes[1]))/Math.max(size.getComponent(axes[1]),.0001);
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}

export function finishMaterials(mesh,partKey) {
  textures??=makeTextures();
  const make=(source)=>{
    const cacheKey=partKey+'/'+source.name;
    if(materialCache.has(cacheKey))return materialCache.get(cacheKey);
    if(source.userData?.cycleUpKind==='clear-pvc'){
      const material=new THREE.MeshPhysicalMaterial({name:source.name,color:'#edf8f9',transparent:true,opacity:source.userData.cycleUpOpacity??.12,roughness:.08,metalness:0,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:.35});
      materialCache.set(cacheKey,material);return material;
    }
    // All three Blender versions retain their authored prints and materials.
    if(source.map || /^(CycleUp \/|V2 \/|PLUIE \/)/.test(source.name) || source.userData?.cycleUpPreserve){
      const material=source.clone();
      material.envMapIntensity=.85;
      if(material.map)material.map.anisotropy=8;
      materialCache.set(cacheKey,material);
      return material;
    }
    const color=source.color;
    const brightness=Math.max(color.r,color.g,color.b);
    const neutral=Math.max(color.r,color.g,color.b)-Math.min(color.r,color.g,color.b)<.07;
    const code=source.name.replace('STEP - ','');
    const settings={color:'#b9c1c0',metalness:.82,roughness:.29,envMapIntensity:1.15,bumpMap:textures.brush,bumpScale:.00016};
    if(brightness<.25){Object.assign(settings,{color:'#202826',metalness:.12,roughness:.56,bumpMap:textures.grain,bumpScale:.00035});}
    if(partKey.startsWith('front_')||partKey==='rear'){
      if(brightness<.25)Object.assign(settings,{color:'#171b1a',metalness:0,roughness:.84,bumpMap:textures.grain,bumpScale:.00065,envMapIntensity:.8});
      else Object.assign(settings,{color:'#c6cdcc',metalness:.95,roughness:.23,bumpScale:.00008});
    }
    if(partKey==='seats' && code==='A6ABB2')Object.assign(settings,{color:'#35584a',metalness:0,roughness:.9,bumpMap:textures.weave,bumpScale:.001,sheen:.8,sheenColor:new THREE.Color('#b6c4b4'),sheenRoughness:.8});
    if((partKey==='chassis'||partKey==='gallery') && code==='6F362D')Object.assign(settings,{color:'#a28d6d',metalness:0,roughness:.9,bumpMap:textures.weave,bumpScale:.001,sheen:.4,sheenColor:new THREE.Color('#d8c8aa'),sheenRoughness:.85});
    if(partKey==='motor' && code==='2E515B')Object.assign(settings,{color:'#53655e',metalness:.6,roughness:.34,clearcoat:.2,clearcoatRoughness:.4});
    if((partKey==='battery'||partKey==='electric') && brightness<.65)Object.assign(settings,{color:'#25312e',metalness:.35,roughness:.36,clearcoat:.25,clearcoatRoughness:.3});
    if(partKey==='transmission')Object.assign(settings,{color:'#616b69',metalness:.92,roughness:.24,bumpScale:.0001});
    if(!neutral && partKey==='chassis' && code!=='6F362D'){
      if(color.r>.5 && color.g>.2)Object.assign(settings,{color:'#e5ad3c',metalness:.1,roughness:.22,clearcoat:1,clearcoatRoughness:.15});
      else if(color.r>.5)Object.assign(settings,{color:'#9c2e26',metalness:.08,roughness:.24,clearcoat:.8});
    }
    if(partKey==='solar'){
      if(code==='232344')Object.assign(settings,{color:'#ffffff',map:textures.solar,metalness:.15,roughness:.38,clearcoat:.45,clearcoatRoughness:.2,envMapIntensity:.65,bumpMap:null,bumpScale:0});
      else Object.assign(settings,{color:'#202622',metalness:.12,roughness:.45,bumpMap:null});
    }
    const material=new THREE.MeshPhysicalMaterial({...settings,side:source.side});
    material.name=partKey+' — '+source.name;
    materialCache.set(cacheKey,material);return material;
  };
  const sources=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  // Untextured CAD faces use generated UVs for the studio's fine surface detail.
  if(!sources.some(material=>material.map))mesh.geometry.deleteAttribute('uv');
  planarUV(mesh.geometry);
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(make):make(mesh.material);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const clear=materials.every(m=>m.transparent&&m.opacity<.5);
  mesh.castShadow=!clear;mesh.receiveShadow=!clear;
}

export function createStudio(renderer,scene,{compact=false}={}) {
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04).texture;
  scene.environment=environment;scene.environmentIntensity=.8;
  scene.environmentRotation.y=.35;
  room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe9eff4,0xa59d8a,.4));
  const key=new THREE.DirectionalLight(0xfff5e8,2.2);key.position.set(-2,7,3);
  key.castShadow=true;key.shadow.mapSize.set(compact?1024:2048,compact?1024:2048);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:18});
  key.shadow.bias=-.00008;key.shadow.normalBias=.002;key.shadow.radius=4;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xdbe8f5,.8);fill.position.set(4,2,-1);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,1.7);rim.position.set(0,4,-4);scene.add(rim);
  // A shallow depth capture gives soft contact shadows without a long, hard roof silhouette.
  const shadowTarget=new THREE.WebGLRenderTarget(1024,1024);
  const blurTarget=shadowTarget.clone();
  const contactCamera=new THREE.OrthographicCamera(-1.5,1.5,2,-2,.01,.76);
  contactCamera.up.set(0,0,-1);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(3,4),new THREE.MeshBasicMaterial({map:shadowTarget.texture,transparent:true,depthWrite:false,opacity:.7}));
  contact.rotation.x=-Math.PI/2;scene.add(contact);
  const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.BasicDepthPacking,side:THREE.DoubleSide});
  depthMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );','gl_FragColor = vec4( vec3( 0.06 ), pow( fragCoordZ, 3.0 ) * 0.75 );');
  };
  const blurMaterial=new THREE.ShaderMaterial({
    uniforms:{image:{value:shadowTarget.texture},direction:{value:new THREE.Vector2()}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`uniform sampler2D image; uniform vec2 direction; varying vec2 vUv;
      void main(){vec4 color=texture2D(image,vUv)*0.227027;
      color+=texture2D(image,vUv+direction*1.384615)*0.316216;
      color+=texture2D(image,vUv-direction*1.384615)*0.316216;
      color+=texture2D(image,vUv+direction*3.230769)*0.070270;
      color+=texture2D(image,vUv-direction*3.230769)*0.070270;
      gl_FragColor=color;}`,
    depthTest:false,depthWrite:false,
  });
  const blurScene=new THREE.Scene();blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),blurMaterial));
  const blurCamera=new THREE.Camera();
  return {
    setGround(y){contact.position.y=y-.008;contactCamera.position.set(0,y+.75,0);contactCamera.lookAt(0,y,0);contactCamera.updateMatrixWorld();},
    bakeContact(){
      const oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
      const oldTarget=renderer.getRenderTarget(),oldMaterial=scene.overrideMaterial;
      contact.visible=false;renderer.shadowMap.enabled=false;
      const clearMeshes=[];
      scene.traverse(object=>{
        if(!object.isMesh||!object.visible)return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        if(materials.every(m=>m.transparent&&m.opacity<.5)){clearMeshes.push(object);object.visible=false;}
      });
      renderer.setClearColor(0x000000,0);scene.overrideMaterial=depthMaterial;
      renderer.setRenderTarget(shadowTarget);renderer.clear();renderer.render(scene,contactCamera);
      scene.overrideMaterial=oldMaterial;
      clearMeshes.forEach(mesh=>{mesh.visible=true;});
      for(const amount of [2.5,4]){
        blurMaterial.uniforms.image.value=shadowTarget.texture;blurMaterial.uniforms.direction.value.set(amount/1024,0);
        renderer.setRenderTarget(blurTarget);renderer.clear();renderer.render(blurScene,blurCamera);
        blurMaterial.uniforms.image.value=blurTarget.texture;blurMaterial.uniforms.direction.value.set(0,amount/1024);
        renderer.setRenderTarget(shadowTarget);renderer.clear();renderer.render(blurScene,blurCamera);
      }
      renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);
      renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;contact.visible=true;
    },
    update(amount){
      const opacity=Math.pow(1-amount,3);
      contact.material.opacity=.7*opacity;
      contact.visible=amount<.95;
      renderer.shadowMap.needsUpdate=true;
    },
  };
}
