// 체험 모드·미리보기용 예시 사진과 글(서버 없이). 사진은 SVG 그림(data:)이라 외부 요청이 없다.

export function makePhoto(w, h, hue = 340, label = '') {
  const a = `hsl(${hue} 70% 78%)`, b = `hsl(${(hue + 40) % 360} 65% 62%)`, c = `hsl(${(hue + 200) % 360} 60% 88%)`;
  const r = Math.min(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="${w}" height="${h}" fill="url(#g)"/>`
    + `<circle cx="${w * 0.72}" cy="${h * 0.3}" r="${r * 0.18}" fill="${c}" opacity=".85"/>`
    + `<path d="M0 ${h * 0.78} Q ${w * 0.3} ${h * 0.62} ${w * 0.55} ${h * 0.76} T ${w} ${h * 0.7} V ${h} H 0 Z" fill="#ffffff" opacity=".35"/>`
    + `<text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="${Math.round(r * 0.09)}" fill="#ffffff" text-anchor="middle" opacity=".9">${label.replace(/[<&>]/g, '')}</text>`
    + '</svg>';
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return { path: uri, thumb: uri, w, h };
}

export const RATIOS = [[1200, 1200, '1:1'], [1200, 1800, '2:3'], [900, 1800, '1:2'], [1600, 900, '16:9'], [1200, 1600, '3:4'], [1600, 1200, '4:3'], [900, 1600, '9:16']];

export function samplePhoto(i, label) {
  const [w, h, r] = RATIOS[i % RATIOS.length];
  return makePhoto(w, h, (i * 47 + 330) % 360, label || r);
}

const hoursAgo = (n, now = Date.now()) => new Date(now - n * 3600e3).toISOString();

// 미리보기용 홈 데이터(config의 메뉴에 맞춰 만든다)
export function sampleHome(config, now = Date.now()) {
  const menus = {};
  let k = 0;
  for (const m of config.menus || []) {
    if (!['photo_text', 'album', 'archive'].includes(m.form)) continue;
    menus[m.id] = [0, 1, 2].map((i) => ({
      id: `sample_${m.id}_${i}`, menu: m.id, title: ['첫 방송 날', '100일 기념', '비 오는 밤 라디오'][i], body: '예시 글이에요. 공개하면 실제 글이 보여요.',
      photos: [samplePhoto(k++)], category: '', pinned: false, supporter: m.form === 'archive' ? '별빛' : '', eventDate: '', likes: 3 + i, comments: i, created: hoursAgo(10 + i * 30, now),
    }));
  }
  const lounge = (config.menus || []).find((m) => m.form === 'lounge');
  const comments = lounge ? [
    { id: 'sc1', menu: lounge.id, post: null, nickname: '별빛', body: '오늘 방송도 따뜻했어요.', created: hoursAgo(3, now), hearted: true, reply: '고마워요!' },
    { id: 'sc2', menu: lounge.id, post: null, nickname: '달빛', body: '내일도 들으러 갈게요.', created: hoursAgo(26, now), hearted: false, reply: null },
  ] : [];
  return { menus, comments, pinned: [] };
}

export const SAMPLE_RANKINGS = {
  support: {
    week: ['별빛', '달빛', '구름', '새벽', '하늘', '바람'].map((nickname) => ({ nickname })),
    month: ['달빛', '별빛', '바람', '구름', '노을'].map((nickname) => ({ nickname })),
    all: ['별빛', '달빛', '구름', '하늘', '새벽', '노을', '바람'].map((nickname) => ({ nickname })),
  },
  activity: [['구름', 32], ['별빛', 30], ['새벽', 27], ['달빛', 25], ['노을', 18]].map(([nickname, level]) => ({ nickname, level })),
};
