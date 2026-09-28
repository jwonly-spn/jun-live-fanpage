// 사진 칸 크기 계산 — 사진은 절대 자르지 않는다. DOM 없이 동작.

export const FEED_CAP = 1.5; // 피드 칸 높이 최대 = 폭 × 1.5

function dims(w, h) {
  const W = Number(w), H = Number(h);
  return W > 0 && H > 0 && Number.isFinite(W) && Number.isFinite(H) ? [W, H] : [1, 1];
}

// 칸 비율(높이/폭)과 잘림 방지 여부
export function frameRatio(w, h, cap = FEED_CAP) {
  const [W, H] = dims(w, h);
  const natural = H / W;
  const capped = natural > cap;
  return { ratio: capped ? cap : natural, natural, capped };
}

// 폭 width 칸 안에서 칸 높이와 사진이 차지하는 크기(contain)
export function frameSize(width, w, h, cap = FEED_CAP) {
  const { ratio, natural, capped } = frameRatio(w, h, cap);
  const height = width * ratio;
  const photoHeight = height;
  const photoWidth = capped ? height / natural : width;
  return { width, height, capped, photoWidth, photoHeight };
}

// 화면 폭에 따른 앨범 열 수: 휴대폰 2, 태블릿 3, PC 4
export function columnsFor(width) {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return 4;
}

// 메이슨리: 차례대로 가장 짧은 열에 넣는다(높이 = h/w + 여백). 반환: 열마다 원래 번호 목록
export function masonry(items, cols, extra = 0) {
  const n = Math.max(1, Math.floor(cols) || 1);
  const heights = new Array(n).fill(0);
  const out = Array.from({ length: n }, () => []);
  items.forEach((it, i) => {
    const [W, H] = dims(it?.w, it?.h);
    let best = 0;
    for (let c = 1; c < n; c++) if (heights[c] < heights[best] - 1e-9) best = c;
    out[best].push(i);
    heights[best] += H / W + extra;
  });
  return out;
}

// 긴 변을 maxEdge 이하로 줄인 크기(키우지는 않음)
export function fitWithin(w, h, maxEdge) {
  const [W, H] = dims(w, h);
  const s = Math.min(1, maxEdge / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * s)), h: Math.max(1, Math.round(H * s)) };
}

// 올릴 사진 규격
export const IMAGE_SPEC = {
  main: { maxEdge: 2048, maxBytes: 1.5 * 1024 * 1024 },
  thumb: { maxEdge: 640, maxBytes: 200 * 1024 },
};

// base64 글자 수 → 바이트 수
export function base64Bytes(b64) {
  const s = String(b64 || '');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
}
