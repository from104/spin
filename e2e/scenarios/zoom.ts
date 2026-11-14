// S14 줌 뒤에도 손끝 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: (1) 휠 줌이 커서 밑의 점을 안 붙잡아 확대하려던 자리가 화면 밖으로 달아나는 것 — 앱의
// `zoomAt`·`clientToWorld` 산술은 vitest 가 보지만 **실제 wheel 이벤트(passive:false 로 단 리스너)와 브라우저가 계산한
// 행렬**은 jsdom 에 없다. (2) 줌·팬으로 `viewBox` 가 바뀐 뒤 트레이에서 놓은 개체가 손끝이 아니라 줌 이전 좌표계의
// 자리에 서는 것. (3) 빈 코트 더블클릭 뒤 끌기(판 이동)가 판을 손이 끈 만큼 밀지 않는 것 — 무장(`panArmed`)은 두 번의 실제
// pointerdown 간격으로 정해진다. 판정자는 브라우저의 `getScreenCTM()`(viewBox 반영)이라 앱 산술과 독립이다.
import { at, defineGroup, eventually, expectNear, expectQuiet, shift } from './kit.ts';

/** 팬으로 끄는 거리(화면 px) */
const PAN_PX = 60;

export default defineGroup('zoom', [
  {
    title: 'S14 줌·팬 뒤 손끝',
    needs: ['pointer'],
    run: async (app) => {
      const span = async () => {
        const a = await app.courtToScreen(at(0, 0));
        const b = await app.courtToScreen(at(1, 1));
        return Math.hypot(b.x - a.x, b.y - a.y);
      };
      const base = await span();

      await app.step('휠 확대는 커서 밑의 점을 붙든다', async () => {
        const focus = at(0.7, 0.3);
        const before = await app.courtToScreen(focus);
        await app.wheel(before, -300);
        await eventually('확대됨', span, (s) => s > base * 1.15);
        expectNear('확대 뒤 커서 밑의 점', await app.courtToScreen(focus), before);
      });

      await app.step('다른 자리에서 한 번 더', async () => {
        const focus = at(0.5, 0.55);
        const before = await app.courtToScreen(focus);
        const zoomed = await span();
        await app.wheel(before, -300);
        await eventually('더 확대됨', span, (s) => s > zoomed * 1.1);
        expectNear('두 번째 확대 뒤 커서 밑의 점', await app.courtToScreen(focus), before);
      });

      await app.step('빈 코트 더블클릭 뒤 끌기 — 팬', async () => {
        // 판 이동은 빈 자리 더블클릭으로 무장하고 끈다(CourtStage 의 panArmed). 판은 손이 끈 만큼 따라와야 한다
        const grip = await app.courtToScreen(at(0.42, 0.62));
        const probe = at(0.5, 0.55);
        const before = await app.courtToScreen(probe);
        await app.doubleTap(grip);
        await app.drag(grip, shift(grip, PAN_PX, 0), { steps: 12 });
        await app.settled();
        expectNear('팬 뒤 코트 점이 끈 만큼 따라옴', await app.courtToScreen(probe), shift(before, PAN_PX, 0));
      });

      await app.step('줌·팬 뒤 놓은 자리가 손끝 아래', async () => {
        const tap = at(0.5, 0.55);
        const finger = await app.courtToScreen(tap);
        const viaTap = await app.placeFromTray('ball', tap, { via: 'tap' });
        expectNear('줌 뒤 탭으로 놓은 공', await app.objectCenter(viaTap), finger);

        const drop = at(0.45, 0.5);
        const fingerDrag = await app.courtToScreen(drop);
        const viaDrag = await app.placeFromTray('cone', drop, { via: 'drag' });
        expectNear('줌 뒤 끌어다 놓은 콘', await app.objectCenter(viaDrag), fingerDrag);
      });
      await expectQuiet(app, 'S14');
    },
  },
]);
