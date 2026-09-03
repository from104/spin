// 2.5 [E-5] — 첫 화면 표적 예산 게이트: **[보드] 초기 상태의 상호작용 컨트롤 ≤ 40.**
//
// 원안은 이 게이트를 3차 말에 뒀다. 그러면 2차에서 예산을 넘겨도 3차 내내 모른 채 쌓는다 —
// 그래서 2차 말(지금)로 당겨졌다. 계획서 §3(165행)의 내역은 재편 완료 시 약 36 이다:
// 헤더 6 + 트레이 13 + 서랍 손잡이 2 + 스테이지 컨트롤 6 + 하단 바 7 + 인스펙터 손잡이 1 +
// 빈 판 채우기 1. 40 은 그 위의 **상한**이다 — 여유분 4 는 항목 하나의 실수를 흡수하는 폭이지
// "4개 더 넣어도 된다"는 초대장이 아니다.
//
// 🔁 2026-09-03 실측: **35 → 36**(여유 4). [지우기] 도구가 되살아나 기능 구역 버튼이 하나
// 늘었다(기현 지시 — `features/editor/toolDefs.ts` 가 뒤집기 근거를 쥔다). 서랍과 무관한
// 단독 버튼이라 아래 첫 화면 셈이 **36** 이다.
// 상한 40 은 **안 올린다** — 위 문단이 말한 그대로, 여유는 초대장이 아니다.
//
// 🔁 2026-09-03(2차) 실측: **첫 화면은 36 그대로**다. [자유 그리기] 가 늘었지만 [작도] 서랍
// **안**이라 손잡이 하나가 그대로 다섯을 나른다 — 이 게이트가 서랍을 접어 산 값이 정확히 이것이다.
// 다만 **손잡이에 손을 얹어 플라이아웃이 펼쳐진 순간의 셈은 40 → 41 로 올랐다**(아래 대조군
// it 이 여는 그 상태). 그 상태는 게이트 밖이고, 그것이 실수가 아니라 재설계의 결론이다:
// 플라이아웃은 손이 그 자리에 머무는 동안만 있는 **일시 표적**이라 "첫 화면에서 눈이 훑어야
// 하는 것" 이 아니다. 값을 여기 적어 두는 이유는 그 예외가 **무한정이 아니기 때문**이다 —
// 서랍 안이 계속 불면 언젠가 서랍을 가르는 것이 답이 되고, 그때 41 이 출발점이 된다.
//
// ── 세는 규칙 (이게 애매하면 게이트가 무의미하다) ──────────────────────────────
// 1. 대상: 실제 앱 첫 화면 전체 — AppShell(레일 + 헤더 + [보드]) + SkipLink. 오버레이(모달·
//    시트·토스트)는 초기 상태에 닫혀 있으므로 DOM 에 없다 — "초기 상태"의 정의가 그것이다.
// 2. **센다**: 네이티브 상호작용 요소(button · a[href] · input · select · textarea · summary)와
//    상호작용 role(button·tab·switch·checkbox·radio·link·menuitem·slider), 그리고 포커스로
//    끌어들이는 tabindex ≥ 0. 여러 조건에 걸려도 요소당 1 이다(querySelectorAll 이 보장).
// 3. **disabled/aria-disabled 도 센다.** 꺼진 버튼도 화면에서 자리를 차지하고 시선을 받는
//    표적이다 — 예산의 대상은 "누를 수 있는 것"이 아니라 "표적으로 보이는 것"이다.
// 4. **안 센다**: aria-hidden 안쪽(스크린리더에게 없는 것 — 시각 장식), hidden, tabindex=-1
//    단독(프로그램 포커스 대상, 예: <main id="main">).
// 5. sr-only 는 **요소 종류로 거르지 않는다** — sr-only 인 상호작용 컨트롤(SkipLink)은 포커스
//    순회에 실제로 나타나는 표적이므로 센다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppShell } from '../app/AppShell.tsx';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../store/toast/ToastProvider.tsx';

const BUDGET = 40;

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[tabindex]',
].join(', ');

function countTargets(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)].filter((el) => {
    // 규칙 4 — tabindex 단독 매치는 ≥0 만 표적이다(main 의 tabIndex=-1 을 걸러낸다).
    const ti = el.getAttribute('tabindex');
    const nativeOrRole =
      el.matches('button, a[href], input, select, textarea, summary') ||
      ['button', 'tab', 'switch', 'checkbox', 'radio', 'link', 'menuitem', 'slider'].includes(el.getAttribute('role') ?? '');
    if (!nativeOrRole && ti !== null && Number.parseInt(ti, 10) < 0) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.closest('[hidden]')) return false;
    return true;
  });
}

/** jsdom 에 matchMedia 가 없다 — 없으면 두 boolean 이 넓은 쪽으로 굳는다(2.3 폴백). 기본
 *  PC 경로를 명시해 둔다. 좁은 창은 컨트롤 **수**를 바꾸지 않으므로(2.3 은 패딩만 걷는다)
 *  이 게이트는 넓은 창 하나로 충분하다 — 수를 바꾸는 재편(레일 접기)이 오면 그쪽이 행을 더한다. */
function stubMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

beforeEach(() => {
  stubMedia();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

async function openFirstScreen() {
  // C4(react-router) — AppShell 은 라우터 문맥이 필요하다. 첫 화면 = 루트 주소.
  const router = createMemoryRouter([{ path: '*', element: <AppShell /> }], { initialEntries: ['/'] });
  render(
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>,
  );
  // 판이 실제로 다 선 뒤에 센다 — 트레이·하단 바가 늦게 오면 반쪽 화면을 세고 초록불이 난다.
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  // 2026-08-28 — [코트 비우기]가 [보드 설정] 모달 안으로 들어가서 준비 신호로 못 쓴다.
  // 기능 바에 상시 서는 칸 아무거나면 되므로 그 모달을 여는 칸을 본다.
  await waitFor(() => expect(screen.getByRole('button', { name: '보드 설정' })).toBeInTheDocument());
}

describe('첫 화면 표적 예산 [E-5]', () => {
  it(`[보드] 초기 상태의 상호작용 컨트롤이 ${BUDGET} 이하다`, async () => {
    await openFirstScreen();
    const targets = countTargets(document.body);
    // 넘겼다면 아래 목록에서 무엇이 불었는지 읽어라 — 컨트롤을 지우거나, 계획서 §3 예산
    // 내역을 고치는 결정과 함께가 아니면 이 상한을 올리지 마라.
    const names = targets.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? el.tagName);
    expect(targets.length, `표적 ${targets.length}개:\n${names.join('\n')}`).toBeLessThanOrEqual(BUDGET);
    // 하한 — 재편 목표 내역(36)에서 크게 모자라면 세는 규칙이 새는 것이다("0개라서 통과"를 막는다).
    expect(targets.length).toBeGreaterThanOrEqual(25);
  });

  it('대조군: 닫혀 있는 오버레이는 세지 않았다 — 인스펙터를 열면 예산 밖 컨트롤이 실재한다', async () => {
    // 게이트의 "초기 상태" 한정이 실제로 무게를 갖는지 확인한다. 인스펙터 20컨트롤이
    // 오버레이로 내려간 것이 이 예산 절감의 절반이다(계획서 §3) — 열었을 때 수가 늘지
    // 않는다면 그 절감은 애초에 없던 것이다.
    // ⚠️ 2026-08-14 — 자유 전술판에 인스펙터가 없어졌다. 같은 논지를 지키는 오버레이는 이제
    // 기능 바의 [코트] 팝오버다(형태 3 + 크기 3 = 6컨트롤이 닫히면 DOM 에서 사라진다).
    await openFirstScreen();
    const before = countTargets(document.body).length;
    screen.getByRole('button', { name: '보드 설정' }).click();
    await waitFor(() => expect(countTargets(document.body).length).toBeGreaterThan(before));
    // 서랍(플라이아웃)도 같은 방식이다 — ⚠️ 2026-08-14, 손을 얹어야 열리고 그래서 첫 화면
    // 예산에는 영영 안 들어간다(그것이 이 재설계의 값이다). 위 오버레이 열림과 같은 화면을
    // 두 번 센 것이 아님을 여기서 함께 잡는다.
    fireEvent.pointerEnter(screen.getByRole('button', { name: /^작도/ }), { pointerType: 'mouse' });
    expect(countTargets(document.body).length).toBeGreaterThan(before);
  });
});
