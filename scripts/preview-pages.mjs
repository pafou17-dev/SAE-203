import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('pages-dist'),base='/SAE-203/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.wasm':'application/wasm','.glb':'model/gltf-binary','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8874');
  if(!url.pathname.startsWith(base)){res.writeHead(302,{location:base});return res.end();}
  const relative=decodeURIComponent(url.pathname.slice(base.length));
  if(relative.startsWith('api/consultation')){
   const body=[];for await(const chunk of req)body.push(chunk);
   const headers={...req.headers,origin:'http://127.0.0.1:8873'};delete headers.host;delete headers.connection;delete headers['content-length'];
   const response=await fetch('http://127.0.0.1:8873/'+relative,{method:req.method,headers,...(body.length?{body:Buffer.concat(body)}:{})});
   const responseHeaders=Object.fromEntries(response.headers),data=Buffer.from(await response.arrayBuffer());
   // fetch already decompresses upstream responses.
   delete responseHeaders['content-encoding'];delete responseHeaders['transfer-encoding'];
   responseHeaders['content-length']=String(data.length);
   res.writeHead(response.status,responseHeaders);return res.end(data);
  }
  let file=path.resolve(root,relative||'index.html');
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  const data=await fs.readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8874,'127.0.0.1',()=>console.log('Pages preview: http://127.0.0.1:8874/SAE-203/'));
