// S4·S5·S6 — 코트 위 손끝: 놓기, 끌기·되돌리기, 돌아간 코트. docs/PLAN-TEST-SUITE.md §5.
//
// 판정이 자기증명이 되지 않게 두 경로를 맞댄다(계획 §4): 누른 화면 점 ↔ 개체의 **실제 화면 bbox 중심**
// (`#obj-<id>`)은 화면 px 로, 되돌리기·다시하기는 **모델 자세**(다리 objects())로 본다. 화면 점은 브라우저의
// getScreenCTM() 으로 푼다 — 앱의 clientToWorld 와 독립이라, 그 산술이 회전·배율에서 어긋나면 여기가 빨개진다.
//
// 휠체어는 bbox 중심이 자세 점(축)이 아니다 — 차체 그림이 앞뒤로 비대칭이라 11px 남짓 어긋난다(탐침 실측).
// 그래서 휠체어는 "모델 자세를 CTM 으로 화면에 투영한 점" 을, 공은 bbox 중심을 손끝과 견준다.
//
// ⚠️ 끌 개체는 **트레이에서 끌어다 놓은 것**을 쓴다. 코트를 탭해 놓은 개체를 350ms 안에 다시 누르면 놓기 탭과
//    합쳐져 더블탭(미세 조정 패드)이 된다 — 그 앱 버그는 S5b 가 따로 붙잡고 있다. 끌어다 놓기는 무대에 누름을
//    남기지 않으므로(누름은 트레이 칩에서 시작한다) 끌기 시험이 그 버그에 휘말리지 않는다.
import { at, check, defineGroup, eventually, expectCtmMatchesLayout, expectNear, expectQuiet, objectById, shift } from './kit.ts';

export default defineGroup('court', [
  {
    // 지우면 새는 실기 버그: 트레이 칩의 setPointerCapture·실제 좌표 경로(useTrayDrag)가 깨져 놓은 자리가
    // 손끝에서 벗어나거나(배율·회전 산술), 탭으로 든 선수가 코트 탭에 안 내려앉는 것. jsdom 은 rect 가 0 이라
    // 이 경로의 좌표를 한 번도 실제 값으로 못 돈다. 터치(chromium-mobile)는 pointerType 'touch' 로 간다.
    title: 'S4 놓은 자리가 손끝 아래',
    run: async (app) => {
      await app.step('판정자 자체 검증 — CTM == 레이아웃(계획 §8 위험 2)', () => expectCtmMatchesLayout(app));

      await app.step('휠체어: 칩 탭 → 코트 탭', async () => {
        const target = at(0.3, 0.55);
        const finger = await app.courtToScreen(target);
        const id = await app.placeFromTray('chair', target, { via: 'tap', team: 'home' });
        const chair = await objectById(app, id);
        check(chair.team === 'home', '놓인 휠체어의 팀', chair.team);
        expectNear('휠체어 자세 점(모델→CTM)', await app.worldToScreen(chair), finger);
      });

      await app.step('공: 칩을 코트까지 끌어다 놓기', async () => {
        const target = at(0.7, 0.35);
        const finger = await app.courtToScreen(target);
        const id = await app.placeFromTray('ball', target, { via: 'drag' });
        expectNear('공의 화면 중심(#obj bbox)', await app.objectCenter(id), finger);
        expectNear('공 자세 점(모델→CTM)', await app.worldToScreen(await objectById(app, id)), finger);
      });

      await expectQuiet(app, 'S4');
    },
  },
  {
    // 지우면 새는 실기 버그: 진짜 pointermove 열과 rAF 변환 쓰기(transformWriter)를 거친 끌기가 손을 못 따라가는
    // 것, 되돌리기가 원위치가 아닌 "근처" 로 돌아가는 것(정착 재커밋이 히스토리를 둘로 쪼개면 그렇게 된다).
    title: 'S5 끌기·되돌리기·다시하기',
    run: async (app) => {
      const id = await app.placeFromTray('ball', at(0.4, 0.5), { via: 'drag' });
      const before = await objectById(app, id);
      const from = await app.objectCenter(id);
      check(from !== null, '공이 화면에 없다');

      const to = shift(from, 70, 35);
      await app.drag(from, to);
      await app.settled();
      expectNear('끈 뒤 공의 화면 중심', await app.objectCenter(id), to);
      const moved = await objectById(app, id);
      check(moved.x !== before.x || moved.y !== before.y, '끈 뒤 모델 자세가 그대로다', moved);

      await app.undo();
      await app.settled();
      const undone = await objectById(app, id);
      check(undone.x === before.x && undone.y === before.y, `되돌린 자세가 원위치가 아니다 — 기대 (${before.x}, ${before.y})`, undone);
      expectNear('되돌린 뒤 화면 중심', await app.objectCenter(id), from);

      await app.redo();
      await app.settled();
      const redone = await objectById(app, id);
      check(redone.x === moved.x && redone.y === moved.y, `다시한 자세가 끈 자리가 아니다 — 기대 (${moved.x}, ${moved.y})`, redone);
      expectNear('다시한 뒤 화면 중심', await app.objectCenter(id), to);
      await expectQuiet(app, 'S5');
    },
  },
  {
    // 지우면 새는 실기 버그: "놓자마자 자리를 고친다" 는 배치의 기본 흐름(§6.10a — 놓으면 그것이 선택된다)이
    // 손이 빠른 사람에게만 막히는 것. 놓기 탭과 다음 누름이 350ms·12px 안이면 더블탭으로 묶인다.
    // 2026-11-15 고침: 더블 판정이 두 누름의 대상이 같은지 본다(CourtStage lastDownRef.id).
    title: 'S5b 놓자마자 끌기',
    run: async (app) => {
      const finger = await app.courtToScreen(at(0.45, 0.5));
      const to = shift(finger, 60, 30);
      // 사람이 하듯 이어서: 칩을 들고 → 코트를 탭해 놓고 → 그대로 잡아 끈다(사이에 기다림을 두지 않는다)
      await app.pickFromTray('ball');
      await app.tap(finger);
      await app.drag(finger, to);
      await app.settled();
      check(!(await app.present('nudge-pad')), '끌었는데 미세 조정 패드(nudge-pad)가 떴다');
      const ball = (await app.objects()).find((o) => o.kind === 'ball');
      check(!!ball, '공이 놓이지 않았다');
      expectNear('곧바로 끈 공의 화면 중심', await app.objectCenter(ball.id), to);
    },
  },
  {
    // 지우면 새는 실기 버그: 세로 화면에서 코트가 90° 돌아갔을 때 탭·끌기가 손끝을 못 따라가는 것(회전 판정이
    // 뷰포트·크롬 실측에 달려 jsdom 에선 안 선다 — useStageRot.ts), 화살표 키가 화면이 아니라 월드 축으로 미는 것.
    // 데스크톱 엔진은 창을 세로(800×1280)로 돌려 같은 판정을 받는다.
    title: 'S6 돌아간 코트의 손끝과 화살표',
    needs: ['keyboard'],
    run: async (app) => {
      if (app.capabilities.has('resize')) await app.resize(800, 1280);
      await eventually('코트 회전', () => app.courtRot(), 90);
      await app.step('판정자 자체 검증 — 돌아간 CTM == 레이아웃', () => expectCtmMatchesLayout(app));

      await app.step('탭으로 놓기', async () => {
        const target = at(0.3, 0.3);
        const finger = await app.courtToScreen(target);
        const id = await app.placeFromTray('ball', target, { via: 'tap' });
        expectNear('돌아간 코트에 탭으로 놓은 공', await app.objectCenter(id), finger);
      });

      const target = at(0.65, 0.6);
      const finger = await app.courtToScreen(target);
      const id = await app.placeFromTray('ball', target, { via: 'drag' });
      expectNear('돌아간 코트에 끌어다 놓은 공', await app.objectCenter(id), finger);

      const to = shift(finger, 40, 60);
      await app.drag(finger, to);
      await app.settled();
      expectNear('돌아간 코트에서 끈 공', await app.objectCenter(id), to);

      // 공을 눌러 고른 뒤 → 키 — 화살표는 화면 기준이어야 한다. 누르기를 먼저 하는 이유: 화살표는 초점이 판
      // 안에 있어야 먹는데, 터치 **끌기**는 브라우저가 탭으로 안 쳐서 초점을 옮기지 않는다(마우스는 누르는
      // 순간 옮긴다). 터치·키보드를 함께 쓰는 사람의 흐름도 "눌러 고르고 키" 다. 끈 자리에서 12px 넘게
      // 떨어진 곳에서 끌기를 시작했으므로 이 누르기는 더블탭으로 묶이지 않는다(S5b 참고).
      const before = await app.objectCenter(id);
      check(before !== null, '공이 화면에 없다');
      await app.tap(before);
      await app.settled();
      check(!(await app.present('nudge-pad')), '고르려고 눌렀는데 미세 조정 패드가 떴다');
      await app.pressKey('ArrowRight');
      await app.settled();
      const after = await app.objectCenter(id);
      check(after !== null, '공이 화면에 없다');
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      check(dx > 0.5 && Math.abs(dy) < 0.5, `→ 키 뒤 화면 이동이 오른쪽이 아니다 — (dx ${dx.toFixed(2)}, dy ${dy.toFixed(2)})`);
      await expectQuiet(app, 'S6');
    },
  },
]);
