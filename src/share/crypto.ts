// 공유 링크의 자물쇠 (PLAN-SHARE-LINK 결정 2). **WebCrypto 만 쓴다** — 라이브러리를 붙이지
// 않는다(zip.ts·buildStaticSvg.ts 가 세운 그 판단의 세 번째 적용).
//
// 대칭키다. 공개키가 아닌 이유는 계획서 §0 그대로다: "링크 가진 사람 누구나" 는 받는 사람을
// 미리 모르는 모델이고, 공개키는 받는 사람을 아는 2.0 포털의 것이다.
//
// ⚠️ 키는 **서버로 보내는 어떤 값에도 섞이면 안 된다.** 키가 사는 곳은 링크의 `#` 뒤뿐이고
// (프래그먼트는 요청에 실리지 않는다), 이 파일이 내주는 `keyB64` 는 link.ts 로만 간다.
// ⚠️ iv 는 링크마다 새로 뽑는다. 같은 키로 iv 를 재사용하면 AES-GCM 은 평문이 새는 파손 모드에
// 들어간다 — 그래서 키 생성과 iv 생성을 한 함수에 묶지 않고, iv 는 `encrypt` 안에서만 만든다.
import { ShareError, type ShareBytes } from './api.ts';

/** AES-GCM 권장값. 12바이트가 아닌 iv 는 GCM 이 내부에서 해싱해 늘리므로 표준값을 벗어날 이유가 없다. */
const IV_BYTES = 12;
/** GCM 인증 태그 16바이트. iv + 태그 = 28 이 암호문의 **최소 길이**다(평문이 0바이트일 때). */
const MIN_SEALED_BYTES = IV_BYTES + 16;

/** 32바이트 키의 base64url 은 패딩 없이 정확히 43자다(⌈32/3⌉×4 − 1). link.ts 의 정규식이 이 수를
 *  쥐고 있고, 잘린 링크를 붙여넣었을 때 서버를 부르기 전에 걸러내는 유일한 근거다. */
export const SHARE_KEY_B64_LEN = 43;

export function toBase64Url(bytes: ShareBytes): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): ShareBytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '=='.slice(0, (4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad); // 잘못된 글자면 여기서 던진다 — 호출자가 'bad-key' 로 접는다
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export interface GeneratedShareKey {
  key: CryptoKey;
  /** 링크의 `#` 뒤에 그대로 실리는 43자. */
  keyB64: string;
}

export async function generateKey(): Promise<GeneratedShareKey> {
  // extractable:true 여야 raw 로 뽑아 링크에 실을 수 있다 — 이 키의 존재 이유가 그것이다.
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { key, keyB64: toBase64Url(raw) };
}

export async function importKey(keyB64: string): Promise<CryptoKey> {
  let raw: ShareBytes;
  try {
    raw = fromBase64Url(keyB64);
  } catch (e) {
    throw new ShareError('bad-key', { cause: e });
  }
  // 32바이트가 아니면 importKey 가 던지지만, 그 예외는 브라우저마다 문구가 달라 진단이 안 된다.
  if (raw.byteLength !== 32) throw new ShareError('bad-key');
  try {
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch (e) {
    throw new ShareError('bad-key', { cause: e });
  }
}

/** 결과 배치는 `iv(12) ‖ 암호문(태그 포함)` — 서버에 올라가는 바이트 그대로다. */
export async function encrypt(key: CryptoKey, bytes: ShareBytes): Promise<ShareBytes> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv, 0);
  out.set(sealed, iv.length);
  return out;
}

/** 태그가 안 맞으면 'bad-key'. **한 바이트만 바뀌어도** 여기서 걸린다 — 잘린 링크와 변조된
 *  암호문이 같은 문구로 떨어지는 것은 의도한 것이다(사용자가 할 일이 "링크를 다시 받는다" 로 같다). */
export async function decrypt(key: CryptoKey, bytes: ShareBytes): Promise<ShareBytes> {
  if (bytes.byteLength < MIN_SEALED_BYTES) throw new ShareError('bad-key');
  const iv = bytes.subarray(0, IV_BYTES);
  const body = bytes.subarray(IV_BYTES);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, body));
  } catch (e) {
    throw new ShareError('bad-key', { cause: e });
  }
}
