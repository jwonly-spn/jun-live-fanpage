/* R9 native-detail companion. Original renderer.js and 1024 logical anchors
 * remain unchanged. Registered native face, hair, features and wardrobe rasters
 * are composed directly before display reduction. Missing native entries use
 * explicit compatibility fallback; readiness is recorded in verified STATUS and HANDOFF_READY. */
(function(global){
 'use strict';
 const solidAlphaSpan=(data,rowOffset,lo,hi)=>{let start=-1,bestL=-1,bestR=-1,length=0;for(let x=lo;x<=hi;x++){const solid=x<hi&&data[(rowOffset+x)*4+3]>=128;if(solid&&start<0)start=x;if(!solid&&start>=0){if(x-start>length){length=x-start;bestL=start;bestR=x-1;}start=-1;}}return[bestL,bestR];};
 class DJStyleHDRenderer extends global.DJStyleRenderer{
  constructor(manifest,baseURL='',bundle=null,hdManifest={}){super(manifest,baseURL,bundle);this.hd=hdManifest;this.nativeTint=new Map();this.hd.nativeByPath=this.hd.nativeByPath||{};for(const e of Object.values(this.hd.wardrobe||{}))for(const a of[e,...e.nativeMaskEntries||[]])if(a.compatibilityPath)this.hd.nativeByPath[a.compatibilityPath]=a;}
  clearNativeCache(){this.nativeTint.clear();this.tintCache.clear();this.cache.clear();this.shaftClipCache.clear();}
  async shaftClip(hem,g){
   const e=hem?.shoeOcclusionMask&&this.hd.nativeByPath?.[hem.shoeOcclusionMask];
   if(!e)return super.shaftClip(hem,g);
   const key=hem.id+'|native|'+e.sha256;if(this.shaftClipCache.has(key))return this.shaftClipCache.get(key);
   const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(await this.native(e),...e.rect);const mask=x.getImageData(0,0,1024,1024),d=x.createImageData(1024,1024),centers=g==='male'?[484,575]:[497,565],split=(centers[0]+centers[1])/2;
   for(let leg=0;leg<2;leg++){const bottoms=[];for(let cx=centers[leg]-16;cx<=centers[leg]+16;cx++)for(let y=955;y>=820;y--)if(mask.data[(y*1024+cx)*4+3]>=128){bottoms.push(y);break;}if(bottoms.length<8)continue;bottoms.sort((a,b)=>a-b);const hemY=bottoms[Math.floor(bottoms.length*.2)]-2;for(let y=650;y<hemY;y++)for(let cx=leg?Math.ceil(split):0;cx<(leg?1024:Math.ceil(split));cx++){const i=(y*1024+cx)*4;d.data[i]=d.data[i+1]=d.data[i+2]=255;d.data[i+3]=255-mask.data[i+3];}}
   x.clearRect(0,0,1024,1024);x.putImageData(d,0,0);this.shaftClipCache.set(key,c);return c;
  }
  async native(entry,color){
   if(this.hd.loadNative)await this.hd.loadNative(entry.path);
   const key=entry.path+'|'+(color||'original');
   if(!this.nativeTint.has(key)){
    const im=await this.image(entry.path);if(!color)return im;
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height);d.data.set(global.DJHairColor.recolor(d.data,color));x.putImageData(d,0,0);this.nativeTint.set(key,c);
   }return this.nativeTint.get(key);
  }
  async render(target,state={},options={}){
   const s={body:'female',hair:1,hairColor:'brown',eyes:1,nose:1,mouth:1,expression:'normal',top:null,bottom:null,shoe:null,outfit:null,accessory:null,hat:null,...state};
   if(!['male','female'].includes(s.body)||!['normal','smile','cry'].includes(s.expression))throw Error('Invalid body/expression');
   const v=options.viewport||[0,0,1024,1024],scale=options.scale||1;
   if(!Number.isFinite(scale)||scale<=0||scale>4||v.length!==4||v.some(n=>!Number.isFinite(n))||v[2]<=0||v[3]<=0)throw Error('Invalid HD viewport');
   const make=()=>{const c=document.createElement('canvas');c.width=Math.round(v[2]*scale);c.height=Math.round(v[3]*scale);const x=c.getContext('2d');x.setTransform(scale,0,0,scale,-v[0]*scale,-v[1]*scale);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';return c;};
   const ctx=c=>c.getContext('2d'),blit=(x,c)=>{x.save();x.setTransform(1,0,0,1,0,0);x.drawImage(c,0,0);x.restore();};
   const g=s.body,pad=n=>String(n).padStart(2,'0'),ward=cat=>s[cat]==null?null:this.get(`${cat}_${pad(s[cat])}_${g}`);
   const top=s.outfit==null?ward('top'):null,bottom=s.outfit==null?ward('bottom'):null,outfit=ward('outfit'),shoe=ward('shoe'),hat=ward('hat'),hem=outfit||bottom,shaft=shoe?await this.shaftClip(hem,g):null;
   const props=(Array.isArray(s.accessory)?s.accessory:s.accessory==null?[]:[s.accessory]).map(n=>this.get(`accessory_${pad(n)}_${g}`));
   const drawSD=async(x,path)=>{const e=this.hd.nativeByPath?.[path];if(e){for(const p of e.pieces||[e])x.drawImage(await this.native(p),...p.rect);}else x.drawImage(await this.image(path),0,0,1024,1024);};
   const shoeLayer=async path=>{const c=make(),x=ctx(c);await drawSD(x,path);if(shaft){x.globalCompositeOperation='destination-out';x.drawImage(shaft,0,0,1024,1024);x.globalCompositeOperation='source-over';}return c;};
   const hair=async layer=>{const a=this.get(`${g}_hair_${pad(s.hair)}_${layer}`),e=this.hd.hair?.[a.id],c=make(),x=ctx(c);if(e)x.drawImage(await this.native(e,s.hairColor),...e.rect);else x.drawImage(await this.tinted(a.path,s.hairColor),0,0,1024,1024);if(hat?.hairCutoutMask){x.globalCompositeOperation='destination-out';await drawSD(x,hat.hairCutoutMask);x.globalCompositeOperation='source-over';}return c;};
   const c=make(),x=ctx(c);blit(x,await hair('back'));const body=make(),bc=ctx(body);
   const defaultBody=this.hd.nativeDefaultBodyEnabled===false?null:this.hd.defaultBody?.[g],nativeDefaultBodyMode=defaultBody?(!outfit&&(!top||!bottom)?'whole_clothes':!shoe?'footwear_only':false):false;
   if(!options.omitCompatibilityBody){await drawSD(bc,this.get(g+'_body').path);if(nativeDefaultBodyMode){const minY=nativeDefaultBodyMode==='whole_clothes'?defaultBody.minimumBodyY:defaultBody.footwearOnlyMinimumY;bc.clearRect(0,minY,1024,1024-minY);bc.save();bc.beginPath();bc.rect(0,minY,1024,1024-minY);bc.clip();bc.drawImage(await this.native(defaultBody),...defaultBody.rect);bc.restore();}}
   const debug=label=>{if(options.onLayer)options.onLayer(label,body);};
   const companionAsset=outfit||top,nativeClothing=companionAsset&&this.hd.nativeByPath?.[companionAsset.path],companion=nativeClothing?.bodyCompanion;
   const nativeShoe=shoe&&this.hd.nativeByPath?.[shoe.path],footwearCompanion=nativeShoe?.lowerBodyCompanion||(!shoe&&defaultBody?.footwearCompanion);
   const nativeBottom=bottom&&this.hd.nativeByPath?.[bottom.path],bottomCompanion=nativeBottom?.lowerBodyCompanion;
   const legCompanion=footwearCompanion||(nativeShoe&&this.hd.lowerLeg?.[g]);
   const featureIds=['eyes','nose','mouth'].map(cat=>{const expr=cat==='eyes'?s.expression:cat==='mouth'&&s.expression==='smile'?'smile':'normal';return `${g}_${cat}_${pad(s[cat])}${expr==='normal'?'':'_'+expr}`;});
   const bakedIds=['eyes','nose','mouth'].map(cat=>`${g}_${cat}_01`);
   const face=this.hd.face?.[g],useFace=!!face&&featureIds.every((id,i)=>id===bakedIds[i]||!!this.hd.features?.[id]),nativeFeaturesUsed=[];
   const lowerBodyMaster=!outfit&&nativeBottom&&this.hd.lowerBody?.[g];
   if(useFace)bc.clearRect(...face.logicalClearRect);
   // Replacement masks remove the original body only. Applying a pelvis
   // replacement after native upper-body paint cut into the new right hand.
   const upperReplace=nativeDefaultBodyMode==='whole_clothes'&&companion&&!outfit?defaultBody.upperReplacementMask:companion?.replacementMask;
   for(const m of[upperReplace,lowerBodyMaster?.replacementMask||bottomCompanion?.replacementMask,footwearCompanion?.replacementMask])if(m){bc.globalCompositeOperation='destination-out';bc.drawImage(await this.native(m),...m.rect);}bc.globalCompositeOperation='source-over';
   if(lowerBodyMaster&&!options.omitNativeBareLegPaint){const p=lowerBodyMaster.paint,cut=nativeBottom.coveredLegsUntil;if(cut){const split=g==='female'?531:529.5;for(let leg=0;leg<2;leg++){bc.save();bc.beginPath();bc.rect(leg?split:0,cut[leg],leg?1024-split:split,1024-cut[leg]);bc.clip();bc.drawImage(await this.native(p),...p.rect);bc.restore();}}else bc.drawImage(await this.native(p),...p.rect);}
   if(companion){bc.save();if(companion.upperOnlyInitial){bc.beginPath();bc.rect(0,0,1024,companion.restoreAfterBottomMinY);bc.clip();}bc.drawImage(await this.native(nativeClothing),...nativeClothing.rect);bc.restore();}
   if(companion?.neckRepair){const r=companion.neckRepair;bc.globalCompositeOperation='destination-out';bc.drawImage(await this.native(r.eraseMask),...r.eraseMask.rect);bc.globalCompositeOperation='source-over';bc.drawImage(await this.native(r.painting),...r.painting.rect);}
   if(useFace){const portrait=companion?.face||(nativeDefaultBodyMode==='whole_clothes'&&defaultBody.face)||face;bc.drawImage(await this.native(portrait),...portrait.rect);bc.globalCompositeOperation='source-atop';for(const id of featureIds){const e=this.hd.features?.[id];if(e){bc.drawImage(await this.native(e),...e.rect);nativeFeaturesUsed.push(id);}}bc.globalCompositeOperation='source-over';}
   debug('upperbody');
   for(const lower of[lowerBodyMaster?null:bottomCompanion,legCompanion])if(lower){
    let joinBefore=null,joinGuide=null,joinY=0,joinH=0;const joinEnd=footwearCompanion?.skinJoinEndY||905;
    if(lower===legCompanion&&footwearCompanion?.guideSkinMask&&v[1]<joinEnd&&v[1]+v[3]>845){
     joinY=Math.max(0,Math.floor((845-v[1])*scale));joinH=Math.min(body.height,Math.ceil((joinEnd-v[1])*scale))-joinY;
     if(joinH>0){joinBefore=bc.getImageData(0,joinY,body.width,joinH);const gm=make(),gx=ctx(gm),ge=footwearCompanion.guideSkinMask;gx.drawImage(await this.native(ge),...ge.rect);joinGuide=gx.getImageData(0,joinY,body.width,joinH);}
    }

    bc.globalCompositeOperation='destination-out';if(lower===legCompanion&&!footwearCompanion){const m=lower.replacementMask;bc.drawImage(await this.native(m),...m.rect);}
    if(lower===legCompanion&&footwearCompanion){const m=lower.replacementMask;bc.drawImage(await this.native(m),...m.rect);}
    bc.globalCompositeOperation=lower.composition||'destination-over';const paint=lower.paint||lower;
    if(lower===legCompanion&&footwearCompanion&&shaft){const layer=make(),lx=ctx(layer);lx.drawImage(await this.native(paint),...paint.rect);lx.globalCompositeOperation='destination-out';lx.drawImage(shaft,0,0,1024,1024);blit(bc,layer);}else bc.drawImage(await this.native(paint),...paint.rect);

    if(joinBefore){
     const out=bc.getImageData(0,joinY,body.width,joinH),W=body.width,split=Math.max(0,Math.min(W,Math.round(((g==='female'?531:529.5)-v[0])*scale)));
     for(let row=0;row<joinH;row++){
      const weight=Math.max(0,Math.min(1,(v[1]+(joinY+row+.5)/scale-845)/20));
      for(let side=0;side<2;side++){
       const lo=side?split:0,hi=side?W:split;let[oldL,oldR]=solidAlphaSpan(joinBefore.data,row*W,lo,hi);const[newL,newR]=solidAlphaSpan(joinGuide.data,row*W,lo,hi);
       if(newL<0)continue;if(oldL<0){oldL=newL;oldR=newR;}
       const left=oldL*(1-weight)+newL*weight,right=oldR*(1-weight)+newR*weight;
       for(let px=lo;px<hi;px++){const a=(row*W+px)*4+3;if(out.data[a]){const oldAlpha=out.data[a];let alpha=Math.round(255*Math.max(0,Math.min(1,px+.5-left,right+.5-px)));if(alpha>oldAlpha&&oldAlpha<128){const r=out.data[a-3],gg=out.data[a-2],b=out.data[a-1],paintedSkin=r>135&&gg>70&&b>55&&r>=gg&&r>=b&&r-gg<100&&r-b<130;if(oldAlpha<16||!paintedSkin)alpha=oldAlpha;}out.data[a]=alpha;}}
      }
     }
     // Opaque cuffs can rasterize to249 at a seam; normalize alpha only.
     for(let i=3;i<out.data.length;i+=4)if(out.data[i]>=240)out.data[i]=255;
     bc.save();bc.setTransform(1,0,0,1,0,0);bc.putImageData(out,0,joinY);bc.restore();
    }
    bc.globalCompositeOperation='source-over';debug(lower===bottomCompanion?'bottom_underpaint':'footwear');
   }
   for(const a of [outfit,bottom,top,shoe])if(a?.bodyCutoutMask&&!(a===companionAsset&&companion)&&!(a===bottom&&bottomCompanion)&&!(a===shoe&&legCompanion)){bc.globalCompositeOperation='destination-out';if(a===shoe)blit(bc,await shoeLayer(a.bodyCutoutMask));else await drawSD(bc,a.bodyCutoutMask);}
   const base=this.get(g+'_body');if(shoe&&shaft&&base.defaultFootwearMask&&!legCompanion){bc.globalCompositeOperation='destination-out';await drawSD(bc,base.defaultFootwearMask);}bc.globalCompositeOperation='source-over';
   debug('bodycuts');
   for(const a of [outfit,bottom,top,shoe])if(a){if(a===shoe){if(!footwearCompanion)blit(bc,await shoeLayer(a.path));}else if(a===companionAsset&&companion){
    const layer=make(),lx=ctx(layer),overlay=companion.overlay||nativeClothing,minY=companion.restoreAfterBottomMinY||0;lx.save();lx.beginPath();lx.rect(0,minY,1024,companion.restoreAfterBottomMaxY-minY);lx.clip();lx.drawImage(await this.native(overlay),...overlay.rect);lx.restore();
    const old=bc.getImageData(0,0,body.width,body.height),ld=lx.getImageData(0,0,body.width,body.height);blit(bc,layer);const out=bc.getImageData(0,0,body.width,body.height);for(let i=3;i<out.data.length;i+=4)out.data[i]=Math.max(old.data[i],ld.data[i]);bc.save();bc.setTransform(1,0,0,1,0,0);bc.putImageData(out,0,0);bc.restore();
   }else await drawSD(bc,a.path);}
   debug('clothes');if(hem?.shoeOcclusionMask&&shoe&&!footwearCompanion){const h=make(),hx=ctx(h);await drawSD(hx,hem.path);hx.globalCompositeOperation='destination-in';await drawSD(hx,hem.shoeOcclusionMask);blit(bc,h);}debug('hem');blit(x,body);
   if(!useFace)for(const cat of ['eyes','nose','mouth']){const expr=cat==='eyes'?s.expression:cat==='mouth'&&s.expression==='smile'?'smile':'normal';await drawSD(x,this.get(`${g}_${cat}_${pad(s[cat])}${expr==='normal'?'':'_'+expr}`).path);}
   const front=await hair('front');if(this.hd.hair?.[`${g}_hair_${pad(s.hair)}_front`]?.maxAlphaComposite){const old=x.getImageData(0,0,c.width,c.height),fd=ctx(front).getImageData(0,0,c.width,c.height);blit(x,front);const out=x.getImageData(0,0,c.width,c.height);for(let i=3;i<out.data.length;i+=4)out.data[i]=Math.max(old.data[i],fd.data[i]);x.save();x.setTransform(1,0,0,1,0,0);x.putImageData(out,0,0);x.restore();}else blit(x,front);for(const a of props){const ac=make(),ax=ctx(ac);await drawSD(ax,a.path);ax.globalCompositeOperation='destination-out';blit(ax,front);blit(x,ac);}if(hat)await drawSD(x,hat.path);
   target.width=c.width;target.height=c.height;target.getContext('2d').drawImage(c,0,0);
   return {state:s,width:c.width,height:c.height,logicalViewport:v,scale,nativeFaceUsed:useFace,nativeHairUsed:!!this.hd.hair?.[`${g}_hair_${pad(s.hair)}_front`],nativeFeaturesUsed,nativeLowerLegUsed:!!legCompanion,nativeLowerBodyMasterUsed:!!lowerBodyMaster,nativeDefaultBodyUsed:nativeDefaultBodyMode,nativeWardrobeUsed:[outfit,bottom,top,shoe,hat,...props].filter(a=>a&&this.hd.nativeByPath?.[a.path]).map(a=>a.id),legacyFaceFallback:!useFace};
  }
 }
 global.DJStyleHDRenderer=DJStyleHDRenderer;
})(window);

