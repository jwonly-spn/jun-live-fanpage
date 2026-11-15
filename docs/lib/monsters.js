// 시즌 2 몬스터 목록·속성·상성·그림 주소 — DOM 없이 동작(노드 시험이 그대로 부른다). 약속 문서 spec.md 2절.
//  · 속성 6: fire 불 · water 물 · grass 풀 · earth 땅 · wind 바람 · electric 전기
//  · 상성 고리(왼쪽이 오른쪽에 강함): 물 › 불 › 풀 › 땅 › 전기 › 바람 › 물 — 강하면 ×1.5, 약하면 ×0.75
//  · 몬스터 목록은 먼치킨 저장소의 season-s2.json(사이트로 복사된 docs/kiugi/season-s2.json)이 정한다 — 2026-11-15 확정: 18종
//    (속성마다 3종 fire_01 · fire_02 · fire_03, _03 은 "드문 몬스터" rare) × 3단계 + 보스 6(boss_fire …, 이름·그림은 아직 자리).
//    종마다 이름 · 단계 이름(stageNames) · 동물(animal) · 계열 설화(lore) · 단계마다 도감 글(dex[3]), 맨 위에 대륙 이야기(intro).
//    파일이 없으면(또는 읽을 몬스터가 하나도 없으면) 자리 목록: 속성마다 3종, 이름 "불 몬스터 1".
//  · 그림: docs/kiugi/s2/monster_<속성>_<nn>_<단계>.webp(256px 투명) · boss_<속성>.png(먼치킨 저장소 app/public/kiugi/s2/ 를 sync-kiugi-site 가 복사,
//    어떤 그림이 있는지는 docs/kiugi/manifest.json 의 files.s2). 그림이 없는 단계는 앞 단계 그림 + "곧 진화 모습이 나와요", 하나도 없으면 속성 색 동그라미.

export const TYPES = [
  { id: 'fire', name: '불', emoji: '🔥', color: '#e2603a' },
  { id: 'water', name: '물', emoji: '💧', color: '#3b86d1' },
  { id: 'grass', name: '풀', emoji: '🌿', color: '#4c9a45' },
  // 산 그림 글자는 글자 모양으로 그려지는 기기가 있어(▲) 그림 글자 표시(FE0F)를 붙인다 — 소스에 그 글자를 바로 쓰면 보이지 않아 번호로
  { id: 'earth', name: '땅', emoji: String.fromCodePoint(0x26f0, 0xfe0f), color: '#a2733f' },
  { id: 'wind', name: '바람', emoji: '🌪', color: '#5aa99b' },
  { id: 'electric', name: '전기', emoji: '⚡', color: '#d6a51d' },
];
export const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const RING = ['water', 'fire', 'grass', 'earth', 'electric', 'wind'];
// t 가 강한 상대(고리에서 다음) · t 를 이기는 속성(고리에서 앞 — 보스의 "약점")
export const beats = (t) => RING[(RING.indexOf(t) + 1) % RING.length];
export const beatenBy = (t) => RING[(RING.indexOf(t) + RING.length - 1) % RING.length];
export function multiplier(attack, defend) {
  if (!TYPE[attack] || !TYPE[defend]) return 1;
  if (beats(attack) === defend) return 1.5;
  if (beatenBy(attack) === defend) return 0.75;
  return 1;
}

// 키우기: 냥 1 = 경험치 1 · 2단계 4,500 · 3단계 14,000(누적) · 레벨 = 1 + floor(sqrt(경험치)/4) · 힘 = (10 + 레벨×4) × 단계 배율(1 / 1.25 / 1.5)
export const STAGE_EXP = [0, 4500, 14000];
export const STAGE_MUL = [1, 1.25, 1.5];
export const STAGES = 3;
export const levelOf = (exp) => 1 + Math.floor(Math.sqrt(Math.max(0, Number(exp) || 0)) / 4);
export const powerOf = (lv, stage) => Math.round((10 + Math.max(1, Number(lv) || 1) * 4) * (STAGE_MUL[Math.min(STAGES, Math.max(1, Number(stage) || 1)) - 1]));

export const SP = /^([a-z]{1,12})_(\d{2})$/;
export function speciesOf(sp) {
  const m = SP.exec(String(sp ?? ''));
  return m ? { sp: m[0], type: m[1], nn: m[2], known: Boolean(TYPE[m[1]]) } : null;
}
// 한 종(자리 이름) — 설화·도감 글은 비어 있다
export const SPECIES_PER_TYPE = 3;
function blankSpecies(type, nn) {
  const name = `${TYPE[type].name} 몬스터 ${Number(nn)}`;
  return { sp: `${type}_${nn}`, type, nn, name, stages: [name, name, name], walk: type, rare: false, animal: '', lore: '', dex: ['', '', ''] };
}
// 기본 목록(season-s2.json 이 없을 때): 속성마다 3종 × 3단계 + 보스 6, 자리 이름
export function defaultCatalog() {
  const species = [], bosses = [];
  for (const t of TYPES) {
    for (let i = 1; i <= SPECIES_PER_TYPE; i++) species.push(blankSpecies(t.id, String(i).padStart(2, '0')));
    bosses.push({ id: `boss_${t.id}`, type: t.id, name: `${t.name} 보스` });
  }
  return { species, bosses, named: false, intro: '' };
}
const HIDDEN = new RegExp('[' + [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
const clean = (v, max = 16) => (typeof v === 'string' ? [...v.replace(HIDDEN, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('') : '');
// 설화·도감 글·대륙 이야기(긴 글 한 문단 — 지금 120~500자)
export const LORE_MAX = 1200;
const story = (v) => { const t = typeof v === 'string' ? v : v && typeof v === 'object' ? v.text ?? v.dex : ''; return typeof t === 'string' ? clean(t.replace(/[\r\n\t]+/g, ' '), LORE_MAX) : ''; };
const entries = (v) => (Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? x : null)).filter(Boolean)
  : v && typeof v === 'object' ? Object.entries(v).map(([id, x]) => (typeof x === 'string' ? { id, name: x } : x && typeof x === 'object' ? { id, ...x } : null)).filter(Boolean) : []);
// season-s2.json(먼치킨 저장소 — 봇 묶음이 만든다)에서 목록을 읽는다. 모양을 넉넉히 받는다:
//  monsters: [{id|sp:'fire_01', name, stageNames:['1단계 이름','2단계 이름','3단계 이름'] | stages:[…] | names:[…] | stages:[{name}],
//             rare?:true, animal?, lore?, dex?:['1단계 도감 글', …]}] 또는 {fire_01: '이름' | {name, stages}}
//  intro: '대륙 이야기' · bosses: [{id:'boss_fire' | type:'fire', name}] 또는 {boss_fire: '이름'}. 모르는 칸·모르는 속성·같은 id 두 번은 버린다.
//  목록 = 파일에 있는 몬스터(파일 차례 그대로). 읽을 몬스터가 하나도 없으면 자리 목록(defaultCatalog).
export const SPECIES_MAX = 60;
export function readCatalog(json) {
  const out = defaultCatalog();
  if (!json || typeof json !== 'object') return out;
  const species = [], seen = new Set();
  for (const m of entries(json.monsters)) {
    const info = speciesOf(m.id ?? m.sp);
    if (!info?.known || seen.has(info.sp) || species.length >= SPECIES_MAX) continue;
    seen.add(info.sp);
    const s = blankSpecies(info.type, info.nn);
    const name = clean(m.name);
    if (name) { s.name = name; s.stages = [name, name, name]; out.named = true; }
    const list = Array.isArray(m.stageNames) ? m.stageNames : Array.isArray(m.stages) ? m.stages : Array.isArray(m.names) ? m.names : [];
    list.slice(0, STAGES).forEach((x, i) => { const n = clean(typeof x === 'string' ? x : x?.name); if (n) { s.stages[i] = n; out.named = true; } });
    if (!name && s.stages[0]) s.name = s.stages[0];
    s.rare = m.rare === true;
    s.animal = clean(m.animal);
    s.lore = story(m.lore);
    if (Array.isArray(m.dex)) s.dex = [0, 1, 2].map((i) => story(m.dex[i]));
    species.push(s);
  }
  if (species.length) out.species = species;
  out.intro = story(json.intro);
  for (const b of entries(json.bosses)) {
    const type = TYPE[b.type] ? b.type : String(b.id ?? '').replace(/^boss_/, '');
    const boss = out.bosses.find((x) => x.type === type);
    const name = clean(b.name);
    if (boss && name) { boss.name = name; out.named = true; }
  }
  return out;
}

// 그림 이름(spec.md 2절)
export const monsterFile = (sp, stage) => { const s = speciesOf(sp); return s ? `monster_${s.type}_${s.nn}_${stage}.webp` : ''; };
export const bossFile = (type) => `boss_${type}.png`;
// 있는 그림 이름 모음: docs/kiugi/manifest.json 의 files.s2(없으면 빈 모음 — 모두 동그라미 자리 그림)
export function artFiles(manifest) {
  const list = manifest?.files?.s2;
  return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
}
// 몬스터 그림: {url, stage(보이는 그림의 단계), soon(이 단계 그림이 아직 없어 앞 단계 그림)} | null(그림 하나도 없음 — 동그라미)
export function monsterArt(base, files, sp, stage) {
  const st = Math.min(STAGES, Math.max(1, Number(stage) || 1));
  for (let s = st; s >= 1; s--) {
    const f = monsterFile(sp, s);
    if (f && files.has(f)) return { url: `${base}kiugi/s2/${f}`, stage: s, soon: s < st };
  }
  return null;
}
export function bossArt(base, files, type) {
  const f = bossFile(type);
  return files.has(f) ? { url: `${base}kiugi/s2/${f}`, stage: 1, soon: false } : null;
}

// 청취자 한 명의 몬스터(서버 kiugi v3 답): [{sp, stage, lv}] → 대표 먼저, 그다음 레벨 높은 순 · 모르는 몬스터는 뺀다
export function sortMonsters(monsters, lead) {
  return (Array.isArray(monsters) ? monsters : [])
    .filter((m) => m && speciesOf(m.sp)?.known && Number.isSafeInteger(m.stage) && Number.isSafeInteger(m.lv))
    .map((m) => ({ sp: m.sp, stage: Math.min(STAGES, Math.max(1, m.stage)), lv: Math.max(1, m.lv), lead: m.sp === lead }))
    .sort((a, b) => Number(b.lead) - Number(a.lead) || b.lv - a.lv || b.stage - a.stage || (a.sp < b.sp ? -1 : 1));
}
// 도감에서: 만난 몬스터 sp → 가장 높은 단계
export function metOf(monsters) {
  const met = new Map();
  for (const m of sortMonsters(monsters)) met.set(m.sp, Math.max(met.get(m.sp) || 0, m.stage));
  return met;
}
// "물 › 불" 같은 짧은 글
export const typeLabel = (t) => (TYPE[t] ? `${TYPE[t].emoji} ${TYPE[t].name}` : '');
export const walkCommand = (t) => (TYPE[t] ? `!산책 ${TYPE[t].name}` : '!산책');
