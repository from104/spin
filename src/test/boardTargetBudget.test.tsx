// 2.5 [E-5] — 첫 화면 표적 예산 게이트: **[보드] 초기 상태의 상호작용 컨트롤 ≤ 40.**
//
// 원안은 이 게이트를 3차 말에 뒀다. 그러면 2차에서 예산을 넘겨도 3차 내내 모른 채 쌓는다 —
// 그래서 2차 말(지금)로 당겨졌다. 계획서 §3(165행)의 내역은 재편 완료 시 약 36 이다:
// 헤더 6 + 트레이 13 + 서랍 손잡이 2 + 스테이지 컨트롤 6 + 하단 바 7 + 인스펙터 손잡이 1 +
// 빈 판 채우기 1. 40 은 그 위의 **상한**이다 — 여유분 4 는 항목 하나의 실수를 흡수하는 폭이지
// "4개 더 넣어도 된다"는 초대장이 아니다.
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
import { makeDefaultPrefs, PREFS_KEY } from '../storage/prefs.ts';
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
  });

  // 2026-08-12 3차 검증관 지적: 위 게이트는 매번 localStorage 를 비우고 재므로 **실사용 경로를
  // 못 본다.** seed 드릴에 화살표 8곳·메모 2곳이 있어 §3 불변식 3 이 두 서랍을 다 열고, 개폐는
  // `prefs.tray` 에 남는다 — **seed 드릴을 한 번 열면 그 뒤 전술판은 영구히 서랍이 열린 상태**다.
  // 그 상태의 실측이 40 이라 여유가 0 이고, 5.4 의 [포메이션 채우기] 1 이 오면 41 = 초과다.
  // 게이트가 그것을 못 잡으면 예산은 종이 위에만 있는 것이다.
  it(`서랍이 둘 다 열린 실사용 상태도 ${BUDGET} 이하다 — seed 드릴을 한 번 열면 이 상태가 영구다`, async () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...makeDefaultPrefs(), tray: { draw: true, note: true } }),
    );
    await openFirstScreen();
    const targets = countTargets(document.body);
    const names = targets.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? el.tagName);
    expect(targets.length, `서랍 열림 표적 ${targets.length}개:\n${names.join('\n')}`).toBeLessThanOrEqual(BUDGET);
  });

  it('대조군: 서랍을 열면 표적이 실제로 는다 — 위 it 이 같은 화면을 두 번 센 것이 아니다', async () => {
    // ⚠️ 2026-08-14 — 여는 방법이 바뀌었다. 옛 경로는 `prefs.tray` 주입(서랍이 열린 채로
    // 시작한다)이었는데, 서랍이 플라이아웃이 되면서 그 저장값 자체가 사라졌다. 지금은 손잡이에
    // 손을 얹어야 열린다 — 그래서 **첫 화면 예산에는 영영 안 들어간다**(그것이 이 재설계의 값이다).
    await openFirstScreen();
    const closed = countTargets(document.body).length;
    fireEvent.pointerEnter(screen.getByRole('button', { name: /^작도/ }), { pointerType: 'mouse' });
    expect(countTargets(document.body).length).toBeGreaterThan(closed);
  });

  it('대조군: 셈이 화면 전 구역을 실제로 보고 있다 — 구역별 표적이 최소 1개씩 잡힌다', async () => {
    // "0개라서 통과"를 막는다(스파이 단언의 대조군과 같은 규율). 선택자가 낡아 아무것도 못
    // 세면 위 게이트는 영원히 초록불이다 — 구역별 최소치가 그 헛통과를 잡는다.
    await openFirstScreen();
    const targets = countTargets(document.body);
    const label = (el: HTMLElement) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
    const has = (name: string) => targets.some((el) => label(el).startsWith(name));
    expect(has('주요 메뉴') || targets.some((el) => el.closest('[aria-label="주요 메뉴"]')), '레일').toBe(true);
    expect(has('본문으로 건너뛰기') || targets.some((el) => el.matches('a[href]')), 'SkipLink').toBe(true);
    expect(has('확대'), '스테이지 컨트롤').toBe(true);
    expect(has('2번 선수 배치') || has('공'), '트레이').toBe(true);
    // ⚠️ 2026-08-28 — '하단 바' 행이 여기서 **빠졌다.** 증인이 [코트 비우기]였는데 그 칸은
    //    애초에 기능 바 소속이었고(이번에 [보드 설정] 모달로 다시 이사했다), 자유 전술판에는
    //    하단 재생 묶음이 **없다** — 1장짜리라 스텝도 트랜스포트도 없다(DESIGN §6.8 각주).
    //    즉 이 행은 기능 바를 '하단 바' 라는 이름으로 두 번 세고 있었다. 아래 한 줄로 족하다.
    // 2026-08-27 — 속도 제한은 [보드 설정] 모달 안으로 들어가 **첫 화면 표적이 아니다**.
    // 그 자리를 대신해 기능 바의 대표로 [보드 설정]을 센다(구역이 실제로 잡히는지가 요점이다).
    expect(has('보드 설정'), '기능 바').toBe(true);
    // 하한 — 재편 목표 내역(36)에서 크게 모자라면 세는 규칙이 새는 것이다.
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
  });
});
