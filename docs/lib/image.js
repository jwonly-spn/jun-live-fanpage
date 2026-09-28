// 브라우저에서 사진 줄이기 — 원본(긴 변 2048, 1.5MB 이하) + 미리보기(긴 변 640, 200KB 이하) JPEG. 비율은 그대로.
import { fitWithin, IMAGE_SPEC, base64Bytes } from './photo.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* 아래 방법으로 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function encode(src, sw, sh, { maxEdge, maxBytes }) {
  let { w, h } = fitWithin(sw, sh, maxEdge);
  for (let round = 0; round < 6; round++) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    for (const q of [0.86, 0.78, 0.7, 0.6]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= maxBytes) {
        const b64 = await blobToBase64(blob);
        if (base64Bytes(b64) <= maxBytes) return { b64, w, h };
      }
    }
    w = Math.max(1, Math.round(w * 0.82)); h = Math.max(1, Math.round(h * 0.82));
  }
  throw new Error('사진이 너무 커요. 다른 사진을 골라 주세요.');
}

// → {data, thumb, w, h, preview(data URL)}
export async function prepareImage(file) {
  if (!file || (file.type && !ACCEPT.includes(file.type))) throw new Error('JPG·PNG·WebP 사진만 올릴 수 있어요.');
  if (file.size > 40 * 1024 * 1024) throw new Error('40MB 이하 사진을 골라 주세요.');
  let src;
  try { src = await decode(file); } catch { throw new Error('사진을 읽을 수 없어요. 다른 사진을 골라 주세요.'); }
  try {
    const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
    if (!sw || !sh) throw new Error('사진을 읽을 수 없어요.');
    const main = await encode(src, sw, sh, IMAGE_SPEC.main);
    const thumb = await encode(src, main.w, main.h, IMAGE_SPEC.thumb);
    return { data: main.b64, thumb: thumb.b64, w: main.w, h: main.h, preview: 'data:image/jpeg;base64,' + thumb.b64 };
  } finally { src.close?.(); }
}
