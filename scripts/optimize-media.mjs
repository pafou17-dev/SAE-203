import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve('public/assets');
let before=0,after=0,count=0;
for(const dir of ['photos','journey','portraits']){
  for(const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})){
    if(!entry.isFile()||!(/\.(png|jpg)$/i.test(entry.name)))continue;
    if(dir==='journey'&&!/^rosalie-(classique|cargo|pluie)\.png$/.test(entry.name))continue;
    if(dir==='portraits'&&entry.name!=='personnages-sans-fond.png')continue;
    const input=path.join(root,dir,entry.name),output=input.replace(/\.(png|jpg)$/i,'.webp');
    await sharp(input).webp(dir==='portraits'?{lossless:true,effort:6}:{quality:88,alphaQuality:100,effort:6}).toFile(output);
    before+=(await fs.stat(input)).size;after+=(await fs.stat(output)).size;count++;
  }
}
console.log(JSON.stringify({images:count,originalBytes:before,webpBytes:after,savedPercent:Math.round((1-after/before)*100)}));
