import { MapCore } from './teaser-mapcore.js';

export function startMap(root, motion) {
  const M = MapCore(), cv = root.querySelector('#territory-map'), cx = cv.getContext('2d');
  if (!cx) return;
  const D = M.decor();
  cv.width = M.CW; cv.height = M.CH;
  const img = cx.createImageData(M.CW, M.CH);
  function rgb(c,a){return'rgba('+c[0]+','+c[1]+','+c[2]+','+(a==null?1:a)+')'}
  function castle(x,y,c){var w=16,h=12,t=y-h/2;cx.save();cx.beginPath();
    cx.moveTo(x-w/2,y+h/2);cx.lineTo(x-w/2,t-3);cx.lineTo(x-w/2+4,t-3);cx.lineTo(x-w/2+4,t);cx.lineTo(x-2,t);cx.lineTo(x-2,t-3);cx.lineTo(x+2,t-3);cx.lineTo(x+2,t);cx.lineTo(x+w/2-4,t);cx.lineTo(x+w/2-4,t-3);cx.lineTo(x+w/2,t-3);cx.lineTo(x+w/2,y+h/2);cx.closePath();
    cx.fillStyle=rgb(c);cx.fill();cx.lineWidth=1.6;cx.strokeStyle='rgba(52,40,28,.9)';cx.stroke();
    cx.beginPath();cx.moveTo(x,t-3);cx.lineTo(x,t-13);cx.stroke();cx.beginPath();cx.moveTo(x,t-13);cx.lineTo(x+8,t-10);cx.lineTo(x,t-7);cx.closePath();cx.fillStyle=rgb(c);cx.fill();cx.stroke();
    cx.fillStyle='rgba(52,40,28,.85)';cx.fillRect(x-2,y+h/2-6,4,6);cx.restore()}
  function decorate(){var own=M.owner();cx.lineCap='round';
    cx.lineWidth=1.4;cx.strokeStyle='rgba(48,86,104,.34)';
    D.waves.forEach(function(p){var x=p[0],y=p[1];cx.beginPath();cx.moveTo(x-9,y);cx.quadraticCurveTo(x-4.5,y-4,x,y);cx.quadraticCurveTo(x+4.5,y+4,x+9,y);cx.stroke()});
    D.trees.forEach(function(p){var o=own[p[2]],a=o===-1?.8:.22,x=p[0],y=p[1];
      cx.strokeStyle='rgba(60,72,44,'+a+')';cx.lineWidth=1.1;cx.beginPath();cx.moveTo(x,y+4.5);cx.lineTo(x,y+1);cx.stroke();
      cx.beginPath();cx.arc(x,y-1.6,3.4,0,Math.PI*2);cx.fillStyle='rgba(104,128,78,'+(a*.75)+')';cx.fill();cx.stroke()});
    D.mts.forEach(function(m){var x=m[0],y=m[1],s=m[3];
      cx.beginPath();cx.moveTo(x-s,y+s*.45);cx.lineTo(x-s*.15,y-s*.8);cx.lineTo(x+s*.3,y-s*.1);cx.lineTo(x+s*.55,y-s*.45);cx.lineTo(x+s,y+s*.45);cx.closePath();
      cx.fillStyle='rgba(240,230,205,.88)';cx.fill();
      cx.beginPath();cx.moveTo(x-s*.15,y-s*.8);cx.lineTo(x+s*.05,y+s*.45);cx.lineTo(x+s,y+s*.45);cx.lineTo(x+s*.55,y-s*.45);cx.lineTo(x+s*.3,y-s*.1);cx.closePath();cx.fillStyle='rgba(96,78,54,.2)';cx.fill();
      cx.beginPath();cx.moveTo(x-s,y+s*.45);cx.lineTo(x-s*.15,y-s*.8);cx.lineTo(x+s*.3,y-s*.1);cx.lineTo(x+s*.55,y-s*.45);cx.lineTo(x+s,y+s*.45);
      cx.strokeStyle='rgba(84,66,46,.8)';cx.lineWidth=1.3;cx.stroke()});
    var rx=M.CW-58,ry=M.CH-58;cx.save();cx.translate(rx,ry);cx.strokeStyle='rgba(48,62,70,.7)';cx.fillStyle='rgba(247,240,222,.75)';cx.lineWidth=1.2;
    cx.beginPath();cx.arc(0,0,22,0,Math.PI*2);cx.fill();cx.stroke();
    for(var k=0;k<4;k++){cx.rotate(Math.PI/2);cx.beginPath();cx.moveTo(0,-30);cx.lineTo(5,0);cx.lineTo(-5,0);cx.closePath();cx.fillStyle=k===3?'rgba(170,60,50,.85)':'rgba(48,62,70,.75)';cx.fill()}
    cx.restore();
    M.caps.forEach(function(c,k){castle((c%M.GW+.5)*M.S,(Math.floor(c/M.GW)+.5)*M.S,M.PAL[k])})}

  const toggle = root.querySelector('.s2-map-toggle');
  const day = root.querySelector('.s2-map-day');
  let fields, animation = 0, timeout = 0, paused = false, visible = true;
  let names = [];
  function draw(from, to, progress) {
    M.render(img.data, from, to, progress);
    cx.putImageData(img, 0, 0);
    decorate();
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.font = '700 24px sans-serif';
    cx.lineJoin = 'round';
    names.forEach((l) => {
      const x = l.x * M.CW, y = Math.max(22, l.y * M.CH - 8);
      cx.lineWidth = 6; cx.strokeStyle = '#fbf6e8'; cx.strokeText(l.name, x, y);
      cx.fillStyle = '#263f35'; cx.fillText(l.name, x, y);
    });
  }
  function update() {
    names = M.labels();
    day.textContent = `12월 ${M.day()}일`;
    cv.dataset.day = M.day();
    cv.setAttribute('aria-label', `예시 지도 12월 ${M.day()}일: ` + names.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', '));
  }
  const canPlay = () => !paused && !motion.matches && visible && !document.hidden;
  function schedule() {
    clearTimeout(timeout);
    if (canPlay()) timeout = setTimeout(advance, 3200);
  }
  function advance() {
    if (!canPlay()) return;
    const before = fields;
    if (!M.step()) M.reset();
    fields = M.fields();
    update();
    const start = performance.now();
    let last = 0;
    function frame(now) {
      if (!canPlay()) { draw(fields, fields, 1); return; }
      const p = Math.min(1, (now - start) / 900);
      // 휴대폰에서 매 프레임 픽셀을 다시 셈하지 않도록 약 12fps로 제한한다.
      if (now - last >= 80 || p === 1) {
        draw(before, fields, p * p * (3 - 2 * p));
        last = now;
      }
      if (p < 1) animation = requestAnimationFrame(frame);
      else schedule();
    }
    animation = requestAnimationFrame(frame);
  }
  function sync() {
    clearTimeout(timeout);
    cancelAnimationFrame(animation);
    toggle.disabled = motion.matches;
    toggle.textContent = motion.matches ? '움직임 줄임' : paused ? '움직임 재생' : '움직임 멈추기';
    toggle.setAttribute('aria-pressed', String(paused || motion.matches));
    root.querySelector('.s2-live-dot').classList.toggle('is-paused', paused || motion.matches);
    draw(fields, fields, 1);
    schedule();
  }
  M.reset();
  fields = M.fields();
  update();
  sync();
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(cv);
  }
}
