// S18 심플 모드 — docs/PLAN-SIMPLE-DRIVE.md 결정 A1·A3·A5, C2.
//
// 지우면 새는 실기 버그: (1) [보드 설정] 의 [심플 모드] 를 켰는데 휠체어가 원이 아니라 그대로 차체인 것(prefs → ObjectLayer
// → ChairChip 배선), (2) **저장된 물리·상호작용이 켜져 있는데** 심플 모드가 그것을 끄지 못해 원을 겹쳐 끌면 서로 밀려 나가는 것
// ("원천적으로 물리 없음" 위반 — 월드 setInteract 강제), (3) 화면은 원인데 내보낸 그림만 차체인 것("보이는 것 = 내보내지는 것",
// ExportSheet 의 chairDisc 배선). 원/차체의 구분은 속성이 아니라 **기하**로 본다 — 차체(1.3×0.8 m)는 가로세로비가 1.6 이고
// 원(지름 1.0 m + 방향 눈금)은 1.15 라, 코트가 돌아 있어도 비율 `max(r, 1/r)` 로 가른다. 지름·비율 상수는 베끼지 않고 임계 하나만 둔다.
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectQuiet, objectById, poseKey, shift } from './kit.ts';
import { decoded, difference, exportPng } from './export.ts';

/** 차체는 1.6, 원은 1.15 부근 — 그 사이의 문턱. */
const DISC_MAX_ASPECT = 1.35;

async function openCourtModal(app: SpinApp): Promise<void> {
  await app.press('fn-court');
  await eventually('보드 설정 모달', () => app.dialogs(), (d) => d.includes('court-modal'));
}
async function closeCourtModal(app: SpinApp): Promise<void> {
  await app.pressKey('Escape');
  await eventually('보드 설정 모달 닫힘', () => app.dialogs(), (d) => !d.includes('court-modal'));
}

/** 화면에 보이는 개체의 가로세로 비(길쭉한 쪽 ÷ 짧은 쪽). */
async function aspectOf(app: SpinApp, id: string): Promise<number> {
  const b = await app.objectBox(id);
  check(b !== null, `${id} 가 화면에 없다`);
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  return Math.max(w / h, h / w);
}

export default defineGroup('simple', [
  {
    title: 'S18 심플 모드 — 원이 되고 안 밀린다',
    // 표시(스위치 → 원)는 터치·마우스 어디서나 같다 — 4 프로젝트에서 돈다. 끌기 부분만 마우스('pointer') 능력으로 가른다
    needs: ['keyboard'], // 보드 설정 모달을 Esc 로 닫는다
    run: async (app) => {
      const a = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'tap', team: 'home' });
      const b = await app.placeFromTray('chair', at(0.75, 0.5), { via: 'tap', team: 'away' });
      check((await aspectOf(app, a)) > DISC_MAX_ASPECT, '심플 모드 전인데 휠체어가 이미 원 모양이다(전제 실패)');

      // 물리·상호작용을 **먼저 켜 둔다** — 저장값이 켬이어도 심플 모드가 끄는지가 이 시나리오의 본론이다
      await openCourtModal(app);
      await app.press('court-toggle-interact');
      await closeCourtModal(app);
      await app.press('fn-simple'); // 기능 바 맨 위 토글(2026-11-16 — 모달에서 이사)
      await openCourtModal(app);
      await eventually('잠금 이유 문구', () => app.present('court-simple-note'), true);
      await closeCourtModal(app);

      check((await aspectOf(app, a)) < DISC_MAX_ASPECT, '심플 모드를 켰는데 휠체어가 원이 아니다', await app.objectBox(a));

      if (!app.capabilities.has('pointer')) {
        await expectQuiet(app, 'S18');
        return;
      }
      const before = await app.worldToScreen(await objectById(app, b));
      const from = await app.objectCenter(a);
      check(from !== null, '휠체어가 화면에 없다');
      await app.drag(from, shift(from, (before.x - from.x) * 1.4, 0), { steps: 30 }); // 상대 너머까지 끈다
      await app.settled();
      const after = await app.worldToScreen(await objectById(app, b));
      check(Math.hypot(after.x - before.x, after.y - before.y) < 1, '심플 모드인데 상대가 밀려 났다 — 물리 상호작용이 안 꺼졌다', { before, after });
      await expectQuiet(app, 'S18');
    },
  },
  {
    title: 'S18b 심플 모드 — 내보낸 그림도 원',
    needs: ['download'],
    run: async (app) => {
      await app.press('fn-simple');

      const empty = decoded(await exportPng(app), '빈 판');
      await app.placeFromTray('chair', at(0.2, 0.5), { via: 'drag', team: 'home' });
      const withChair = decoded(await exportPng(app), '휠체어 판');
      const d = difference(empty, withChair);
      check(d.count > 0, '휠체어를 놓았는데 그림이 그대로다');
      // boxW·boxH 는 그림 크기에 대한 비율이라 픽셀로 되돌려 잰다
      const w = d.boxW * empty.width;
      const h = d.boxH * empty.height;
      check(Math.max(w / h, h / w) < DISC_MAX_ASPECT, '심플 모드인데 내보낸 그림의 휠체어가 원이 아니다', { w, h });
      await expectQuiet(app, 'S18b');
    },
  },
  {
    // 지우면 새는 실기 버그: 상호작용이 꺼져 있으면(심플 모드는 늘 끔) 키보드·방향판 이동·회전이 **순간이동**이라 아무도 벽을
    // 지키지 않았다. 방향키만 눌러도 차체가 판 밖으로 나가고, 벽 앞에서 벽 쪽으로 돌면 차체 앞이 판 밖인 채 **저장**된다 —
    // 심플 모드에서는 차체를 안 그리니 보이지도 않는다. 그 칩은 나중에 다른 칩을 끌기만 해도 안전망이 밀어 커밋한다.
    // 판정은 앱 상수 없이: 심플을 끈 뒤 **보이는 차체 상자**가 판(court-surface = 벽 경계, 라인 바깥 여백까지) 상자 안인가, 다른 칩을 끈 뒤 자세가 그대로인가.
    title: 'S18c 심플 모드 — 키로 벽까지 밀고 벽 쪽으로 돌아도 차체는 판 안',
    needs: ['keyboard'],
    run: async (app) => {
      const a = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
      const b = await app.placeFromTray('chair', at(0.5, 0.85), { via: 'drag', team: 'away' });
      await app.press('fn-simple');

      // 화면에서 월드 −x 벽(왼쪽 골라인 쪽)이 어느 쪽인가 — 세로 창에서는 코트가 돌아 있다
      const pa = await objectById(app, a);
      const s0 = await app.worldToScreen(pa);
      const s1 = await app.worldToScreen({ x: pa.x - 100, y: pa.y });
      const dx = s1.x - s0.x;
      const dy = s1.y - s0.y;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const toWall = horiz ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';
      // 숫자키 1·3·5·7 = 화면 위·오른쪽·아래·왼쪽을 본다
      const faceKey = (arrow: string): string => ({ ArrowUp: '1', ArrowRight: '3', ArrowDown: '5', ArrowLeft: '7' })[arrow]!;
      const away = horiz ? (dx > 0 ? 'ArrowLeft' : 'ArrowRight') : dy > 0 ? 'ArrowUp' : 'ArrowDown';

      const c = await app.objectCenter(a);
      check(c !== null, '휠체어가 화면에 없다');
      await app.tap(c);
      await app.settled();
      await app.pressKey(faceKey(away)); // 등을 벽으로
      for (let i = 0; i < 24; i++) await app.pressKey(`Shift+${toWall}`); // 큰 걸음으로 반 코트 넘게 — 벽에서 멈춰야 한다
      await app.pressKey(faceKey(toWall)); // 벽 앞에서 벽 쪽으로 돈다
      await app.settled();
      await app.pressKey('Escape'); // 선택 테두리를 걷는다 — 상자는 차체만

      await app.press('fn-simple');
      const field = await app.rectOf('court-surface');
      const box = await app.objectBox(a);
      check(field !== null && box !== null, '판·휠체어가 화면에 없다');
      // 칩의 테두리 선은 차체 hull 바깥으로 반 굵기만큼 그려진다(실측 화면 1.3–3.7 px). 허용치는 칩 짧은 변의 15% —
      // 고치기 전 실패는 hull 이 벽 너머 13.5 px(짧은 변 20 의 68%) 이상이라 넉넉히 갈린다.
      const tol = 0.15 * Math.min(box.right - box.left, box.bottom - box.top);
      check(
        box.left >= field.left - tol && box.top >= field.top - tol && box.right <= field.right + tol && box.bottom <= field.bottom + tol,
        '벽 앞에서 돈 휠체어의 차체가 판 밖이다',
        { box, field, pose: await objectById(app, a) },
      );

      if (app.capabilities.has('pointer')) {
        // 이어서 **다른** 칩을 끈다 — 손대지 않은 칩은 한 픽셀도 안 움직여야 한다(안전망이 밀어 커밋하면 빨강)
        const before = poseKey([await objectById(app, a)]);
        const from = await app.objectCenter(b);
        check(from !== null, '상대 휠체어가 화면에 없다');
        await app.drag(from, shift(from, 40, 0), { steps: 10 });
        await app.settled();
        check(poseKey([await objectById(app, a)]) === before, '다른 칩을 끌었는데 벽 앞의 칩이 움직였다', { before, after: await objectById(app, a) });
      }
      await expectQuiet(app, 'S18c');
    },
  },
]);
