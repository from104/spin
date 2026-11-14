// S1 부팅과 직접 진입 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 운영 빌드에서만 생기는 것들 — 청크 분할로 갈린 화면이 안 뜨는 것, 주소로 직접
// 들어오거나 새로고침하면 fallback 을 못 타 빈 화면·404·엉뚱한 화면이 되는 것(2026-09-02 해시→경로
// 전환의 전제), 실제 레이아웃에서 코트가 0×0 으로 접히는 것. jsdom 은 셋 다 못 본다(번들도 fallback 도
// 레이아웃도 없다). 대문에서 시험 다리가 서는지도 여기서 본다 — 다리가 안 서면 S3~S8 이 전부 "다리 없음"
// 으로 빨개져 원인이 흐려진다.
import type { ScreenKey } from '../drivers/SpinApp.ts';
import { check, defineGroup, eventually, expectQuiet } from './kit.ts';

/** 레일의 여섯 목적지 — 주소창에 직접 쳐서 들어오는 길과 그때 서야 하는 화면 키(src/app/routes.ts 표) */
const ROUTES: readonly (readonly [string, ScreenKey])[] = [
  ['/', 'board'],
  ['/drills', 'drills'],
  ['/sessions', 'sessions'],
  ['/team', 'team'],
  ['/rules', 'rules'],
  ['/settings', 'settings'],
];

export default defineGroup('boot', [
  {
    title: 'S1 레일 여섯 주소로 직접 진입하고 새로고침해도 그 화면이 뜬다',
    needs: ['reload'],
    run: async (app) => {
      for (const [route, screen] of ROUTES) {
        await app.step(`직접 진입 ${route}`, async () => {
          await app.open(route);
          check((await app.screen()) === screen, `${route} 직접 진입 뒤 화면 키 — 기대 ${screen}`, await app.screen());
          if (route === '/') {
            await eventually('코트 무대의 화면 크기 > 0', () => app.courtSize(), (s) => !!s && s.width > 0 && s.height > 0);
            // 빈 전술판(quiet 시드)이라 개체는 0 — 값보다 "다리가 대답하는가" 를 본다
            await eventually('시험 다리(objects)', () => app.objects().then((o) => o.length), 0);
          }
          await app.reload();
          check((await app.path()) === route, `${route} 새로고침 뒤 주소`, await app.path());
          check((await app.screen()) === screen, `${route} 새로고침 뒤 화면 키 — 기대 ${screen}`, await app.screen());
          await expectQuiet(app, route);
        });
      }
    },
  },
]);
