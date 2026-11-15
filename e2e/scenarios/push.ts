// S17 끌어서 밀기 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: [보드 설정] 의 물리·상호작용을 켠 채 휠체어를 다른 휠체어로 끌었는데 상대가 안 밀리고 겹쳐 지나가는
// 것(켬 스위치 → 물리 루프 배선, 충돌 마스크). 충돌 수치는 vitest 가 보지만(물리 모듈 단위) **실제 포인터 이벤트 주기 위에서
// Matter.js 루프가 도는 것**과 손을 뗀 뒤 정착(`settled`)은 jsdom 에 없다. 밀린 거리는 앱 상수로 베끼지 않고 "움직였는가"만 본다.
//
// ⚠️ 계획의 "겹치지 않으며 코트 밖으로 안 나간다" 는 단언하지 않는다 — 돌연변이로 실효를 못 증명했다: 벽 생성과 경계 되밀기
//    (`pushChairIntoBounds`)를 둘 다 빼도 이 흐름에서는 초록이었다(잡은 칩을 막는 drag.ts 가 세 번째 안전망). 겹침도 같은 이유로
//    "밀렸다" 와 따로 증명되지 않는다. 값 없는 단언은 남기지 않는다 — 그 둘은 vitest(`keepInCourt.test.ts` 등)가 본다.
import { at, check, defineGroup, eventually, expectQuiet, objectById, shift } from './kit.ts';

export default defineGroup('push', [
  {
    title: 'S17 휠체어로 휠체어 밀기',
    needs: ['pointer', 'keyboard'], // 보드 설정 모달을 Esc 로 닫는다
    run: async (app) => {
      // 물리·상호작용은 기본 꺼짐이다(2026-11-13 결정) — [보드 설정] 에서 켠다. 이 시나리오는 켠 쪽을 본다
      await app.press('fn-court');
      await eventually('보드 설정 모달', () => app.dialogs(), (d) => d.includes('court-modal'));
      await app.press('court-toggle-interact');
      await app.pressKey('Escape');
      await eventually('보드 설정 모달 닫힘', () => app.dialogs(), (d) => !d.includes('court-modal'));

      const pusher = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
      const pushed = await app.placeFromTray('chair', at(0.75, 0.5), { via: 'drag', team: 'away' });
      const before = await app.worldToScreen(await objectById(app, pushed));

      // 미는 쪽을 상대 너머까지 끌고 간다
      const from = await app.objectCenter(pusher);
      check(from !== null, '미는 휠체어가 화면에 없다');
      await app.drag(from, shift(from, (before.x - from.x) * 1.4, 0), { steps: 30 });
      await app.settled();

      const after = await app.worldToScreen(await objectById(app, pushed));
      check(Math.hypot(after.x - before.x, after.y - before.y) > 5, '밀었는데 상대 휠체어가 안 움직였다', { before, after });
      await expectQuiet(app, 'S17');
    },
  },
  {
    // 2026-11-16 기현님 지시 — 키보드·[미세 조정] 이동도 이웃과 부딪힌다(엔진 settleAfterNudge → 정착 덧쓰기 PLACE_SETTLE).
    // 지우면 새는 것: 순간이동(setPose)만 하고 정착을 안 맡겨 공을 뚫고 지나가는 것, 정착은 했는데 밀린 공이 **상태에 안 남아**
    // 새로고침·스텝 전환 뒤 옛 자리로 돌아가는 것(objectById 는 상태를 읽는다), 되돌리기가 공을 두고 휠체어만 돌리는 것.
    title: 'S17b 키보드로 휠체어를 밀어 공을 밀기 — 되돌리기 한 번에 함께',
    needs: ['pointer', 'keyboard'],
    run: async (app) => {
      await app.press('fn-court');
      await eventually('보드 설정 모달', () => app.dialogs(), (d) => d.includes('court-modal'));
      await app.press('court-toggle-interact');
      await app.pressKey('Escape');
      await eventually('보드 설정 모달 닫힘', () => app.dialogs(), (d) => !d.includes('court-modal'));

      const chair = await app.placeFromTray('chair', at(0.4, 0.5), { via: 'drag', team: 'home' });
      const ball = await app.placeFromTray('ball', at(0.46, 0.5), { via: 'drag' });
      const b0 = await objectById(app, ball);
      // 방향키는 **화면** 기준이다 — 코트가 돈 세로 창에서는 판의 +x 가 화면 위·아래다. 화면에서 공이 있는 쪽 키를 고른다
      const cs = await app.worldToScreen(await objectById(app, chair));
      const bs = await app.worldToScreen(b0);
      const dx = bs.x - cs.x;
      const dy = bs.y - cs.y;
      const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';

      const c = await app.objectCenter(chair);
      check(c !== null, '휠체어가 화면에 없다');
      await app.tap(c);
      await app.settled();
      for (let i = 0; i < 4; i++) await app.pressKey(`Shift+${arrow}`); // 큰 걸음 × 4 — 공 자리를 지나간다
      await app.settled();

      const b1 = await objectById(app, ball);
      const ch1 = await objectById(app, chair);
      check(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 5, '키보드로 밀었는데 공이 안 움직였다(또는 상태에 안 남았다)', { arrow, b0, b1, ch1 });

      await app.undo();
      await app.settled();
      const b2 = await objectById(app, ball);
      check(Math.hypot(b2.x - b0.x, b2.y - b0.y) < 0.5, '되돌리기 한 번에 공이 제자리로 안 돌아왔다', { b0, b2 });
      await expectQuiet(app, 'S17b');
    },
  },
]);
