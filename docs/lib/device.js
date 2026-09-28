// 휴대폰 브라우저를 JUN LIVE 승인 기기로 쓰기(PC 없이).
// 열쇠는 이 브라우저 안(IndexedDB)에만 있고 밖으로 꺼낼 수 없다(non-extractable).
// 서명 형식은 PC 앱과 같다: ECDSA P-256, IEEE-P1363, base64url.

const DB = 'junlive-device', STORE = 'keys', ID = 'main';
const enc = new TextEncoder();

export const b64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256hex = async (v) => hex(await crypto.subtle.digest('SHA-256', typeof v === 'string' ? enc.encode(v) : v));
export const nonce = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

export function supported() {
  return typeof indexedDB !== 'undefined' && !!globalThis.crypto?.subtle && isSecureContext;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

let cached = null;
// { privateKey, publicKey(b64url SPKI), id(sha256 hex), code(XXXX-...) }
export async function identity({ create = true } = {}) {
  if (cached) return cached;
  const db = await openDb();
  let rec = await tx(db, 'readonly', (s) => s.get(ID));
  if (!rec) {
    if (!create) return null;
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    rec = { privateKey: pair.privateKey, publicKey: b64url(spki), created: Date.now() };
    await tx(db, 'readwrite', (s) => s.put(rec, ID));
    // 지워지지 않게 부탁만 한다(브라우저에 따라 답이 오지 않을 수 있어 기다리지 않음)
    try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch { /* 선택 */ }
  }
  const raw = Uint8Array.from(atob(rec.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const id = await sha256hex(raw);
  cached = { privateKey: rec.privateKey, publicKey: rec.publicKey, id, code: codeOf(id) };
  return cached;
}

export const codeOf = (id) => id.slice(0, 24).toUpperCase().match(/.{4}/g).join('-');

export async function sign(text) {
  const me = await identity();
  return b64url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, me.privateKey, enc.encode(text)));
}

// 승인 서버와 같은 문장(access-client.cjs / junlive-access)
export const accessText = ({ timestamp, nonce: n, publicKey, applicant }) =>
  `JUN-LIVE-ACCESS/1\n${timestamp}\n${n}\n${publicKey}` + (applicant ? '\n' + JSON.stringify({ nickname: applicant.nickname, tag: applicant.tag }) : '');

// 팬페이지·기록 서버 형식: PREFIX/1\naction\ntimestamp\nnonce\npublicKey\nsha256(JSON(payload))
export async function signedAction(prefix, action, payload) {
  const me = await identity();
  const timestamp = Date.now(), n = nonce();
  const text = `${prefix}/1\n${action}\n${timestamp}\n${n}\n${me.publicKey}\n${await sha256hex(JSON.stringify(payload ?? null))}`;
  return { action, timestamp, nonce: n, publicKey: me.publicKey, signature: await sign(text), payload };
}
