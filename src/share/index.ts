// 공유 링크 기능의 **바깥 문**. UI(공유 시트·가져오기 시트)는 이 파일만 import 한다 —
// codec·crypto·api 를 화면에서 직접 부르면 "잠그기 전에 올린다" 같은 순서 실수가 화면마다
// 따로 생긴다. 순서는 여기 두 함수가 쥔다.
//
// 만들기: 접기 → 키 생성 → 잠그기 → 올리기 → 링크
// 열기:   링크 파싱 → 받기 → 키 복원 → 풀기 → 펴기·검증
//
// ⚠️ 저장은 여기서 하지 않는다(PLAN-URL-SHARE §1.5 · 기각한 길 ⑤). `openShareLink` 는 Drill 을
// **돌려주기만** 한다 — 남이 준 링크가 내 라이브러리를 말없이 늘리는 일이 없어야 하고, 저장은
// 기존 관문(`prepareDrillImport` → 3택 → `commitDrillImports`)이 한다.
import type { Drill } from '../model/drill.ts';
import { encodeDrillPayload, decodeDrillPayload } from './codec.ts';
import { generateKey, importKey, encrypt, decrypt } from './crypto.ts';
import { buildShareLink, parseShareLink } from './link.ts';
import { uploadCiphertext, fetchCiphertext, ShareError, type ShareErrorKind } from './api.ts';

export { encodeDrillPayload, decodeDrillPayload, SHARE_CODEC_DEFLATE_RAW, SHARE_MAX_INFLATED_BYTES } from './codec.ts';
export type { EncodeDrillOptions } from './codec.ts';
export { generateKey, importKey, encrypt, decrypt, SHARE_KEY_B64_LEN } from './crypto.ts';
export { buildShareLink, parseShareLink, SHARE_ID_RE, SHARE_KEY_RE } from './link.ts';
export type { ShareLinkParts } from './link.ts';
export {
  ShareError,
  isShareError,
  shareApiBase,
  uploadCiphertext,
  fetchCiphertext,
  deleteShared,
  SHARE_MAX_CIPHERTEXT_BYTES,
} from './api.ts';
export type { ShareErrorKind, ShareUploadResult, ShareBytes } from './api.ts';

// ── 오류 문구 4종 (PLAN-SHARE-LINK 결정 10) ───────────────────────────────
// 내부 종류는 7가지지만 **사용자가 할 일은 네 가지**뿐이다. 화면은 이 표로 접어서 문구를 고른다.
//   not-found  링크가 없거나 만료됐다        → 보낸 사람에게 다시 받는다
//   bad-key    열쇠가 맞지 않는다(잘린 링크)  → 링크 전체를 다시 받는다(`#` 뒤까지)
//   too-new    이 앱이 너무 오래됐다          → 앱을 새로고침/업데이트한다
//   network    서버에 못 닿았다               → 잠시 뒤 다시
export type ShareNotice = 'not-found' | 'bad-key' | 'too-new' | 'network';

export const SHARE_NOTICE_BY_KIND: Record<ShareErrorKind, ShareNotice> = {
  'not-found': 'not-found',
  'bad-key': 'bad-key',
  'too-new': 'too-new',
  network: 'network',
  // 손상된 링크·SPIN 드릴이 아닌 내용·검증 탈락은 전부 "이 링크로는 못 연다" 이고, 처방이
  // 'bad-key' 와 같다(링크를 다시 받는다). 잘린 링크와 훼손된 암호문을 사용자 눈에 가르지 않는다.
  invalid: 'bad-key',
  // ⚠️ 가져오기 경로에서 'too-large' 는 **압축 폭탄**이다(정상 드릴은 1 MiB 근처도 못 간다) —
  //    믿을 수 없는 링크라는 뜻이라 'bad-key' 로 접는다. 만들기 경로의 413(드릴이 64 KiB 초과)은
  //    이 표를 타지 않는다 — 공유 시트가 "이 드릴은 링크로 보내기엔 큽니다" 를 직접 말한다.
  'too-large': 'bad-key',
  // 처방이 'network' 와 같다: 잠시 뒤 다시. 만들기 경로에서 이 값을 잡아 "잠시 뒤" 를 구체적으로
  // 말하고 싶으면 kind 를 직접 보면 된다(이 표는 마지막 폴백이다).
  'rate-limited': 'network',
};

/** 예외 하나를 화면 문구 종류로. **모르는 예외는 'network'** 다 — 우리 오류가 아니면 사용자에게
 *  "링크가 잘못됐다" 고 말할 근거가 없고, 다시 시도가 가장 덜 틀린 안내다. */
export function shareNoticeFor(e: unknown): ShareNotice {
  return e instanceof ShareError ? SHARE_NOTICE_BY_KIND[e.kind] : 'network';
}

export interface CreatedShareLink {
  /** `${origin}/s/${id}#${keyB64}` — 약 80자. */
  link: string;
  id: string;
  /** ⚠️ 서버는 sha256 만 갖는다. 잃으면 회수할 길이 없으므로 화면이 `spin.shareLinks` 에 남긴다. */
  deleteToken: string;
  expiresAt: number;
}

/** 결정 8 — 기본은 **이름을 빼고** 만든다. 공유되는 것은 패턴이지 우리 팀 명단이 아니다.
 *  ("이름 포함" 스위치가 생기면 이 옵션이 그 자리다 — 뒤집기가 한 줄이다.) */
export async function createShareLink(
  drill: Drill,
  origin: string,
  options: { stripNames?: boolean } = {},
): Promise<CreatedShareLink> {
  const plain = await encodeDrillPayload(drill, { stripNames: options.stripNames ?? true });
  const { key, keyB64 } = await generateKey();
  const sealed = await encrypt(key, plain);
  const { id, deleteToken, expiresAt } = await uploadCiphertext(sealed);
  return { link: buildShareLink(origin, id, keyB64), id, deleteToken, expiresAt };
}

/** 링크(또는 경로, 또는 `id#key`) 하나로 드릴을 연다. 저장하지 않는다. */
export async function openShareLink(input: string): Promise<Drill> {
  const parts = parseShareLink(input);
  if (!parts) throw new ShareError('invalid');
  // 키 복원을 먼저 한다 — 잘린 열쇠라면 서버를 부를 이유가 없다(남의 서버에 헛짐을 안 지운다).
  const key = await importKey(parts.keyB64);
  const sealed = await fetchCiphertext(parts.id);
  const plain = await decrypt(key, sealed);
  return decodeDrillPayload(plain);
}
