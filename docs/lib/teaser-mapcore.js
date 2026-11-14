export function MapCore(){
  // 그림 지도 시험판: 화면엔 칸이 없고, 경계를 맞추려고 눈에 안 보이는 작은 점(GW×GH)으로만 셈한다.
  var GW=120,GH=75,S=6,CW=GW*S,CH=GH*S,N=GW*GH,WILD=5,SEA=-2,ND=5,REST=4;
  var PAL=[[227,73,72],[237,161,0],[0,131,0],[98,80,214],[27,175,122]];
  var NAMES=['별사탕','구름빵','초코칩','달무리','호박죽'];
  var ACT=[.95,.6,.9,.85,.45];
  function hash(ix,iy,s){var h=(Math.imul(ix|0,374761393)+Math.imul(iy|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
  function vn(x,y,s){var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    var a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
  function fbm(x,y,s,o){var v=0,amp=.5,f=1,t=0;for(var k=0;k<o;k++){v+=amp*vn(x*f,y*f,s+k*17);t+=amp;f*=2;amp*=.5}return v/t}
  function nb4(i,cb){var x=i%GW,y=(i-x)/GW;if(x>0)cb(i-1);if(x<GW-1)cb(i+1);if(y>0)cb(i-GW);if(y<GH-1)cb(i+GW)}
  function blur(src){var t=new Float32Array(N),o=new Float32Array(N),x,y,i;
    for(y=0;y<GH;y++)for(x=0;x<GW;x++){i=y*GW+x;t[i]=(src[x>0?i-1:i]+src[i]+src[x<GW-1?i+1:i])/3}
    for(y=0;y<GH;y++)for(x=0;x<GW;x++){i=y*GW+x;o[i]=(t[y>0?i-GW:i]+t[i]+t[y<GH-1?i+GW:i])/3}return o}
  function blur2(a){return blur(blur(a))}

  // 대륙 모양
  var land=new Uint8Array(N),mount=new Float32Array(N),lobe=new Float32Array(N),jit=new Float32Array(N);
  for(var cy=0;cy<GH;cy++)for(var cx=0;cx<GW;cx++){
    var i=cy*GW+cx,wx=cx+16*(fbm(cx*.03,cy*.03,5,3)-.5),wy=cy+12*(fbm(cx*.03+40,cy*.03+40,6,3)-.5);
    var nx=wx/GW*2-1,ny=wy/GH*2-1,d=Math.sqrt(nx*nx*.72+ny*ny*1.0);
    var h=fbm(wx*.055,wy*.055,11,4)*.85+.6-d*.92;
    land[i]=(h>.4&&cx>3&&cy>2&&cx<GW-4&&cy<GH-3)?1:0;
    mount[i]=fbm(cx*.09+7,cy*.09+3,31,3);
    lobe[i]=fbm(cx*.11,cy*.11,77,3);jit[i]=hash(cx,cy,99);
  }
  (function keepBiggest(){var comp=new Int32Array(N).fill(-1),best=-1,bs=0,id=0;
    for(var s=0;s<N;s++){if(!land[s]||comp[s]>=0)continue;var q=[s],sz=0;comp[s]=id;
      while(q.length){var c=q.pop();sz++;nb4(c,function(n){if(land[n]&&comp[n]<0){comp[n]=id;q.push(n)}})}
      if(sz>bs){bs=sz;best=id}id++}
    for(var k=0;k<N;k++)land[k]=comp[k]===best?1:0})();
  var LAND=0;for(var k=0;k<N;k++)LAND+=land[k];
  var coast=new Int16Array(N).fill(-1),q=[];for(k=0;k<N;k++)if(!land[k]){coast[k]=0;q.push(k)}
  for(var h0=0;h0<q.length;h0++){var c0=q[h0];nb4(c0,function(n){if(coast[n]<0){coast[n]=coast[c0]+1;q.push(n)}})}
  var seaD=new Int16Array(N).fill(-1),q2=[];for(k=0;k<N;k++)if(land[k]){seaD[k]=0;q2.push(k)}
  for(var h1=0;h1<q2.length;h1++){var c1=q2[h1];nb4(c1,function(n){if(seaD[n]<0){seaD[n]=seaD[c1]+1;q2.push(n)}})}
  var mv=[];for(k=0;k<N;k++)if(land[k]&&coast[k]>3)mv.push(mount[k]);mv.sort(function(a,b){return a-b});var MT=mv[Math.floor(mv.length*.8)]||1;
  var Lb=blur2(Float32Array.from(land));
  var Mb=blur2(Float32Array.from(mount,function(v,i){return land[i]&&coast[i]>3&&v>MT?Math.min(1,(v-MT)*12+.4):0}));

  // 기지 자리: 바다에서 먼 곳 중 서로 멀리
  var caps=[];(function(){var cand=[];for(var i=0;i<N;i++)if(land[i]&&coast[i]>=6)cand.push(i);
    var first=cand[Math.floor(hash(3,9,1)*cand.length)];caps.push(first);
    while(caps.length<ND){var bi=-1,bd=-1;cand.forEach(function(c){var md=1e9;caps.forEach(function(p){var dx=c%GW-p%GW,dy=(c-c%GW)/GW-(p-p%GW)/GW;md=Math.min(md,dx*dx+dy*dy)});if(md>bd){bd=md;bi=c}});caps.push(bi)}})();
  var capDist=caps.map(function(p){var px=p%GW,py=(p-px)/GW,a=new Float32Array(N);for(var i=0;i<N;i++){var x=i%GW,y=(i-x)/GW;a[i]=Math.sqrt((x-px)*(x-px)+(y-py)*(y-py))}return a});

  // 종이 결
  var tex=new Float32Array(CW*CH);for(var py=0;py<CH;py++)for(var px=0;px<CW;px++){tex[py*CW+px]=fbm(px*.018,py*.018,21,3)*.7+hash(px,py,3)*.3}

  var rnd,owner,base,col,day,feed;
  function cnt(k){var c=0;for(var i=0;i<N;i++)if(owner[i]===k)c++;return c}
  function pct(k){return cnt(k)/LAND*100}
  function wildPct(){return cnt(-1)/LAND*100}
  function own(k){var c=0;for(var i=0;i<N;i++)if(owner[i]===k&&!base[i]&&col[i]<0)c++;return c}
  function colPct(w){var c=0;for(var i=0;i<N;i++)if(owner[i]===w&&col[i]>=0)c++;return c/LAND*100}
  function ruledPct(l){var c=0;for(var i=0;i<N;i++)if(col[i]===l)c++;return c/LAND*100}
  function grow(k,n,pure){if(n<=0)return 0;var inF=new Uint8Array(N),F=[],got=0,i;
    for(i=0;i<N;i++)if(owner[i]===k)nb4(i,function(m){if(owner[m]===-1&&!inF[m]){inF[m]=1;F.push(m)}});
    while(got<n&&F.length){var bj=0,bs=1e9;for(var j=0;j<F.length;j++){var c=F[j],s=capDist[k][c]+(pure?0:lobe[c]*30+jit[c]*3);if(s<bs){bs=s;bj=j}}
      var c2=F[bj];F[bj]=F[F.length-1];F.pop();if(owner[c2]!==-1)continue;owner[c2]=k;got++;
      nb4(c2,function(m){if(owner[m]===-1&&!inF[m]){inF[m]=1;F.push(m)}})}
    return got}
  // 영지전: 진 DJ 땅 일부가 이긴 DJ의 식민지가 돼요. 식민지를 빼앗긴 DJ가 그 DJ를 이기면 식민지를 모두 되찾아요(독립).
  function war(win,lose,n){var i,freed=0;
    for(i=0;i<N;i++)if(owner[i]===lose&&col[i]===win){owner[i]=win;col[i]=-1;freed++}
    if(freed)return{n:freed,free:true};
    var cand=new Uint8Array(N),seed=-1,bd=1e9;
    for(i=0;i<N;i++)if(owner[i]===lose&&!base[i]&&col[i]<0){cand[i]=1;if(capDist[win][i]<bd){bd=capDist[win][i];seed=i}}
    if(seed<0||n<1)return{n:0};
    var inF=new Uint8Array(N),F=[seed],got=0;inF[seed]=1;
    while(got<n&&F.length){var bj=0,bs=1e9;for(var j=0;j<F.length;j++){var c=F[j],s=capDist[win][c]+lobe[c]*8;if(s<bs){bs=s;bj=j}}
      var c2=F[bj];F[bj]=F[F.length-1];F.pop();owner[c2]=win;col[c2]=lose;got++;
      nb4(c2,function(m){if(cand[m]&&!inF[m]&&owner[m]===lose){inF[m]=1;F.push(m)}})}
    return{n:got}}

  function reset(){var s=20261115;rnd=function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    owner=new Int8Array(N);base=new Uint8Array(N);col=new Int8Array(N).fill(-1);for(var i=0;i<N;i++)owner[i]=land[i]?-1:SEA;
    caps.forEach(function(c,k){owner[c]=k;grow(k,Math.round(LAND*.01)-1,true);for(var j=0;j<N;j++)if(owner[j]===k)base[j]=1});
    day=1;feed={items:['12월 1일 시즌 시작 · 모두 기지 1%에서 시작해요 · 영지전도 첫날부터 열려요'],now:1}}
  function f1(v){return(Math.round(v*10)/10).toFixed(1)}
  function won(v){return v>=10000?(Math.round(v/1000)/10)+'만':v.toLocaleString('ko-KR')}
  var GAMES=['가위바위보','가위바위보 하나빼기','몬스터 대전'];
  // 정하신 규칙: 보스는 방송마다 1번(시작 1시간 뒤), 땅은 보스와 영지전으로만 움직여요
  function step(){if(day>=31)return false;day++;var news=[],on=[],G=.03/ND;
    NAMES.forEach(function(nm,k){if(rnd()>ACT[k])return;on.push(k);
      var casts=rnd()<.4?2:1,ok=0,miss=0,before=pct(k);
      for(var z=0;z<casts;z++){if(rnd()<.1)continue;if(rnd()<.8){grow(k,Math.max(1,Math.round(LAND*G*wildPct()/100)));ok++}else miss++}
      if(ok)news.push(nm+' · 보스 토벌 성공'+(ok>1?' (방송 '+ok+'번)':'')+' · 땅 +'+f1(pct(k)-before)+'% → '+f1(pct(k))+'%');
      else if(miss)news.push(nm+' · 보스 토벌 실패 · 참전한 분들은 경험치를 조금 받아요')});
    var pool=on.slice();
    while(pool.length>=2&&rnd()<.6){var a=pool.splice(Math.floor(rnd()*pool.length),1)[0],b=pool.splice(Math.floor(rnd()*pool.length),1)[0];
      var r0=rnd(),game=r0<.45?0:r0<.85?1:2,win=rnd()<.5?a:b,lose=win===a?b:a,bet=(2+Math.floor(rnd()*29))*1000;
      var share=Math.min(.25,.1+.05*Math.floor(bet/10000)),r=war(win,lose,Math.round(own(lose)*share));
      news.push(NAMES[a]+' vs '+NAMES[b]+' 영지전 · '+GAMES[game]+' · '+NAMES[win]+' 승 · 판돈 '+won(bet)+'냥'+(r.free?' · 식민지 '+f1(r.n/LAND*100)+'%를 되찾았어요 (독립!)':r.n?' · '+NAMES[lose]+' 땅 '+f1(r.n/LAND*100)+'%를 식민지로':''))}
    if(day===31){var top=NAMES.map(function(_,k){return k}).sort(function(x,y){return cnt(y)-cnt(x)})[0];news.push('12월 31일 시즌 끝 · 1위 '+NAMES[top]+' '+f1(pct(top))+'% · 먼치킨 한 달 무료 이용권과 상금 486스푼')}
    feed.items=news.concat(feed.items).slice(0,40);feed.now=news.length;return true}
  function asleep(){return false}

  function fields(){var F=[],k,i,a;
    for(k=0;k<=WILD;k++){a=new Float32Array(N);for(i=0;i<N;i++)a[i]=(k===WILD?owner[i]===-1:owner[i]===k)?1:0;F.push(blur2(a))}
    for(k=0;k<ND;k++){a=new Float32Array(N);for(i=0;i<N;i++)a[i]=col[i]===k?1:0;F.push(blur2(a))}
    return F}
  function render(data,Fo,Fn,t){
    var F=[],mask=new Uint8Array(N),cmask=new Uint8Array(N),k,i,NF=Fo.length;
    for(k=0;k<NF;k++){var a=new Float32Array(N),o=Fo[k],n=Fn[k];for(i=0;i<N;i++){var v=o[i]+(n[i]-o[i])*t;a[i]=v;if(v>.002){if(k<=WILD)mask[i]|=1<<k;else cmask[i]|=1<<(k-WILD-1)}}F.push(a)}
    var p=0;
    for(var py=0;py<CH;py++){var gy=(py+.5)/S-.5,iy=Math.floor(gy),fy=gy-iy,y0=iy<0?0:iy,y1=iy+1>GH-1?GH-1:iy+1;
      for(var px=0;px<CW;px++,p++){var gx=(px+.5)/S-.5,ix=Math.floor(gx),fx=gx-ix,x0=ix<0?0:ix,x1=ix+1>GW-1?GW-1:ix+1;
        var A=y0*GW+x0,B=y0*GW+x1,C=y1*GW+x0,D=y1*GW+x1,w0=(1-fx)*(1-fy),w1=fx*(1-fy),w2=(1-fx)*fy,w3=fx*fy;
        var l=Lb[A]*w0+Lb[B]*w1+Lb[C]*w2+Lb[D]*w3,T=tex[p],r,g,b;
        if(l<.5){var s=Math.min(1,(.5-l)*2.6);r=200-52*s;g=222-34*s;b=226-20*s;
          var sh=.94+.1*T;r*=sh;g*=sh;b*=sh;
          if(l>.46){var e=(l-.46)/.04;r+=(68-r)*e*.75;g+=(78-g)*e*.75;b+=(80-b)*e*.75}
        }else{
          var m=mask[A]|mask[B]|mask[C]|mask[D],bk=-1,bv=-1,sk=-1,sv=0;
          for(k=0;k<=WILD;k++)if(m&(1<<k)){var f=F[k],v2=f[A]*w0+f[B]*w1+f[C]*w2+f[D]*w3;if(v2>bv){sk=bk;sv=bv<0?0:bv;bk=k;bv=v2}else if(v2>sv){sv=v2;sk=k}}
          var mt=Mb[A]*w0+Mb[B]*w1+Mb[C]*w2+Mb[D]*w3;if(mt>1)mt=1;
          r=242-12*mt;g=233-20*mt;b=208-26*mt;
          var edge=bv-sv;
          if(bk===WILD||bk<0){r+=(196-r)*.55;g+=(208-g)*.55;b+=(160-b)*.55;
            if(sk>=0&&sk<WILD&&edge<.08){var c0=PAL[sk],z=(1-edge/.08)*.7;r+=(c0[0]*.62-r)*z;g+=(c0[1]*.62-g)*z;b+=(c0[2]*.62-b)*z}
          }else{var c1=PAL[bk],al=.3+.34*(1-Math.min(1,edge/.5));al*=.88+.24*T;
            r+=(c1[0]-r)*al;g+=(c1[1]-g)*al;b+=(c1[2]-b)*al;
            var cm=cmask[A]|cmask[B]|cmask[C]|cmask[D];
            if(cm)for(k=0;k<ND;k++)if(cm&(1<<k)){var fc=F[WILD+1+k],cv=fc[A]*w0+fc[B]*w1+fc[C]*w2+fc[D]*w3;
              if(cv>.5){if(((px+py)%16)<6){var c3=PAL[k];r+=(c3[0]-r)*.5;g+=(c3[1]-g)*.5;b+=(c3[2]-b)*.5}break}}
            if(edge<.08){var z2=(1-edge/.08)*.75;r+=(c1[0]*.62-r)*z2;g+=(c1[1]*.62-g)*z2;b+=(c1[2]*.62-b)*z2}}
          var sh2=.9+.15*T;r*=sh2;g*=sh2;b*=sh2;
          if(l<.53){var e2=1-(l-.5)/.03;r+=(68-r)*e2*.75;g+=(78-g)*e2*.75;b+=(80-b)*e2*.75}
        }
        var q4=p*4;data[q4]=r;data[q4+1]=g;data[q4+2]=b;data[q4+3]=255}}
  }
  function pole(inside,fallback){var dist=new Int16Array(N).fill(-1),qq=[],i;
    for(i=0;i<N;i++)if(!inside(i)){dist[i]=0;qq.push(i)}
    for(var h=0;h<qq.length;h++){var c=qq[h];nb4(c,function(m){if(dist[m]<0){dist[m]=dist[c]+1;qq.push(m)}})}
    var bi=fallback,bd=-1;for(i=0;i<N;i++)if(inside(i)&&dist[i]>bd){bd=dist[i];bi=i}return bi}
  function labels(){return NAMES.map(function(nm,k){
      var bi=pole(function(i){return owner[i]===k&&col[i]<0},caps[k]);
      var lx=bi%GW+.5,ly=(bi-bi%GW)/GW+.5,kx=caps[k]%GW+.5,ky=(caps[k]-caps[k]%GW)/GW+.5;if(Math.abs(lx-kx)<5&&Math.abs(ly-ky)<4){lx=kx;ly=ky-5.6}
      var c2=cnt(k);return{k:k,name:nm,x:lx/GW,y:ly/GH,cells:c2,pct:c2/LAND*100,col:colPct(k),ruled:ruledPct(k),sleep:false}})}
  // 식민지 덩어리마다 "○○ 땅 · △△ 지배 중"
  function colonies(){var seen=new Uint8Array(N),out=[];
    for(var s=0;s<N;s++){if(seen[s]||col[s]<0)continue;var w=owner[s],l=col[s],q=[s],cells=[];seen[s]=1;
      while(q.length){var c=q.pop();cells.push(c);nb4(c,function(m){if(!seen[m]&&owner[m]===w&&col[m]===l){seen[m]=1;q.push(m)}})}
      if(cells.length<10)continue;var set={};cells.forEach(function(c){set[c]=1});var bi=pole(function(i){return set[i]===1},cells[0]);
      out.push({w:w,l:l,x:(bi%GW+.5)/GW,y:((bi-bi%GW)/GW+.5)/GH,pct:cells.length/LAND*100})}
    return out}  // 그림 장식 자리(산·숲·물결)
  function decor(){var mts=[],trees=[],waves=[];
    for(var y=1;y<GH-1;y+=2)for(var x=1;x<GW-1;x+=2){var i=y*GW+x,j=hash(x,y,5),jx=(x+.5+(hash(x,y,6)-.5)*1.6)*S,jy=(y+.5+(hash(x,y,7)-.5)*1.6)*S;
      if(land[i]&&coast[i]>3&&mount[i]>MT&&j<.55)mts.push([jx,jy,i,8+Math.min(1,(mount[i]-MT)*10)*6]);
      else if(land[i]&&coast[i]>1&&j<.42)trees.push([jx,jy,i]);
      else if(!land[i]&&seaD[i]>=3&&seaD[i]<=10&&j<.1)waves.push([jx,jy])}
    return{mts:mts,trees:trees,waves:waves}}
  return{GW:GW,GH:GH,S:S,CW:CW,CH:CH,N:N,PAL:PAL,NAMES:NAMES,LAND:LAND,caps:caps,reset:reset,step:step,fields:fields,render:render,labels:labels,colonies:colonies,decor:decor,
    pct:pct,wildPct:wildPct,asleep:asleep,owner:function(){return owner},day:function(){return day},feed:function(){return feed}}
}
