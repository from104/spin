// S15·S16 판 설정 — 진영 바꾸기가 놓는 방향을 따른다, 격자·규칙 구역 스위치가 층을 실제로 지운다. docs/PLAN-TEST-SUITE.md §5.
//
// 이 시나리오들은 **배선**만 본다. 방향 산술(`placement.ts`)과 스위치 상태는 vitest 가 이미 본다 — 여기서 보는 것은
// 실제 화면에서 [보드 설정] 모달 → 트레이 놓기·그림 층으로 이어지는 줄이 끊기지 않았는가, 그리고 그 모달이 작은 화면에
// 들어가는가(jsdom 은 레이아웃이 없어 못 본다).
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectQuiet, objectById } from './kit.ts';

async function openCourtModal(app: SpinApp): Promise<void> {
  await app.press('fn-court');
  await eventually('보드 설정 모달', () => app.dialogs(), (d) => d.includes('court-modal'));
}

async function closeCourtModal(app: SpinApp): Promise<void> {
  await app.pressKey('Escape');
  await eventually('보드 설정 모달 닫힘', () => app.dialogs(), (d) => !d.includes('court-modal'));
}

/** 0 ≤ 각도 < 360 */
const norm = (deg: number): number => ((deg % 360) + 360) % 360;

export default defineGroup('court-modal', [
  {
    // 지우면 새는 실기 버그: 풀 코트에서 [진영 바꾸기] 를 눌러도 새로 놓는 휠체어가 같은 쪽을 보는 것(모달의 방향 상태가
    // 트레이 놓기에 안 닿는 배선 단절). 놓는 방향이 진영을 따르는 것은 2026-11 에 들어간 기능이다.
    title: 'S15 진영 바꾸기와 놓는 방향',
    needs: ['pointer', 'keyboard'],
    run: async (app) => {
      const first = await app.placeFromTray('chair', at(0.3, 0.3), { via: 'drag', team: 'home' });
      const angleBefore = norm((await objectById(app, first)).angleDeg);

      await openCourtModal(app);
      await app.press('court-defense');
      await closeCourtModal(app);

      const second = await app.placeFromTray('chair', at(0.3, 0.7), { via: 'drag', team: 'home' });
      const angleAfter = norm((await objectById(app, second)).angleDeg);
      const turned = norm(angleAfter - angleBefore);
      check(Math.abs(turned - 180) < 1, `진영을 바꾼 뒤 놓은 휠체어가 180° 돌지 않았다 — 앞 ${angleBefore}° 뒤 ${angleAfter}°`);
      await expectQuiet(app, 'S15');
    },
  },
  {
    // 지우면 새는 실기 버그: 스위치를 꺼도 그 층이 DOM 에 남는 것(꺼짐 표시만 바뀌고 그림이 안 바뀐다), 새로고침 뒤 켜진
    // 채로 돌아오는 것(저장 누락), 좁은 화면에서 모달의 스위치가 화면 밖·다른 요소 밑에 있는 것(jsdom 은 레이아웃이 없다).
    title: 'S16 격자·규칙 구역 스위치',
    needs: ['keyboard', 'reload'],
    run: async (app) => {
      // 전제: 두 층은 기본 켜짐이다. 코트가 그려진 직후라 층이 서기를 기다린다(바로 읽으면 가끔 아직 없다)
      await eventually('시작 상태의 격자 층(기본 켜짐)', () => app.present('layer-grid'), true);
      await eventually('시작 상태의 규칙 구역 층(기본 켜짐)', () => app.present('layer-rulezones'), true);

      await openCourtModal(app);
      const view = await app.viewportSize();
      for (const id of ['court-toggle-grid', 'court-toggle-rulezones']) {
        const r = await app.rectOf(id);
        check(r !== null, `${id} 가 모달에 없다`);
        check(r.left >= 0 && r.top >= 0 && r.right <= view.width && r.bottom <= view.height, `${id} 가 화면 밖에 있다`, { r, view });
        check(await app.onTop(id), `${id} 가 다른 요소에 가려져 있다`);
      }
      await app.press('court-toggle-grid');
      await eventually('격자 층이 사라짐', () => app.present('layer-grid'), false);
      await app.press('court-toggle-rulezones');
      await eventually('규칙 구역 층이 사라짐', () => app.present('layer-rulezones'), false);
      await closeCourtModal(app);

      await app.reload();
      check(!(await app.present('layer-grid')), '새로고침 뒤 격자 층이 되살아났다');
      check(!(await app.present('layer-rulezones')), '새로고침 뒤 규칙 구역 층이 되살아났다');
      await expectQuiet(app, 'S16');
    },
  },
]);
