// S10 시드 드릴 서랍 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 첫 실행에 앱이 스스로 심는 규칙 장면(+따라하기 한 벌)이 서랍에 안 서는 것, 지운 시드가
// 새로고침마다 되살아나는 것(`SeedDrills` 의 도장 effect·`seedDrillsOnce` 의 "이미 있으면 안 심는다" 두 겹이
// 실제 IndexedDB 트랜잭션 순서와 맞물려 돈다 — fake-indexeddb·jsdom 은 트랜잭션 완료 시점이 달라 이 경주를 못 본다).
//
// 장수는 22 가 아니라 **22 이상**이다 — 규칙 장면 22벌 앞에 따라하기 드릴 한 벌이 더 심긴다(storage/seed.ts
// `defaultSeedDrills`). 개수를 못박으면 장면이 하나 늘 때마다 빨개지는 변경 감지기가 된다.
import type { SpinApp } from '../drivers/SpinApp.ts';
import { check, defineGroup, eventually, expectQuiet } from './kit.ts';

const cardCount = async (app: SpinApp) => (await app.anchor('library-card'))?.count ?? 0;

export default defineGroup('library', [
  {
    title: 'S10 시드 서랍과 지운 시드',
    seed: { profile: 'scenes', route: '/drills' },
    needs: ['reload'],
    run: async (app) => {
      const seeded = await eventually('시드 카드가 서랍에 섬', () => cardCount(app), (n) => n >= 22, { timeout: 15_000 });

      await app.pressAnchor('library-card-menu');
      await app.press('drill-delete');
      await eventually('삭제 확인 대화 상자', () => app.dialogs(), (d) => d.includes('confirm-dialog'));
      await app.press('confirm-ok');
      await eventually('지운 카드가 서랍에서 빠짐', () => cardCount(app), seeded - 1);

      await app.reload();
      await eventually('새로고침 뒤 서랍이 채워짐', () => cardCount(app), (n) => n > 0, { timeout: 15_000 });
      check((await cardCount(app)) === seeded - 1, '지운 시드가 새로고침 뒤 되살아났다', await cardCount(app));
      await expectQuiet(app, 'S10');
    },
  },
]);
