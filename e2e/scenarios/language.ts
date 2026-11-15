// S13 언어 누수 점검 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 영어·일본어로 바꾼 뒤에도 화면에 한글이 남는 것 — 번역 키가 빠져 한국어 원문이 그대로
// 나가거나, 코드에 박힌 문구·aria 이름이 번역을 우회하거나, 저장된 언어가 화면 일부에만 반영되는 것. 키 패리티
// 테스트와 소스 grep 은 "키가 있는가" 만 보고 **렌더 결과**를 못 본다(어떤 키가 실제로 어느 화면에 쓰이는지는
// 실행해야 안다). 한글 음절(U+AC00–D7A3)이 보이는 글·접근성 이름에 있는지로 잰다 — 일본어·영어 화면에서는
// 한글이 **하나도** 없어야 하는 것이 사실이라 문구를 베끼지 않아도 되고 번역이 바뀌어도 안 깨진다.
//
// 허용 목록(ALLOWED): 한글이 정당하게 남는 자리 — 언어 이름(자기 언어로 적는다)과 사용자 데이터. 목록이 늘면 이유를
// 적는다(조용히 늘리면 이 점검이 무뎌진다). 언어 모달이 열려 있는 동안은 재지 않는다(`한국어` 가 거기 있다).
import type { SpinApp } from '../drivers/SpinApp.ts';
import { check, defineGroup, eventually, expectQuiet } from './kit.ts';

const HANGUL = /[가-힣]/;

/** 한글이 있어도 되는 문자열 — 지금은 없다. 생기면 (문자열 정규식, 이유) 로 더한다 */
const ALLOWED: readonly RegExp[] = [];


/** 훑을 화면 — 레일의 목적지 + 규칙 주제 상세. 전술판('/')은 S13c 가 따로 맡는다(개체를 놓은 판까지 본다) */
const ROUTES = ['/drills', '/sessions', '/team', '/rules', '/rules/two-on-one', '/settings'] as const;

async function leaks(app: SpinApp): Promise<string[]> {
  const { text, names } = await app.uiStrings();
  return [...text, ...names].filter((s) => HANGUL.test(s) && !ALLOWED.some((a) => a.test(s)));
}

async function expectNoHangul(app: SpinApp, where: string): Promise<void> {
  const found = await leaks(app);
  check(found.length === 0, `${where}: 한글이 남았다(${found.length}건)`, found.slice(0, 5));
}

async function chooseLanguage(app: SpinApp, code: 'ko' | 'en' | 'ja'): Promise<void> {
  await app.press('lang-open');
  await eventually('언어 대화 상자', () => app.dialogs(), (d) => d.length === 1);
  await app.press(`lang-${code}`);
  await eventually(`언어 ${code} 반영`, () => app.htmlLang(), code);
  await eventually('언어 대화 상자 닫힘', () => app.dialogs(), (d) => d.length === 0);
}

export default defineGroup('language', [
  {
    title: 'S13 en·ja 화면에 한글이 없다',
    // 언어 단추(`lang-open`)는 넓은 창은 레일, 좁은 창은 머리띠(AppNavSegment)에 있다 — 둘은 동시에 서지 않는다
    needs: ['reload'],
    run: async (app) => {
      await app.open('/drills');
      await app.step('ko 기준선 — 검출기가 한글을 본다', async () => {
        check(HANGUL.test((await app.uiStrings()).text.join(' ')), '한국어 화면인데 한글이 하나도 안 잡힌다 — 검출기가 눈이 멀었다');
      });

      for (const code of ['en', 'ja'] as const) {
        await app.step(`${code}: 지금 화면(바꾼 즉시)`, async () => {
          await chooseLanguage(app, code);
          await expectNoHangul(app, `${code} 서랍(즉시 반영)`);
        });
        for (const route of ROUTES) {
          await app.step(`${code}: ${route}`, async () => {
            await app.open(route);
            check((await app.htmlLang()) === code, `${code} ${route}: 새로고침 뒤 html[lang]`, await app.htmlLang());
            await expectNoHangul(app, `${code} ${route}`);
          });
        }
        await app.step(`${code}: 도움말`, async () => {
          await app.open('/drills');
          await app.press('help-open');
          await eventually('도움말 대화 상자', () => app.dialogs(), (d) => d.includes('help-modal'));
          await expectNoHangul(app, `${code} 도움말`);
          await app.pressKey('Escape');
          await eventually('도움말 닫힘', () => app.dialogs(), (d) => d.length === 0);
        });
      }
      await expectQuiet(app, 'S13');
    },
  },
  {
    // 지우면 새는 실기 버그: 전술판(편집기) 화면에만 남은 한국어 — 트레이 휠체어 칩의 이름(`G번`·`2번` 의 `번` 이
    // 번역 템플릿 밖에 붙는다: "Place 2번"·"2번を配置")과 코트 무대의 접근성 이름 `코트 편집 영역`. 영어·일본어 화면의
    // 스크린리더 사용자가 한국어 조각을 듣는다.
    // 2026-11-15 졸업: 트레이 칩 이름의 `번`(model/chairLabel numberedName 이 언어를 받는다)과
    // 코트 무대 이름(`editor.courtStage.ariaLabel`)을 번역했다. 옛 knownBug 는 `Place 2번`·`코트 편집 영역`.
    title: 'S13c 전술판 한글 누수',
    needs: ['reload'],
    run: async (app) => {
      await app.open('/');
      for (const code of ['en', 'ja'] as const) {
        await chooseLanguage(app, code);
        const found = await leaks(app);
        check(found.length === 0, `${code}: 전술판에 한글이 남았다(${found.length}건)`, [...new Set(found)].slice(0, 4));
      }
    },
  },
  {
    // 지우면 새는 실기 버그: 검색·공유로 `/en/…` 에 들어온 사람에게 저장된 언어(여기서는 한국어)가 이겨 영어 주소가
    // 한국어로 뜨는 것. 프리렌더 원문은 영어인데 넘겨받는 순간 바뀌는 사고이기도 하다(S2 는 감축 모션을 푼 같은 조건).
    title: 'S13b /en/ 주소가 저장 언어를 이긴다',
    run: async (app) => {
      await app.open('/en/rules/');
      check((await app.htmlLang()) === 'en', '저장 언어(ko)가 /en/ 주소를 이겼다', await app.htmlLang());
      await expectNoHangul(app, '/en/rules/');
    },
  },
]);
