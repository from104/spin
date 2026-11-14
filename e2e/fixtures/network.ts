// 네트워크 차단 — 시험 중 앱이 바깥(127.0.0.1·localhost 밖)으로 나가는 요청을 전부 끊고 주소를 적는다.
// docs/PLAN-TEST-SUITE.md §2.
//
// QCalc 판은 환율 API 를 고정 응답했지만 SPIN 은 고정 응답할 것이 없다 — 동기화(구글 GIS·Drive)는 기본
// 꺼짐이고, 공유 링크는 같은 출처의 `/api/share` 다. 그래서 하는 일은 하나: **새는 것을 잡는다.**
// 끊긴 주소는 드라이버의 `blockedRequests()` 로 나오고, 시나리오가 그것이 비어 있는지 본다 — 기본
// 설정으로 구글이나 외부 CDN 을 부르기 시작하면 그것이 회귀다.
import type { BrowserContext } from '@playwright/test';

/** 컨텍스트에 외부 차단 라우트를 건다. 돌려받은 배열에 끊긴 주소가 쌓인다 */
export async function blockExternal(context: BrowserContext): Promise<string[]> {
  const blocked: string[] = [];
  await context.route(
    (url) => /^(https?|wss?):$/.test(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname),
    async (route) => {
      blocked.push(route.request().url());
      await route.abort('blockedbyclient');
    },
  );
  return blocked;
}
