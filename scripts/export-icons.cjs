const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const background='#06472b';
(async()=>{
 const symbol=await fs.readFile(path.join(root,'brand.svg'));
 const inner=symbol.toString().replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${background}"/><g transform="translate(64 64) scale(3)">${inner}</g></svg>\n`;
 await fs.writeFile(path.join(root,'icons/app-icon.svg'),svg);
 for(const size of [32,180,192,512]){
  await sharp(Buffer.from(svg)).resize(size,size).flatten({background}).removeAlpha().png().toFile(path.join(root,`icons/icon-${size}-v2.png`));
 }
 const masked=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${background}"/><g transform="translate(92 92) scale(2.5625)">${inner}</g></svg>`;
 await sharp(Buffer.from(masked)).flatten({background}).removeAlpha().png().toFile(path.join(root,'icons/icon-maskable-512-v2.png'));
 // Verify actual exported assets, including opacity and exact dimensions.
 for(const size of [32,180,192,512]){
  const file=path.join(root,`icons/icon-${size}-v2.png`),m=await sharp(file).metadata();
  if(m.width!==size||m.height!==size||m.hasAlpha)throw Error('Invalid icon export '+size);
  console.log(`icon-${size}-v2.png: ${m.width}×${m.height}, opaque`);
 }
 const mark=await sharp(symbol).resize(328,328).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let maxRadius=0;
 for(let y=0;y<328;y++)for(let x=0;x<328;x++)if(mark.data[(y*328+x)*4+3]>127)maxRadius=Math.max(maxRadius,Math.hypot(x+92-256,y+92-256));
 if(maxRadius>204.8)throw Error('Maskable symbol exceeds Android safe zone');
 console.log('Android safe-zone radius:',maxRadius.toFixed(1),'of 204.8 pixels');
})();
