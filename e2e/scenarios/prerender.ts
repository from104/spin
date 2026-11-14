// S2 프리렌더 착지 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 검색으로 `/rules/<주제>/`·`/en/…`·`/ja/…` 에 착지한 사람이 (1) JS 가 돌기 전에 본문 없는
// 빈 페이지를 받는 것(프리렌더 굽기 실패 — 빌드에만 있는 산출물이라 jsdom·dev 서버가 못 본다), (2) 앱이 넘겨받자
// 부팅 로더가 읽던 글을 덮는 것(`LANDED_ON_PRERENDER` 는 `createRoot` 보다 먼저 평가돼야 하는 조용한 계약 —
// 어기면 에러 없이 스플래시만 뜬다), (3) 넘겨받은 뒤 문서 언어(`html[lang]`)나 본문이 주소의 언어와 다른 것,
// (4) 넘겨받은 뒤 장면이 안 도는 것. 앞의 둘은 운영 빌드(`dist/`)에만 있다.
//
// 본문 문구는 번역되므로 단언하지 않는다 — 프리렌더 `h1` 이 넘겨받은 뒤 화면에도 있는가(같은 출처 데이터)만 본다.
import { check, defineGroup, eventually, expectQuiet } from './kit.ts';

/** [주소, 문서 언어] — 같은 주제를 세 언어로. 두 장면 이상이 있는 주제를 고른다(규칙 장면 재생 단추가 서야 한다) */
const LANDINGS: readonly (readonly [string, string])[] = [
  ['/rules/two-on-one/', 'ko'],
  ['/en/rules/two-on-one/', 'en'],
  ['/ja/rules/two-on-one/', 'ja'],
];

export default defineGroup('prerender', [
  {
    title: 'S2 프리렌더 착지 ko·en·ja',
    needs: ['prerender'],
    // 감축 모션을 풀어 둔다 — 시드의 'always' 는 로더 길이를 0 으로 접어, 로더가 읽던 글을 덮는 회귀가 보이지 않는다
    seed: { prefs: { a11y: { reduceMotion: 'system' } } },
    run: async (app) => {
      for (const [route, lang] of LANDINGS) {
        await app.step(`프리렌더 ${route}`, async () => {
          const pre = await app.prerendered(route);
          check(pre.status === 200, `${route}: JS 이전 원문 응답 코드`, pre.status);
          check(pre.seoPage === 'rules', `${route}: 원문에 프리렌더 규칙 블록이 없다`, pre.seoPage);
          check(pre.lang === lang, `${route}: 원문 html[lang]`, pre.lang);
          check(pre.h1.length > 0 && pre.textChars > 200, `${route}: 원문 본문이 비었다`, { h1: pre.h1, chars: pre.textChars });

          await app.open(route);
          check((await app.htmlLang()) === lang, `${route}: 넘겨받은 뒤 html[lang]`, await app.htmlLang());
          check((await app.screen()) === 'rules', `${route}: 넘겨받은 뒤 화면 키`, await app.screen());
          check((await app.rootText()).includes(pre.h1), `${route}: 넘겨받은 뒤 화면에 프리렌더 제목이 없다`, pre.h1);
          const log = await app.modalLog();
          check(!log.loaderSeen, `${route}: 프리렌더에 착지했는데 로더 덮개가 섰다`);

          const play = await app.anchor('rules-play');
          check(play !== null, `${route}: 장면 재생 단추(rules-play)가 없다`);
          await app.pressAnchor('rules-play');
          await eventually(`${route}: 장면 재생 조작 줄`, () => app.present('play-toggle'), true);
          await eventually(`${route}: 장면이 다음 스텝으로 넘어감`, () => app.rootText(), (t) => /STEP [2-9]\//.test(t), { timeout: 15_000 });
          await expectQuiet(app, route);
        });
      }
    },
  },
]);
