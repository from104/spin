// S18 심플 모드 — docs/PLAN-SIMPLE-DRIVE.md 결정 A1·A3·A5, C2.
//
// 지우면 새는 실기 버그: (1) [보드 설정] 의 [심플 모드] 를 켰는데 휠체어가 원이 아니라 그대로 차체인 것(prefs → ObjectLayer
// → ChairChip 배선), (2) **저장된 물리·상호작용이 켜져 있는데** 심플 모드가 그것을 끄지 못해 원을 겹쳐 끌면 서로 밀려 나가는 것
// ("원천적으로 물리 없음" 위반 — 월드 setInteract 강제), (3) 화면은 원인데 내보낸 그림만 차체인 것("보이는 것 = 내보내지는 것",
// ExportSheet 의 chairDisc 배선). 원/차체의 구분은 속성이 아니라 **기하**로 본다 — 차체(1.3×0.8 m)는 가로세로비가 1.6 이고
// 원(지름 1.0 m — 2026-11-19 부터 방향 표시 없음)은 1.0 부근이라, 코트가 돌아 있어도 비율 `max(r, 1/r)` 로 가른다. 지름·비율 상수는 베끼지 않고 임계 하나만 둔다.
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

/** [물리·상호작용] 을 켠다 — 켬이면 키보드·방향판 이동이 순간이동이 아니라 **쓸기**(sweepTo)다. 쥔 칩은 static 이라
 *  Matter 벽도 안전망도 막지 않았다(2026-11-17 기현님 "객체들이 키보드로 이동하면 코트 가장자리를 넘어감"). */
async function interactOn(app: SpinApp): Promise<void> {
  await openCourtModal(app);
  await app.press('court-toggle-interact');
  await closeCourtModal(app);
}

type Sc = Parameters<typeof defineGroup>[1][number];

const wallTurn: Sc = {
  // 지우면 새는 실기 버그: 상호작용이 꺼져 있으면(심플 모드는 늘 끔) 키보드·방향판 이동·회전이 **순간이동**이라 아무도 벽을
  // 지키지 않았다. 방향키만 눌러도 차체가 판 밖으로 나가고, 벽 앞에서 벽 쪽으로 돌면 차체 앞이 판 밖인 채 **저장**된다 —
  // 심플 모드에서는 차체를 안 그리니 보이지도 않는다. 그 칩은 나중에 다른 칩을 끌기만 해도 안전망이 밀어 커밋한다.
  // 판정은 앱 상수 없이: 심플을 끈 뒤 **보이는 차체 상자**가 판(court-surface = 벽 경계, 라인 바깥 여백까지) 상자 안인가, 다른 칩을 끈 뒤 자세가 그대로인가.
  // ── 2026-11-19: 이 시나리오는 (상호작용 켬 | 심플) 둘로 돌았다. 심플 갈래(옛 S18c 「심플 모드 — 키로 벽까지 밀고 벽 쪽으로 돌아도
  // 차체는 판 안」)는 옛 계약이라 뺐다 — 심플의 원은 방향이 없고 경계가 원 하나다(새 S18c 는 아래 simpleWall). 남은 것은 S18e.
  title: 'S18e 상호작용 켬 — 키로 벽까지 밀고 벽 쪽으로 돌아도 차체는 판 안',
  needs: ['keyboard'],
  run: async (app) => {
    const a = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
    const b = await app.placeFromTray('chair', at(0.5, 0.85), { via: 'drag', team: 'away' });
    await interactOn(app);

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
    await app.settled();
    // 같은 개체의 키 이동은 700 ms 안이면 한 칸으로 합쳐진다(history COALESCE_MS) — 회전을 따로 한 칸으로 떼어 잰다
    await new Promise((r) => setTimeout(r, 900));
    const beforeTurn = await objectById(app, a);
    await app.pressKey(faceKey(toWall)); // 벽 앞에서 벽 쪽으로 돈다 — 차체 앞이 벽에 닿지 않게 피벗이 밀려 들어온다
    await app.settled();
    const turned = await objectById(app, a);
    check(turned.angleDeg !== beforeTurn.angleDeg, '숫자키로 돌았는데 방향이 그대로다(전제 실패)', { beforeTurn, turned });
    // 되돌리기 한 번에 방향·피벗이 **둘 다** 처음 값 — 벽 밀어넣기(PLACE_SETTLE)가 회전과 같은 칸이다
    await app.undo();
    await app.settled();
    check(poseKey([await objectById(app, a)]) === poseKey([beforeTurn]), '되돌리기 한 번에 방향·피벗이 처음 값으로 안 돌아왔다', {
      beforeTurn,
      after: await objectById(app, a),
    });
    await app.redo();
    await app.settled();
    await app.pressKey('Escape'); // 선택 테두리를 걷는다 — 상자는 차체만

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
    await expectQuiet(app, 'S18e');
  },
};

const simpleWall: Sc = {
  // 지우면 새는 실기 버그(2026-11-19 「기본, 심플 모드 완전 분리」): (1) 심플 모드의 원이 앞을 벽 쪽으로 두면 벽에 못 닿는다 —
  // 보이지 않는 차체 앞(1.04 m)이 먼저 벽에 걸려 원과 벽 사이에 0.5 m 틈이 남는다(옛 「원 ∪ 차체」 경계), (2) 원에는 방향이 없는데
  // 숫자키·Q·E 가 보이지 않는 각도를 돌린다, (3) 심플을 끈 뒤 그 칩의 실물 차체가 벽 밖에 걸친 채 남아 다음 손짓에 벽에 밀려난다 —
  // 끄는 순간 판 안으로 넣고 되돌리기 한 칸으로 남아야 한다(2026-11-19 「복귀 때 판 안으로」). 판정은 앱 상수 없이: 원·차체의 화면 상자가
  // 판(court-surface = 벽 경계) 가장자리에 붙었는가 / 안인가.
  title: 'S18c 심플 — 원이 앞쪽으로도 벽에 닿는다',
  needs: ['keyboard'],
  run: async (app) => {
    const a = await app.placeFromTray('chair', at(0.5, 0.5), { via: 'drag', team: 'home' });
    const b = await app.placeFromTray('chair', at(0.5, 0.85), { via: 'drag', team: 'away' });

    await app.press('fn-simple');
    await app.settled();

    // 놓인 휠체어가 **보는 쪽**의 벽으로 민다(앞이 벽 쪽 — 옛 경계에서 보이지 않는 차체가 먼저 닿던 방향). 세로 창에서는 코트가 돌아 있다
    const pa = await objectById(app, a);
    const s0 = await app.worldToScreen(pa);
    const rad = (pa.angleDeg * Math.PI) / 180;
    const s1 = await app.worldToScreen({ x: pa.x + 100 * Math.cos(rad), y: pa.y + 100 * Math.sin(rad) });
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    const toWall = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';

    const facing = await objectById(app, a);
    const c = await app.objectCenter(a);
    check(c !== null, '원이 화면에 없다');
    await app.tap(c);
    await app.settled();
    for (const k of ['5', '9', 'e', 'Shift+q']) await app.pressKey(k); // 방향 키 — 원에는 방향이 없다
    await app.settled();
    check((await objectById(app, a)).angleDeg === facing.angleDeg, '심플 모드인데 방향 키가 원의 각도를 돌렸다', { facing, after: await objectById(app, a) });

    for (let i = 0; i < 24; i++) await app.pressKey(`Shift+${toWall}`); // 큰 걸음으로 반 코트 넘게 — 원이 벽에 닿아 멈춘다
    await app.settled();
    const moved = await objectById(app, a);
    // 전제: 키가 이 원에 닿았다(방향 키 단언이 빈손으로 초록이 아니다)
    check(Math.hypot(moved.x - pa.x, moved.y - pa.y) > 50, '방향키로 원이 안 움직였다(전제 실패 — 선택·포커스)', { pa, moved });
    await app.pressKey('Escape'); // 선택 테두리를 걷는다 — 상자는 원만
    const field = await app.rectOf('court-surface');
    const box = await app.objectBox(a);
    check(field !== null && box !== null, '판·원이 화면에 없다');
    const gap = { ArrowLeft: box.left - field.left, ArrowRight: field.right - box.right, ArrowUp: box.top - field.top, ArrowDown: field.bottom - box.bottom }[toWall]!;
    // 원의 테두리 선은 반 굵기만큼 바깥으로 그려진다 — 허용치는 지름의 15%. 옛 경계(원 ∪ 차체)의 틈은 지름의 54%(13.5/25)라 넉넉히 갈린다.
    const tol = 0.15 * (box.right - box.left);
    check(Math.abs(gap) <= tol, '앞을 벽 쪽으로 둔 원이 벽에 안 닿는다(보이지 않는 차체가 막는다)', { gap, tol, box, field, pose: await objectById(app, a) });

    const parked = poseKey([await objectById(app, a)]);
    if (app.capabilities.has('pointer')) {
      // 다른 칩을 끈다 — 손대지 않은 원은 한 픽셀도 안 움직인다
      const from = await app.objectCenter(b);
      check(from !== null, '상대 휠체어가 화면에 없다');
      await app.drag(from, shift(from, 40, 0), { steps: 10 });
      await app.settled();
      check(poseKey([await objectById(app, a)]) === parked, '심플에서 다른 칩을 끌었는데 벽에 붙인 원이 움직였다', { parked, after: await objectById(app, a) });
    }
    // 평소 모드로 — 실물 차체가 벽 밖에 걸친 칩은 **끄는 순간** 차체 앞이 벽에 서는 자리로 들어온다(2026-11-19 기현님 선택 「복귀 때 판 안으로」,
    // 옛 계약 「스위치만으로 칩이 튀면 안 된다」를 뒤집었다). 방향은 그대로, 되돌리기 한 번에 원이 붙어 있던 자리.
    await app.press('fn-simple');
    await app.settled();
    const fitted = await objectById(app, a);
    check(poseKey([fitted]) !== parked && fitted.angleDeg === facing.angleDeg, '심플을 껐는데 벽 밖에 걸친 칩이 판 안으로 안 들어왔다', { parked, fitted });
    const field2 = await app.rectOf('court-surface');
    const body = await app.objectBox(a);
    check(field2 !== null && body !== null, '판·휠체어가 화면에 없다');
    // 칩의 테두리 선은 차체 hull 바깥으로 반 굵기만큼 그려진다 — 허용치는 짧은 변의 15%(S18e 와 같다). 넣지 않으면 13.5 px(짧은 변 20 의 68%) 밖이다.
    const tol2 = 0.15 * Math.min(body.right - body.left, body.bottom - body.top);
    check(
      body.left >= field2.left - tol2 && body.top >= field2.top - tol2 && body.right <= field2.right + tol2 && body.bottom <= field2.bottom + tol2,
      '심플을 끈 뒤 차체가 판 밖이다',
      { body, field2, fitted },
    );
    await app.undo();
    await app.settled();
    check(poseKey([await objectById(app, a)]) === parked, '되돌리기 한 번에 원이 붙어 있던 자리로 안 돌아왔다', { parked, after: await objectById(app, a) });
    await app.redo();
    await app.settled();
    if (app.capabilities.has('pointer')) {
      const from = await app.objectCenter(b);
      check(from !== null, '상대 휠체어가 화면에 없다');
      await app.drag(from, shift(from, -40, 0), { steps: 10 });
      await app.settled();
      check(poseKey([await objectById(app, a)]) === poseKey([fitted]), '평소 모드에서 다른 칩을 끌었는데 판 안에 넣은 칩이 움직였다', { fitted, after: await objectById(app, a) });
    }
    await expectQuiet(app, 'S18c');
  },
};

const groupWall = (interact: boolean): Sc => ({
  // 지우면 새는 실기 버그(113154c): 휠체어 여럿을 골라 벽 쪽으로 밀면 칩마다 따로 벽에 서서 **벽 쪽 칩만 멈추고 나머지가
  // 겹쳐 들어온다**(키보드), 덩어리 끌기는 벽 검사가 없어 무리째 판 밖으로 나간다. 가장 먼저 닿는 칩이 무리 전체를 세워야
  // 간격(포메이션)이 남는다. 평소 모드·상호작용 끔(앱 기본)에서 잰다 — 순간이동 경로다.
  title: interact ? 'S18f 상호작용 켬 — 무리 이동이 벽에서 서고 간격이 남는다' : 'S18d 무리 이동 — 벽에서 무리 전체가 서고 간격이 남는다',
  needs: ['keyboard'],
  run: async (app) => {
    const a = await app.placeFromTray('chair', at(0.3, 0.5), { via: 'drag', team: 'home' });
    const b = await app.placeFromTray('chair', at(0.45, 0.5), { via: 'drag', team: 'home' });
    if (interact) await interactOn(app);
    const a0 = await objectById(app, a);
    const b0 = await objectById(app, b);
    // 화면에서 월드 −x 벽(a 쪽)이 어느 쪽인가 — 세로 창에서는 코트가 돌아 있다
    const s0 = await app.worldToScreen(a0);
    const s1 = await app.worldToScreen({ x: a0.x - 100, y: a0.y });
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    const toWall = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';

    const c = await app.objectCenter(a);
    check(c !== null, '휠체어가 화면에 없다');
    await app.tap(c);
    await app.settled();
    await app.pressKey('ControlOrMeta+a'); // 둘 다 고른다 — 포커스는 a 에 남아 방향키가 무리 이동이 된다
    await app.settled();
    for (let i = 0; i < 24; i++) await app.pressKey(`Shift+${toWall}`); // 큰 걸음으로 반 코트 넘게
    await app.settled();
    const a1 = await objectById(app, a);
    const b1 = await objectById(app, b);
    check(a0.x - a1.x > 50, '무리가 벽 쪽으로 안 움직였다(전제 실패 — 무리 선택·포커스)', { a0, a1, b1 });
    check(Math.abs(b1.x - a1.x - (b0.x - a0.x)) < 0.5 && Math.abs(b1.y - a1.y - (b0.y - a0.y)) < 0.5, '벽에서 무리 간격이 무너졌다(벽 쪽 칩만 멈췄다)', {
      a0,
      b0,
      a1,
      b1,
    });

    if (app.capabilities.has('pointer')) {
      // 벽에 선 무리를 손으로 더 벽 쪽으로 끈다 — 무리 전체가 그 자리에 서 있어야 한다(판 밖으로 안 나간다)
      const from = await app.objectCenter(b);
      check(from !== null, '휠체어가 화면에 없다');
      const len = Math.hypot(dx, dy);
      await app.drag(from, shift(from, (dx / len) * 120, (dy / len) * 120), { steps: 12 });
      await app.settled();
      const a2 = await objectById(app, a);
      const b2 = await objectById(app, b);
      check(poseKey([a2, b2]) === poseKey([a1, b1]), '벽에 선 무리를 더 끌었더니 판 밖으로 나갔다', { a1, a2, b1, b2 });
    }
    await expectQuiet(app, 'S18d');
  },
});

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
      // [보드 설정] 의 이동 스위치 셋은 심플 모드에서 **안 보인다**(2026-11-19 「보드 다이얼로그에서 숨겨」 — 옛 계약은 disabled + 이유 문구)
      await openCourtModal(app);
      check(!(await app.present('court-toggle-interact')), '심플 모드인데 [물리·상호작용] 스위치가 보인다');
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
  simpleWall,
  wallTurn,
  groupWall(false),
  groupWall(true),
]);
