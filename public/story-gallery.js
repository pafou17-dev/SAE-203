import * as THREE from 'three';

const stage=document.getElementById('story-gallery-stage');
if(stage)initializeGallery();

function initializeGallery(){
  const section=stage.closest('.story-gallery'),host=document.getElementById('story-gallery-canvas');
  const items=[...stage.querySelectorAll('.story-gallery-item')].map((button,index)=>({
    index,button,title:button.dataset.title,src:button.querySelector('img').getAttribute('src'),alt:button.querySelector('img').alt,
  }));
  const preference=matchMedia('(prefers-reduced-motion: reduce)'),dialog=document.getElementById('gallery-lightbox');
  const dialogImage=document.getElementById('gallery-dialog-image');
  const picks=[...section.querySelectorAll('[data-gallery-pick]')];
  const wrap=value=>(value%items.length+items.length)%items.length;
  let renderer,scene,camera,meshes=[],visible=false,initialized=false,failed=false;
  let position=0,target=0,current=0,dialogIndex=0,frame=0,lastTime=0,drag=null,hover=-1,opener=null,swipe=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let width=1,height=1;
  stage.classList.add('is-pending');

  function updateCaption(){
    const index=wrap(Math.round(position));
    const title=window.CycleUpI18n?.translate(items[index].title)??items[index].title;
    if(current===index&&document.getElementById('gallery-current-title').textContent===title)return;
    current=index;document.getElementById('gallery-current-title').textContent=title;
    document.getElementById('gallery-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
    picks.forEach((button,i)=>{if(i===index)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  }
  function requestFrame(){if(!frame&&visible&&renderer&&!document.hidden)frame=requestAnimationFrame(render);}
  function render(now){
    frame=0;const delta=lastTime?Math.min(50,now-lastTime):16;lastTime=now;
    const previous=position;
    position=preference.matches?target:THREE.MathUtils.lerp(position,target,1-Math.exp(-delta/110));
    if(Math.abs(target-position)<.0005)position=target;
    const speed=(position-previous)/Math.max(delta,1)*1000;
    meshes.forEach((mesh,index)=>{
      const offset=wrap(index-position+items.length/2)-items.length/2;
      const x=offset*6.2;
      mesh.position.set(x,-x*x*.018,x*x*.025);
      mesh.rotation.set(0,-x*.055,-x*.004);
      const scale=index===hover&&!drag?1.025:1;
      mesh.scale.set(mesh.userData.imageWidth*scale,mesh.userData.imageHeight*scale,1);
      mesh.userData.flex.value=preference.matches?0:THREE.MathUtils.clamp(speed*.065,-.7,.7);
      mesh.visible=Math.abs(x)<18;
    });
    scene.updateMatrixWorld(true);renderer.render(scene,camera);updateCaption();
    if(Math.abs(target-position)>.0005)requestFrame();
  }
  function resize(){
    if(!renderer)return;
    const bounds=host.getBoundingClientRect();width=bounds.width;height=bounds.height;
    if(!width||!height)return;
    renderer.setSize(width,height);camera.aspect=width/height;
    camera.position.z=12;camera.updateProjectionMatrix();requestFrame();
  }
  function choose(index){
    const difference=wrap(index-wrap(Math.round(target))+items.length/2)-items.length/2;
    target=Math.round(target)+difference;
    if(!renderer){position=target;updateCaption();}requestFrame();
  }
  function step(direction){target=Math.round(target)+direction;if(!renderer){position=target;updateCaption();}requestFrame();}
  function hitAt(event){
    const bounds=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(meshes.filter(mesh=>mesh.visible),false)[0]?.object.userData.index??-1;
  }
  function failGallery(){
    failed=true;stage.classList.remove('is-webgl','is-pending');host.replaceChildren();
    if(frame)cancelAnimationFrame(frame);frame=0;renderer?.dispose();renderer=null;
  }
  function boot(){
    if(initialized||failed)return;initialized=true;
    try{
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
      const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Galerie de photos. Glissez ou utilisez les flèches pour parcourir les images.');canvas.tabIndex=0;canvas.style.touchAction='pan-y';host.append(canvas);
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.z=12;
      const geometry=new THREE.PlaneGeometry(1,1,24,12),loader=new THREE.TextureLoader();
      meshes=items.map(item=>{
        const flex={value:0};
        const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,side:THREE.DoubleSide,depthWrite:false,alphaTest:.01});
        material.onBeforeCompile=shader=>{
          shader.uniforms.galleryFlex=flex;
          shader.vertexShader='uniform float galleryFlex;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(uv.x * 3.14159265) * galleryFlex * 0.6;\ntransformed.x -= sin(uv.y * 3.14159265) * galleryFlex * 0.12;');
        };
        const mesh=new THREE.Mesh(geometry,material);mesh.userData={index:item.index,flex,imageWidth:5.7,imageHeight:4.275};scene.add(mesh);
        loader.load(item.src,texture=>{
          texture.colorSpace=THREE.SRGBColorSpace;
          texture.anisotropy=Math.min(4,renderer?.capabilities.getMaxAnisotropy()||1);
          const aspect=texture.image.width/texture.image.height;
          mesh.userData.imageWidth=Math.min(5.7,4.275*aspect);
          mesh.userData.imageHeight=mesh.userData.imageWidth/aspect;
          material.map=texture;material.needsUpdate=true;requestFrame();
        },undefined,failGallery);
        return mesh;
      });
      stage.classList.remove('is-pending');stage.classList.add('is-webgl');resize();new ResizeObserver(resize).observe(stage);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failGallery();});
      canvas.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastTime:performance.now(),velocity:0,moved:false,target};
      });
      canvas.addEventListener('pointermove',event=>{
        if(drag&&event.pointerId===drag.id){
          const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
          if(!drag.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){drag.moved=true;canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');}
          if(drag.moved){
            const now=performance.now(),pixelsPerCard=width<600?width*.84:width*.36;
            drag.velocity=-(event.clientX-drag.lastX)/Math.max(8,now-drag.lastTime)/pixelsPerCard*1000;
            target=drag.target-dx/pixelsPerCard;drag.lastX=event.clientX;drag.lastTime=now;requestFrame();
          }
        }else if(event.pointerType!=='touch'){
          const next=hitAt(event);if(next!==hover){hover=next;canvas.style.cursor=hover<0?'grab':'pointer';requestFrame();}
        }
      });
      canvas.addEventListener('pointerup',event=>{
        if(!drag||event.pointerId!==drag.id)return;
        const moved=drag.moved;
        if(moved)target=Math.round(target+THREE.MathUtils.clamp(drag.velocity*.16,-1.4,1.4));
        drag=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
        if(!moved){const index=hitAt(event);if(index>=0)openImage(index,canvas);}requestFrame();
      });
      const cancelDrag=()=>{if(drag?.moved)target=Math.round(target);drag=null;canvas.classList.remove('is-dragging');requestFrame();};
      canvas.addEventListener('pointercancel',cancelDrag);canvas.addEventListener('lostpointercapture',cancelDrag);
      canvas.addEventListener('pointerleave',()=>{hover=-1;if(!drag?.moved)drag=null;requestFrame();});
      canvas.addEventListener('wheel',event=>{
        if(!event.shiftKey&&Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;
        event.preventDefault();target+=(event.shiftKey?event.deltaY:event.deltaX)/Math.max(250,width*.4);requestFrame();
      },{passive:false});
      canvas.addEventListener('keydown',event=>{
        if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();step(event.key==='ArrowRight'?1:-1);}
        if(event.key==='Enter'||event.key===' '){event.preventDefault();openImage(current,canvas);}
      });
    }catch{failGallery();}
  }
  function showDialogImage(index){
    dialogIndex=wrap(index);const item=items[dialogIndex];
    dialogImage.src=item.src;dialogImage.alt=item.alt;
    document.getElementById('gallery-dialog-title').textContent=item.title;
    document.getElementById('gallery-dialog-count').textContent=`${String(dialogIndex+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
    if(!preference.matches)dialogImage.animate([{opacity:0,transform:'translateY(14px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:400,easing:'cubic-bezier(.2,.65,.25,1)'});
  }
  function openImage(index,trigger){
    opener=trigger;showDialogImage(index);document.documentElement.classList.add('gallery-is-open');
    if(!dialog.open)dialog.showModal();
  }
  items.forEach(item=>item.button.addEventListener('click',()=>openImage(item.index,item.button)));
  window.addEventListener('cycleup:gallery-open',event=>{
    const index=event.detail?.index;
    if(Number.isInteger(index)&&index>=0&&index<items.length)openImage(index,event.detail.trigger instanceof HTMLElement?event.detail.trigger:items[index].button);
  });
  picks.forEach((button,index)=>button.addEventListener('click',()=>choose(index)));
  document.getElementById('gallery-previous').addEventListener('click',()=>step(-1));
  document.getElementById('gallery-next').addEventListener('click',()=>step(1));
  document.getElementById('gallery-enlarge').addEventListener('click',event=>openImage(current,event.currentTarget));
  document.getElementById('gallery-dialog-close').addEventListener('click',()=>dialog.close());
  document.getElementById('gallery-dialog-previous').addEventListener('click',()=>showDialogImage(dialogIndex-1));
  document.getElementById('gallery-dialog-next').addEventListener('click',()=>showDialogImage(dialogIndex+1));
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();showDialogImage(dialogIndex+(event.key==='ArrowRight'?1:-1));}
  });
  dialogImage.addEventListener('pointerdown',event=>{swipe={x:event.clientX,y:event.clientY};});
  dialogImage.addEventListener('pointerup',event=>{if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3)showDialogImage(dialogIndex+(dx<0?1:-1));swipe=null;});
  dialogImage.addEventListener('pointercancel',()=>{swipe=null;});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('gallery-is-open');choose(dialogIndex);opener?.focus({preventScroll:true});});
  preference.addEventListener('change',()=>{if(preference.matches){target=Math.round(target);position=target;dialogImage.getAnimations().forEach(animation=>animation.cancel());}requestFrame();});
  const observer=new IntersectionObserver(entries=>{
    const entry=entries[0];visible=entry.isIntersecting;
    if(visible){boot();lastTime=0;requestFrame();}else if(frame){cancelAnimationFrame(frame);frame=0;}
  },{rootMargin:'240px 0px'});
  observer.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else requestFrame();});
}
