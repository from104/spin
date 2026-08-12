// 2.4 — `--hit` 실배선 + 트레이 93/117 (§5.4).
//
// 세 층을 따로 본다:
//   ① **픽셀 식** — trayChipBoxPx/trayRailWidthPx 가 §5.4 의 표(44→상자 44×60·폭 93,
//      56→56×78·117)를 재현하는가. jsdom 은 calc(var()) 를 계산하지 못하므로 픽셀 검증은
//      여기서만 가능하다.
//   ② **DOM 배선** — 화면의 인라인 style 이 정말 그 식의 calc 문자열을 쓰는가. 문자열을
//      소스에서 import 하지 않고 **리터럴로 다시 적는다** — 소스 상수를 읽어 비교하면 식이
//      틀려도 테스트가 따라 움직여 아무것도 못 잡는다(자기 사본 문제).
//   ③ **축척 불변** — 1024×600 에서 --hit 44↔56 전환이 pxPerUnit 을 한 눈금도 못 움직인다.
//      세로가 제약이라 트레이 24px 는 폭 여유(§5.4 '남는 폭')에서 나오기 때문이다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { trayChipBoxPx, trayRailWidthPx } from './trayMetrics.ts';
import { StageControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { BoardBar } from './BoardBar.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { CHROME_ROWS, courtBoxPx, courtScale } from '../../app/chromeBudget.ts';
import type { ChromeState } from '../../app/chromeBudget.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { BALL, CONE } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter } from '../../model/edits.ts';

// ── ① 픽셀 식 — §5.4 표 재현 ────────────────────────────────────────────────

describe('트레이 칩·폭 픽셀 식 (§5.4)', () => {
  it('--hit 44 → 칩 상자 44×60, 트레이 폭 93', () => {
    expect(trayChipBoxPx(44)).toEqual({ w: 44, h: 60 });
    expect(trayRailWidthPx(44)).toBe(93);
  });

  it('--hit 56 → 칩 상자 56×78, 트레이 폭 117', () => {
    expect(trayChipBoxPx(56)).toEqual({ w: 56, h: 78 });
    expect(trayRailWidthPx(56)).toBe(117);
  });

  it('완료 판정: 기본값에서도 칩 상자 ≥44×44 — 재편 전 30×39 의 복구', () => {
    const box = trayChipBoxPx(44);
    expect(box.w).toBeGreaterThanOrEqual(44);
    expect(box.h).toBeGreaterThanOrEqual(44);
  });
});

// ── ② DOM 배선 ──────────────────────────────────────────────────────────────

const SLOTS: ChairSlot[] = [
  { id: 'ch_hit_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff', placed: false },
  { id: 'ch_hit_b' as ChairId, number: '5', color: '#d93a3a', ink: '#fff', placed: true },
];

function Rail({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const [pending, setPending] = useState<ChairId | null>(null);
  return (
    <ToolRail
      tool="select"
      onSelectTool={() => {}}
      coneSlot={0}
      onConeSlotChange={() => {}}
      ballCount={0}
      ballMax={BALL.maxCount}
      coneCounts={[0, 0]}
      coneMax={CONE.maxCountPerColor}
      chairSlots={SLOTS}
      pendingPlayerId={pending}
      onArmPlayer={setPending}
      courtLabel="풀 코트"
      orientation={orientation}
    />
  );
}

// 픽셀 식과 같은 식의 calc — **리터럴이다.** 식을 바꾸면 ①과 여기가 함께 빨간불이 나야 맞다.
const ROW_MAX_CSS = 'calc(var(--hit) * 2 + 5px)';
const CHIP_BOX_H_CSS = 'calc((var(--hit) - 8px) * 1.5 + 6px)';

describe('트레이 DOM — 칩·폭이 --hit 파생 calc 로 걸려 있다', () => {
  it('세로 트레이의 폭이 칩 두 줄 식이다', () => {
    render(<Rail />);
    const nav = screen.getByRole('navigation', { name: '도구' });
    expect(nav.style.width).toBe(ROW_MAX_CSS);
    expect(nav.style.minWidth).toBe(ROW_MAX_CSS);
  });

  it('가로 트레이는 폭을 못박지 않는다 — 대조군', () => {
    render(<Rail orientation="horizontal" />);
    const nav = screen.getByRole('navigation', { name: '도구' });
    expect(nav.style.width).toBe('');
  });

  it('선수 칩 상자(끌 수 있는 것)가 --hit × 비율 파생이다', () => {
    render(<Rail />);
    const chip = screen.getByRole('button', { name: '2번 선수 배치' });
    expect(chip.style.width).toBe('var(--hit)');
    expect(chip.style.height).toBe(CHIP_BOX_H_CSS);
  });

  it('빈 슬롯(나가 있는 선수)도 같은 상자다 — 칸이 어긋나면 줄이 민다', () => {
    render(<Rail />);
    const slot = document.querySelector('span[title^="5번"]') as HTMLElement;
    expect(slot, '빈 슬롯 선택자가 낡았다').not.toBeNull();
    expect(slot.style.width).toBe('var(--hit)');
    expect(slot.style.height).toBe(CHIP_BOX_H_CSS);
  });

  it('칩 SVG 자체도 --hit 파생 크기다 — 뷰박스 좌표계라 그림·등번호가 같이 스케일된다', () => {
    render(<Rail />);
    const chip = screen.getByRole('button', { name: '2번 선수 배치' });
    const svg = chip.querySelector('svg')!;
    expect(svg.style.width).toBe('calc(var(--hit) - 8px)');
    expect(svg.style.height).toBe('calc((var(--hit) - 8px) * 1.5)');
  });

  it('공·콘 상자와 기능 도구는 min 으로만 자란다 — 기본 52×50, 큰 터치 타깃이면 56', () => {
    render(<Rail />);
    for (const name of ['공', '주황 콘', '선택']) {
      const btn = screen.getByRole('button', { name: new RegExp(`^${name}`) });
      expect(btn.style.minWidth).toBe('var(--hit)');
      expect(btn.style.minHeight).toBe('var(--hit)');
      // 대조군: 기본 크기는 그대로다(52 ≥ 44 라 min 이 진다) — 44 기본 화면은 안 바뀐다.
      expect(btn.style.width).toBe('52px');
    }
  });
});

// ── ② DOM 배선 — 코트 위·하단 바 (§5.4 "한 픽셀도 안 커진다" 목록의 복구) ──────

describe('StageControls — 7개 전부 --hit', () => {
  it('버튼 묶음이 var(--hit) 정사각이다', () => {
    render(
      <StageControls
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
        showGrid={false}
        onToggleGrid={() => {}}
        showRuleZones={false}
        onToggleRuleZones={() => {}}
        inspectorOpen={false}
        onToggleInspector={() => {}}
        inspectorPanelId="p"
        onShowHelp={() => {}}
      />,
    );
    // 3.9 에서 도움말이 **맨 끝에** 들어와 7개가 됐다 — §3 예산 내역 '스테이지 컨트롤 6
    // (줌 3 + 토글 2 + 도움말 1)' + 인스펙터 손잡이 1 이 이 묶음의 전부다.
    const names = ['확대', '축소', '줌 초기화', '격자 표시 전환', '골 지역 가이드 전환', '속성', '도움말'];
    for (const name of names) {
      const btn = screen.getByRole('button', { name });
      expect(btn.style.width, name).toBe('var(--hit)');
      expect(btn.style.height, name).toBe('var(--hit)');
    }
    // 대조군: 선택자가 통째로 낡지 않았다 — 정확히 6개가 전부다.
    expect(screen.getAllByRole('button')).toHaveLength(names.length);
  });
});

const settingsWrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

afterEach(() => {
  vi.restoreAllMocks();
});

/** 2.10 이 트랜스포트를 사진 뭉치로 재편하며 `steps` prop 이 `drill` 로 바뀌었다(칩이 스텝마다
 *  판을 그리려면 cast·팀 색·코트가 함께 필요하다). §16.1/§17.3 사전 등록대로 **선택자만** 옮기고
 *  `--hit` 파생 단언은 그대로 둔다 — 44 리터럴로 돌아가면 그건 갱신이 아니라 회귀다. */
function drillOf(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = addStepAfter(d, i - 1);
  return d;
}

function renderTransport(d: Drill) {
  render(
    <TransportBar
      drill={d}
      stepId={d.steps[0]!.id}
      onSelectStep={() => {}}
      onReorderStep={() => {}}
      onAddStep={() => {}}
      playing={false}
      onTogglePlay={() => {}}
      speed={1}
      onCycleSpeed={() => {}}
    />,
    { wrapper: settingsWrapper },
  );
}

describe('TransportBar — 이전/재생/다음·스텝 칩·속도가 --hit 파생', () => {
  it('이전/다음/한 장 더 찍기 44 → var(--hit), 재생은 +4px 위계를 유지한다', () => {
    renderTransport(drillOf(3));
    for (const name of ['이전 스텝', '다음 스텝', '한 장 더 찍기']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.style.width, name).toBe('var(--hit)');
      expect(btn.style.height, name).toBe('var(--hit)');
    }
    const play = screen.getByRole('button', { name: '재생' });
    expect(play.style.width).toBe('calc(var(--hit) + 4px)');
    expect(play.style.height).toBe('calc(var(--hit) + 4px)');
    const speed = screen.getByRole('button', { name: /^재생 속도/ });
    expect(speed.style.minHeight).toBe('var(--hit)');
  });

  it('스텝 칩(role=tab)의 히트 높이·최소폭이 var(--hit) 다', () => {
    // TransportBar.test.tsx 의 "과거엔 6px" 회귀 포인트와 같은 자리 — 이제 44 리터럴도 아니고,
    // 트랙 폭을 흉내 낼 필요도 없다(칩은 트랙을 나눠 갖지 않는다).
    renderTransport(drillOf(3));
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.style.height).toBe('var(--hit)');
      expect(tab.style.minHeight).toBe('var(--hit)');
      expect(tab.style.minWidth).toBe('var(--hit)');
    }
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});

describe('BoardBar — 비우기·골대 원위치·속도 스위치가 --hit 파생', () => {
  it('세 손잡이 전부 minHeight var(--hit)', () => {
    render(<BoardBar courtMode="full" courtLocked={false} onReset={() => {}} onResetGoals={() => {}} />, { wrapper: settingsWrapper });
    for (const name of ['코트 비우기', '골대 원위치']) {
      expect(screen.getByRole('button', { name }).style.minHeight, name).toBe('var(--hit)');
    }
    expect(screen.getByRole('switch', { name: '개체 이동 속도 제한' }).style.minHeight).toBe('var(--hit)');
  });
});

// ── ③ 축척 불변 — 완료 판정 "1024×600 에서 --hit 44↔56 전환에 pxPerUnit 변화 0" ──

describe('1024×600 — --hit 전환이 코트 축척을 건드리지 않는다', () => {
  const narrowState: ChromeState = { narrow: true, inspector: 'hidden' };
  // 예산표의 narrow 93 이 hit=44 의 트레이다. 56 이면 그 차이(24px)만큼 폭이 더 빠진다 —
  // 직접 min 을 적지 않는다(2.3 F7: 표 13 it 이 그 한 줄에 걸려 있었다).
  const extra = trayRailWidthPx(56) - trayRailWidthPx(44);

  it('예산표 트레이 행이 hit=44 식과 같다 — 이 대조가 어긋나면 아래 계산이 헛짚는다', () => {
    const row = CHROME_ROWS.find((r) => r.id === 'toolRail')!;
    expect(trayRailWidthPx(44)).toBe(row.narrow);
    expect(extra).toBe(24);
  });

  it.each(['full', 'half', 'flat'] as const)('%s 코트: pxPerUnit 변화가 정확히 0 이다', (mode) => {
    const at44 = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    const at56 = { w: at44.w - extra, h: at44.h };
    const s44 = courtScale(mode, at44);
    const s56 = courtScale(mode, at56);
    expect(s56.pxPerUnit).toBe(s44.pxPerUnit);
    // 이유까지 못박는다: 폭을 24 뺏겨도 여전히 **세로가 제약**이라(§5.4 '남는 폭 172px')
    // 축척이 통째로 세로에서 나온다 — 돌지 않았고, 값이 정확히 h/vbH 다.
    expect(s56.rot).toBe(0);
    expect(s56.pxPerUnit).toBe(at56.h / COURT_DEFS[mode].vbH);
  });

  it('대조군: 폭이 제약인 상자였다면 24px 만큼 실제로 줄었다', () => {
    // "변화 0" 단언이 courtScale 고장(항상 같은 값)으로도 통과하지 않는지 찌른다.
    // (400 이 아니라 600 인 이유: 상자가 세로로 길어지면 rotForFit 이 돌려서 도로 세로 제약이
    //  된다 — 폭 제약을 유지하려면 안 도는 납작한 상자라야 한다.)
    const tight = { w: 600, h: 468 };
    const tighter = { w: 600 - extra, h: 468 };
    expect(courtScale('full', tighter).pxPerUnit).toBeLessThan(courtScale('full', tight).pxPerUnit);
  });
});
