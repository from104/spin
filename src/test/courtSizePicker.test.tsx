// §6.4 — **크기를 고르는 UI 가 실제로 판을 바꾸는가.**
//
// 5차 검증관이 이 항목을 신설한 이유가 정확히 "저장·마이그레이션·검증·백업까지 왕복하는데
// 화면에 한 픽셀도 나타나지 않는 죽은 값" 이었다. 그래서 이 파일의 중심 단언은 모델이 아니라
// **판의 viewBox** 다 — 규격상 완료·제품상 미배송을 구분하는 유일한 자리다.
//
// 함께 못박는 것 셋:
//  · 초기 화면(=시트가 닫힌 상태)에는 이 컨트롤이 **DOM 에 없다** — §3 표적 예산(≤40, 여유 0).
//  · 판이 더러우면 select 가 아니라 **잠금 사유**가 선다(코트 형태 전환과 같은 문).
//  · 크기를 바꾼 뒤 **판 위 개체가 코트 밖에 남지 않는다**(순수 함수로 뺀 성질 + 대조군).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../store/toast/ToastProvider.tsx';
import { AppNavProvider, type AppHistoryApi } from '../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../app/AppHeader.tsx';
import { LiveRegion } from '../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../storage/prefs.ts';
import { BOARD_KEY, CURRENT_BOARD_SCHEMA, loadBoard } from '../storage/board.ts';
import { BoardScreen } from '../features/board/BoardScreen.tsx';
import { createDrill } from '../model/defaults.ts';
import type { Drill } from '../model/drill.ts';
import { isStepEmpty } from '../model/drill.ts';
import { courtDefFor, COURT_SIZES, COURT_SIZE_LABELS as COURT_SIZE_LABELS_ALL, DEFAULT_COURT_SIZE, type CourtSize } from '../model/court.ts';

const COURT_SIZE_LABELS = COURT_SIZE_LABELS_ALL.ko;

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>
              <AppHeader />
              {children}
            </AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

async function openBoard(): Promise<{ user: ReturnType<typeof userEvent.setup> }> {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user };
}

/** 판 SVG 의 viewBox. CourtStage 는 svg 루트에 role="application" 을 준다. */
const boardViewBox = (): string | null => screen.getByRole('application').getAttribute('viewBox');

/** 저장본을 미리 깔아 둔다 — 더러운 판(개체가 놓인 판)을 만드는 가장 짧은 길이다.
 *  실제 드래그로 더럽히려면 jsdom 에 없는 포인터 캡처·레이아웃이 필요하다. */
function seedBoard(drill: Drill, pristine: boolean): void {
  localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: CURRENT_BOARD_SCHEMA, pristine, drill }));
}

// ── 성질을 **순수 함수**로 뺀다 ────────────────────────────────────────────────────────
//
// "코트를 줄였더니 선수가 밖에 서 있다" 를 prop 뒤에 숨기지 않기 위해서다. 이 함수는 판이
// 아니라 드릴 하나만 보고, 그래서 대조군(일부러 밖에 세운 판)으로 **이 함수가 실제로 잡는다**
// 는 것까지 증명할 수 있다.
/** 그 드릴의 모든 저장 좌표가 자기 코트 viewBox 안인가. 밖에 있는 것들의 목록을 돌려준다. */
export function outsideCourt(d: Drill): string[] {
  const { vbW, vbH } = courtDefFor(d.courtMode, d.courtSize);
  const bad: string[] = [];
  const check = (tag: string, p: { x: number; y: number }): void => {
    if (p.x < 0 || p.x > vbW || p.y < 0 || p.y > vbH) bad.push(`${tag}(${p.x},${p.y})`);
  };
  for (const s of d.steps) {
    for (const [id, p] of Object.entries(s.chairs)) if (p) check(`chair:${id}`, p);
    for (const [id, p] of Object.entries(s.balls)) if (p) check(`ball:${id}`, p);
    for (const [id, p] of Object.entries(s.cones)) if (p) check(`cone:${id}`, p);
    for (const a of s.arrows) {
      check(`arrow:${a.id}.from`, a.from);
      check(`arrow:${a.id}.ctrl`, a.ctrl);
      check(`arrow:${a.id}.to`, a.to);
    }
    for (const n of s.notes) check(`note:${n.id}`, n);
  }
  return bad;
}

beforeEach(() => {
  localStorage.clear();
  // jsdom 에 matchMedia 가 없다 — 없으면 좁은/넓은 판정이 넓은 쪽으로 굳는다(2.3 폴백).
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('§6.4 코트 크기 선택 — 자리(§3 표적 예산)', () => {
  it('초기 화면에는 코트 크기 컨트롤이 DOM 에 아예 없다 (인스펙터 시트는 닫히면 사라진다)', async () => {
    await openBoard();
    expect(screen.queryByRole('radiogroup', { name: '코트 크기' })).toBeNull();
    // 대조군: 같은 질의가 팝오버를 열면 실제로 찾아낸다(질의가 늘 null 인 것이 아니다).
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.getByRole('radiogroup', { name: '코트 크기' })).toBeInTheDocument();
  });

  it('세 크기가 규정상의 이름과 함께 나온다 (치수만 적으면 무엇이 표준인지 알 수 없다)', async () => {
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    const group = screen.getByRole('radiogroup', { name: '코트 크기' });
    const btns = [...group.querySelectorAll('button')];
    expect(btns.map((b) => b.textContent)).toEqual(COURT_SIZES.map((s) => COURT_SIZE_LABELS[s]));
    // 지금 값은 aria-pressed 로 말한다(select 의 value 자리). §9 ② 부기 — 기본은 30×18 그대로다.
    const pressed = btns.filter((b) => b.getAttribute('aria-checked') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.textContent).toBe(COURT_SIZE_LABELS[DEFAULT_COURT_SIZE]);
  });
});

describe('§6.4 코트 크기 선택 — 고르면 판이 실제로 바뀐다', () => {
  it.each(COURT_SIZES.filter((s) => s !== DEFAULT_COURT_SIZE))('%s 를 고르면 판의 viewBox 가 그 코트가 된다', async (size) => {
    const { user } = await openBoard();
    const before = boardViewBox();
    expect(before).toBe(`0 0 ${courtDefFor('full', DEFAULT_COURT_SIZE).vbW} ${courtDefFor('full', DEFAULT_COURT_SIZE).vbH}`);

    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: `코트 크기 ${COURT_SIZE_LABELS[size]}` }));

    const def = courtDefFor('full', size);
    await waitFor(() => expect(boardViewBox()).toBe(`0 0 ${def.vbW} ${def.vbH}`));
    expect(boardViewBox()).not.toBe(before); // 대조군: 정말로 달라졌다
  });

  it('고른 크기가 스냅샷에 남아 다음 방문에 되살아난다', async () => {
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: `코트 크기 ${COURT_SIZE_LABELS['25x14']}` }));
    // 저장은 500ms 디바운스다 — 실제로 써질 때까지 기다린다(마운트 직후만 재면 헛통과다).
    await waitFor(() => expect(loadBoard()?.drill.courtSize).toBe('25x14'), { timeout: 3000 });
    // 갈아끼운 판은 다시 비어 있다 — 2026-08-28 부터 그 사실을 스냅샷 필드가 아니라 판에서 읽는다.
    expect(loadBoard()!.drill.steps.every(isStepEmpty)).toBe(true);
  });

  it('크기를 바꾼 판은 **비어 있다** — 코트를 줄여도 개체가 밖에 남지 않는다', async () => {
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: `코트 크기 ${COURT_SIZE_LABELS['25x14']}` }));
    await waitFor(() => expect(loadBoard()?.drill.courtSize).toBe('25x14'), { timeout: 3000 });

    const saved = loadBoard()!.drill;
    expect(outsideCourt(saved)).toEqual([]);
    // 그리고 그 이유가 "판이 비어서" 라는 것까지 적어 둔다 — 다음 사람이 좌표 이동을 넣고
    // 이 단언만 보면 "이미 지키고 있다" 고 오해하지 않도록.
    expect(Object.keys(saved.steps[0]!.chairs)).toHaveLength(0);
    expect(Object.keys(saved.steps[0]!.balls)).toHaveLength(0);
  });

  it('대조군: outsideCourt 는 실제로 판 밖을 잡아낸다 (안 잡으면 위 단언이 헛것이다)', () => {
    const d = createDrill({ courtMode: 'full', courtSize: '25x14' });
    const id = d.cast.chairs[0]!.id;
    // 30×18 에서는 안(x=750 < 825)이지만 25×14 viewBox(700×425)에서는 **밖**인 좌표.
    const bad: Drill = { ...d, steps: [{ ...d.steps[0]!, chairs: { [id]: { x: 750, y: 200, angleDeg: 0 } } }] };
    expect(outsideCourt(bad)).toEqual([`chair:${id}(750,200)`]);
    expect(outsideCourt({ ...bad, courtSize: '30x18' })).toEqual([]); // 같은 좌표가 큰 판에서는 안이다
  });
});

describe('§6.4 코트 크기 선택 — 잠금은 코트 형태 전환과 같은 문을 지난다', () => {
  it('판이 더러우면 select 가 아니라 잠금 사유가 선다', async () => {
    const dirty = createDrill({ courtMode: 'full' });
    seedBoard(dirty, false); // pristine=false = 저장본이 이미 편집된 판이다
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));

    expect(screen.queryByRole('radiogroup', { name: '코트 크기' })).toBeNull();
    expect(screen.getByText(/코트 크기를 바꾸려면 먼저 코트를 비우세요/)).toBeInTheDocument();
    // 값 자체는 계속 보인다 — 못 바꾸는 것과 안 보이는 것은 다르다.
    expect(screen.getByText(new RegExp(COURT_SIZE_LABELS[DEFAULT_COURT_SIZE]))).toBeInTheDocument();
  });

  it('[코트 비우기] 로 판을 비우면 다시 고를 수 있다 (그리고 고른 크기는 유지된다)', async () => {
    const dirty = createDrill({ courtMode: 'full', courtSize: '28x15' });
    seedBoard(dirty, false);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.queryByRole('radiogroup', { name: '코트 크기' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: '코트 비우기' }));
    await user.click(screen.getByRole('button', { name: '비우기' }));

    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    const group = await screen.findByRole('radiogroup', { name: '코트 크기' });
    // 지금 값은 aria-pressed 다. 비우기가 규격까지 되돌리지는 않는다.
    const pressed = [...group.querySelectorAll('button')].find((b) => b.getAttribute('aria-checked') === 'true');
    expect(pressed?.textContent).toBe(COURT_SIZE_LABELS['28x15']);
    const def = courtDefFor('full', '28x15');
    expect(boardViewBox()).toBe(`0 0 ${def.vbW} ${def.vbH}`);
  });

  it('하프 코트에서는 select 대신 "풀 코트에만 적용" 을 말한다 — 골라도 안 변하는 컨트롤은 거짓말이다', async () => {
    seedBoard(createDrill({ courtMode: 'half', courtSize: '25x14' }), true);
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(screen.queryByRole('radiogroup', { name: '코트 크기' })).toBeNull();
    expect(screen.getByText(/풀 코트에만 적용됩니다/)).toBeInTheDocument();
    // 하프 판은 크기와 무관하게 같은 viewBox 다(court.ts 근거 셋).
    expect(boardViewBox()).toBe(`0 0 ${courtDefFor('half').vbW} ${courtDefFor('half').vbH}`);
  });
});

describe('§6.4 코트 형태를 왕복해도 고른 크기가 살아남는다', () => {
  it('풀(25×14) → 하프 → 풀 에서 25×14 가 유지된다', async () => {
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: `코트 크기 ${COURT_SIZE_LABELS['25x14']}` }));
    await waitFor(() => expect(boardViewBox()).toBe(`0 0 ${courtDefFor('full', '25x14').vbW} ${courtDefFor('full', '25x14').vbH}`));

    // 형태 전환으로 왕복한다. 2026-08-14 재설계로 형태와 크기가 **같은 팝오버** 안이지만
    // 서로 다른 그룹이고, 고르면 팝오버가 닫히므로 매번 다시 연다 — 그 여닫음까지가 경로다.
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: '하프 코트' }));
    await waitFor(() => expect(boardViewBox()).toBe(`0 0 ${courtDefFor('half').vbW} ${courtDefFor('half').vbH}`));
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(screen.getByRole('radio', { name: '풀 코트' }));

    const def = courtDefFor('full', '25x14');
    await waitFor(() => expect(boardViewBox()).toBe(`0 0 ${def.vbW} ${def.vbH}`));
  });
});

/** 크기를 고른 뒤에도 화면이 **같은 코트 하나**를 말하는가. 규격상 완료·제품상 미배송을
 *  가르는 마지막 자리다 — viewBox 만 따라오고 라인이 안 따라오면 판이 반쪽만 바뀐다. */
describe('§6.4 고른 뒤의 판은 전부 같은 코트를 말한다', () => {
  it.each(COURT_SIZES)('%s — viewBox·경기면 외곽선·격자가 한 코트다', async (size: CourtSize) => {
    seedBoard(createDrill({ courtMode: 'full', courtSize: size }), true);
    await openBoard();
    const def = courtDefFor('full', size);
    const svg = screen.getByRole('application');
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
    const boxes = [...svg.querySelectorAll('rect')].map((r) => `${r.getAttribute('width')}×${r.getAttribute('height')}`);
    expect(boxes).toContain(`${def.surface.w}×${def.surface.h}`);
    // 격자 세로선은 gridGeom 에서 온다 — 캐시가 새면 여기서 남의 코트 x 가 나온다.
    const { cellW, origin } = def.grid;
    const gridXs = [...svg.querySelectorAll('line.grid-line')].map((l) => l.getAttribute('x1'));
    expect(gridXs).toContain(String(origin.x + cellW));
  });
});
