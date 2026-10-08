// DJ 키우기 그림(방송 관리 창, 나중에 팬페이지도 같은 규칙): 캐릭터를 1024×1024 캔버스에 층층이 겹쳐 SVG 글로 만든다.
// 그림 파일(GPT 그림, app/public/kiugi/<시즌>/*.png)이 있으면 그것을, 없으면 아래 SVG 자리 그림을 쓴다(기획 dj-kiugi.html 의 자리 그림을 옮기고 빈 옷은 새로 그렸다).
// 파일 이름(기획의 GPT 부탁 표와 같다): base_{f|m}_{s1..s5}.png · hair_{모양}_{front|back}.png(회색 → 화면에서 머리색으로 물들인다) ·
//  eyes_{눈}.png · nose_{코}.png · mouth_{입}.png · 표정 조각 exp_blush·exp_sparkle·exp_floating-hearts·exp_tears.png, eyes_wink·eyes_happy·eyes_heart.png ·
//  시즌 옷 {시즌}_{칸}_{옷id}.png(예: s1_head_witch-hat.png) · 시즌 보상 reward_{id}.png(그 보상이 나온 시즌 폴더).
// 몸·머리카락·얼굴·표정 조각은 첫 시즌 폴더(s1)에서 찾는다.
// 위치·크기 보정: 시즌 폴더의 adjust.json = {"파일 이름(.png 뺌)": {"x":0,"y":0,"scale":1,"back":false}} — x·y 는 1024 캔버스 기준 칸 수,
//  scale 은 캔버스 가운데(512,512) 기준 크기, back:true 면 몸 뒤에 그린다(날개 등).
// 문서(DOM) 없이 글만 만든다(노드 시험에서 바로 불러 쓴다).
export const BASE_SEASON='s1';
export const SKIN_COLORS=Object.freeze({s1:'#FCE3D3',s2:'#F6CFAE',s3:'#E3AC84',s4:'#C68A62',s5:'#8D5A3D'});
// 머리색: 회색 머리 그림에 이 색을 곱한다(Codex 그림 패키지 기술연결가이드 7 — 결과 = 원본 × 색 ÷ 255, 2026-10-08).
//  예전(진한 색 + 밝히기)보다 머리결이 살아 있다. cocoa·charcoal·beige·lilac 은 패키지 권장값.
export const HAIR_COLORS=Object.freeze({black:'#55434C',brown:'#A07052',light:'#C2A476',blond:'#F2D58E',pink:'#F5A6C0',purple:'#9B87AE',sky:'#92CCF0',silver:'#F0F2F6'});
// 머리색 고르기 칸의 동그라미 색(화면 전용): 곱하기 색 그대로 칠하면 실제 머리보다 너무 밝다(검정이 회보라, 은발이 흰 바탕에 안 보임).
//  회색 머리 그림의 보통 밝기(약 0.8)를 곱해 그려진 머리와 비슷하게 맞춘다. 그림에는 HAIR_COLORS 를 쓴다.
export const HAIR_SWATCH_GRAY=0.8;
export const hairSwatch=hex=>{const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return'#808080';return '#'+[0,2,4].map(i=>Math.round(parseInt(m[1].slice(i,i+2),16)*HAIR_SWATCH_GRAY).toString(16).padStart(2,'0').toUpperCase()).join('');};
export const HAIR_SWATCHES=Object.freeze(Object.fromEntries(Object.entries(HAIR_COLORS).map(([k,v])=>[k,hairSwatch(v)])));
const OUT='#4A3426',EYE='#2E2433';
const s5=` stroke="${OUT}" stroke-width="5" stroke-linejoin="round"`,s6=` stroke="${OUT}" stroke-width="6" stroke-linejoin="round"`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function star(cx,cy,r,fill,stroke=true){const p=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;p.push((cx+rr*Math.cos(a)).toFixed(1)+','+(cy-rr*Math.sin(a)).toFixed(1));}return `<polygon points="${p.join(' ')}" fill="${fill}"${stroke?s5:''}/>`;}
const heart=(x,y,s,fill,extra='')=>`<path d="M${x} ${y+0.9*s} C${x-1.2*s} ${y+0.1*s} ${x-0.9*s} ${y-0.9*s} ${x} ${y-0.3*s} C${x+0.9*s} ${y-0.9*s} ${x+1.2*s} ${y+0.1*s} ${x} ${y+0.9*s}Z" fill="${fill}"${extra}/>`;
const bat=(x,y,k,fill)=>`<path transform="translate(${x} ${y}) scale(${k})" d="M0 0 q-18 -16 -40 -6 q12 4 14 13 q12 -9 26 -7 q14 -2 26 7 q2 -9 14 -13 q-22 -10 -40 6z" fill="${fill}"/>`;
const ghost=(x,y,k,eyes=true)=>`<g transform="translate(${x} ${y}) scale(${k})"><path d="M-50 40 Q-52 -50 0 -52 Q52 -50 50 40 L38 26 L26 42 L14 26 L0 42 L-14 26 L-26 42 L-38 26Z" fill="#FFFFFF"${s6}/>${eyes?`<circle cx="-16" cy="-10" r="7" fill="${EYE}"/><circle cx="16" cy="-10" r="7" fill="${EYE}"/>`:''}</g>`;
function curls(cx,cy,r,a0,a1,step,cr){let o='';for(let a=a0;a<=a1;a+=step){const t=a*Math.PI/180;o+=`<circle cx="${(cx+r*Math.cos(t)).toFixed(1)}" cy="${(cy+r*Math.sin(t)).toFixed(1)}" r="${cr}"/>`;}return o;}

// ── 캐릭터 조각(기획 dj-kiugi.html 과 같은 좌표) ──
export const HAIR_SHAPES=Object.freeze({
 short:{back:'',front:'<path d="M326 392 Q298 134 512 122 Q726 134 698 392 Q692 296 664 250 Q612 284 562 256 Q512 290 462 256 Q412 284 360 250 Q332 296 326 392Z"/>'},
 part:{back:'<path d="M326 330 Q326 140 512 130 Q698 140 698 330 L704 520 Q512 490 320 520 Z"/>',front:'<path d="M318 420 Q290 138 512 120 Q740 138 706 420 Q702 300 640 234 Q560 300 430 260 Q360 300 318 420Z"/>'},
 bob:{back:'<path d="M300 340 Q300 134 512 122 Q724 134 724 340 L734 556 Q694 586 652 560 L644 430 L380 430 L372 560 Q330 586 290 556 Z"/>',front:'<path d="M320 330 Q326 138 512 128 Q698 138 704 330 Q694 300 676 300 L348 300 Q330 300 320 330Z"/>'},
 long:{back:'<path d="M296 340 Q296 130 512 120 Q728 130 728 340 L750 770 Q700 806 652 770 L642 460 L382 460 L372 770 Q324 806 274 770 Z"/>',front:'<path d="M318 420 Q300 134 512 124 Q724 134 706 420 Q690 290 600 246 Q520 320 400 298 Q340 330 318 420Z"/>'},
 pony:{back:'<path d="M676 206 Q836 226 818 460 Q806 616 714 664 Q774 520 736 400 Q718 300 676 206Z"/>',front:'<path d="M326 392 Q298 134 512 122 Q726 134 698 392 Q692 296 664 250 Q612 284 562 256 Q512 290 462 256 Q412 284 360 250 Q332 296 326 392Z"/>',extra:`<circle cx="690" cy="214" r="22" fill="#E57399"${s5}/>`},
 curly:{back:'<g>'+curls(512,350,200,150,210,15,56)+curls(512,350,200,330,390,15,56)+'</g>',front:'<g>'+curls(512,345,170,195,345,15,52)+'</g>'}
});
const TORSO={m:'M418 598 Q420 572 452 566 L572 566 Q604 572 606 598 L600 780 L424 780 Z',f:'M430 598 Q432 574 458 568 L566 568 Q592 574 594 598 L586 690 Q600 740 596 780 L428 780 Q424 740 438 690 Z'};
const ARM_L='<rect x="388" y="585" width="44" height="175" rx="22" transform="rotate(10 410 590)"/>',ARM_R='<rect x="592" y="585" width="44" height="175" rx="22" transform="rotate(-10 614 590)"/>';
const HAND_L=[380,757],HAND_R=[644,757];
const defs=c=>`<clipPath id="${c.id}t"><path d="${TORSO[c.g]}"/></clipPath><clipPath id="${c.id}l">${ARM_L}</clipPath><clipPath id="${c.id}r">${ARM_R}</clipPath>`;
const sleeves=(c,color,len=175)=>`<g clip-path="url(#${c.id}l)"><rect x="300" y="560" width="200" height="${25+len}" fill="${color}" transform="rotate(10 410 590)"/></g><g clip-path="url(#${c.id}r)"><rect x="524" y="560" width="200" height="${25+len}" fill="${color}" transform="rotate(-10 614 590)"/></g>`;
const torso=(c,color,extra='')=>`<path d="${TORSO[c.g]}" fill="${color}"${s6}/>`+(extra?`<g clip-path="url(#${c.id}t)">${extra}</g>`:'');
export function eyesSvg(k){
 const L=440,R=584,Y=372;
 if(k==='smile')return `<path d="M418 380 Q440 354 462 380 M562 380 Q584 354 606 380" fill="none" stroke="${EYE}" stroke-width="9" stroke-linecap="round"/>`;
 if(k==='sleepy')return `<path d="M418 372 Q440 396 462 372 Z M562 372 Q584 396 606 372 Z" fill="${EYE}"/><path d="M414 370 L466 370 M558 370 L610 370" stroke="${EYE}" stroke-width="7" stroke-linecap="round"/>`;
 if(k==='cat')return `<path d="M414 382 Q440 350 470 362 Q446 394 414 382Z M610 382 Q584 350 554 362 Q578 394 610 382Z" fill="${EYE}"/><circle cx="447" cy="368" r="5" fill="#FFF"/><circle cx="591" cy="368" r="5" fill="#FFF"/>`;
 if(k==='sparkle')return `<ellipse cx="${L}" cy="${Y}" rx="25" ry="31" fill="${EYE}"/><ellipse cx="${R}" cy="${Y}" rx="25" ry="31" fill="${EYE}"/><circle cx="449" cy="360" r="8" fill="#FFF"/><circle cx="593" cy="360" r="8" fill="#FFF"/><circle cx="432" cy="384" r="4" fill="#FFF"/><circle cx="576" cy="384" r="4" fill="#FFF"/>`;
 // 표정 눈(레벨 표정): 윙크 · ^^ · 하트
 if(k==='wink')return `<ellipse cx="${L}" cy="${Y}" rx="19" ry="25" fill="${EYE}"/><circle cx="446" cy="362" r="6" fill="#FFF"/><path d="M562 376 Q584 392 606 376" fill="none" stroke="${EYE}" stroke-width="9" stroke-linecap="round"/>`;
 if(k==='happy')return `<path d="M418 384 L440 362 L462 384 M562 384 L584 362 L606 384" fill="none" stroke="${EYE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
 if(k==='heart')return heart(L,Y,24,'#E53950',s5)+heart(R,Y,24,'#E53950',s5);
 return `<ellipse cx="${L}" cy="${Y}" rx="19" ry="25" fill="${EYE}"/><ellipse cx="${R}" cy="${Y}" rx="19" ry="25" fill="${EYE}"/><circle cx="446" cy="362" r="6" fill="#FFF"/><circle cx="590" cy="362" r="6" fill="#FFF"/>`;
}
export function noseSvg(k){if(k==='tri')return `<path d="M510 404 Q502 422 516 424" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;if(k==='round')return '<ellipse cx="512" cy="418" rx="12" ry="9" fill="#000" opacity=".12"/>';return '<ellipse cx="512" cy="418" rx="6" ry="4" fill="#000" opacity=".22"/>';}
export function mouthSvg(k){
 if(k==='grin')return `<path d="M478 450 Q512 452 546 450 Q540 494 512 496 Q484 494 478 450Z" fill="#7A2E3A"${s5}/><path d="M484 453 Q512 456 540 453 L538 463 Q512 467 486 463Z" fill="#FFF"/>`;
 if(k==='cat')return `<path d="M484 456 Q498 474 512 460 Q526 474 540 456" fill="none" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`;
 if(k==='o')return `<ellipse cx="512" cy="464" rx="12" ry="14" fill="#7A2E3A"${s5}/>`;
 if(k==='tongue')return `<ellipse cx="521" cy="478" rx="14" ry="12" fill="#F48FB1"${s5}/><path d="M482 456 Q512 482 542 456" fill="none" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`;
 return `<path d="M482 456 Q512 482 542 456" fill="none" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`;
}
function bodySvg(c){
 const sk=c.skin;
 return `<ellipse cx="512" cy="946" rx="170" ry="18" fill="#000" opacity=".12"/>`+
 `<rect x="450" y="770" width="52" height="150" rx="24" fill="${sk}"${s6}/><rect x="522" y="770" width="52" height="150" rx="24" fill="${sk}"${s6}/>`+
 `<ellipse cx="476" cy="922" rx="42" ry="20" fill="#FFFFFF"${s6}/><ellipse cx="548" cy="922" rx="42" ry="20" fill="#FFFFFF"${s6}/>`+
 `<path d="M432 760 L592 760 L600 830 L524 830 L512 800 L500 830 L424 830 Z" fill="#8C93A8"${s6}/>`+
 `<g fill="${sk}"${s6}>${ARM_L}${ARM_R}</g><circle cx="${HAND_L[0]}" cy="${HAND_L[1]}" r="24" fill="${sk}"${s6}/><circle cx="${HAND_R[0]}" cy="${HAND_R[1]}" r="24" fill="${sk}"${s6}/>`+
 `<path d="${TORSO[c.g]}" fill="#F4F4F7"${s6}/>`+sleeves(c,'#F4F4F7',55)+
 `<rect x="494" y="528" width="36" height="52" fill="${sk}"${s5}/>`+
 `<ellipse cx="328" cy="380" rx="26" ry="38" fill="${sk}"${s6}/><ellipse cx="696" cy="380" rx="26" ry="38" fill="${sk}"${s6}/>`+
 `<ellipse cx="512" cy="345" rx="185" ry="195" fill="${sk}"${s6}/>`;
}
// 표정 조각(눈·입을 바꾸지 않고 겹치는 것)
export const EXPRESSION_ART=Object.freeze({
 'exp-blush':()=>'<ellipse cx="420" cy="434" rx="38" ry="20" fill="#FF6F8E" opacity=".75"/><ellipse cx="604" cy="434" rx="38" ry="20" fill="#FF6F8E" opacity=".75"/><path d="M398 432 l8 -10 M416 434 l8 -10 M434 436 l8 -10 M582 432 l8 -10 M600 434 l8 -10 M618 436 l8 -10" stroke="#E0476A" stroke-width="3"/>',
 'exp-sparkle':()=>star(404,334,14,'#FFE066',false)+star(620,334,14,'#FFE066',false)+star(470,396,8,'#FFFFFF',false)+star(614,398,8,'#FFFFFF',false),
 'exp-floating-hearts':()=>heart(372,150,26,'#FF8FB1',s5)+heart(512,92,32,'#FF6F9C',s5)+heart(660,140,24,'#FF8FB1',s5),
 'exp-tears':()=>'<path d="M424 404 Q414 426 424 434 Q436 426 424 404Z M600 404 Q590 426 600 434 Q612 426 600 404Z" fill="#9FD8FF" stroke="#4FA3D8" stroke-width="3"/><circle cx="420" cy="424" r="3" fill="#FFF"/><circle cx="596" cy="424" r="3" fill="#FFF"/>'
});

// ── 시즌 1 할로윈 옷·소품·배경 자리 그림(SVG). back:true = 몸 뒤에 그린다 ──
const ITEMS={
 // 머리
 'witch-hat':()=>`<path d="M400 180 L540 12 Q568 -12 590 16 Q570 32 576 62 L632 180 Z" fill="#4A2F6B"${s6}/><ellipse cx="512" cy="184" rx="250" ry="44" fill="#4A2F6B"${s6}/><path d="M404 158 L628 158 L632 178 L400 178 Z" fill="#F2A93B"${s5}/>`,
 'pumpkin-hat':()=>`<ellipse cx="512" cy="168" rx="182" ry="96" fill="#F28C28"${s6}/><path d="M446 80 Q424 168 446 258 M578 80 Q600 168 578 258 M512 72 L512 264" fill="none" stroke="#D2691E" stroke-width="6"/><rect x="500" y="44" width="24" height="40" rx="8" fill="#5E8C3A"${s5}/><path d="M524 64 Q560 42 580 68 Q552 80 524 72Z" fill="#7CB342"${s5}/>`,
 'cat-ears':()=>`<path d="M334 250 Q512 110 690 250" fill="none" stroke="#2B2433" stroke-width="18" stroke-linecap="round"/><polygon points="360,196 370,82 452,150" fill="#2B2433"${s5}/><polygon points="664,196 654,82 572,150" fill="#2B2433"${s5}/><polygon points="376,172 382,112 428,150" fill="#F6A9C0"/><polygon points="648,172 642,112 596,150" fill="#F6A9C0"/>`,
 'devil-horns':()=>`<path d="M334 250 Q512 110 690 250" fill="none" stroke="#B71C1C" stroke-width="16" stroke-linecap="round"/><path d="M398 176 Q368 100 402 62 Q408 118 438 150Z" fill="#E53935"${s5}/><path d="M626 176 Q656 100 622 62 Q616 118 586 150Z" fill="#E53935"${s5}/>`,
 'ghost-pin':()=>`<polygon points="640,210 600,184 600,236" fill="#F6A9C0"${s5}/><polygon points="640,210 680,184 680,236" fill="#F6A9C0"${s5}/>${ghost(640,176,0.55)}`,
 'bat-clips':()=>bat(372,236,1.3,'#5B3A87')+bat(652,236,1.3,'#5B3A87'),
 'mummy-wrap':()=>`<g fill="#F5F1E6"${s5}><path d="M318 250 Q512 150 706 250 L700 286 Q512 190 324 286Z"/><path d="M330 196 Q512 110 694 196 L686 226 Q512 146 338 226Z"/><path d="M684 270 Q720 330 700 400 L680 396 Q694 334 664 282Z"/></g><path d="M380 214 L400 260 M560 170 L540 214 M620 238 L640 276" stroke="#C9BFA8" stroke-width="4"/>`,
 'arrow-head':()=>`<path d="M270 252 L346 260" stroke="#7A4E2D" stroke-width="12" stroke-linecap="round"/><path d="M262 230 L300 256 L262 280 L282 256Z" fill="#E53950"${s5}/><path d="M680 262 L748 268" stroke="#7A4E2D" stroke-width="12" stroke-linecap="round"/><polygon points="740,246 790,270 740,292" fill="#B0B6C3"${s5}/>`,
 'brain-hat':()=>`<path d="M332 214 Q320 90 430 84 Q470 40 540 62 Q620 40 660 100 Q722 130 696 214 Q512 250 332 214Z" fill="#F7A8C4"${s6}/><path d="M380 150 Q420 120 450 150 Q480 180 520 140 Q560 110 600 150 M400 190 Q440 170 470 196 M560 196 Q600 170 640 190 M512 70 Q500 120 520 180" fill="none" stroke="#D2648C" stroke-width="6" stroke-linecap="round"/>`,
 'candle-crown':()=>`<path d="M364 210 L380 120 L446 170 L512 100 L578 170 L644 120 L660 210Z" fill="#E8B930"${s6}/>${[384,448,512,576,640].map((x,i)=>`<rect x="${x-12}" y="${i===2?44:i%2?84:70}" width="24" height="${i===2?60:i%2?50:52}" rx="4" fill="#7E57C2"${s5}/><path d="M${x} ${i===2?18:i%2?58:44} Q${x+12} ${i===2?34:i%2?74:60} ${x} ${i===2?46:i%2?86:72} Q${x-12} ${i===2?34:i%2?74:60} ${x} ${i===2?18:i%2?58:44}Z" fill="#FFB74D"/>`).join('')}`,
 // 얼굴
 blush:()=>'<ellipse cx="420" cy="432" rx="32" ry="18" fill="#FF8FA3" opacity=".55"/><ellipse cx="604" cy="432" rx="32" ry="18" fill="#FF8FA3" opacity=".55"/>',
 'heart-sticker':()=>heart(420,438,16,'#E53950',' stroke="#FFFFFF" stroke-width="4"'),
 'bat-paint':()=>bat(604,440,1,'#3B2350'),
 'round-glasses':()=>'<circle cx="440" cy="372" r="44" fill="#FFF" fill-opacity=".15" stroke="#5B4636" stroke-width="9"/><circle cx="584" cy="372" r="44" fill="#FFF" fill-opacity=".15" stroke="#5B4636" stroke-width="9"/><path d="M484 366 Q512 352 540 366" fill="none" stroke="#5B4636" stroke-width="9"/>',
 'vampire-fangs':()=>`<path d="M494 462 L500 490 L508 464Z M516 464 L524 490 L530 462Z" fill="#FFFFFF"${s5}/><path d="M525 494 Q520 504 525 510 Q530 504 525 494Z" fill="#D32F2F"/>`,
 monocle:()=>'<circle cx="584" cy="372" r="42" fill="#FFF" fill-opacity=".2" stroke="#D4A017" stroke-width="8"/><path d="M620 396 Q650 470 640 540" fill="none" stroke="#D4A017" stroke-width="4" stroke-dasharray="6 5"/>',
 'skull-paint':()=>'<path d="M512 160 Q360 168 330 330 Q324 450 400 510 L512 528Z" fill="#FFFFFF" opacity=".85"/><circle cx="440" cy="374" r="34" fill="#2E2433" opacity=".8"/><path d="M500 410 L488 432 L512 432Z" fill="#2E2433"/><path d="M430 480 L512 480 M446 470 L446 492 M466 470 L466 492 M486 470 L486 492" stroke="#2E2433" stroke-width="4"/>',
 mustache:()=>'<path d="M512 440 Q476 420 446 438 Q420 456 432 476 Q444 460 470 462 Q498 462 512 448 Q526 462 554 462 Q580 460 592 476 Q604 456 578 438 Q548 420 512 440Z" fill="#2B2420"/><circle cx="428" cy="476" r="9" fill="#2B2420"/><circle cx="596" cy="476" r="9" fill="#2B2420"/>',
 booger:()=>'<path d="M498 424 Q490 446 500 452 Q512 446 506 424Z" fill="#8BC34A" stroke="#5E8C3A" stroke-width="3"/>',
 'big-mole':()=>'<circle cx="552" cy="480" r="11" fill="#2B2420"/><path d="M552 470 Q560 452 572 448" fill="none" stroke="#2B2420" stroke-width="3"/>',
 // 상의
 'stripe-knit':c=>{let st='';for(let y=600;y<790;y+=34)st+=`<rect x="300" y="${y}" width="424" height="14" fill="#2B2433"/>`;return sleeves(c,'#F28C28')+torso(c,'#F28C28',st);},
 'skull-tee':c=>sleeves(c,'#2B2433',55)+torso(c,'#2B2433','<circle cx="512" cy="660" r="34" fill="#FFF"/><rect x="496" y="684" width="32" height="20" rx="4" fill="#FFF"/><circle cx="500" cy="656" r="8" fill="#2B2433"/><circle cx="524" cy="656" r="8" fill="#2B2433"/>'),
 'pumpkin-hoodie':c=>sleeves(c,'#F28C28')+torso(c,'#F28C28','<polygon points="486,640 500,620 508,644" fill="#3B2412"/><polygon points="538,640 524,620 516,644" fill="#3B2412"/><path d="M482 668 Q512 690 542 668 L534 676 L524 668 L512 680 L500 668 L490 676Z" fill="#3B2412"/><rect x="460" y="716" width="104" height="44" rx="12" fill="#E07B1A"/>')+`<path d="M446 570 Q512 538 578 570 L566 588 Q512 566 458 588Z" fill="#E07B1A"${s5}/>`,
 'ghost-pajama':c=>sleeves(c,'#FAFAFF')+torso(c,'#FAFAFF',[[470,630],[548,660],[480,720],[556,740]].map(([x,y])=>ghost(x,y,0.28,false)).join('')),
 'bat-blouse':c=>sleeves(c,'#2B2433')+torso(c,'#2B2433')+`<path d="M452 572 Q390 560 380 612 Q420 600 440 624 Q470 600 512 600 Q554 600 584 624 Q604 600 644 612 Q634 560 572 572 Q512 590 452 572Z" fill="#3B2350"${s5}/><path d="M492 604 L512 620 L532 604 L512 640Z" fill="#9B59D0"${s5}/>`,
 'web-knit':c=>sleeves(c,'#8C8F9A')+torso(c,'#8C8F9A','<g stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".9"><path d="M512 600 L512 780 M512 680 L430 600 M512 680 L594 600 M512 680 L430 780 M512 680 L594 780"/><circle cx="512" cy="680" r="30"/><circle cx="512" cy="680" r="62"/></g>'),
 'candy-vest':c=>sleeves(c,'#FFFFFF',70)+torso(c,'#FFFFFF',`<path d="M430 568 L496 568 L470 780 L420 780Z M528 568 L594 568 L604 780 L554 780Z" fill="#F48FB1"/>${[[452,610,'#7BC4E8'],[466,680,'#FFE066'],[446,740,'#8BC34A'],[572,620,'#FFE066'],[560,690,'#7BC4E8'],[580,750,'#9B7BD8']].map(([x,y,f])=>`<circle cx="${x}" cy="${y}" r="10" fill="${f}"/>`).join('')}`),
 'mummy-shirt':c=>sleeves(c,'#F5F1E6')+torso(c,'#F5F1E6','<path d="M400 600 L620 640 M400 650 L620 690 M400 700 L620 740 M400 750 L620 790" stroke="#C9BFA8" stroke-width="6"/>')+`<path d="M590 720 Q640 760 620 820 L604 816 Q618 768 576 734Z" fill="#F5F1E6"${s5}/>`,
 'belly-tee':c=>sleeves(c,'#F6C9A8',55)+torso(c,'#F6C9A8','<ellipse cx="512" cy="712" rx="66" ry="52" fill="#EDB48F"/><path d="M500 718 Q512 730 524 718" fill="none" stroke="#A86A44" stroke-width="5" stroke-linecap="round"/><path d="M460 672 Q512 650 564 672" fill="none" stroke="#D99A74" stroke-width="4"/>'),
 'stage-jacket':c=>sleeves(c,'#6A3FB5')+torso(c,'#6A3FB5',`<path d="M512 570 L470 660 L512 780 L554 660Z" fill="#F4F4F7"/>${star(450,640,14,'#FFE066',false)}${star(580,700,12,'#FFE066',false)}${star(470,740,10,'#FFFFFF',false)}`)+`<path d="M458 570 L420 640 L470 660Z M566 570 L604 640 L554 660Z" fill="#8E63D9"${s5}/>`,
 // 하의·원피스
 overalls:()=>`<rect x="458" y="650" width="108" height="110" rx="12" fill="#5B8BD9"${s5}/><path d="M428 740 L596 740 L604 842 L524 842 L512 806 L500 842 L420 842 Z" fill="#5B8BD9"${s6}/>`,
 'ripped-jeans':c=>`<path d="M428 740 L596 740 L598 926 L526 926 L512 800 L498 926 L426 926 Z" fill="#2B2D3A"${s6}/><ellipse cx="466" cy="852" rx="20" ry="12" fill="${c.skin}"/><ellipse cx="560" cy="866" rx="18" ry="11" fill="${c.skin}"/><path d="M450 852 L482 852 M546 866 L574 866" stroke="#8C93A8" stroke-width="3"/>`,
 'check-skirt':()=>{let l='';for(let x=420;x<620;x+=34)l+=`<line x1="${x}" y1="742" x2="${x+(x-512)*0.25}" y2="850" stroke="#2B2433" stroke-width="5"/>`;return `<path d="M430 740 L594 740 L640 852 L384 852 Z" fill="#F28C28"${s6}/>`+l+'<line x1="408" y1="796" x2="616" y2="796" stroke="#2B2433" stroke-width="5"/>';},
 'pumpkin-pants':()=>`<path d="M424 744 Q404 800 430 848 Q470 864 506 846 Q512 830 518 846 Q554 864 594 848 Q620 800 600 744Z" fill="#F28C28"${s6}/><path d="M466 750 Q456 800 470 850 M558 750 Q568 800 554 850" fill="none" stroke="#D2691E" stroke-width="5"/>`,
 'ghost-sheet':c=>`<path d="M428 580 Q512 540 596 580 L640 930 L604 910 L578 934 L548 910 L512 934 L476 910 L446 934 L420 910 L384 930Z" fill="#FFFFFF" fill-opacity=".95"${s6}/><ellipse cx="482" cy="660" rx="12" ry="16" fill="#2E2433"/><ellipse cx="542" cy="660" rx="12" ry="16" fill="#2E2433"/>`,
 'skeleton-tights':()=>`<path d="M428 740 L596 740 L598 926 L526 926 L512 800 L498 926 L426 926 Z" fill="#1F1A26"${s6}/><path d="M462 790 L462 900 M562 790 L562 900 M450 790 L474 790 M450 900 L474 900 M550 790 L574 790 M550 900 L574 900" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/><circle cx="462" cy="846" r="9" fill="#FFF"/><circle cx="562" cy="846" r="9" fill="#FFF"/>`,
 'werewolf-pants':()=>`<path d="M428 740 L596 740 L600 900 L584 886 L570 906 L554 888 L540 904 L526 886 L512 800 L498 886 L484 904 L470 888 L454 906 L440 886 L424 900 Z" fill="#7A5232"${s6}/><path d="M440 770 l-12 -10 M466 790 l-14 -6 M586 780 l14 -8 M560 812 l14 -6 M470 850 l-16 -2 M560 856 l16 -2" stroke="#A9764B" stroke-width="6" stroke-linecap="round"/>`,
 'dracula-suit':c=>torso(c,'#2B2433','<path d="M512 570 L490 780 L534 780Z" fill="#FFFFFF"/><path d="M498 590 L512 606 L526 590 L512 600Z" fill="#C62828"/>')+`<path d="M428 740 L596 740 L598 926 L526 926 L512 800 L498 926 L426 926 Z" fill="#2B2433"${s6}/><path d="M432 760 L430 920 M592 760 L594 920" stroke="#C62828" stroke-width="6"/>`,
 'witch-dress':c=>{let h='M424 722 L600 722 L666 878',up=true;for(const x of [636,606,576,546,516,486,456,426,396,366]){h+=` L${x} ${up?856:880}`;up=!up;}h+=' L358 878 Z';return torso(c,'#3E2A5C')+`<path d="${h}" fill="#3E2A5C"${s6}/>`;},
 'gothic-dress':c=>torso(c,'#1F1A26','<path d="M430 620 L594 620" stroke="#9B59D0" stroke-width="8"/>')+`<path d="M420 720 L604 720 L656 860 Q512 900 368 860Z" fill="#1F1A26"${s6}/><path d="M396 800 Q512 836 628 800 M380 846 Q512 884 644 846" fill="none" stroke="#5B4A70" stroke-width="6"/><path d="M490 704 L512 724 L534 704 L512 744Z" fill="#9B59D0"${s5}/>`,
 // 겉옷·등(back: 몸 뒤)
 'pumpkin-backpack':()=>`<ellipse cx="652" cy="700" rx="70" ry="58" fill="#F28C28"${s6}/><rect x="644" y="630" width="14" height="18" rx="4" fill="#5E8C3A"/><path d="M462 572 L470 760 M562 572 L554 760" stroke="#A0522D" stroke-width="14" stroke-linecap="round"/>`,
 'ghost-wings':()=>'<g fill="#FFFFFF" fill-opacity=".7" stroke="#B8C4D8" stroke-width="5"><path d="M432 620 Q330 560 300 640 Q340 650 350 690 Q392 660 432 676Z"/><path d="M592 620 Q694 560 724 640 Q684 650 674 690 Q632 660 592 676Z"/></g>',
 'fur-vest':c=>`<path d="M432 576 L486 576 L478 780 L428 780 Q420 690 432 576Z M538 576 L592 576 Q604 690 596 780 L546 780Z" fill="#8A5A36"${s6}/><g fill="#B07A50">${[600,640,680,720,760].map(y=>`<circle cx="484" cy="${y}" r="9"/><circle cx="540" cy="${y}" r="9"/>`).join('')}</g>`,
 'bone-scarf':()=>`<g fill="#FFFFFF"${s5}><rect x="440" y="548" width="144" height="34" rx="16"/><circle cx="440" cy="556" r="16"/><circle cx="440" cy="576" r="16"/><circle cx="584" cy="556" r="16"/><circle cx="584" cy="576" r="16"/></g>`,
 'spider-legs':()=>`<g stroke="#1F1A26" stroke-width="12" stroke-linecap="round" fill="none">${[600,640,680,720].map((y,i)=>`<path d="M440 ${y} Q${360-i*6} ${y-60} ${300-i*10} ${y+20}"/><path d="M584 ${y} Q${664+i*6} ${y-60} ${724+i*10} ${y+20}"/>`).join('')}</g>`,
 'zombie-hands':()=>`<g fill="#7DBE5A"${s5}><path d="M410 560 Q402 530 420 520 L428 548 L436 516 L448 518 L446 552 L458 524 L470 530 L460 566 Q440 590 410 560Z"/><path d="M614 560 Q622 530 604 520 L596 548 L588 516 L576 518 L578 552 L566 524 L554 530 L564 566 Q584 590 614 560Z"/></g>`,
 'bat-wings':()=>`<path d="M432 610 Q300 520 222 604 Q264 612 274 652 Q306 632 326 672 Q348 642 378 684 Q398 642 432 646Z" fill="#4A2F6B"${s6}/><path d="M592 610 Q724 520 802 604 Q760 612 750 652 Q718 632 698 672 Q676 642 646 684 Q626 642 592 646Z" fill="#4A2F6B"${s6}/>`,
 'witch-robe':()=>`<path d="M446 572 Q372 700 360 900 L436 890 L456 600Z" fill="#3E2A5C"${s6}/><path d="M578 572 Q652 700 664 900 L588 890 L568 600Z" fill="#3E2A5C"${s6}/>${star(466,640,12,'#E8B930')}${star(558,640,12,'#E8B930')}`,
 'dracula-cape':()=>`<path d="M446 578 Q368 700 348 902 L430 884 L452 600Z" fill="#1F1A26"${s6}/><path d="M578 578 Q656 700 676 902 L594 884 L572 600Z" fill="#1F1A26"${s6}/><path d="M440 566 L396 470 L478 540Z" fill="#C62828"${s5}/><path d="M584 566 L628 470 L546 540Z" fill="#C62828"${s5}/>`,
 'starry-cape':()=>`<path d="M446 578 Q368 700 344 906 Q380 890 430 900 L452 600Z" fill="#283A78"${s6}/><path d="M578 578 Q656 700 680 906 Q644 890 594 900 L572 600Z" fill="#283A78"${s6}/>${star(400,760,12,'#FFE066',false)}${star(626,720,10,'#FFE066',false)}${star(410,860,8,'#FFFFFF',false)}${star(640,840,9,'#FFFFFF',false)}`,
 // 신발
 sneakers:()=>`<ellipse cx="476" cy="922" rx="46" ry="22" fill="#F28C28"${s6}/><ellipse cx="548" cy="922" rx="46" ry="22" fill="#F28C28"${s6}/><path d="M432 930 L520 930 M504 930 L592 930" stroke="#FFF" stroke-width="7"/>`,
 'skull-sneakers':()=>`<ellipse cx="476" cy="922" rx="46" ry="22" fill="#2B2433"${s6}/><ellipse cx="548" cy="922" rx="46" ry="22" fill="#2B2433"${s6}/><circle cx="470" cy="918" r="9" fill="#FFF"/><circle cx="554" cy="918" r="9" fill="#FFF"/><path d="M432 932 L520 932 M504 932 L592 932" stroke="#FFF" stroke-width="6"/>`,
 'pumpkin-slippers':()=>`<ellipse cx="476" cy="920" rx="50" ry="28" fill="#F28C28"${s6}/><ellipse cx="548" cy="920" rx="50" ry="28" fill="#F28C28"${s6}/><rect x="470" y="886" width="12" height="16" rx="4" fill="#5E8C3A"/><rect x="542" y="886" width="12" height="16" rx="4" fill="#5E8C3A"/>`,
 'witch-boots':()=>`<path d="M446 838 L506 838 L508 928 Q460 944 420 930 Q404 920 418 908 Q442 912 448 900Z" fill="#3E2A5C"${s6}/><path d="M578 838 L518 838 L516 928 Q564 944 604 930 Q620 920 606 908 Q582 912 576 900Z" fill="#3E2A5C"${s6}/>`,
 'bat-shoes':()=>`<ellipse cx="476" cy="924" rx="44" ry="20" fill="#1F1A26"${s6}/><ellipse cx="548" cy="924" rx="44" ry="20" fill="#1F1A26"${s6}/>${bat(450,898,0.8,'#5B3A87')}${bat(574,898,0.8,'#5B3A87')}`,
 'odd-socks':c=>`<rect x="450" y="840" width="52" height="96" rx="20" fill="#FFFFFF"${s5}/><path d="M452 856 L500 856 M452 876 L500 876 M452 896 L500 896 M452 916 L500 916" stroke="#E53950" stroke-width="8"/><rect x="522" y="840" width="52" height="96" rx="20" fill="#7BC4E8"${s5}/>${[[536,860],[558,880],[540,904],[562,920]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6" fill="#FFF"/>`).join('')}`,
 'duck-flippers':()=>`<path d="M470 900 L400 960 Q440 980 476 958 Q500 976 520 948Z" fill="#FFD54F"${s6}/><path d="M554 900 L624 960 Q584 980 548 958 Q524 976 504 948Z" fill="#FFD54F"${s6}/>`,
 'bear-slippers':()=>`<ellipse cx="460" cy="920" rx="80" ry="50" fill="#8A5A36"${s6}/><ellipse cx="564" cy="920" rx="80" ry="50" fill="#8A5A36"${s6}/>${[[420,890],[452,878],[486,884],[530,884],[564,878],[598,890]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="12" fill="#5D3A1F"/>`).join('')}`,
 'zombie-feet':()=>`<ellipse cx="476" cy="922" rx="44" ry="22" fill="#7DBE5A"${s6}/><ellipse cx="548" cy="922" rx="44" ry="22" fill="#7DBE5A"${s6}/><path d="M440 912 l6 0 M452 908 l6 0 M566 908 l6 0 M578 912 l6 0" stroke="#4E3A2A" stroke-width="7" stroke-linecap="round"/>`,
 'ghost-shoes':()=>'<ellipse cx="476" cy="922" rx="54" ry="30" fill="#E6F0FF" opacity=".5"/><ellipse cx="548" cy="922" rx="54" ry="30" fill="#E6F0FF" opacity=".5"/><ellipse cx="476" cy="922" rx="44" ry="20" fill="#FFFFFF" fill-opacity=".85" stroke="#B8C4D8" stroke-width="5"/><ellipse cx="548" cy="922" rx="44" ry="20" fill="#FFFFFF" fill-opacity=".85" stroke="#B8C4D8" stroke-width="5"/>',
 // 손 소품
 lollipop:()=>`<line x1="${HAND_R[0]}" y1="${HAND_R[1]}" x2="676" y2="640" stroke="#FFF" stroke-width="10"/><circle cx="680" cy="616" r="38" fill="#F48FB1"${s6}/><path d="M680 616 m-24 0 a24 24 0 1 1 24 24 a14 14 0 1 1 -10 -18" fill="none" stroke="#FFF" stroke-width="7"/>`,
 'ghost-doll':()=>`<path d="M320 820 Q318 730 370 728 Q422 730 420 820 L408 806 L396 822 L384 806 L370 822 L356 806 L344 822 L332 806Z" fill="#FFFFFF"${s6}/><circle cx="356" cy="770" r="7" fill="#2E2433"/><circle cx="384" cy="770" r="7" fill="#2E2433"/><ellipse cx="370" cy="790" rx="8" ry="6" fill="#2E2433"/>`,
 'bat-balloon':()=>`<path d="M${HAND_R[0]} ${HAND_R[1]} Q700 640 720 470" fill="none" stroke="#6B6385" stroke-width="3"/><ellipse cx="724" cy="430" rx="44" ry="40" fill="#7E57C2"${s5}/>${bat(724,420,1.5,'#4A2F6B')}`,
 'pumpkin-basket':()=>`<path d="M318 790 Q370 712 422 790" fill="none" stroke="${OUT}" stroke-width="7"/><ellipse cx="370" cy="828" rx="62" ry="48" fill="#F28C28"${s6}/><polygon points="344,816 358,798 366,820" fill="#3B2412"/><polygon points="396,816 382,798 374,820" fill="#3B2412"/><path d="M344 842 Q370 860 396 842 L388 850 L378 842 L370 852 L362 842 L352 850Z" fill="#3B2412"/>`,
 broom:()=>`<line x1="560" y1="900" x2="760" y2="560" stroke="#8A5A36" stroke-width="14" stroke-linecap="round"/><path d="M570 880 L520 960 L560 972 L600 900Z" fill="#E8C268"${s5}/><path d="M540 930 L560 940 M556 912 L574 924" stroke="#B8902F" stroke-width="4"/>`,
 'magic-wand':()=>`<line x1="${HAND_R[0]}" y1="${HAND_R[1]}" x2="736" y2="604" stroke="#7A4E2D" stroke-width="12" stroke-linecap="round"/>`+star(744,584,40,'#FFD54F'),
 'skull-mic':()=>`<rect x="634" y="660" width="22" height="110" rx="8" fill="#B0B6C3"${s5}/><circle cx="645" cy="632" r="34" fill="#FFFFFF"${s5}/><circle cx="634" cy="628" r="8" fill="#2E2433"/><circle cx="656" cy="628" r="8" fill="#2E2433"/><path d="M638 650 L652 650" stroke="#2E2433" stroke-width="4"/>`,
 bone:()=>`<g fill="#FFFFFF"${s5}><rect x="300" y="790" width="150" height="26" rx="12"/><circle cx="300" cy="790" r="16"/><circle cx="300" cy="816" r="16"/><circle cx="450" cy="790" r="16"/><circle cx="450" cy="816" r="16"/></g>`,
 'rubber-chicken':()=>`<path d="M650 760 Q700 700 690 640 Q720 610 740 640 Q760 620 760 650 Q730 660 722 690 Q760 760 700 820 Q660 840 650 760Z" fill="#FFE066"${s6}/><path d="M738 652 L770 660 L742 672Z" fill="#F28C28"${s5}/><circle cx="722" cy="640" r="5" fill="${EYE}"/><path d="M712 616 Q716 600 726 612 Q732 598 738 616" fill="#E53950"/>`,
 'rotten-fish':()=>`<path d="M300 800 Q360 760 420 800 Q360 840 300 800Z M300 800 L270 776 L276 824Z" fill="#9CBF6A"${s6}/><circle cx="400" cy="796" r="6" fill="${EYE}"/><path d="M330 790 l10 20 M352 786 l10 22" stroke="#6E8F45" stroke-width="4"/><g fill="#2E2433"><circle cx="350" cy="730" r="5"/><circle cx="390" cy="716" r="5"/></g><path d="M344 724 l-8 -6 M356 724 l8 -6 M384 710 l-8 -6 M396 710 l8 -6" stroke="#9AA" stroke-width="3"/>`,
 // 배경
 'halloween-night':()=>{let b='';for(const [x,y]of [[200,160],[320,240],[690,120]])b+=bat(x,y,1.1,'#120F24');return '<rect width="1024" height="1024" fill="#221E45"/><circle cx="810" cy="190" r="100" fill="#FFF3B0"/>'+b+'<ellipse cx="200" cy="1010" rx="420" ry="130" fill="#15122C"/><ellipse cx="860" cy="1020" rx="380" ry="120" fill="#15122C"/><circle cx="130" cy="900" r="34" fill="#F28C28"/><circle cx="900" cy="915" r="28" fill="#F28C28"/>';},
 'pumpkin-field':()=>{let p='';for(const q of [[120,900,70],[260,950,50],[800,910,80],[930,960,48],[60,980,40]])p+=`<ellipse cx="${q[0]}" cy="${q[1]}" rx="${q[2]}" ry="${q[2]*0.7}" fill="#F28C28"/>`;return '<rect width="1024" height="1024" fill="#FBC28A"/><circle cx="820" cy="260" r="110" fill="#FFE0A3"/><rect y="860" width="1024" height="164" fill="#7A5A3A"/>'+p;},
 'haunted-house':()=>'<rect width="1024" height="1024" fill="#5A4A7A"/><rect y="900" width="1024" height="124" fill="#2E2640"/><path d="M640 900 L640 420 L760 300 L880 420 L880 900Z" fill="#2E2640"/><rect x="690" y="480" width="44" height="60" fill="#FFD54F"/><rect x="786" y="480" width="44" height="60" fill="#FFD54F"/><path d="M80 900 L80 560 L200 470 L320 560 L320 900Z" fill="#2E2640"/><rect x="170" y="620" width="60" height="70" fill="#FFD54F"/>',
 'candy-shop':()=>`<rect width="1024" height="1024" fill="#FBE3EC"/><rect y="880" width="1024" height="144" fill="#C98B6B"/>${[260,460,660].map(y=>`<rect x="40" y="${y}" width="240" height="14" fill="#A0664A"/><rect x="744" y="${y}" width="240" height="14" fill="#A0664A"/>`).join('')}${[[80,210,'#7BC4E8'],[160,210,'#FFE066'],[220,410,'#F48FB1'],[100,610,'#8BC34A'],[790,210,'#9B7BD8'],[880,410,'#F28C28'],[820,610,'#7BC4E8'],[930,610,'#F48FB1']].map(([x,y,f])=>`<rect x="${x-26}" y="${y}" width="52" height="${(Math.round(y/10)%3)*6+44}" rx="10" fill="${f}" opacity=".85" stroke="#FFFFFF" stroke-width="4"/>`).join('')}`,
 'graveyard-party':()=>`<rect width="1024" height="1024" fill="#2B2350"/><circle cx="160" cy="160" r="70" fill="#FFF3B0"/><rect y="860" width="1024" height="164" fill="#2E4A2E"/>${[[110,820],[300,840],[740,830],[920,816]].map(([x,y])=>`<path d="M${x-40} ${y+60} L${x-40} ${y} Q${x} ${y-50} ${x+40} ${y} L${x+40} ${y+60}Z" fill="#8C93A8" stroke="#5B6070" stroke-width="5"/>`).join('')}${ghost(860,300,0.9)}<rect x="820" y="370" width="90" height="30" rx="8" fill="#1F1A26"/>${[[200,560],[700,600]].map(([x,y])=>`<g stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="26" fill="#FFFFFF"/><path d="M${x} ${y+26} L${x} ${y+110} M${x} ${y+50} L${x-40} ${y+20} M${x} ${y+50} L${x+44} ${y+80} M${x} ${y+110} L${x-30} ${y+170} M${x} ${y+110} L${x+36} ${y+160}"/></g>`).join('')}`,
 // DJ 옷(2026-10-08 그림 v2 의 dj_* 8장 — 사용자: 상점 옷으로). 그림 파일이 없을 때의 자리 그림
 'dj-headphones':()=>`<path d="M362 330 Q362 150 512 150 Q662 150 662 330" fill="none" stroke="#3A3440" stroke-width="18"/><rect x="336" y="300" width="52" height="96" rx="22" fill="#EDE6DA"${s6}/><rect x="636" y="300" width="52" height="96" rx="22" fill="#EDE6DA"${s6}/>`,
 'dj-star-clip':()=>star(610,210,30,'#F6D365'),
 'dj-neck-headphones':()=>`<path d="M410 560 Q512 640 614 560" fill="none" stroke="#3A3440" stroke-width="14"/><rect x="380" y="520" width="56" height="70" rx="22" fill="#EDE6DA"${s6}/><rect x="588" y="520" width="56" height="70" rx="22" fill="#EDE6DA"${s6}/>`,
 'dj-ivory-cardigan':c=>sleeves(c,'#F4EEDF')+torso(c,'#F4EEDF',`<line x1="512" y1="580" x2="512" y2="790" stroke="${OUT}" stroke-width="4"/>${[620,670,720].map(y=>`<circle cx="530" cy="${y}" r="7" fill="#C9B79A"/>`).join('')}`),
 'dj-charcoal-hoodie':c=>sleeves(c,'#4A4750')+torso(c,'#4A4750','<path d="M440 700 L584 700 L584 760 L440 760Z" fill="#3D3A42"/>'),
 'dj-cargo':()=>`<path d="M428 740 L596 740 L598 926 L526 926 L512 800 L498 926 L426 926 Z" fill="#8E8B86"${s6}/><rect x="430" y="820" width="34" height="40" rx="6" fill="#7D7A75"/><rect x="560" y="820" width="34" height="40" rx="6" fill="#7D7A75"/>`,
 'dj-lilac-skirt':()=>`<path d="M430 740 L594 740 L640 852 L384 852 Z" fill="#C9B6E4"${s6}/>`,
 'dj-ivory-sneakers':()=>`<ellipse cx="476" cy="922" rx="46" ry="22" fill="#F4EEDF"${s6}/><ellipse cx="548" cy="922" rx="46" ry="22" fill="#F4EEDF"${s6}/>`,
 // 시즌 보상
 'pumpkin-crown':()=>`<path d="M356 216 L372 120 L440 172 L512 96 L584 172 L652 120 L668 216Z" fill="#F2C230"${s6}/><ellipse cx="512" cy="130" rx="40" ry="30" fill="#F28C28"${s5}/><rect x="506" y="92" width="12" height="16" rx="4" fill="#5E8C3A"/>${star(372,110,16,'#FFF8C2',false)}${star(652,110,16,'#FFF8C2',false)}${star(470,70,10,'#FFF8C2',false)}${star(560,62,12,'#FFF8C2',false)}`,
 'shadow-wings':()=>`<g fill="#1A1424"${s6}><path d="M440 600 Q300 380 120 420 Q200 470 190 540 Q260 520 280 590 Q330 560 360 640 Q400 600 440 660Z"/><path d="M584 600 Q724 380 904 420 Q824 470 834 540 Q764 520 744 590 Q694 560 664 640 Q624 600 584 660Z"/></g><path d="M140 420 Q200 400 260 430 M884 420 Q824 400 764 430" stroke="#A58CFF" stroke-width="8" stroke-linecap="round" opacity=".8"/>`,
 'moonlight-aura':()=>`<circle cx="512" cy="420" r="380" fill="#FFF6C8" opacity=".35"/><circle cx="512" cy="420" r="300" fill="#FFF9DC" opacity=".45"/>${star(190,260,14,'#FFF3B0',false)}${star(840,300,16,'#FFF3B0',false)}${star(250,700,10,'#FFFFFF',false)}${star(800,720,12,'#FFFFFF',false)}`
};
// 몸 뒤에 그리는 것(넓게 펼쳐진 날개·다리). 그림 v2(2026-10-08 Codex 최종 패키지 assets.json layer=back)와 같다.
// 호박 배낭은 v2 그림이 앞에 그리는 그림이라 PNG 일 때는 앞, 자리 그림(SVG)일 때만 뒤.
export const BACK_ITEMS=new Set(['bat-wings','ghost-wings','spider-legs','shadow-wings','moonlight-aura']);
const SVG_BACK_ITEMS=new Set([...BACK_ITEMS,'pumpkin-backpack']);
// 그림 v2 겹치기 규칙(Codex 기술연결가이드 4~6): 전신 의상은 상의를 가리고(입은 상의는 기억), 멜빵은 상의 위에,
// 신발을 신으면 기본 운동화를 뺀 몸(base_{성별}_{피부}_no_shoes.png), 손 소품 뒤에는 그 손(base_{성별}_{피부}_hand_{left|right}.png)을 다시 그린다.
export const FULL_OUTFITS=new Set(['ghost-sheet','dracula-suit','witch-dress','gothic-dress']);
export const OVERALLS=new Set(['overalls']);
// 손 소품을 드는 손(화면 기준 왼쪽·오른쪽)
export const HAND_SIDE=Object.freeze({lollipop:'right','ghost-doll':'left','bat-balloon':'right','pumpkin-basket':'left',broom:'right','magic-wand':'right','skull-mic':'right',bone:'left','rubber-chicken':'right','rotten-fish':'left'});
// 이름이 적힌 자리 표시(그림이 아직 없는 것)
const placeholder=(name,slot)=>{const y={head:150,face:440,neck:560,top:680,bottom:820,outer:640,shoes:930,hand:800,bg:512,aura:512}[slot]||512;return `<g><rect x="362" y="${y-26}" width="300" height="52" rx="14" fill="#FFFFFF" fill-opacity=".8" stroke="#7353D9" stroke-dasharray="10 6" stroke-width="4"/><text x="512" y="${y+9}" text-anchor="middle" font-size="28" font-weight="700" fill="#7353D9">${esc(name)}</text></g>`;};
export const hasItemArt=id=>Object.hasOwn(ITEMS,id);

let SEQ=0;
// 그림 파일이 있는지·보정값. art = 엔진 GET /api/bot/f/kiugi/art 의 답({files:{s1:[...]},adjust:{s1:{...}}})
function pngLayer(art,season,file,c,{tint=''}={}){
 if(!art||!season||!(art.files?.[season]||[]).includes(file))return null;
 const a=art.adjust?.[season]?.[file.replace(/\.png$/,'')]||{},x=Number(a.x)||0,y=Number(a.y)||0,k=Number(a.scale)>0?Number(a.scale):1;
 const t=x||y||k!==1?` transform="translate(${x} ${y}) translate(512 512) scale(${k}) translate(-512 -512)"`:'';
 return `<image href="/kiugi/${esc(season)}/${esc(file)}" x="0" y="0" width="1024" height="1024"${t}${tint?` filter="url(#${c.id}${tint})"`:''}/>`;
}
const hasFile=(art,season,file)=>Boolean(art&&season&&(art.files?.[season]||[]).includes(file));
const backOf=(art,season,file,id)=>{const a=art?.adjust?.[season]?.[String(file).replace(/\.png$/,'')];return typeof a?.back==='boolean'?a.back:(hasFile(art,season,file)?BACK_ITEMS:SVG_BACK_ITEMS).has(id);};
// 캐릭터 한 장. dj = {gender,hair,hairColor,skin,eyes,nose,mouth}, look = {worn:{칸:옷id}, trick:{item,slot}(1시간 장난 분장 — 그 칸을 덮는다)},
// items = {옷id: {slot,season,name,reward}}(엔진 state 의 시즌 옷·시즌 보상), expression = 레벨 표정({parts}), art = 그림 파일 목록.
// options: transparent(배경 없음) · solid(배경 색) · label(접근성 이름)
export function characterSvg(dj={},look={},{items={},expression=null,art=null,transparent=false,solid='var(--kg-stage,#EFE9F8)',label=''}={}){
 const c={g:dj.gender==='m'?'m':'f',skin:SKIN_COLORS[dj.skin]||SKIN_COLORS.s2,hair:HAIR_COLORS[dj.hairColor]||HAIR_COLORS.brown,id:'kg'+(++SEQ).toString(36)+'_'};
 const worn={...(look?.worn||{})};if(look?.trick?.item&&look.trick.slot)worn[look.trick.slot]=look.trick.item;
 const parts=new Set(Array.isArray(expression?.parts)?expression.parts:[]);
 const eyesKey=[...parts].find(p=>p.startsWith('eyes:'))?.slice(5)||dj.eyes||'round',mouthKey=[...parts].find(p=>p.startsWith('mouth:'))?.slice(6)||dj.mouth||'smile';
 // 한 칸의 그림 파일. 남자 캐릭터는 남자 옷 그림({시즌}_m_{칸}_{옷id}.png, 2026-10-08 그림 v2)이 있으면 그것을, 없으면 같은 옷의 기본 그림
 const fileOf=slot=>{
  const id=worn[slot];if(!id)return null;const meta=items[id]||{};const season=meta.season||BASE_SEASON;
  const male=!meta.reward&&c.g==='m'?`${season}_m_${slot}_${id}.png`:null;
  return{id,meta,season,file:meta.reward?`reward_${id}.png`:male&&hasFile(art,season,male)?male:`${season}_${slot}_${id}.png`};
 };
 const hasPng=slot=>{const f=fileOf(slot);return Boolean(f&&hasFile(art,f.season,f.file));};
 // 옷 한 칸: PNG(시즌 폴더) → SVG 자리 그림 → 이름 자리 표시
 const item=(slot,{back=null}={})=>{
  const f=fileOf(slot);if(!f)return'';const{id,meta,season,file}=f;
  const isBack=backOf(art,season,file,id);if(back!==null&&isBack!==back)return'';
  const png=pngLayer(art,season,file,c);if(png)return `<g data-slot="${slot}">${png}</g>`;
  return `<g data-slot="${slot}">${ITEMS[id]?ITEMS[id](c):placeholder(meta.name||id,slot)}</g>`;
 };
 const base=(file,svg,opts)=>pngLayer(art,BASE_SEASON,file,c,opts)??svg;
 // 그림 v2 의 새 머리(f_*·m_*)는 그림 파일이 없을 때 비슷한 자리 그림으로(여자 머리 → 긴 생머리, 남자 머리 → 짧은 머리)
 const h=HAIR_SHAPES[dj.hair]||(String(dj.hair||'').startsWith('m_')?HAIR_SHAPES.short:String(dj.hair||'').startsWith('f_')?HAIR_SHAPES.long:null)||HAIR_SHAPES.bob;
 // 머리 그림(회색)에 머리색을 곱한다: 채널마다 원본 × 색/255, 투명도는 그대로(Codex 기술연결가이드 7과 같은 셈)
 const mul=[1,3,5].map(i=>(parseInt(c.hair.slice(i,i+2),16)/255).toFixed(4));
 const tint=`<filter id="${c.id}hair" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${mul[0]} 0 0 0 0 0 ${mul[1]} 0 0 0 0 0 ${mul[2]} 0 0 0 0 0 1 0"/></filter>`;
 const hairBack=base(`hair_${dj.hair}_back.png`,h.back?`<g fill="${c.hair}"${s6}>${h.back}</g>`:'',{tint:'hair'});
 const hairFront=base(`hair_${dj.hair}_front.png`,`<g fill="${c.hair}"${s6}>${h.front}</g>${h.extra||''}`,{tint:'hair'});
 const over=key=>parts.has(key)?base(`exp_${key.slice(4)}.png`,EXPRESSION_ART[key]()):'';
 const eyes=base(`eyes_${eyesKey}.png`,eyesSvg(eyesKey));
 // 그림 v2 겹치는 순서(Codex 기술연결가이드 3, 아래에서 위로): 배경 → 오라 → 뒤 겉옷(날개·거미 다리) → 뒷머리 → 몸 → 하의 → 상의(전신 의상이면 숨김)
 //  → 전신 의상·멜빵 → 신발 → 앞 겉옷 → 목 → 눈·코·입 → 얼굴 장식 → 표정 효과 → 앞머리 → 머리 장식 → 손 소품 → 그 손 → 둥실 하트
 const skin=SKIN_COLORS[dj.skin]?dj.skin:'s2',full=FULL_OUTFITS.has(worn.bottom),late=full||OVERALLS.has(worn.bottom);
 const noShoes=`base_${c.g}_${skin}_no_shoes.png`,shoes=hasPng('shoes')&&hasFile(art,BASE_SEASON,noShoes);
 const side=hasPng('hand')?HAND_SIDE[worn.hand]:null,hand=side?pngLayer(art,BASE_SEASON,`base_${c.g}_${skin}_hand_${side}.png`,c)||'':'';
 let o='';
 o+=worn.bg?item('bg'):(transparent?'':`<rect width="1024" height="1024" style="fill:${solid}"/>`);
 o+=item('aura');o+=item('outer',{back:true});
 o+=hairBack+base(shoes?noShoes:`base_${c.g}_${skin}.png`,bodySvg(c));
 if(!late)o+=item('bottom');if(!full)o+=item('top');if(late)o+=item('bottom');
 o+=item('shoes')+item('outer',{back:false})+item('neck');
 o+=eyes+base(`nose_${dj.nose||'dot'}.png`,noseSvg(dj.nose))+base(`mouth_${mouthKey}.png`,mouthSvg(mouthKey));
 o+=item('face')+over('exp-blush')+over('exp-sparkle')+over('exp-tears');
 o+=hairFront+item('head')+item('hand')+hand+over('exp-floating-hearts');
 return `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img"${label?` aria-label="${esc(label)}"`:' aria-hidden="true"'}><defs>${defs(c)}${tint}</defs>${o}</svg>`;
}
// 상점 칸의 옷 하나(옷만, 배경은 옅게). 배경 옷은 그 배경 그대로.
// gender 'm' 이면 남자 옷 그림({시즌}_m_{칸}_{옷id}.png — 상의·하의·겉옷·신발, 2026-10-08)이 있으면 그것, 없으면 같은 옷의 기본 그림(캐릭터 그리기와 같은 규칙)
export function itemSvg(id,{items={},art=null,label='',gender='f'}={}){
 const meta=items[id]||{},slot=meta.slot||'head',season=meta.season||BASE_SEASON,g=gender==='m'?'m':'f';
 const male=!meta.reward&&g==='m'?`${season}_m_${slot}_${id}.png`:null;
 const file=meta.reward?`reward_${id}.png`:male&&hasFile(art,season,male)?male:`${season}_${slot}_${id}.png`,c={g,skin:SKIN_COLORS.s2,hair:HAIR_COLORS.brown,id:'kg'+(++SEQ).toString(36)+'_'};
 const body=pngLayer(art,season,file,c)??(ITEMS[id]?ITEMS[id](c):placeholder(meta.name||id,slot));
 // 옷이 놓이는 자리로 확대(머리·얼굴은 위쪽, 신발은 아래쪽)
 const box={head:'232 0 560 560',face:'312 252 400 400',neck:'312 360 400 400',top:'232 452 560 560',bottom:'232 600 560 560',outer:'72 352 880 880',shoes:'332 760 360 360',hand:'232 452 560 560',bg:'0 0 1024 1024',aura:'0 0 1024 1024'}[slot]||'0 0 1024 1024';
 return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img"${label?` aria-label="${esc(label)}"`:' aria-hidden="true"'}><defs>${defs(c)}</defs>${slot==='bg'?'':`<rect x="-200" y="-200" width="1424" height="1424" style="fill:var(--kg-stage,#EFE9F8)"/>`}${body}</svg>`;
}
