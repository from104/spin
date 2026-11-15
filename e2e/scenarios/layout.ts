// S9 좁은 창에서도 기능이 남는다 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 창이 좁아지거나 세로로 눕는 순간 트레이·기능 바·코트·스텝·재생이 뷰포트 밖으로 밀리거나
// 다른 요소에 가려져 **눌 수 없게 되는 것**, 문서에 가로 스크롤이 생기는 것. Tauri 최소 창(900×600)과 반응형
// 경계(1099/1100)가 실제 사용에서 가장 자주 밟히는 자리인데, jsdom 은 `getBoundingClientRect` 가 전부 0 이라 레이아웃을
// 한 번도 못 잰다. 화면 키·문구가 아니라 번역되지 않는 투어 닻(`data-tut`)의 상자와 `elementFromPoint` 로 본다.
//
// 드릴 편집기에서 본다 — 스텝 목록·재생이 있는 가장 복잡한 배치라서다(전술판은 그 부분집합).
import type { SpinApp } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, expectQuiet } from './kit.ts';

/** 편집기에서 어느 창에서나 손에 닿아야 하는 투어 닻 — 이름은 src/ui/tutorial 의 닻과 같다 */
const ANCHORS = ['editor-tray', 'editor-court', 'editor-functionbar', 'editor-playback'] as const;

/** [너비, 높이, 이름] — Tauri 최소 창 · 반응형 경계 양쪽 · 세로로 누운 창 */
const SIZES: readonly (readonly [number, number])[] = [
  [900, 600],
  [1099, 700],
  [1100, 700],
  [800, 1280],
];

async function expectReachable(app: SpinApp, where: string): Promise<void> {
  for (const name of ANCHORS) {
    const a = await app.anchor(name);
    check(a !== null, `${where}: 닻 ${name} 이 문서에 없다`);
    check(a.inViewport, `${where}: 닻 ${name} 이 뷰포트 밖으로 밀렸다`, a.rect);
    check(a.onTop, `${where}: 닻 ${name} 의 가운데가 다른 요소에 가려졌다`, a.rect);
  }
  const overflow = await app.horizontalOverflow();
  check(overflow <= 0, `${where}: 문서에 가로 스크롤이 생겼다`, overflow);
  const size = await app.courtSize();
  check(!!size && size.width > 100 && size.height > 100, `${where}: 코트가 너무 작다`, size);
}

export default defineGroup('layout', [
  {
    title: 'S9 좁은 창에도 기능이 닿는다',
    run: async (app) => {
      await app.placeFromTray('ball', at(0.4, 0.5), { via: 'drag' });
      await app.saveBoardAsDrill();
      await app.settled();
      if (!app.capabilities.has('resize')) {
        // 휴대폰 프로젝트는 창을 안 바꾼다 — 자기 크기(Pixel 7 세로 412×839)가 이미 가장 좁은 자리다(태블릿은 resize 로 아래를 돈다)
        await expectReachable(app, 'S9 기본 창');
      } else {
        for (const [w, h] of SIZES) {
          await app.step(`${w}×${h}`, async () => {
            await app.resize(w, h);
            await expectReachable(app, `S9 ${w}×${h}`);
          });
        }
      }
      await expectQuiet(app, 'S9');
    },
  },
]);
