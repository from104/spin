// minisign 서명 검증 — Tauri 업데이터가 `latest.json` 의 signature 로 하는 것과 같은 판정을 앱 **밖**에서 한다. docs/PLAN-TEST-SUITE.md §12.
//
// 왜 직접 푸는가: 업데이터는 서명이 틀리면 받은 묶음을 버리고 **조용히** 실패한다(useDesktopUpdate.ts 가 오류를 삼킨다) —
// 사용자는 "업데이트가 영영 안 온다" 로만 겪는다. 배송 전에 같은 공개 키로 같은 판정을 해 두면 그 사고를 초안 단계에서 막는다.
// 의존성 없이 node:crypto 의 BLAKE2b-512 와 Ed25519 만 쓴다.
//
// 형식(minisign 1.x — Tauri 의 `tauri signer` 가 쓴다)
// - 공개 키: base64(텍스트). 텍스트의 마지막 줄 = base64('Ed' + 키 id 8바이트 + 공개 키 32바이트)
// - 서명:   base64(텍스트). 2째 줄 = base64(알고리즘 2바이트 + 키 id 8 + 서명 64), 3째 줄 `trusted comment: …`,
//           4째 줄 = base64(전역 서명 64 = Ed25519(서명 64 ‖ 신뢰 주석 바이트))
//   알고리즘 'ED' = 파일의 BLAKE2b-512 에 서명(prehashed — Tauri 의 기본), 'Ed' = 파일 원문에 서명(옛 꼴)
import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto';

/** Ed25519 공개 키의 SPKI DER 머리(12바이트) — 그 뒤에 날 키 32바이트가 붙는다 */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface PublicKey {
  keyId: Buffer;
  key: KeyObject;
}

export interface Signature {
  algorithm: 'ED' | 'Ed';
  keyId: Buffer;
  signature: Buffer;
  trustedComment: string;
  globalSignature: Buffer;
}

const lines = (b64: string): string[] =>
  Buffer.from(b64.trim(), 'base64')
    .toString('utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** tauri.conf.json 의 `plugins.updater.pubkey` 값 → 키 */
export function parsePublicKey(confValue: string): PublicKey {
  const raw = Buffer.from(lines(confValue).pop() ?? '', 'base64');
  if (raw.length !== 42 || raw.subarray(0, 2).toString('latin1') !== 'Ed') {
    throw new Error(`minisign 공개 키 꼴이 아니다(${raw.length}바이트)`);
  }
  return {
    keyId: raw.subarray(2, 10),
    key: createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw.subarray(10, 42)]), format: 'der', type: 'spki' }),
  };
}

/** latest.json 의 signature(또는 .sig 자산의 내용) → 서명 */
export function parseSignature(b64: string): Signature {
  const [, sigLine, trusted, globalLine] = lines(b64);
  const raw = Buffer.from(sigLine ?? '', 'base64');
  const algorithm = raw.subarray(0, 2).toString('latin1');
  if (raw.length !== 74 || (algorithm !== 'ED' && algorithm !== 'Ed')) throw new Error(`minisign 서명 꼴이 아니다(${raw.length}바이트, ${algorithm})`);
  if (!trusted?.startsWith('trusted comment: ')) throw new Error('minisign 서명에 신뢰 주석 줄이 없다');
  const globalSignature = Buffer.from(globalLine ?? '', 'base64');
  if (globalSignature.length !== 64) throw new Error('minisign 서명의 전역 서명이 64바이트가 아니다');
  return {
    algorithm,
    keyId: raw.subarray(2, 10),
    signature: raw.subarray(10, 74),
    trustedComment: trusted.slice('trusted comment: '.length),
    globalSignature,
  };
}

/** 검증 — 통과면 null, 아니면 왜 아닌지 한 줄 */
export function verifyMinisign(file: Buffer, signatureB64: string, publicKey: PublicKey): string | null {
  let sig: Signature;
  try {
    sig = parseSignature(signatureB64);
  } catch (error) {
    return String((error as Error).message);
  }
  if (!sig.keyId.equals(publicKey.keyId)) {
    return `키 id 가 다르다 — 서명 ${sig.keyId.toString('hex')} / 공개 키 ${publicKey.keyId.toString('hex')}`;
  }
  const message = sig.algorithm === 'ED' ? createHash('blake2b512').update(file).digest() : file;
  if (!verify(null, message, publicKey.key, sig.signature)) return '파일 서명이 공개 키로 풀리지 않는다';
  const global = Buffer.concat([sig.signature, Buffer.from(sig.trustedComment, 'utf8')]);
  if (!verify(null, global, publicKey.key, sig.globalSignature)) return '전역 서명(서명 ‖ 신뢰 주석)이 풀리지 않는다';
  return null;
}
