// S11 더블탭 미세 조정 — docs/PLAN-TEST-SUITE.md §5. (2026-11-14 기현 지시: "메모를 제외한 오브젝트를 더블 클릭 시
// 미세 조정 기능 켜기")
//
// 지우면 새는 실기 버그: 실제 포인터 열에서 더블탭이 판 이동 무장이나 선택으로 새어 미세 조정 패드가 안 뜨는 것
// (`CourtStage` 가 첫 누름에서 포인터를 캡처해 브라우저의 dblclick 이 무대로 재타깃된다 — 그래서 앱이 두 번의
// pointerdown 을 직접 잰다. jsdom 은 포인터 캡처가 없어 이 사고를 못 잰다), 패드의 한 번이 한 칸이 아닌 것(또는
// 회전한 코트에서 화면 방향이 아닌 것), 메모를 더블탭하면 패드가 뜨는 것(메모는 **글 열기**).
//
// 더블탭은 350ms·12px 안의 두 pointerdown 이라 벽시계에 기대지만, 이 시나리오는 그 경주를 **버그 증상으로 삼지
// 않는다** — 느린 기계에서 패드가 안 뜨면 "패드가 안 떴다" 로 곧장 실패하는 정상 실패이고, knownBug 가 아니다.
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectQuiet, objectById } from './kit.ts';

/** 휠체어가 **화면에서** 보는 방향(단위 벡터) — 저장 각도를 판 좌표의 짧은 선분으로 그려 화면으로 옮긴다(코트 회전 포함) */
async function screenFacing(app: SpinApp, id: string): Promise<{ x: number; y: number }> {
  const o = await objectById(app, id);
  const a = (o.angleDeg * Math.PI) / 180;
  const p0 = await app.worldToScreen({ x: o.x, y: o.y });
  const p1 = await app.worldToScreen({ x: o.x + Math.cos(a) * 20, y: o.y + Math.sin(a) * 20 });
  const n = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  return { x: (p1.x - p0.x) / n, y: (p1.y - p0.y) / n };
}

/** 패드가 열려 있으면 닫는다(아무 키나 닫는다) */
async function closePad(app: SpinApp): Promise<void> {
  await app.pressKey('Escape');
  await eventually('패드 닫힘', () => app.present('nudge-pad'), false);
}

/** 메모 하나를 놓고 글을 저장한 뒤 선택 도구로 돌아와, 메모가 있는 코트 점을 돌려준다 */
async function placeNote(app: SpinApp) {
  await app.press('tray-item-note');
  const spot = at(0.45, 0.15);
  await app.tap(spot);
  await eventually('새 메모의 글 대화 상자', () => app.dialogs(), (d) => d.includes('note-edit-modal'));
  await app.pressKey('x');
  await app.press('note-save');
  await eventually('글 대화 상자 닫힘', () => app.dialogs(), (d) => !d.includes('note-edit-modal'));
  // 더블탭은 선택 도구에서만 먹는다 — 메모 도구는 놓은 뒤에도 켜져 있다
  await app.press('tray-item-select');
  return spot;
}

export default defineGroup('nudge', [
  {
    title: 'S11 더블탭 패드와 한 칸',
    needs: ['keyboard'],
    run: async (app) => {
      // 끌어다 놓는다 — 탭으로 놓고 곧바로 다시 누르면 놓기 탭과 합쳐진다(앱 버그 S5b)
      const chair = await app.placeFromTray('chair', at(0.3, 0.5), { via: 'drag', team: 'home' });
      const ball = await app.placeFromTray('ball', at(0.6, 0.3), { via: 'drag' });
      const cone = await app.placeFromTray('cone', at(0.6, 0.7), { via: 'drag' });

      for (const [kind, id] of [['휠체어', chair], ['공', ball], ['콘', cone]] as const) {
        await app.step(`${kind} 더블탭`, async () => {
          const c = await app.objectCenter(id);
          check(c !== null, `${kind} 가 화면에 없다`);
          await app.doubleTap(c);
          await eventually(`${kind}: 패드가 뜸`, () => app.present('nudge-pad'), true);
          // 방향판은 휠체어 하나일 때만(NudgePad) — 공·콘에 뜨면 돌릴 것이 없는 칸 아홉이 코트를 가린다
          const heading = await app.present('nudge-face-flip');
          check(heading === (kind === '휠체어'), `${kind}: 방향판이 ${heading ? '떴다' : '안 떴다'}`);
          await closePad(app);
        });
      }

      await app.step('한 번 = 한 칸 (휠체어, 화면 오른쪽)', async () => {
        const c = await app.objectCenter(chair);
        check(c !== null, '휠체어가 화면에 없다');
        await app.doubleTap(c);
        await eventually('패드가 뜸', () => app.present('nudge-pad'), true);
        const p0 = await app.worldToScreen(await objectById(app, chair));
        await app.press('nudge-right');
        await app.settled();
        const p1 = await app.worldToScreen(await objectById(app, chair));
        await app.press('nudge-right');
        await app.settled();
        const p2 = await app.worldToScreen(await objectById(app, chair));
        const d1 = p1.x - p0.x;
        const d2 = p2.x - p1.x;
        check(d1 > 0.5 && Math.abs(p1.y - p0.y) < 0.5, `[→] 한 번이 화면 오른쪽 한 칸이 아니다 — (dx ${d1.toFixed(2)}, dy ${(p1.y - p0.y).toFixed(2)})`);
        check(Math.abs(d2 - d1) < 1, `[→] 두 번째가 첫 번째와 같은 한 칸이 아니다 — ${d1.toFixed(2)} vs ${d2.toFixed(2)}`);
        await closePad(app);
      });

      await app.step('방향판 — 화살표는 화면 방향을 보게, 가운데는 180°', async () => {
        // 화면 기준이다 — 세로 창(코트가 돌아간 휴대폰)에서도 [→] 는 화면 오른쪽을 보게 해야 한다
        const c = await app.objectCenter(chair);
        check(c !== null, '휠체어가 화면에 없다');
        await app.doubleTap(c);
        await eventually('패드가 뜸', () => app.present('nudge-pad'), true);
        for (const [testId, want] of [
          ['nudge-face-right', { x: 1, y: 0 }],
          ['nudge-face-flip', { x: -1, y: 0 }],
          ['nudge-face-upLeft', { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }],
          ['nudge-face-flip', { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
        ] as const) {
          await app.press(testId);
          await app.settled();
          const v = await screenFacing(app, chair);
          check(
            Math.hypot(v.x - want.x, v.y - want.y) < 0.06,
            `[${testId}] 뒤 휠체어가 화면 (${want.x.toFixed(2)}, ${want.y.toFixed(2)}) 쪽을 안 본다 — (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`,
          );
        }
        check(await app.present('nudge-pad'), '방향판을 눌렀더니 패드가 닫혔다 — 여러 번 맞추는 판이다');
        await closePad(app);
      });

      await app.step('메모는 패드가 아니라 글 열기', async () => {
        const spot = await placeNote(app);
        // 고르기를 풀고 누른다 — 놓은 직후 350ms 안에 메모를 더블클릭하면 **첫 누름**이 메모를 놓던 탭과 합쳐져 더블로
        // 판정되어 글 상자가 열리고, 두 번째 누름이 그 상자의 백드롭(pointerdown 에 닫힘)에 떨어져 곧바로 닫힌다 — S5b 와
        // 같은 뿌리(CourtStage 의 lastDownRef 가 첫 누름의 대상을 안 본다). 벽시계 경주라 knownBug 로 못박지 않는다(검토 탐침
        // 2026-11-15: 두 엔진 모두 간격 184ms 에서 재현, 400ms 에서 정상)
        await app.tap(at(0.85, 0.5));
        await app.doubleTap(spot);
        await eventually('메모 더블탭이 글을 연다', () => app.dialogs(), (d) => d.includes('note-edit-modal'));
        check(!(await app.present('nudge-pad')), '메모를 더블탭했는데 미세 조정 패드가 떴다');
      });
      await expectQuiet(app, 'S11');
    },
  },
]);
