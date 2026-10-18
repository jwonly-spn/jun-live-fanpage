/* All artwork and masks use the same global 1024 canvas. */
(function(global){
 'use strict';
 const canvas=()=>Object.assign(document.createElement('canvas'),{width:1024,height:1024});
 class DJStyleRenderer{
  constructor(manifest,baseURL='',bundle=null){this.manifest=manifest;this.baseURL=baseURL;this.bundle=bundle;this.cache=new Map();this.tintCache=new Map();this.shaftClipCache=new Map();this.byId=new Map(manifest.assets.map(a=>[a.id,a]));}
  async image(path){if(!this.cache.has(path))this.cache.set(path,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image load failed: '+path));im.src=this.bundle?.[path]||new URL(path,this.baseURL||document.baseURI).href;}));return this.cache.get(path);}
  get(id){const a=this.byId.get(id);if(!a)throw new Error('Unknown asset '+id);return a;}
  async tinted(path,color){const key=path+'|'+color;if(!this.tintCache.has(key)){const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(await this.image(path),0,0);const d=ctx.getImageData(0,0,1024,1024);d.data.set(global.DJHairColor.recolor(d.data,color));ctx.putImageData(d,0,0);this.tintCache.set(key,c);}return this.tintCache.get(key);}
  async shaftClip(hem,g){
   if(!hem?.shoeOcclusionMask)return null;
   const key=hem.id;if(this.shaftClipCache.has(key))return this.shaftClipCache.get(key);
   const c=canvas(),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(await this.image(hem.shoeOcclusionMask),0,0);const mask=x.getImageData(0,0,1024,1024),d=x.createImageData(1024,1024);
   const centers=g==='male'?[484,575]:[497,565],split=(centers[0]+centers[1])/2;
   for(let leg=0;leg<2;leg++){
    const bottoms=[];for(let cx=centers[leg]-16;cx<=centers[leg]+16;cx++){for(let y=955;y>=820;y--)if(mask.data[(y*1024+cx)*4+3]>=128){bottoms.push(y);break;}}
    if(bottoms.length<8)continue;bottoms.sort((a,b)=>a-b);const hemY=bottoms[Math.floor(bottoms.length*.2)]-2;
    // A trouser leg covers the boot shaft. Its original hem still draws above
    // the shoe afterward. Preserve the base skin wherever the shoe is clipped.
    for(let y=650;y<hemY;y++)for(let cx=leg?Math.ceil(split):0;cx<(leg?1024:Math.ceil(split));cx++){const i=(y*1024+cx)*4;d.data[i]=d.data[i+1]=d.data[i+2]=255;d.data[i+3]=255-mask.data[i+3];}
   }
   x.clearRect(0,0,1024,1024);x.putImageData(d,0,0);this.shaftClipCache.set(key,c);return c;
  }
  async render(target,state={}){
   const s={body:'female',hair:1,hairColor:'brown',eyes:1,nose:1,mouth:1,expression:'normal',top:null,bottom:null,shoe:null,outfit:null,accessory:null,hat:null,...state},g=s.body;
   if(!['male','female'].includes(g)||!['normal','smile','cry'].includes(s.expression))throw new Error('Invalid body/expression');
   const pad=n=>String(n).padStart(2,'0'),wardrobe=cat=>s[cat]==null?null:this.get(`${cat}_${pad(s[cat])}_${g}`);
   const top=s.outfit==null?wardrobe('top'):null,bottom=s.outfit==null?wardrobe('bottom'):null,outfit=wardrobe('outfit'),shoe=wardrobe('shoe'),hat=wardrobe('hat');
   const accessories=(Array.isArray(s.accessory)?s.accessory:s.accessory==null?[]:[s.accessory]).map(n=>this.get(`accessory_${pad(n)}_${g}`));
   const out=canvas(),ctx=out.getContext('2d'),body=canvas(),bc=body.getContext('2d'),hem=outfit||bottom,shaftClip=shoe?await this.shaftClip(hem,g):null;
   const shoeLayer=async path=>{const c=canvas(),x=c.getContext('2d');x.drawImage(await this.image(path),0,0);if(shaftClip){x.globalCompositeOperation='destination-out';x.drawImage(shaftClip,0,0);}return c;};
   const hairImage=async layer=>{const a=this.get(`${g}_hair_${pad(s.hair)}_${layer}`),c=canvas(),hc=c.getContext('2d');hc.drawImage(await this.tinted(a.path,s.hairColor),0,0);if(hat?.hairCutoutMask){hc.globalCompositeOperation='destination-out';hc.drawImage(await this.image(hat.hairCutoutMask),0,0);}return c;};
   ctx.drawImage(await hairImage('back'),0,0);bc.drawImage(await this.image(this.get(g+'_body').path),0,0);
   // Cut only the mannequin. Clothing masks must never erase previously painted garments.
   for(const a of [outfit,bottom,top,shoe])if(a?.bodyCutoutMask){bc.globalCompositeOperation='destination-out';bc.drawImage(a===shoe?await shoeLayer(a.bodyCutoutMask):await this.image(a.bodyCutoutMask),0,0);}
   // A clipped boot shaft preserves the bare leg, but must not preserve the
   // mannequin's gray trainer through the gap above a different custom shoe.
   const baseAsset=this.get(g+'_body');if(shoe&&shaftClip&&baseAsset.defaultFootwearMask){bc.globalCompositeOperation='destination-out';bc.drawImage(await this.image(baseAsset.defaultFootwearMask),0,0);}
   bc.globalCompositeOperation='source-over';for(const a of [outfit,bottom,top,shoe])if(a)bc.drawImage(a===shoe?await shoeLayer(a.path):await this.image(a.path),0,0);
   if(hem?.shoeOcclusionMask){const c=canvas(),hc=c.getContext('2d');hc.drawImage(await this.image(hem.path),0,0);hc.globalCompositeOperation='destination-in';hc.drawImage(await this.image(hem.shoeOcclusionMask),0,0);bc.drawImage(c,0,0);}
   ctx.drawImage(body,0,0);
   for(const cat of ['eyes','nose','mouth']){const expr=cat==='eyes'?s.expression:cat==='mouth'&&s.expression==='smile'?'smile':'normal',suffix=expr==='normal'?'':'_'+expr;ctx.drawImage(await this.image(this.get(`${g}_${cat}_${pad(s[cat])}${suffix}`).path),0,0);}
   const frontHair=await hairImage('front');ctx.drawImage(frontHair,0,0);
   // Keep the requested front-hair -> accessory stage order. Complete props
   // are clipped by foreground strands so rims/straps never float over hair.
   for(const a of accessories){const c=canvas(),ac=c.getContext('2d');ac.drawImage(await this.image(a.path),0,0);ac.globalCompositeOperation='destination-out';ac.drawImage(frontHair,0,0);ctx.drawImage(c,0,0);}
   if(hat)ctx.drawImage(await this.image(hat.path),0,0);
   target.width=target.height=1024;const tc=target.getContext('2d');tc.clearRect(0,0,1024,1024);tc.drawImage(out,0,0);return {state:s,width:1024,height:1024};
  }
 }
 global.DJStyleRenderer=DJStyleRenderer;
})(typeof window!=='undefined'?window:globalThis);
