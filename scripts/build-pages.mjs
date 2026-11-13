import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=path.join(root,'public'),out=path.join(root,'pages-dist');
const base=process.env.PAGES_BASE_PATH||'/SAE-203/';
const api=process.env.CYCLEUP_API_URL||'https://rosalie-atelier-3d-paul.pafou17.chatgpt.site/api/consultation';
if(!/^\/[a-zA-Z0-9/_-]*\/$/.test(base))throw new Error('Invalid Pages base path');
const apiUrl=new URL(api);
if(apiUrl.protocol!=='https:'&&!(apiUrl.protocol==='http:'&&['127.0.0.1','localhost'].includes(apiUrl.hostname)&&apiUrl.pathname.endsWith('/api/consultation')))throw new Error('Invalid API URL');
// Validate the absolute generated directory before any recursive removal.
if(path.dirname(out)!==root||path.basename(out)!=='pages-dist')throw new Error('Unsafe output directory');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const models=new Set(['rosalie-cycleup.glb','rosalie-cargo.glb','rosalie-pluie.glb']);
async function copy(dir,relative=''){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const rel=path.posix.join(relative,entry.name),src=path.join(dir,entry.name),dest=path.join(out,rel);
  if(rel.startsWith('vendor/')&&!rel.startsWith('vendor/examples/jsm/libs/draco/gltf/')&&rel!=='vendor/LICENSE'&&entry.isFile())continue;
  if(entry.isDirectory()){await copy(src,rel);continue;}
  if(!relative&&/\.(js|mjs)$/.test(entry.name))continue;
  if(rel.startsWith('assets/')&&rel.endsWith('.glb')&&!models.has(entry.name))continue;
  if(rel.startsWith('assets/portraits/')&&entry.name!=='personnages-sans-fond.webp')continue;
  if(/\.(png|jpe?g)$/i.test(rel)&&await fs.access(src.replace(/\.(png|jpe?g)$/i,'.webp')).then(()=>true,()=>false))continue;
  await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(src,dest);
 }
}
await copy(source);
const entries=['app','site-ui','audiences','map-integration','edition-motion','story-gallery','consultation'];
const built=await esbuild.build({absWorkingDir:root,entryPoints:entries.map(n=>'public/'+n+'.js'),outdir:'pages-dist/ui',
 bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,metafile:true,entryNames:'[name]-[hash]',chunkNames:'chunks/[name]-[hash]',
 alias:{'three/addons':path.join(source,'vendor/examples/jsm'),'three':path.join(source,'vendor/build/three.module.js')},legalComments:'eof'});
const scripts=new Map();
for(const [name,info] of Object.entries(built.metafile.outputs))if(info.entryPoint)scripts.set(path.basename(info.entryPoint),'/'+path.relative(out,path.resolve(root,name)).replaceAll(path.sep,'/'));
async function finish(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){await finish(file);continue;}
  if(file.endsWith('.html')){
   let html=await fs.readFile(file,'utf8');
   const page=path.relative(out,file).replaceAll(path.sep,'/').replace(/index\.html$/,'');
   html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/g,'');
   html=html.replace(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)><\/script>/g,(whole,attrs,src)=>{
    if(!/type="module"/.test(attrs))return whole;
    const target=scripts.get(path.posix.basename(src.split('?')[0]));
    if(!target)throw new Error('Missing bundled script '+src);
    return '<script type="module" src="'+target+'"></script>';
   });
   html=html.replace(/(["'])\/(?!\/)/g,'$1'+base);
   if(page)html=html.replace(/href="#([^"]*)"/g,'href="'+base+page+'#$1"');
   html=html.replace('0;url=/boite-a-idees/','0;url='+base+'boite-a-idees/');
   html=html.replace('<head>','<head><base href="'+base+'"><meta name="cycleup-api" content="'+api+'">');
   await fs.writeFile(file,html);
  }else if(file.endsWith('.css')&&!file.includes(path.join('interactive-map','lib'))){
   const result=await esbuild.transform(await fs.readFile(file,'utf8'),{loader:'css',minify:true});
   await fs.writeFile(file,result.code);
  }
 }
}
await finish(out);await fs.writeFile(path.join(out,'.nojekyll'),'');
const bundleBytes=Object.values(built.metafile.outputs).reduce((n,file)=>n+file.bytes,0);
console.log(JSON.stringify({directory:out,base,api,bundleBytes,modules:entries.length}));
