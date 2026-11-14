// S8 새로고침 너머 보존 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 전술판(localStorage `spin.board`, 500ms 디바운스)이나 드릴(IndexedDB 자동 저장,
// 800ms 디바운스 + 정착 억제 창)이 새로고침 뒤 옛 자세로 돌아오는 것. 특히 WebKit 의 IndexedDB 와 실제
// 페이지 수명(언로드)은 fake-indexeddb·jsdom 이 흉내 내지 못한다. 저장이 끝났다는 신호(다리 autosave
// 'saved')를 기다린 뒤 새로고침한다 — 기다리지 않고 새로고침했을 때 잃는가는 다른 질문이다(계획 §8).
import { at, check, defineGroup, eventually, expectQuiet, poseKey, shift } from './kit.ts';

export default defineGroup('persist', [
  {
    title: 'S8a 전술판 새로고침 보존',
    needs: ['reload'],
    run: async (app) => {
      await app.placeFromTray('chair', at(0.3, 0.6), { via: 'tap', team: 'home' });
      const ball = await app.placeFromTray('ball', at(0.6, 0.4), { via: 'drag' });
      const from = await app.objectCenter(ball);
      check(from !== null, '공이 화면에 없다');
      await app.drag(from, shift(from, -50, 40));
      await app.settled();
      const before = poseKey(await app.objects());

      await eventually('전술판 저장', () => app.autosave(), 'saved', { timeout: 5_000 });
      await app.reload();
      await app.settled();
      check(poseKey(await app.objects()) === before, '새로고침 뒤 전술판 자세가 다르다', await app.objects());
      await expectQuiet(app, 'S8a');
    },
  },
  {
    title: 'S8b 드릴 자동 저장 보존',
    seed: { profile: 'scenes', route: '/drills' },
    needs: ['reload'],
    run: async (app) => {
      // 시드(규칙 장면)는 앱이 스스로 심는다 — 카드가 생길 때까지 기다렸다 첫 장을 연다
      await app.openDrillCard(0);
      await app.settled();
      const objects = await app.objects();
      const ball = objects.find((o) => o.kind === 'ball') ?? objects.find((o) => o.kind === 'cone');
      check(!!ball, '시드 드릴에 공·콘이 없다', objects.map((o) => o.kind));
      const from = await app.objectCenter(ball.id);
      check(from !== null, '끌 개체가 화면에 없다');
      await app.drag(from, shift(from, 40, 25));
      await app.settled();
      const before = poseKey(await app.objects());
      check(before !== poseKey(objects), '끈 뒤 드릴 자세가 그대로다');

      await eventually('드릴 자동 저장', () => app.autosave(), 'saved', { timeout: 8_000 });
      const path = await app.path();
      await app.reload();
      check((await app.path()) === path, '새로고침 뒤 다른 드릴이 열렸다', await app.path());
      await app.settled();
      check(poseKey(await app.objects()) === before, '새로고침 뒤 드릴 자세가 다르다', await app.objects());
      await expectQuiet(app, 'S8b');
    },
  },
]);
