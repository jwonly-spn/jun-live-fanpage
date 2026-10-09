// ESM build of hair-color.js for the game SVG renderer.
  const PALETTE = Object.freeze({
    black:  {name:'검정',      base:'#2C2731', shadow:'#11121C', highlight:'#696775'},
    brown:  {name:'갈색',      base:'#936047', shadow:'#402C29', highlight:'#D5AF8D'},
    light:  {name:'밝은 갈색', base:'#C28D5B', shadow:'#70482D', highlight:'#F1D2A4'},
    blond:  {name:'금발',      base:'#E8C87A', shadow:'#A97636', highlight:'#FFF0BC'},
    pink:   {name:'분홍',      base:'#F4A4CD', shadow:'#854565', highlight:'#FFE0F0'},
    purple: {name:'보라',      base:'#A48BDC', shadow:'#584173', highlight:'#E1D3FB'},
    sky:    {name:'하늘',      base:'#8DCDEE', shadow:'#426584', highlight:'#DDF5FF'},
    silver: {name:'은발',      base:'#DDE3EB', shadow:'#788294', highlight:'#FFFFFF'}
  });
  const LEGACY = Object.freeze({'#55434C':'black','#A07052':'brown','#C2A476':'light','#F2D58E':'blond','#F5A6C0':'pink','#9B87AE':'purple','#92CCF0':'sky','#F0F2F6':'silver'});
  function rgb(hex) { return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)); }
  function resolve(color) {
    if (Object.hasOwn(PALETTE,color)) return PALETTE[color];
    if (!/^#[0-9a-f]{6}$/i.test(String(color))) throw new Error('머리색은 팔레트 이름 또는 #RRGGBB 형식이어야 합니다.');
    const hex=String(color).toUpperCase(), old=LEGACY[hex];
    if (old) return PALETTE[old];
    const named=Object.values(PALETTE).find(p=>p.base===hex);
    if (named) return named;
    const c=rgb(hex), toHex=a=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
    return {name:'사용자 색',base:hex,shadow:toHex(c.map(v=>v*.48)),highlight:toHex(c.map(v=>v+(255-v)*.62))};
  }
  function table(color) {
    const p=resolve(color), base=rgb(p.base), shadow=rgb(p.shadow), high=rgb(p.highlight);
    const ink=base.map((v,i)=>Math.min([29,28,35][i],Math.round(shadow[i]*.7)));
    const stops=[[0,ink.map(v=>Math.round(v*.55))],[44,ink],[90,shadow],[160,base],[225,high],[255,high.map(v=>Math.round(v+(255-v)*.5))]];
    const lut=Array.from({length:256},()=>[0,0,0]);
    for(let v=0,k=0;v<256;v++) {
      while(k<stops.length-2&&v>stops[k+1][0]) k++;
      const [lo,a]=stops[k],[hi,b]=stops[k+1],t=(v-lo)/(hi-lo);
      for(let c=0;c<3;c++) lut[v][c]=Math.round(a[c]+(b[c]-a[c])*t);
    }
    return lut;
  }
  function recolor(data,color) {
    if (!data || data.length%4) throw new Error('RGBA 바이트 배열이 필요합니다.');
    const lut=table(color),out=new Uint8ClampedArray(data.length);
    for(let i=0;i<data.length;i+=4) {
      const a=data[i+3];out[i+3]=a;
      if (!a) continue;
      // All supplied V3 hair pixels are grayscale. Luminance also handles custom input.
      const l=Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);
      out[i]=lut[l][0];out[i+1]=lut[l][1];out[i+2]=lut[l][2];
    }
    return out;
  }
  function svgFilter(id,color,size=1024) {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) throw new Error('잘못된 SVG filter id');
    if (!Number.isFinite(size)||size<=0) throw new Error('잘못된 SVG 크기');
    const lut=table(color);
    const channels=['R','G','B'].map((c,i)=>'<feFunc'+c+' type="table" tableValues="'+lut.map(v=>(v[i]/255).toFixed(8)).join(' ')+'"/>').join('');
    return '<filter id="'+id+'" x="0" y="0" width="'+size+'" height="'+size+'" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feComponentTransfer in="SourceGraphic">'+channels+'<feFuncA type="identity"/></feComponentTransfer></filter>';
  }
  const api=Object.freeze({VERSION:'tone-map-v1',PALETTE,LEGACY,resolve,table,recolor,svgFilter});

export {api as default,PALETTE,LEGACY,resolve,table,recolor,svgFilter};
