// S8 새로고침 너머 보존 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 전술판(localStorage `spin.board`, 500ms 디바운스)이나 드릴(IndexedDB 자동 저장,
// 800ms 디바운스 + 정착 억제 창)이 새로고침 뒤 옛 자세로 돌아오는 것. 특히 WebKit 의 IndexedDB 와 실제
// 페이지 수명(언로드)은 fake-indexeddb·jsdom 이 흉내 내지 못한다. 저장이 끝났다는 신호(다리 autosave
// 'saved')를 기다린 뒤 새로고침한다 — 기다리지 않고 새로고침했을 때 잃는가는 다른 질문이다(계획 §8).
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectNear, expectQuiet, poseKey, shift } from './kit.ts';

/** 개체마다 화면에 그려진 자리 — 모델 자세를 CTM 으로 투영한 점과 실제 `#obj-<id>` bbox 중심. 새로고침 뒤 같은 자리에
 *  그려지는지 맞댄다(모델만 맞고 그림이 옛 자리인 복원 버그를 잡는다) */
async function screenPoses(app: SpinApp) {
  const objects = await app.objects();
  return Promise.all(
    objects.map(async (o) => ({ id: o.id, kind: o.kind, pose: await app.worldToScreen(o), drawn: await app.objectCenter(o.id) })),
  );
}

async function expectSameOnScreen(app: SpinApp, before: Awaited<ReturnType<typeof screenPoses>>, where: string): Promise<void> {
  const after = await screenPoses(app);
  check(after.length === before.length, `${where}: 화면에 그려진 개체 수가 다르다`, [before.length, after.length]);
  for (const b of before) {
    const a = after.find((x) => x.id === b.id);
    check(!!a, `${where}: 개체 ${b.id} 가 사라졌다`);
    expectNear(`${where}: ${b.kind} 자세 점(모델→CTM)`, a.pose, b.pose);
    check(b.drawn !== null, `${where}: 새로고침 전에 개체 ${b.id} 가 그려져 있지 않았다`);
    expectNear(`${where}: ${b.kind} 의 그려진 중심`, a.drawn, b.drawn);
  }
}

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
      const beforeScreen = await screenPoses(app);

      await eventually('전술판 저장', () => app.autosave(), 'saved', { timeout: 5_000 });
      await app.reload();
      await app.settled();
      check(poseKey(await app.objects()) === before, '새로고침 뒤 전술판 자세가 다르다', await app.objects());
      await expectSameOnScreen(app, beforeScreen, 'S8a');
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
      const beforeScreen = await screenPoses(app);

      await eventually('드릴 자동 저장', () => app.autosave(), 'saved', { timeout: 8_000 });
      const path = await app.path();
      await app.reload();
      check((await app.path()) === path, '새로고침 뒤 다른 드릴이 열렸다', await app.path());
      await app.settled();
      check(poseKey(await app.objects()) === before, '새로고침 뒤 드릴 자세가 다르다', await app.objects());
      await expectSameOnScreen(app, beforeScreen, 'S8b');
      await expectQuiet(app, 'S8b');
    },
  },
]);
