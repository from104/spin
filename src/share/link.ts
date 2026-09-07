// 링크를 만들고 읽는 자리 (PLAN-SHARE-LINK 결정 3, PLAN-URL-SHARE 결정 6).
//
// 꼴은 `${origin}/s/${id}#${keyB64}` 한 가지다. **`#` 뒤는 서버로 가지 않는다** — 그 성질을
// 그대로 써서 열쇠를 숨긴다(뒤집힌 옛 결정 2의 근거는 죽지 않았다: 실린 것이 코드에서 키로
// 바뀌었을 뿐이다). 그래서 열쇠는 Apache 액세스 로그·`Referer`·프록시 캐시 어디에도 안 남는다.
//
// 읽는 쪽은 **세 꼴을 다 받는다**(결정 6 — PoB 의 "enter URL or code here" 그대로): 사람은
// 메신저에서 받은 것을 그대로 붙여넣지, 어느 부분이 링크인지 골라 내지 않는다.
//   ① 전체 URL  `https://spin.atit.app/s/AbC0123xyZ#<43자>`  (언어 접두사 `/en/s/…` 도 받는다)
//   ② 경로만    `/s/AbC0123xyZ#<43자>`
//   ③ 알맹이만  `AbC0123xyZ#<43자>`
//
// ⚠️ 여기의 검사는 **서버를 부르기 전에** 잘린 링크를 걸러내는 것이 목적이다. 그래서 엄격하다
// (id 10자·키 43자). 반대로 `routes.ts` 의 `/s/:id` 파싱은 느슨하다 — 이미 세상에 나간 링크가
// 오타 하나로 대문에 떨어지면 사용자는 "링크 없음" 이라는 알맞은 문구조차 못 본다.
import { SHARE_KEY_B64_LEN } from './crypto.ts';

/** base62 10자(결정 5). 62^10 ≈ 8.4×10^17 — 추측으로 남의 링크를 여는 길을 닫는다. */
export const SHARE_ID_RE = /^[0-9A-Za-z]{10}$/;
/** base64url 43자, 패딩 없음(= 32바이트 키). 42자면 잘린 것이다. */
export const SHARE_KEY_RE = new RegExp(`^[0-9A-Za-z_-]{${SHARE_KEY_B64_LEN}}$`);

export interface ShareLinkParts {
  id: string;
  keyB64: string;
}

/** origin 은 보통 `location.origin`. 뒤 슬래시가 붙어 있어도 `//s/` 를 만들지 않는다. */
export function buildShareLink(origin: string, id: string, keyB64: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${id}#${keyB64}`;
}

export function parseShareLink(input: string): ShareLinkParts | null {
  const text = input.trim();
  const hash = text.indexOf('#');
  if (hash < 0) return null; // 열쇠 없는 링크는 열 수 없다 — 서버를 부를 이유도 없다
  const keyB64 = text.slice(hash + 1);
  if (!SHARE_KEY_RE.test(keyB64)) return null;

  // `#` 앞에서 쿼리를 떼고(공유 링크에 쿼리는 없지만 메신저가 추적 파라미터를 붙인다) 뒤
  // 슬래시를 정리한 뒤 마지막 두 조각만 본다.
  const left = text.slice(0, hash).split('?')[0]!.replace(/\/+$/, '');
  if (SHARE_ID_RE.test(left)) return { id: left, keyB64 }; // ③ 알맹이만

  const seg = left.split('/');
  const id = seg[seg.length - 1] ?? '';
  const before = seg[seg.length - 2] ?? '';
  // ①·② — 어느 도메인이든, 언어 접두사가 있든, 바로 앞 조각이 's' 이기만 하면 된다.
  if (before === 's' && SHARE_ID_RE.test(id)) return { id, keyB64 };
  return null;
}
