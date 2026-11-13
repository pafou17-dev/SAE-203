import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createFinishing(renderer,scene,camera,{compact=false}={}) {
  // Mobile retains the same model, materials, lights and baked contact shadow.
  // Skip screen-space occlusion and its additional full-resolution passes.
  if(compact)return {render(){renderer.render(scene,camera);},setSize(){}};
  const size=renderer.getSize(new THREE.Vector2());
  const target=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene,camera));
  const occlusion=new SSAOPass(scene,camera,size.x,size.y,16);
  occlusion.kernelRadius=.12;
  occlusion.minDistance=.000015;
  occlusion.maxDistance=.003;
  occlusion.ssaoMaterial.fragmentShader=occlusion.ssaoMaterial.fragmentShader.replace('1.0 - occlusion','1.0 - occlusion * 0.65');
  composer.addPass(occlusion);
  composer.addPass(new OutputPass());
  return composer;
}
