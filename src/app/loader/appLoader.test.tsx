// 로더 계약 테스트 — 이 파일 **하나만** 배송 경로(최소 표시 시간 > 0)를 실제로 탄다
// (PLAN-0-6-3-LOADER-NOTICE §7 「새 테스트 — appLoader.test.tsx」, 결정 5·6·7·8).
//
// ⚠️ 이 파일이 존재하는 유일한 이유: `loaderMinMs` 는 테스트 환경에서 0 을 돌려주고(§7-1),
// 그래서 기존 렌더 테스트 6개는 로더를 한 프레임도 보지 않는다. 그 스위치는 **테스트가 배송
// 경로와 다른 경로를 돈다**는 뜻이라 사각지대를 만든다(§8-7). 여기서 `vi.stubEnv` 로 스위치를
// 되돌려 진짜 최소 표시 시간 경로를 태우는 것이 그 사각지대를 사는 값이다 — 이 파일을 지우면
// `appLoaderTiming.ts` 의 환경 분기가 곧 미검증 코드가 된다.
//
// ⚠️ stub 은 **앱 모듈을 하나라도 물기 전에** 서야 한다. `loaderMinMs` 가 값을 호출 시점에
// 읽으므로 오늘은 순서가 느슨하지만, 그 구현이 모듈 최상위 상수로 바뀌는 날 조용히 죽는다.
// 그래서 앱 import 를 전부 동적(top-level await)으로 두고 그 앞에 `vi.resetModules()` 를 둔다 —
// 나중에 누가 정적 import 를 한 줄 더해도(그것은 hoist 되어 stub 보다 먼저 평가된다) 리셋 뒤의
// 동적 import 가 다시 평가돼 계약이 살아남는다.
//
// 하네스는 `AppShell.wiring.test.tsx` 의 관례를 그대로 따른다(그 파일은 헬퍼를 export 하지
// 않으므로 import 할 수 없고, **한 줄도 고치지 않는 것**이 §7 의 조건이다): 화면을 전부 목으로
// 갈아끼워 matter-js·IDB 가 딸려 들어오는 것을 막고, Provider 3개 + 메모리 라우터로 세운다.
// 다만 목이 `<main id="main" tabIndex={-1}>` 를 실제로 렌더한다 — 초점 계약(결정 7)의 표적이
// 그 노드이고, 진짜 화면들도 §7.5a 대로 저마다 그것을 렌더한다.
//
// 안 보는 것(§7 「안 쓰는 것」): 상수 값 대조(`APP_LOADER_MS`·`EXIT_MS` 는 **시계를 그만큼
// 돌리는 데만** 쓴다) · 키프레임 백분율·이징·인라인 스타일 값 · z-index · SVG 도형 개수 ·
// 레일 5개 반복(하나면 배선이 증명된다). 회전이 킥으로 읽히는지는 jsdom 이 못 잰다 — §4 다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// ── 화면 목 8개 ────────────────────────────────────────────────────────────
// 진짜 화면을 끌면 EditorScreen → matter-js 와 storage/IDB 가 통째로 딸려와 워커가 힙을 다 쓴다
// (AppShell.wiring.test.tsx 머리말의 그 사고). 시연은 `PresentScreen` 째로 덮는다 — 이 파일은
// 시연 대상 배선을 보지 않으므로 그 안쪽(PresentRunner + matter-js)을 아예 안 물리는 쪽이 싸다.
// 목 컴포넌트는 팩토리 안에서 한 번만 정의해 참조를 고정한다(렌더마다 새 함수를 돌려주면 React 가
// 언마운트/재마운트로 보고 useAppHeader 의 발행·정리가 끝없이 겹친다 — 같은 주석의 무한 루프).
/** 목 화면이 **자기가 커밋되는 그 순간** 남기는 관찰 기록. ref 콜백은 그 커밋의 DOM 삽입이 전부
 *  끝난 뒤(commit layout phase) 동기로 불리므로, 여기서 본 값이 곧 "새 화면이 커밋되는 그 커밋"
 *  의 상태다. 커밋을 지난 뒤에 재는 단언(fireEvent 다음 줄)으로는 **같은 커밋에 서는 덮개**와
 *  **한 커밋 늦게 서는 덮개**를 구별할 수 없다 — 그 구별이 이 기록의 존재 이유다. */
const commitProbe = vi.hoisted(() => [] as { overlay: boolean; inert: boolean }[]);

vi.mock('../../features/library/LibraryScreen.tsx', () => {
  // 참조를 **고정**한다. 렌더마다 새 화살표를 넘기면 React 가 떼었다 다시 붙여 재렌더마다
  // 한 줄씩 더 적히고, 그러면 "마운트 커밋" 과 그 뒤 커밋이 섞여 기록의 뜻이 사라진다.
  function probeRef(el: HTMLElement | null): void {
    if (!el) return; // 떼어질 때(null)는 안 적는다
    const col = document.querySelector('header')?.parentElement ?? null;
    commitProbe.push({
      overlay: document.querySelector('.spin-loader') !== null,
      inert: col?.hasAttribute('inert') ?? false,
    });
  }
  function LibraryScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-library" ref={probeRef} />;
  }
  return { LibraryScreen };
});
// 세션 화면 목만 **튜토리얼 게이트를 읽어** 글자로 내보낸다(결정 30). 게이트는 상태일 뿐 DOM 을
// 안 만들어 밖에서 관측할 방법이 없고, Provider 안에 들어갈 수 있는 노드는 화면뿐이다. 팩토리를
// async 로 두어 `vi.resetModules()` 뒤의 레지스트리에서 컨텍스트를 물어 온다 — AppShell 이 무는
// 것과 같은 인스턴스라야 값이 통한다.
vi.mock('../../features/sessions/SessionsScreen.tsx', async () => {
  const { useTutorialGate } = await import('../../ui/tutorial/tutorialGate.tsx');
  function SessionsScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-sessions" data-gate={useTutorialGate() ? 'open' : 'closed'} />;
  }
  return { SessionsScreen };
});
vi.mock('../../features/sessions/SessionEditorScreen.tsx', () => {
  function SessionEditorScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-session-editor" />;
  }
  return { SessionEditorScreen };
});
vi.mock('../../features/board/BoardScreen.tsx', () => {
  function BoardScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-board" />;
  }
  return { BoardScreen };
});
vi.mock('../../features/editor/EditorScreen.tsx', () => {
  function EditorScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-editor" />;
  }
  return { EditorScreen };
});
vi.mock('../../features/present/PresentScreen.tsx', () => {
  function PresentScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-present" />;
  }
  return { PresentScreen };
});
vi.mock('../../features/rules/RulesScreen.tsx', () => {
  function RulesScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-rules" />;
  }
  return { RulesScreen };
});
vi.mock('../../features/settings/SettingsScreen.tsx', () => {
  function SettingsScreen() {
    return <main id="main" tabIndex={-1} data-testid="screen-settings" />;
  }
  return { SettingsScreen };
});

// ── 배송 경로 스위치 ───────────────────────────────────────────────────────
vi.stubEnv('MODE', 'production');
vi.resetModules();

const { AppShell } = await import('../AppShell.tsx');
const { SettingsProvider } = await import('../../store/settings/SettingsProvider.tsx');
const { LibraryProvider } = await import('../../store/library/LibraryProvider.tsx');
const { ToastProvider } = await import('../../store/toast/ToastProvider.tsx');
const { liveRegion } = await import('../../ui/LiveRegion.tsx');
const { makeDefaultPrefs, savePrefs } = await import('../../storage/prefs.ts');
const { APP_LOADER_MS, EXIT_MS, loaderMinMs } = await import('./appLoaderTiming.ts');
const { createMemoryRouter, RouterProvider } = await import('react-router');

function Harness() {
  const router = createMemoryRouter([{ path: '*', element: <AppShell /> }], { initialEntries: ['/'] });
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

/** 시계를 ms 만큼 돌린다. 타이머가 깨우는 setState 와 그 뒤에 딸린 effect 를 act 안에서 흘린다 —
 *  퇴장 타이머는 `visible:false` 커밋 **이후**에 걸리므로 한 번의 advance 로는 안 잡힌다. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** 마운트하면 LibraryProvider 가 IDB 를 비동기로 읽는다. 그 setState 가 act 밖에서 떨어지면
 *  경고가 나므로 한 틱 흘려보낸 뒤에 단언한다(wiring 하네스와 같은 이유·같은 처방). */
async function renderShell() {
  const utils = render(<Harness />);
  await advance(0);
  return utils;
}

/** 로더가 덮는 열 = 헤더 + 본문(결정 2). 레일은 이 바깥이라 전환 중에도 마음을 바꿀 수 있다. */
function column(): HTMLElement {
  const header = document.querySelector('header');
  if (!header?.parentElement) throw new Error('헤더가 없어 덮이는 열을 찾을 수 없다');
  return header.parentElement;
}

/** 지금 덮여 있는가. `aria-busy` 는 `loader.visible` 을 그대로 반영하므로(결정 6) 퇴장
 *  transition 이 남긴 DOM 과 헷갈리지 않는다. */
function covered(): boolean {
  return column().getAttribute('aria-busy') === 'true';
}

/** 오버레이가 트리에 있는가. 클래스는 `styles/a11y.css` 와의 계약 이름이다(AppLoaderOverlay 머리말). */
function overlayEl(): Element | null {
  return document.querySelector('.spin-loader');
}

function mainEl(): HTMLElement {
  const el = document.getElementById('main');
  if (!el) throw new Error('화면이 <main id="main"> 을 렌더하지 않았다');
  return el;
}

/** 튜토리얼 자동 시작 게이트의 지금 값. 세션 화면 목이 그것을 글자로 내보낸다(위 vi.mock). */
function gate(): string | null {
  return screen.getByTestId('screen-sessions').getAttribute('data-gate');
}

/** 레일 버튼. 이 파일은 전환 하나로 배선을 증명한다 — 레일 5개 반복은 §7 이 금지한다. */
function rail(label: string): HTMLElement {
  return screen.getByRole('button', { name: label });
}

let say: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.clear();
  commitProbe.length = 0;
  vi.useFakeTimers();
  // 발표는 **횟수**가 계약이다(결정 7: 걷힌 시점에 한 번). 문장 자체는 announce.test.ts 소관이라
  // 여기서 문자열을 대조하지 않는다.
  say = vi.spyOn(liveRegion, 'say');
});

afterEach(() => {
  vi.useRealTimers();
  say.mockRestore();
});

describe('화면 로더 계약 (PLAN-0-6-3 §7)', () => {
  it('테스트 환경 스위치가 이 파일에서는 꺼져 있다 — 최소 표시 시간이 실제로 흐른다', () => {
    // 이 한 줄이 없으면 아래 세 케이스가 "0ms 라 아무 일도 안 일어난다" 를 초록으로 지날 수 있다.
    // 값을 대조하지 않고 **0 보다 큰가**만 본다(상수는 시계를 돌리는 데만 쓴다 — §7).
    expect(loaderMinMs('rail', false)).toBeGreaterThan(0);
    expect(loaderMinMs('boot', false)).toBeGreaterThan(0);
  });

  it('레일 전환에서 로더가 뜨고 최소 표시 시간이 지나야 걷힌다', async () => {
    await renderShell();
    // 첫 마운트는 부팅 로더가 덮는다(결정 12). 레일 전환을 보려면 먼저 이것을 걷는다.
    expect(covered()).toBe(true);
    await advance(APP_LOADER_MS.boot);
    expect(covered()).toBe(false);
    await advance(EXIT_MS.boot);
    expect(overlayEl()).toBeNull(); // 퇴장 transition 이 끝나면 DOM 에서 사라진다(결정 16)

    // 클릭은 fireEvent 로 준다 — userEvent 는 pointerdown 을 먼저 쏘고, 그것이 곧 "아무 입력에
    // 즉시 걷기"(결정 5)라 방금 띄운 로더를 자기 손으로 걷어 버린다.
    fireEvent.click(rail('드릴'));
    expect(overlayEl()).not.toBeNull();
    expect(covered()).toBe(true);

    await advance(APP_LOADER_MS.rail - 1);
    expect(covered()).toBe(true); // 최소 표시 시간 전에는 안 걷힌다
    await advance(1);
    expect(covered()).toBe(false);
    await advance(EXIT_MS.rail);
    expect(overlayEl()).toBeNull();
  });

  it('레일 전환과 같은 커밋에 덮개가 선다 — 새 화면이 맨몸으로 보이는 프레임이 없다', async () => {
    // 실측(2026-09-04 헤드리스 크롬)에서 잡힌 회귀: 레일 클릭 0ms 프레임에 새 화면이 로더 없이
    // 커밋되고 232ms 프레임부터 로더가 그 위로 올라왔다. 그 한 커밋에서는 튜토리얼 게이트도
    // 열려 있어 말풍선(z 300)이 로더 위에 뜨는 프레임이 6장 잡혔다 — 결정 30 이 막으려던 그림이다.
    // 지우면 판정이 다시 effect 로 밀려도 초록이 된다(위 케이스의 단언은 effect 가 흐른 뒤를 잰다).
    await renderShell();
    await advance(APP_LOADER_MS.boot);
    await advance(EXIT_MS.boot);
    commitProbe.length = 0;

    fireEvent.click(rail('드릴'));

    // 드릴 목록이 커밋되던 **그 순간** 이미 덮개가 서 있었고 열이 inert 였는가.
    expect(commitProbe).toEqual([{ overlay: true, inert: true }]);
    // 시계를 한 틱도 안 돌린 지금도 그대로다 — 덮개를 세우는 것은 타이머가 아니라 렌더다.
    expect(overlayEl()).not.toBeNull();
    expect(covered()).toBe(true);
  });

  it("감축 모션('항상 켬')이면 로더가 한 번도 뜨지 않는다", async () => {
    // 접근성 계약(결정 8). 판정은 effectiveReduceMotion 이 지므로 matchMedia 스텁이 필요 없다 —
    // 'always' 는 OS 채널을 보지 않는다. 전역 matchMedia 스텁은 §7 이 금지한다.
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, reduceMotion: 'always' } });

    await renderShell();
    expect(overlayEl()).toBeNull();
    expect(covered()).toBe(false);

    fireEvent.click(rail('드릴'));
    expect(overlayEl()).toBeNull();
    expect(covered()).toBe(false);
    await advance(APP_LOADER_MS.boot + APP_LOADER_MS.rail);
    expect(overlayEl()).toBeNull();
    expect(covered()).toBe(false);
  });

  it('덮인 동안 aria-busy·inert 가 서고, 걷힌 그 시점에 #main 이 초점을 받고 발표가 한 번 난다', async () => {
    // 이 기능이 실제로 깨뜨릴 수 있는 유일한 기존 계약이다(§7.6): `inert` 로 덮인 동안 focus()
    // 는 무효라, 발표·포커스를 전환 커밋에 그대로 두면 초점이 body 로 떨어진다(결정 7).
    await renderShell();
    await advance(APP_LOADER_MS.boot);
    await advance(EXIT_MS.boot);
    say.mockClear();

    fireEvent.click(rail('드릴'));
    const col = column();
    expect(col.getAttribute('aria-busy')).toBe('true');
    expect(col.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).not.toBe(mainEl()); // 덮인 동안에는 초점을 옮기지 않는다
    expect(say).not.toHaveBeenCalled();

    await advance(APP_LOADER_MS.rail);
    expect(col.hasAttribute('aria-busy')).toBe(false); // false 가 아니라 속성 자체가 없다(결정 6)
    expect(col.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(mainEl());
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('튜토리얼 게이트는 퇴장 페이드가 끝나야 열린다 — visible 이 꺼진 것만으로는 안 연다', async () => {
    // 실측(2026-09-04)에서 잡힌 회귀: 퇴장 페이드(EXIT_MS) 도중 프레임에 말풍선(z 300)이 아직
    // 거의 불투명한 판 위에 이미 떠 있었다. 결정 30 의 "로더 걷힘" 은 `visible === false` 가
    // 아니라 **퇴장 완료**라는 것이 이 케이스의 계약이다.
    // 지우면: `onExited` 배선이 사라져도(= 게이트가 visible 만 보아도) 초록으로 지난다.
    await renderShell();
    await advance(APP_LOADER_MS.boot);
    await advance(EXIT_MS.boot);

    fireEvent.click(rail('세션'));
    expect(gate()).toBe('closed'); // 덮개가 서는 그 커밋에 이미 닫혀 있다

    await advance(APP_LOADER_MS.rail);
    expect(covered()).toBe(false); // visible 은 여기서 꺼진다 — 옛 판정식이면 이 줄에서 열렸다
    expect(overlayEl()).not.toBeNull(); // 판은 아직 살아 페이드 중이다
    expect(gate()).toBe('closed');

    await advance(EXIT_MS.rail);
    expect(overlayEl()).toBeNull();
    expect(gate()).toBe('open'); // 판이 사라진 그때서야 자동 시작이 열린다
  });

  it('로더가 애초에 못 뜨는 환경(감축 모션)에서는 게이트가 처음부터 열려 있다 — 투어가 증발하지 않는다', async () => {
    // 위 케이스의 거울상. `coverSettled` 의 초기값(`!loader.visible`)이 지키는 것은 **`onExited` 가
    // 영영 오지 않는 경로**다 — 감축 모션·테스트·프리렌더 착지에서는 판이 한 번도 안 서므로 퇴장도
    // 없고, 초기값이 false 였다면 게이트가 영원히 닫혀 화면 투어가 소리 없이 사라진다. 검증관이
    // 돌연변이(`useState(false)`)로 실증했다: 기존 365 케이스가 전부 초록인 채로 그 고장이 지나간다.
    // 지우면: 초기값을 false 로 바꿔도 아무 테스트도 빨개지지 않는다.
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, reduceMotion: 'always' } });

    await renderShell();
    fireEvent.click(rail('세션'));
    expect(overlayEl()).toBeNull(); // 판은 한 번도 안 선다
    await advance(0); // 안내 판정 effect(noticeDecided) 가 도는 한 틱
    expect(gate()).toBe('open');
  });

  it('아무 입력(keydown)에 최소 표시 시간을 안 기다리고 즉시 걷힌다', async () => {
    // 인위적 지연의 유일한 실질 결함(급한 사람이 갇힌다)을 없앤다(결정 5). 시계를 한 틱도
    // 돌리지 않고 걷히는 것이 계약이다.
    await renderShell();
    expect(covered()).toBe(true);

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(covered()).toBe(false);
  });
});
