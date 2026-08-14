// §6.10 판 가장자리 트레이 — 개체(끌어다 놓는 말) / 기능(모드) 두 구역, 선수 주차 슬롯,
// 공·콘 상자의 남은 개수, 색깔별 콘 상자, 선수 칩 탭.
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FLYOUT_LEAVE_CLOSE_MS, FLYOUT_PICK_CLOSE_MS, ToolRail, type ChairSlot, type ToolRailProps } from './ToolRail.tsx';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { BALL, CONE } from '../../core/constants.ts';
import { CHIP_BOX_H_CSS, trayChipBoxPx } from './trayMetrics.ts';

const SLOTS: ChairSlot[] = [
  { id: 'ch_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff', placed: false },
  { id: 'ch_b' as ChairId, number: 'G', color: '#2f7de1', ink: '#fff', placed: false },
];

/** 상자 기본값 — 재고가 가득한 상태. 개별 테스트가 필요한 것만 덮어쓴다. */
const FULL = {
  ballCount: 0,
  ballMax: BALL.maxCount,
  coneCounts: [0, 0] as [number, number],
  coneMax: CONE.maxCountPerColor,
};

// 2026-08-14 — `tray`·`onTrayChange`·`drillUses` 가 사라졌다(서랍이 플라이아웃이 되면서
// "열린 채로 둔다" 라는 상태가 없어졌다). 남은 확장 지점은 방향 하나다.
type RailExtras = Pick<ToolRailProps, 'orientation'>;

function ControlledRail({ chairSlots, ...extras }: { chairSlots?: ChairSlot[] } & RailExtras) {
  const [tool, setTool] = useState<ToolId>('select');
  const [coneSlot, setConeSlot] = useState<0 | 1>(0);
  const [pending, setPending] = useState<ChairId | null>(null);
  return (
    <ToolRail
      tool={tool}
      onSelectTool={setTool}
      coneSlot={coneSlot}
      onConeSlotChange={setConeSlot}
      {...FULL}
      chairSlots={chairSlots ?? []}
      pendingPlayerId={pending}
      onArmPlayer={setPending}
      courtLabel="풀 코트"
      {...extras}
    />
  );
}

/** 도구를 **밖에서** 쥔 렌더 — 단축키(R·P·T)로 도구가 바뀐 상황을 그대로 흉내낸다.
 *  ToolRail 은 단축키를 스스로 듣지 않는다(useEditorKeyboard 가 듣고 tool 을 내려준다). */
function renderWithTool(tool: ToolId, onSelectTool: (t: ToolId) => void = () => {}, extras: RailExtras = {}) {
  return render(
    <ToolRail
      tool={tool}
      onSelectTool={onSelectTool}
      coneSlot={0}
      onConeSlotChange={() => {}}
      {...FULL}
      chairSlots={SLOTS}
      pendingPlayerId={null}
      onArmPlayer={() => {}}
      courtLabel="풀 코트"
      {...extras}
    />,
  );
}

/** 기능 구역 안의 표적만 센다 — 첫 화면 표적 예산(2.5)이 세는 것과 같은 단위다. */
const functionTargets = () =>
  [...document.querySelectorAll<HTMLElement>('[aria-label="기능"] button')].map(
    // 여는 방향 표식 — 2026-08-14 플라이아웃 이후 세로 기둥은 ◂, 가로 띠는 ▴ 다.
    (b) => b.textContent?.replace(/[▸▾◂▴]/g, '').trim() ?? '',
  );

const handle = (label: '작도' | '설명') => screen.getByRole('button', { name: new RegExp(`^${label}`) });
const expanded = (label: '작도' | '설명') => handle(label).getAttribute('aria-expanded');
const hasTool = (label: string) => screen.queryByRole('button', { name: new RegExp(`^${label}`) }) !== null;
describe('ToolRail — 기능 구역', () => {
  it('모드 도구는 4표적이다 — 선택 · 지우개 · 작도 손잡이 · 설명 손잡이 (3.7)', () => {
    // 5종 상시 노출로 되돌리면 §3 의 미착수분(도움말 1 · 빈 판 채우기 1)이 들어올 때
    // 2.5 게이트(≤40)가 빨간불이 된다. 접는 것이지 없애는 게 아니다 — 아래 it 들이 그 증명.
    render(<ControlledRail />);
    expect(functionTargets()).toEqual(['선택', '지우개', '작도', '설명']);
  });

  it('접힌 3종(이동·패스·메모)은 닫힌 서랍 안이라 첫 화면 표적이 아니다', () => {
    // 숨기기(display:none)가 아니라 **DOM 에 없음**이라야 표적 수가 실제로 준다.
    render(<ControlledRail />);
    for (const label of ['이동', '패스', '메모']) {
      expect(hasTool(label), label).toBe(false);
    }
    expect(expanded('작도')).toBe('false');
    expect(expanded('설명')).toBe('false');
  });

  it('작도 손잡이를 누르면 이동·패스가 나온다 — 메모는 그대로 접혀 있다(대조군)', async () => {
    render(<ControlledRail />);
    const user = userEvent.setup();
    await user.click(handle('작도'));
    expect(expanded('작도')).toBe('true');
    expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
    for (const label of ['이동', '패스']) expect(hasTool(label), label).toBe(true);
    // 대조군이 없으면 "손잡이 아무거나 누르면 전부 열린다" 인 구현도 통과한다.
    expect(hasTool('메모')).toBe(false);
    expect(expanded('설명')).toBe('false');
  });

  it('설명 손잡이를 누르면 메모가 나온다 — 이동·패스는 그대로 접혀 있다(대조군)', async () => {
    // 서랍을 둘로 가른 값이 여기 있다: 코트에 설명만 붙이는 사람이 화살표 2종을 상시
    // 표적으로 떠안지 않는다. 한 서랍이면 이 it 이 성립하지 않는다.
    render(<ControlledRail />);
    const user = userEvent.setup();
    await user.click(handle('설명'));
    expect(expanded('설명')).toBe('true');
    expect(screen.getByRole('group', { name: '설명 도구' })).toBeInTheDocument();
    expect(hasTool('메모')).toBe(true);
    for (const label of ['이동', '패스']) expect(hasTool(label), label).toBe(false);
    expect(expanded('작도')).toBe('false');
  });




  it('서랍 안 도구를 누르면 그 도구가 켜진다 — 접었지 없애지 않았다', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('select', onSelectTool);
    const user = userEvent.setup();
    await user.click(handle('작도'));
    await user.click(screen.getByRole('button', { name: /^이동/ }));
    expect(onSelectTool).toHaveBeenCalledWith('route');
    // 대조군: 손잡이 자체는 도구를 고르지 않는다(열고 닫기만 한다) — 위 1회가 전부다.
    expect(onSelectTool).toHaveBeenCalledTimes(1);
  });

  it('손잡이 둘 다 --hit 손잡이다 — 서랍을 여는 것이 44 미만이면 접은 값이 없다', () => {
    render(<ControlledRail />);
    for (const label of ['작도', '설명'] as const) {
      expect(handle(label).style.minWidth, label).toBe('var(--hit)');
      expect(handle(label).style.minHeight, label).toBe('var(--hit)');
      expect(handle(label).style.width, label).toBe('52px');
    }
  });

  it("'선수' 는 모드 버튼이 아니라 칩으로 놓인다", () => {
    // 개체를 모드 버튼으로 두면 "고르고 → 찍는" 2단계가 되고, 그게 공개판 최대 불만이었다.
    render(<ControlledRail chairSlots={SLOTS} />);
    expect(screen.queryByRole('button', { name: /^선수$/ })).toBeNull();
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G번 선수 배치' })).toBeInTheDocument();
  });
});

// ─── 세로 트레이의 **좌표 모형** ────────────────────────────────────────────────
// jsdom 에는 레이아웃이 없다 — `getBoundingClientRect()` 가 전부 0 을 돌려주므로 *"서랍을
// 열어도 위쪽 항목이 한 픽셀도 안 움직인다"*(§3 불변식 1)를 브라우저에게 물어볼 수 없다.
// 그래서 트레이가 실제로 쓰는 **flex 상자 모형을 여기서 다시 계산한다**: 크기·gap·padding·
// margin·wrap 이 전부 인라인 style 에 선언돼 있다.
// `var(--hit)`·`calc(...)`·`100%` 는 §5.4 기본 44 로 푼다 — trayMetrics 의 픽셀 함수와 같은 해석이다.
//
// **문서 순서보다 강한 이유**: 순서가 그대로여도 위쪽 어딘가의 크기·gap·padding 이 바뀌면
// 아래 항목의 좌표는 움직인다. 그 경우를 잡는다(3.-1 은 순서로만 쟀고 이 자리를 열어 뒀다).
// **못 보는 것**: CSS 파일 쪽 규칙과 `order`, 교차축 정렬(alignItems). 흐름 밖(position:absolute)·
// 화면 밖(sr-only)은 아예 세지 않는다 — 실제 CSS 도 그것들에 자리를 주지 않는다.
//
// ── 2026-08-14 P3 로 모형을 두 군데 넓혔다 (설계서 §6 의 4단계 절차) ─────────────────────
//  ① **wrap** — 트레이가 유동 폭이 되면서 개체·기능 구역이 column 에서 row + wrap 으로 바뀌었다.
//     wrap 을 모르는 모형은 모든 항목을 한 줄에 세워 놓고 "아무도 안 움직였다" 고 답한다.
//     그래서 트레이 폭(=칩 열 수)이 모형의 **입력**이 됐다: `trayBoxes(cols)`.
//  ② **x 좌표** — 이게 없으면 §6 이 요구한 반증 실험이 그냥 통과해 버린다. 서랍 손잡이를 도구
//     그룹 **앞**으로 옮기면 선택·지우개가 오른쪽으로 밀리는데 wrap 축에서는 **y 가 한 픽셀도
//     안 변한다.** 세로로 쌓이던 시절 y 가 하던 일을 이제 x 가 한다.
//     (실제로 2026-08-14 에 이 반증을 돌려 확인했다 — 아래 '반증 실험' it 이 그 절차다.)
const HIT_PX = 44;
/** 칩 `cols` 열짜리 트레이의 안쪽 폭. 좌우 패딩이 0 이라 이것이 곧 트레이 폭이다. */
const trayW = (cols: number): number => HIT_PX * cols + 5 * (cols - 1);

/** 치수 하나를 픽셀로. `100%` 는 부모 안쪽 폭(basis)으로 푼다.
 *  못 푸는 문자열은 0 이다 — 그 자리는 아래 대조군 it 들이 지킨다. */
function pxOf(v: string, basis = 0): number {
  if (!v) return 0;
  const s = v.trim();
  if (s === CHIP_BOX_H_CSS) return trayChipBoxPx(HIT_PX).h;
  if (s === 'var(--hit)') return HIT_PX;
  if (s === '100%') return basis;
  // 트레이 하한·상한 폭 — `calc(var(--hit) * N + Mpx)`.
  const calc = /^calc\(var\(--hit\) \* (\d+) \+ (\d+)px\)$/.exec(s);
  if (calc) return HIT_PX * Number(calc[1]) + Number(calc[2]);
  const m = /^(-?[\d.]+)px$/.exec(s);
  return m ? Number(m[1]) : 0;
}

interface TrayBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Measured {
  w: number;
  h: number;
  /** 이 요소의 **마진 상자 원점** 기준 좌표. 부모가 자기 자리만큼 밀어 준다. */
  boxes: TrayBox[];
}

/** 줄바꿈 판정의 부동소수 여유. */
const EPS = 0.5;

/** 이름 — 스크린리더 이름이 있으면 그것, 없으면 흐름 안 텍스트(배지·활성 링은 absolute 라 뺀다). */
function nameOf(el: HTMLElement): string {
  const label = el.getAttribute('aria-label');
  if (label) return label;
  const clone = el.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll<HTMLElement>('*')]) if (d.style.position === 'absolute') d.remove();
  return (clone.textContent ?? '').replace(/[▸▾]/g, '').replace(/\s+/g, ' ').trim() || '·';
}

/** 한 상자를 재고 자기 크기(margin 포함)와 안쪽 상자들의 좌표를 돌려준다.
 *  선언된 **높이**가 있으면 잎이다 — 버튼·칩·구분선이 그렇고, 그 안쪽(아이콘·라벨)은 상자
 *  크기를 바꾸지 못하므로 안 들어간다.
 *  `stretch` 는 "부모가 세로(column)라 교차축으로 늘어난다" 는 뜻이다 — 가로(row) 부모의
 *  자식은 flex 항목이라 폭이 **내용 기준**이다(flex-basis auto).
 *  jsdom 은 축약형을 longhand 로 펼쳐 두므로 longhand 만 읽는다(둘 다 읽으면 이중 계산). */
function measure(el: HTMLElement, availW: number, stretch: boolean): Measured {
  const s = el.style;
  const mt = pxOf(s.marginTop);
  const mb = pxOf(s.marginBottom);
  const ml = pxOf(s.marginLeft);
  const mr = pxOf(s.marginRight);
  const minW = pxOf(s.minWidth, availW);
  const maxW = s.maxWidth ? pxOf(s.maxWidth, availW) : Number.POSITIVE_INFINITY;
  const fit = (w: number): number => Math.min(maxW, Math.max(minW, w));
  const explicitW = pxOf(s.width, availW);
  const own = Math.max(pxOf(s.height), pxOf(s.minHeight));
  if (own > 0) {
    const w = fit(explicitW || (stretch ? availW : 0));
    return { w: w + ml + mr, h: own + mt + mb, boxes: [{ name: nameOf(el), x: ml, y: mt, w, h: own }] };
  }
  const padT = pxOf(s.paddingTop);
  const padB = pxOf(s.paddingBottom);
  const padL = pxOf(s.paddingLeft);
  const padR = pxOf(s.paddingRight);
  const box = explicitW || (stretch ? fit(availW) : 0);
  const inner = (box > 0 ? box : availW) - padL - padR;
  const gap = pxOf(s.gap);
  const row = s.flexDirection === 'row';
  const wrap = s.flexWrap === 'wrap';
  const boxes: TrayBox[] = [];
  let cx = 0;
  let cy = 0;
  let lineH = 0;
  let widest = 0;
  let n = 0;
  for (const child of [...el.children] as HTMLElement[]) {
    if (child.style.position === 'absolute') continue; // 흐름 밖
    if (child.classList.contains('sr-only')) continue; // 화면 밖(실제 CSS 도 absolute 다)
    const m = measure(child, inner, !row);
    if (row) {
      if (n > 0) {
        if (wrap && cx + gap + m.w > inner + EPS) {
          cy += lineH + gap;
          cx = 0;
          lineH = 0;
        } else {
          cx += gap;
        }
      }
      for (const b of m.boxes) boxes.push({ ...b, x: b.x + cx, y: b.y + cy });
      cx += m.w;
      lineH = Math.max(lineH, m.h);
      widest = Math.max(widest, cx);
    } else {
      if (n > 0) cy += gap;
      for (const b of m.boxes) boxes.push({ ...b, y: b.y + cy });
      cy += m.h;
      widest = Math.max(widest, m.w);
    }
    n += 1;
  }
  const dx = ml + padL;
  const dy = mt + padT;
  return {
    w: (box > 0 ? box : fit(widest + padL + padR)) + ml + mr,
    h: (row ? cy + lineH : cy) + padT + padB + mt + mb,
    boxes: boxes.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
  };
}

/** 트레이의 모든 상자를 문서 순서 + (x, y) 로. `cols` 는 칩 열 수 = 트레이 폭이다. */
function trayBoxes(cols = 5): TrayBox[] {
  return measure(document.querySelector<HTMLElement>('nav[data-tray]')!, trayW(cols), true).boxes;
}

const at = (boxes: TrayBox[], name: string): TrayBox => boxes.find((b) => b.name === name)!;
const boxY = (boxes: TrayBox[], name: string): number => at(boxes, name).y;
const boxX = (boxes: TrayBox[], name: string): number => at(boxes, name).x;

/** 선수 8명 — 실제 드릴의 기본 인원(defaultCast: 두 팀 × G·2·3·4)이자 wrap 이 실제로
 *  일어나는 유일한 개수다. 2명짜리 SLOTS 로는 5열에서 줄이 안 넘어가 wrap 을 못 찌른다. */
const EIGHT: ChairSlot[] = ['G', '2', '3', '4', 'G', '2', '3', '4'].map((n, i) => ({
  id: `ch_w${i}` as ChairId,
  number: n,
  name: `선수${i}`,
  color: i < 4 ? '#d93a3a' : '#1f6bb8',
  ink: '#fff',
  placed: false,
}));
const chipName = (i: number): string => `${EIGHT[i]!.number}번 ${EIGHT[i]!.name} 선수 배치`;

describe('ToolRail — 좌표 모형이 wrap 을 실제로 흉내낸다 (§6 절차 ②)', () => {
  // §6: *"모형이 실제를 못 흉내내면 이 테스트는 헛통과한다."* 그래서 **열 수를 바꿔가며 같은 줄/
  // 다른 줄이 실제로 바뀌는지**를 먼저 못박는다. 이 절이 통과해야 아래 불변식 절이 의미를 갖는다.
  it('칩은 열 수만큼 한 줄에 서고 그 다음이 아랫줄로 넘어간다 — 5열', () => {
    render(<ControlledRail chairSlots={EIGHT} />);
    const b = trayBoxes(5);
    // 1행 다섯(같은 y, x 는 hit+gap 씩), 2행 셋(첫 칸 x 가 1행 첫 칸과 같다 = flex-start)
    for (let i = 1; i < 5; i++) {
      expect(boxY(b, chipName(i)), `칩 ${i}`).toBe(boxY(b, chipName(0)));
      expect(boxX(b, chipName(i)), `칩 ${i}`).toBe(boxX(b, chipName(0)) + i * (HIT_PX + 5));
    }
    expect(boxY(b, chipName(5))).toBe(boxY(b, chipName(0)) + trayChipBoxPx(HIT_PX).h + 5);
    expect(boxX(b, chipName(5)), '2행이 1행 아래에 안 맞춰 섰다 — justifyContent 가 center 인가').toBe(
      boxX(b, chipName(0)),
    );
  });

  it('2열로 좁히면 같은 칩이 다른 줄로 간다 — 모형이 폭을 정말 보고 있다', () => {
    render(<ControlledRail chairSlots={EIGHT} />);
    const wide = trayBoxes(5);
    const narrowTray = trayBoxes(2);
    // 5열에서는 0·2 가 같은 줄, 2열에서는 다른 줄. 같은 DOM 인데 답이 갈려야 한다.
    expect(boxY(wide, chipName(2))).toBe(boxY(wide, chipName(0)));
    expect(boxY(narrowTray, chipName(2))).toBeGreaterThan(boxY(narrowTray, chipName(0)));
    expect(boxX(narrowTray, chipName(2))).toBe(boxX(narrowTray, chipName(0)));
  });

  it('도구 손잡이 넷도 폭 따라 접힌다 — 5열이면 한 줄, 2열이면 넉 줄', () => {
    // 설계서 §4.3 검산표의 '도구 50 / 215' 가 정확히 이 두 경우다.
    render(<ControlledRail chairSlots={EIGHT} />);
    const wide = trayBoxes(5);
    const narrowTray = trayBoxes(2);
    expect(boxY(wide, '지우개')).toBe(boxY(wide, '선택'));
    expect(boxX(wide, '지우개')).toBe(boxX(wide, '선택') + 52 + 5); // 버튼 52 + 기능 구역 gap 5
    expect(boxY(narrowTray, '지우개')).toBe(boxY(narrowTray, '선택') + 50 + 5); // 버튼 50 + gap 5
    expect(boxX(narrowTray, '지우개')).toBe(boxX(narrowTray, '선택'));
  });
});


// ── 서랍 = 플라이아웃 (2026-08-14 기현님 재설계) ──────────────────────────────────────
//
// 옛 서랍은 흐름 안에서 펼쳐졌고, 그래서 이 파일에는 "열어도 앞쪽 좌표가 안 움직인다" 를
// 재는 좌표 모형 describe 가 셋 있었다(§3 불변식 1). 플라이아웃은 `position:absolute` 라
// **흐름을 한 픽셀도 안 먹으므로** 그 세 describe 가 재던 것이 원인째 사라졌다 — 지웠다.
// 대신 그 자리를 지키는 단언은 하나다: **패널이 흐름 밖에 있다.**
describe('ToolRail — 서랍 플라이아웃', () => {
  const handle = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

  it('열린 패널은 흐름 밖(fixed)이고 트레이 **밖**에 붙는다 — 자르는 조상을 피하는 유일한 길', async () => {
    // 2026-08-14 기현님 신고(*"서랍이 안 펼쳐진다"*)의 수리. 트레이의 `overflow` 가 패널을
    // 통째로 잘라내고 있었다 — 흐름에서 빼는 것만으로는 부족하고 **자르는 조상 밖**이라야 한다.
    const user = userEvent.setup();
    render(<ControlledRail />);
    await user.click(handle('작도'));
    const panel = screen.getByRole('group', { name: '작도 도구' });
    expect(panel.style.position, '흐름 안이면 앞쪽 표적이 밀린다(§3 불변식 1)').toBe('fixed');
    expect(document.querySelector('nav[data-tray]')!.contains(panel), '트레이 안이면 잘린다').toBe(false);
  });

  it('세로 기둥은 **왼쪽**(코트 쪽)으로, 가로 띠는 **위**로 편다 — 판 안쪽이라 안 잘린다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ControlledRail />);
    await user.click(handle('작도'));
    const side = screen.getByRole('group', { name: '작도 도구' });
    // 세로 기둥은 왼쪽으로 — `right` 를 잡고 `bottom` 은 안 잡는다(값은 잰 좌표라 안 못박는다).
    expect(side.style.right).not.toBe('');
    expect(side.style.top).not.toBe('');
    expect(side.style.bottom).toBe('');
    unmount();

    render(<ControlledRail orientation="horizontal" />);
    await user.click(handle('작도'));
    const band = screen.getByRole('group', { name: '작도 도구' });
    // 가로 띠는 위로 — `bottom` 을 잡고 `right` 는 안 잡는다.
    expect(band.style.bottom).not.toBe('');
    expect(band.style.left).not.toBe('');
    expect(band.style.right).toBe('');
  });

  it('마우스가 올라가면 열린다 — 누르지 않아도 된다', async () => {
    render(<ControlledRail />);
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
    expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
  });

  it('터치의 pointerenter 로는 안 열린다 — 열자마자 click 이 도로 닫는 것을 막는다', () => {
    render(<ControlledRail />);
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'touch' });
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
  });

  it('하위 도구를 고르면 **딜레이 뒤에** 닫힌다 — 즉시 닫으면 고른 것이 눈에 안 남는다', async () => {
    vi.useFakeTimers();
    try {
      render(<ControlledRail />);
      fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
      const panel = screen.getByRole('group', { name: '작도 도구' });
      fireEvent.click(within(panel).getByRole('button', { name: /이동/ }));

      // 아직 열려 있다 — 이 한 줄이 "딜레이" 를 못박는다(0 이면 여기서 이미 닫힌다).
      expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(FLYOUT_PICK_CLOSE_MS + 1));
      expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('포인터가 나가면 닫힌다 — 손잡이와 패널 사이를 지나는 틈만큼 늦게', async () => {
    vi.useFakeTimers();
    try {
      render(<ControlledRail />);
      const btn = handle('작도');
      fireEvent.pointerEnter(btn, { pointerType: 'mouse' });
      expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
      fireEvent.pointerLeave(btn, { pointerType: 'mouse' });
      act(() => void vi.advanceTimersByTime(FLYOUT_LEAVE_CLOSE_MS - 10));
      expect(screen.getByRole('group', { name: '작도 도구' }), '틈을 지나다 닫혔다').toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(20));
      expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('한 번에 하나만 열린다 — 둘이 겹쳐 뜨면 어느 것이 어느 서랍인지 사라진다', () => {
    render(<ControlledRail />);
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
    fireEvent.pointerEnter(handle('설명'), { pointerType: 'mouse' });
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    expect(screen.getByRole('group', { name: '설명 도구' })).toBeInTheDocument();
  });

  it('Esc 로 닫힌다', () => {
    render(<ControlledRail />);
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
  });
});

describe('ToolRail — 선수 주차 슬롯', () => {
  it('코트에 나가 있는 선수는 빈 슬롯으로 남고 끌 수 없다', () => {
    // 자리가 사라지면 트레이 길이가 배치할 때마다 출렁이고, 무엇보다 코트에서 빼낸 말이
    // 어디로 돌아가는지가 안 보인다. 자리는 남기되 버튼이 아니게 만든다.
    render(<ControlledRail chairSlots={[{ ...SLOTS[0]!, placed: true }, SLOTS[1]!]} />);
    expect(screen.queryByRole('button', { name: '2번 선수 배치' })).toBeNull();
    expect(screen.getByRole('button', { name: 'G번 선수 배치' })).toBeInTheDocument();
  });
});

describe('ToolRail — 개체 상자', () => {
  it('공 상자는 놓은 수가 아니라 **남은** 수를 보여 준다', () => {
    // 손이 다음에 알고 싶은 것은 "몇 개 놓았나"가 아니라 "몇 개 더 꺼낼 수 있나"다.
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        ballCount={3}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    const ballBtn = screen.getByRole('button', { name: /^공/ });
    expect(ballBtn).toHaveTextContent(String(BALL.maxCount - 3));
    // 개수는 **이름**이 아니라 설명이다 — 이름이 흔들리면 같은 버튼이 매번 다르게 들린다.
    expect(ballBtn).toHaveAccessibleName('공');
    expect(ballBtn).toHaveAccessibleDescription(`${BALL.maxCount - 3}개 남음`);
  });

  it('공 상자가 비면 aria-disabled 가 되고 남은 수가 0 이다', () => {
    render(
      <ToolRail
        tool="ball"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        ballCount={BALL.maxCount}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    const ballBtn = screen.getByRole('button', { name: /^공/ });
    expect(ballBtn).toHaveAttribute('aria-disabled', 'true');
    expect(ballBtn).toHaveAccessibleDescription(`상자가 비었습니다 — 최대 ${BALL.maxCount}개`);
  });

  it('콘은 색마다 상자가 따로고 남은 수도 따로다', () => {
    // 배지 하나로 두 색의 재고를 나타낼 수 없다 — 그래서 재클릭 색 토글 팝오버를 버렸다.
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        coneCounts={[5, 1]}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    expect(screen.getByRole('button', { name: '주황 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 5}개 남음`,
    );
    expect(screen.getByRole('button', { name: '파랑 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 1}개 남음`,
    );
  });

  it('콘 상자를 누르면 그 색이 곧 선택된 색이 된다', async () => {
    const user = userEvent.setup();
    render(<ControlledRail />);
    await user.click(screen.getByRole('button', { name: '파랑 콘' }));
    expect(screen.getByRole('button', { name: '파랑 콘' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '주황 콘' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('선수 칩을 탭하면 그 선수를 배치 대기로 만든다(예전 2단계 경로 유지)', async () => {
    const user = userEvent.setup();
    render(<ControlledRail chairSlots={SLOTS} />);
    await user.click(screen.getByRole('button', { name: '2번 선수 배치' }));
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ToolRail — 끌어다 놓기 연결', () => {
  type ItemDown = NonNullable<ToolRailProps['onItemPointerDown']>;
  const renderWithDrag = (onItemPointerDown: ItemDown) =>
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        chairSlots={SLOTS}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
        onItemPointerDown={onItemPointerDown}
      />,
    );

  it('개체(선수 칩·공·콘)는 pointerdown 에서 드래그 세션을 연다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: '2번 선수 배치' }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'player', chairId: 'ch_a' });

    onItem.mockClear();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^공/ }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'ball' });
  });

  it('콘은 어느 상자에서 꺼냈는지를 드래그가 들고 간다', async () => {
    // 도구 상태(coneSlot)와 어긋날 수 있다 — 파랑 상자를 끌었으면 파랑이어야 한다.
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: '파랑 콘' }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'cone', coneSlot: 1 });
  });

  it('배선된 상태에서도 키보드 Enter 로 칩을 집을 수 있다(§5.6 복구)', async () => {
    // 주 사용자는 입에 문 젓가락으로 타이핑한다 — 키보드 경로가 죽으면 트레이가 통째로 닫힌다.
    // 키보드 활성화는 pointerdown 없이 click(detail=0)만 오므로, 드래그가 배선돼 있어도
    // onTap(=onArmPlayer)이 그대로 발화해야 한다.
    const onItem = vi.fn<ItemDown>();
    const onArm = vi.fn();
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        chairSlots={SLOTS}
        pendingPlayerId={null}
        onArmPlayer={onArm}
        courtLabel="풀 코트"
        onItemPointerDown={onItem}
      />,
    );
    const user = userEvent.setup();
    screen.getByRole('button', { name: '2번 선수 배치' }).focus();
    await user.keyboard('{Enter}');
    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onArm).toHaveBeenCalledWith('ch_a');
    expect(onItem).not.toHaveBeenCalled();
  });

  it('배선된 상태의 마우스 탭은 한 번만 발화한다 — pointerdown 경로와 click 이 겹치지 않는다', async () => {
    // 실제 배선(useTrayDrag)은 문턱을 못 넘긴 탭에서 onTap 을 부른다. 그 뒤에 따라오는
    // click(detail=1)까지 onTap 을 부르면 이중 발화다 — 그게 §5.6 이 경계한 전형적 실패다.
    const onItem = vi.fn<ItemDown>((_item, _e, onTap) => onTap());
    const onArm = vi.fn();
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        chairSlots={SLOTS}
        pendingPlayerId={null}
        onArmPlayer={onArm}
        courtLabel="풀 코트"
        onItemPointerDown={onItem}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2번 선수 배치' }));
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('기능 도구는 끌 수 없다 — 모드라서 끌 것이 없다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^지우개/ }) });
    expect(onItem).not.toHaveBeenCalled();
  });
});
