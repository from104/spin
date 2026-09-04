// SEO C1 — **언어별 URL 접두사** (2026-09-02).
//
// 검색 엔진에 세 언어를 따로 올리려면 언어마다 주소가 달라야 한다. 같은 주소가 방문자의
// 설정에 따라 다른 언어를 보여주면 구글은 그중 하나만 색인하고, `hreflang` 은 애초에 서로
// 다른 URL 을 가리키는 태그라 쓸 수가 없다.
//
// **한국어는 뿌리(`/`)에 그대로 둔다.** 접두사를 붙이면 이미 배포된 주소·북마크·
// spin.atit.dev 의 301 이 전부 옮겨 앉는다. 새로 생기는 쪽(`/en`·`/ja`)에만 접두사를 준다.
//
// 이 값은 **react-router 의 basename** 으로 들어간다. 그래서 `routes.ts` 의 경로 표는
// 한 줄도 안 바뀐다 — `navigate('/rules')` 가 `/ja` 아래에서는 저절로 `/ja/rules` 가 된다.
import { SUPPORTED_LOCALES } from '../i18n/locale.ts';
import type { Locale } from '../i18n/locale.ts';

/** 접두사를 갖는 로케일 = 한국어를 뺀 나머지. 로케일이 늘면 여기가 저절로 따라온다. */
export const PREFIXED_LOCALES: readonly Locale[] = SUPPORTED_LOCALES.filter((l) => l !== 'ko');

export interface LocaleRoute {
  /** URL 이 언어를 명시했으면 그 언어. 뿌리면 `null`(= 한국어 또는 설정을 따름). */
  locale: Locale | null;
  /** react-router 에 넘길 basename. 뿌리는 `'/'`. */
  basename: string;
  /** 접두사를 걷어낸 나머지. 항상 `'/'` 로 시작한다. */
  rest: string;
}

/** `/ja/rules/two-on-one` → `{ locale:'ja', basename:'/ja', rest:'/rules/two-on-one' }`.
 *
 *  두 글자 조각이라도 **지원 로케일이 아니면 손대지 않는다** — 드릴 id 가 두 글자일 수
 *  있고(`/drills/ab`), 그때 접두사로 오인하면 목록이 통째로 안 뜬다. */
export function splitLocalePrefix(pathname: string): LocaleRoute {
  const m = /^\/([a-z]{2})(?=\/|$)/.exec(pathname);
  const tag = m?.[1];
  if (tag && (PREFIXED_LOCALES as readonly string[]).includes(tag)) {
    const rest = pathname.slice(m[0].length);
    return { locale: tag as Locale, basename: `/${tag}`, rest: rest.startsWith('/') ? rest : `/${rest || ''}` };
  }
  return { locale: null, basename: '/', rest: pathname.startsWith('/') ? pathname : `/${pathname}` };
}

/** 해시 시절 주소를 경로로 옮긴다 — `/#/rules/x` → `/rules/x`.
 *
 *  0.6.0 까지 배포된 주소가 전부 해시였다. 북마크·SNS 로 나간 링크가 죽으면 안 되므로
 *  뿌리에서 해시만 달고 들어온 요청을 경로로 갈아 끼운다. **경로가 이미 뿌리가 아니면
 *  건드리지 않는다** — 그때 해시는 앵커(`#섹션`)일 수 있다. */
export function legacyHashPath(pathname: string, hash: string): string | null {
  if (pathname !== '/' || !hash.startsWith('#/')) return null;
  return hash.slice(1);
}
