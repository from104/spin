// S19 휠체어 조정 모드(키보드·화면 조이스틱) — docs/PLAN-SIMPLE-DRIVE.md 결정 B·C2, 2026-11-17 기현님 지시.
//
// 지우면 새는 실기 버그(jsdom 에 없는 것 — 진짜 키 누름이 이어지는 동안 rAF 루프·Matter 가 도는 것, 상태 커밋 주기):
//  · 키를 누르고 있는데 휠체어가 **보는 쪽**이 아니라 화면 방향으로 가거나 안 가는 것(keymap drive 층·운동학 배선)
//  · 밀린 공이 상태에 안 남거나, 되돌리기 한 번에 휠체어만 돌아오고 공은 남는 것(B7 한 칸·PLACE_SETTLE)
//  · 키를 누른 채 벽까지 가면 판 밖으로 나가는 것(쥔 칩은 static 이라 Matter 벽이 안 막는다 — 걸음마다 경계, 8038332)
//  · 심플 모드·상호작용 꺼짐에서 들어가지는 것, 심플을 켜도 모드가 남는 것(B1 게이트) — 터치 기기에서도(4프로젝트)
//  · 조이스틱 손잡이를 위로 끌어도 안 가거나 화면 위로 가는 것(위 = **보는 쪽**, 세로 휴대폰은 코트가 90° 돈다), 놓아도 계속 가는 것,
//    조이스틱을 만진 것이 '다른 입력 = 나가기' 로 읽혀 모드가 끝나는 것, 진짜 터치(CDP)로 끌 때 포인터 캡처·touch-action 이 안 먹는 것,
//    조이스틱이 [끝] 단추를 가리는 것
// 거리·속도의 정확한 값은 재지 않는다 — 스위트가 부하에 약하다(산수는 src/drive/model.test.ts·src/physics/drive.test.ts 가 본다).
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectQuiet, objectById } from './kit.ts';

async function interactOn(app: SpinApp): Promise<void> {
  await app.press('fn-court');
  await eventually('보드 설정 모달', () => app.dialogs(), (d) => d.includes('court-modal'));
  await app.press('court-toggle-interact');
  await app.pressKey('Escape');
  await eventually('보드 설정 모달 닫힘', () => app.dialogs(), (d) => !d.includes('court-modal'));
}

/** 휠체어 **하나만** 고른다 — 방금 놓은 개체는 이미 골라져 있고, 고른 것을 다시 누르면 풀린다(재탭 해제). 그래서 빈 곳을 눌러
 *  먼저 비운다(Esc 는 떠 있는 토스트·포커스 자리에 따라 선택까지 안 갈 수 있다 — 실측). */
async function selectOnly(app: SpinApp, chair: string): Promise<void> {
  await app.tap(await app.courtToScreen(at(0.2, 0.85)));
  await app.settled();
  const c = await app.objectCenter(chair);
  check(c !== null, '휠체어가 화면에 없다');
  await app.tap(c);
  await app.settled();
}

/** 휠체어를 고르고 J — 조정 모드 띠가 뜰 때까지. */
async function enterDrive(app: SpinApp, chair: string): Promise<void> {
  await selectOnly(app, chair);
  await app.pressKey('j');
  await eventually('조정 모드 띠', () => app.present('drive-strip'), true);
}

/** 보는 쪽 단위벡터(월드). 저장 각도는 θ 와 같은 방향이다. */
const heading = (o: { angleDeg: number }): { x: number; y: number } => ({
  x: Math.cos((o.angleDeg * Math.PI) / 180),
  y: Math.sin((o.angleDeg * Math.PI) / 180),
});

export default defineGroup('drive', [
  {
    title: 'S19 키보드로 몰아 공 밀기',
    needs: ['pointer', 'keyboard'],
    run: async (app) => {
      await interactOn(app);
      const chair = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
      const c0 = await objectById(app, chair);
      const h = heading(c0);
      check(Math.abs(h.x) > 0.7, '골대를 보고 놓이는 휠체어가 가로를 안 본다(전제 실패)', c0);
      // 공은 휠체어가 **보는 쪽**에 — 화면 방향과 무관하게 W 는 그쪽이다
      const ball = await app.placeFromTray('ball', at(h.x > 0 ? 0.57 : 0.43, 0.5), { via: 'drag' });
      const b0 = await objectById(app, ball);
      await enterDrive(app, chair);

      await app.keyDown('w');
      try {
        await eventually('W 를 누르고 있으면 공이 밀린다', () => objectById(app, ball), (b) => Math.hypot(b.x - b0.x, b.y - b0.y) > 5, { timeout: 8000 });
      } finally {
        await app.keyUp('w');
      }
      const c1 = await objectById(app, chair);
      const along = (c1.x - c0.x) * h.x + (c1.y - c0.y) * h.y;
      check(along > 5, '휠체어가 보는 쪽으로 가지 않았다', { c0, c1 });

      await app.pressKey('Escape');
      await eventually('Esc 로 모드가 끝난다', () => app.present('drive-strip'), false);
      await app.settled();
      const b1 = await objectById(app, ball);
      check(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 5, '밀린 공이 상태에 안 남았다', { b0, b1 });

      await app.undo();
      await app.settled();
      const c2 = await objectById(app, chair);
      const b2 = await objectById(app, ball);
      check(Math.hypot(c2.x - c0.x, c2.y - c0.y) < 0.5 && Math.hypot(b2.x - b0.x, b2.y - b0.y) < 0.5, '되돌리기 한 번에 휠체어·공이 제자리로 안 돌아왔다', {
        c0,
        c2,
        b0,
        b2,
      });
      await expectQuiet(app, 'S19');
    },
  },
  {
    // 쥔 휠체어는 static 이라 Matter 벽이 막지 않는다 — 걸음마다 경계(sweepTo·driveStep 공용 placeSweptChair)가 막는다.
    // "키를 쥔 채로 **선다**" 가 곧 증명이다: 경계가 없으면 판 밖으로 끝없이 가서 이 기다림이 시간 초과로 빨개진다.
    title: 'S19b 벽에서 선다',
    needs: ['pointer', 'keyboard'],
    run: async (app) => {
      await interactOn(app);
      const chair = await app.placeFromTray('chair', at(0.9, 0.3), { via: 'drag', team: 'home' });
      const c0 = await objectById(app, chair);
      const toWall = heading(c0).x > 0 ? 'w' : 's'; // +x 벽(가까운 쪽)으로 — 등을 대고 있으면 후진
      await enterDrive(app, chair);
      await app.pressKey('5');

      await app.keyDown(toWall);
      try {
        let last = c0;
        let since = Date.now();
        await eventually(
          '키를 쥔 채 벽에 닿아 선다',
          () => objectById(app, chair),
          (c) => {
            if (Math.hypot(c.x - last.x, c.y - last.y) > 0.05) {
              last = c;
              since = Date.now();
            }
            // 커밋은 0.5 s 마다다 — 1.2 s 동안 그대로면 섰다
            return c.x - c0.x > 5 && Date.now() - since > 1200;
          },
          { timeout: 10000 },
        );
      } finally {
        await app.keyUp(toWall);
      }
      await app.pressKey('Escape');
      await eventually('Esc 로 모드가 끝난다', () => app.present('drive-strip'), false);
      await app.settled();
      await app.pressKey('Escape'); // 선택 테두리를 걷는다 — 상자는 차체만
      const field = await app.rectOf('court-surface');
      const box = await app.objectBox(chair);
      check(field !== null && box !== null, '판·휠체어가 화면에 없다');
      const tol = 0.15 * Math.min(box.right - box.left, box.bottom - box.top); // 테두리 선 반 굵기(S18c 와 같은 허용치)
      check(
        box.left >= field.left - tol && box.top >= field.top - tol && box.right <= field.right + tol && box.bottom <= field.bottom + tol,
        '벽까지 몬 휠체어의 차체가 판 밖이다',
        { box, field },
      );
      await expectQuiet(app, 'S19b');
    },
  },
  {
    // B1 게이트 — 상호작용 꺼짐·심플 모드에서는 들어가지 않고, 모드 중 심플을 켜면 끝난다. 대조군: 상호작용을 켜면 같은 J 가 들어간다.
    title: 'S19c 쓸 수 있을 때만',
    needs: ['keyboard'],
    run: async (app) => {
      const chair = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
      await selectOnly(app, chair);
      await app.pressKey('j');
      await app.settled();
      check(!(await app.present('drive-strip')), '상호작용이 꺼져 있는데 조정 모드에 들어갔다');

      await interactOn(app);
      // 대조군 — 같은 손짓이 이제는 들어간다. J 를 **쥐고** 들어간다: 두 번째 down 은 자동 반복(repeat)이라 모드 안에서
      // '조정 키가 아닌 아무 키 = 나가기' 로 읽히면 들어가자마자 나간다(첫 판의 실수).
      await selectOnly(app, chair);
      await app.keyDown('j');
      await app.keyDown('j');
      await app.keyUp('j');
      await eventually('J 를 쥐고 들어가도 모드가 남는다', () => app.present('drive-strip'), true);
      await app.press('fn-simple');
      await eventually('심플 모드를 켜면 조정 모드가 끝난다', () => app.present('drive-strip'), false);
      await app.pressKey('j');
      await app.settled();
      check(!(await app.present('drive-strip')), '심플 모드에서 조정 모드에 들어갔다');
      await app.press('fn-simple');
      await expectQuiet(app, 'S19c');
    },
  },
  {
    // 들어가기는 J(터치 프로젝트도 키보드 능력이 있다), 몰기는 조이스틱, 나오기는 [끝] — 터치 손의 한 바퀴. 마우스 프로젝트는 같은 판을
    // 마우스로 끈다(조이스틱은 터치 전용이 아니다).
    title: 'S19d 조이스틱으로 몰기',
    needs: ['keyboard'],
    run: async (app) => {
      await interactOn(app);
      const chair = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
      const c0 = await objectById(app, chair);
      const h = heading(c0);
      await enterDrive(app, chair);
      check(await app.onTop('drive-end'), '조이스틱(또는 다른 것)이 [끝] 단추를 가린다');
      // 속도 [+] — 터치에는 1–5 키가 없다. 누른 뒤에도 모드가 남아야 한다(단추 누름이 '다른 입력 = 나가기' 로 새지 않게).
      check(!(await app.rootText()).includes('4/5'), '전제: 처음 속도가 4 가 아니어야 한다');
      await app.press('drive-speed-up');
      await eventually('[+] 로 속도가 한 단계 오른다', async () => (await app.rootText()).includes('4/5'), true);
      check(await app.present('drive-strip'), '속도 단추를 누르자 조정 모드가 끝났다');
      const stick = await app.centerOf('drive-stick');
      check(stick !== null && (await app.onTop('drive-stick')), '조이스틱이 화면에 없거나 가려졌다');

      // 손잡이를 위로 끝까지(받침 밖까지 끌어도 손잡이는 받침 안에 갇힌다) — 쥔 채로 휠체어가 보는 쪽으로 가기를 기다린다
      await app.drag(stick, { x: stick.x, y: stick.y - 200 }, {
        whileHeld: () =>
          eventually(
            '손잡이를 위로 쥐고 있으면 보는 쪽으로 간다',
            () => objectById(app, chair),
            (c) => (c.x - c0.x) * h.x + (c.y - c0.y) * h.y > 8,
            { timeout: 8000 },
          ),
      });
      // 놓으면 선다 — 1.2 s 동안 그대로면 섰다(커밋은 0.5 s 마다)
      let last = await objectById(app, chair);
      let since = Date.now();
      await eventually(
        '손을 떼면 선다',
        () => objectById(app, chair),
        (c) => {
          if (Math.hypot(c.x - last.x, c.y - last.y) > 0.05) {
            last = c;
            since = Date.now();
          }
          return Date.now() - since > 1200;
        },
        { timeout: 6000 },
      );
      check(await app.present('drive-strip'), '조이스틱을 쓰자 조정 모드가 끝났다');
      const c1 = await objectById(app, chair);
      check((c1.x - c0.x) * h.x + (c1.y - c0.y) * h.y > 8, '휠체어가 보는 쪽으로 가지 않았다', { c0, c1 });

      await app.press('drive-end');
      await eventually('[끝] 으로 모드가 끝난다', () => app.present('drive-strip'), false);
      check(!(await app.present('drive-joystick')), '모드가 끝났는데 조이스틱이 남았다');
      await app.settled();
      await app.undo();
      await app.settled();
      const c2 = await objectById(app, chair);
      check(Math.hypot(c2.x - c0.x, c2.y - c0.y) < 0.5, '되돌리기 한 번에 휠체어가 제자리로 안 돌아왔다', { c0, c2 });
      await expectQuiet(app, 'S19d');
    },
  },
]);
