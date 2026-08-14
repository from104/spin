// 2026-08-14 P5 — **세로 띠의 DOM 배선.** trayBand.test.ts 가 숫자를 재고, 여기서는 화면이
// 정말 그 식을 걸고 있는지를 본다.
//
// ⚠️ 세 층을 **따로** 단언한다(하나로 묶으면 하나가 깨져도 다른 것이 대신 걸러 준다):
//   ① 높이 못박음 — `height` 가 없으면 띠가 내용을 따라 들쭉날쭉해지고 **코트 크기가 흔들린다.**
//   ② wrap — 없으면 옛날처럼 한 줄로 늘어서 가로로만 스크롤한다(2행이 아니다).
//   ③ overflowY — 3행으로 넘치는 폭(480×800 실측 182px)에서 **유일한 도달 경로**다.
//      없으면 도구 줄이 잘려 작도·설명에 영영 못 닿는다(위험 3 의 세로판).
// 그리고 교차축 정렬(alignContent) — §3 불변식 1 이 주축에서 요구한 것과 **같은 이유**의 세로판.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { TRAY_BAND_PAD_X, TRAY_BAND_PAD_Y, trayBandSectionsPx } from './trayMetrics.ts';
import { BALL, CONE } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';

const SLOTS: ChairSlot[] = [
  { id: 'ch_band_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff', placed: false },
  { id: 'ch_band_b' as ChairId, number: '5', color: '#1f6bb8', ink: '#fff', placed: false },
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
      zoom={{ onZoomIn: () => {}, onZoomOut: () => {}, onZoomReset: () => {} }}
      // 2026-08-14 — 되돌리기·다시하기가 헤더에서 줌 아래로 왔다. 줄나눔 모형
      // (trayBandSectionsPx)이 이 구역을 세므로 여기서 빠지면 모형과 화면이 갈라진다.
      history={{ canUndo: false, canRedo: false, onUndo: () => {}, onRedo: () => {} }}
    />
  );
}

const rail = () => screen.getByRole('navigation', { name: '도구' });

/** 픽셀 식과 같은 식의 calc — **리터럴이다.** 상수를 import 해 비교하면 식이 틀려도 테스트가
 *  따라 움직여 아무것도 못 잡는다(ToolRail.hit.test.tsx 의 같은 관례). */
const BAND_2ROW_CSS = 'calc((var(--hit) - 8px) * 1.5 + 6px + max(50px, var(--hit)) + 22px)';

describe('세로 띠 — 높이가 못박혀 있다 (코트가 안 흔들리는 근거)', () => {
  it('★ height 가 2행 calc 식이다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.height).toBe(BAND_2ROW_CSS);
  });

  it('대조군 — 세로 기둥(가로 화면)에는 height 가 없다', () => {
    // 기둥은 판 높이를 그대로 받아야 한다. 여기에 띠 높이가 새면 판이 통째로 찌그러진다.
    render(<Rail />);
    expect(rail().style.height).toBe('');
  });

  it('띠 높이는 **내용과 무관한 상수**라야 한다 — 서랍을 열어도 안 변한다', async () => {
    // 세로 전용 서랍안이 기각된 이유가 이것이다(설계서 §4.7 ⚠️): 띠가 76 → 132 로 변하면
    // 코트 축척이 0.7176 → 0.6497 로 바뀌어 **판 위 모든 개체가 움직인다.**
    render(<Rail orientation="horizontal" />);
    const before = rail().style.height;
    await userEvent.setup().click(screen.getByRole('button', { name: /^작도/ }));
    // 대조군: 서랍이 실제로 열렸다(안 열렸으면 '안 변한다' 는 아무것도 안 재는 문장이다).
    expect(screen.getByRole('button', { name: /이동/ })).toBeInTheDocument();
    expect(rail().style.height).toBe(before);
    expect(rail().style.minHeight, '최소 높이로 슬쩍 자라면 못박음이 아니다').toBe('');
    expect(rail().style.maxHeight).toBe('');
  });
});

describe('세로 띠 — wrap 과 그 교차축 정렬', () => {
  it('★ flexWrap 이 wrap 이다 — 없으면 2행이 아니라 옛날 한 줄이다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.flexWrap).toBe('wrap');
  });

  it('대조군 — 세로 기둥의 nav 는 wrap 하지 않는다(접히는 것은 그 안 구역들이다)', () => {
    render(<Rail />);
    expect(rail().style.flexWrap).toBe('');
  });

  it('★ alignContent 가 flex-start 다 — center/stretch 면 줄이 늘 때 첫 줄이 움직인다', () => {
    // §3 불변식 1 의 세로판. 서랍을 열어 줄이 하나 늘면 중앙정렬에서는 선수 칩이 통째로 위로
    // 올라간다 — 발 마우스·입 젓가락 사용자의 공간 기억이 깨지는 그 고장이다.
    // 겸해서: 3행으로 넘칠 때 위쪽 넘침은 scrollTop 으로 못 간다(첫 줄에 손이 안 닿는다).
    render(<Rail orientation="horizontal" />);
    expect(rail().style.alignContent).toBe('flex-start');
    expect(rail().style.alignContent).not.toBe('center');
  });

  it('★ overflowY 가 auto 다 — 3행으로 넘치는 폭에서 유일한 도달 경로', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.overflowY).toBe('auto');
    // 가로 넘침 경로도 그대로 살아 있다(벤치 한 줄이 띠보다 넓을 수 있다).
    expect(rail().style.overflowX).toBe('auto');
  });

  it('대조군 — 세로 기둥의 nav 는 스크롤러가 아니다(벤치 구역 하나뿐)', () => {
    render(<Rail />);
    expect(rail().style.overflowY).toBe('');
    expect(screen.getByRole('group', { name: '개체' }).style.overflowY).toBe('auto');
  });
});

describe('P3·3차 검증이 세운 세 단언이 **wrap 에서도** 그대로 참이다', () => {
  // ToolRail.test.tsx 가 이 셋을 소유한다(거기서 한 글자도 안 고쳤다). 여기서 다시 찍는 이유는
  // **wrap 을 연 뒤에도** 성립하는지가 이번 단계의 완료 판정이기 때문이다 — 저쪽은 wrap 이
  // 없던 시절에 쓰였고, 통과 사실만으로는 "wrap 축에서도 검사했다" 가 안 된다.
  it('주축이 row 이고 시작 정렬이다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.flexDirection).toBe('row');
    expect(rail().style.justifyContent).toBe('flex-start');
  });

  it('서랍 내용은 앞쪽 표적보다 문서 순서상 뒤다 — 끝에 폭이 붙어도 앞이 안 밀린다', async () => {
    render(<Rail orientation="horizontal" />);
    await userEvent.setup().click(screen.getByRole('button', { name: /^작도/ }));
    const first = screen.getByRole('button', { name: '2번 선수 배치' });
    for (const opened of ['이동', '패스']) {
      const el = screen.getByRole('button', { name: new RegExp(opened) });
      expect(first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING, opened).toBeTruthy();
    }
  });

  it('띠 패딩이 8/13 그대로다 — 줄나눔 모형이 세는 26px 이 여기서 온다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.padding).toBe(`${TRAY_BAND_PAD_Y}px ${TRAY_BAND_PAD_X}px`);
    expect(rail().style.padding).toBe('8px 13px');
  });
});

describe('줄나눔 모형의 전제 — 띠가 정말 그 여섯 구역인가', () => {
  // ⚠️ **하네스도 검증 대상이다.** trayBandSectionsPx 는 "줌 · 편집 이력 · 구분선 · 벤치 ·
  // 구분선 · 기능" 여섯을 그 순서로 전제하고 높이를 답한다. 화면이 일곱 개가 되거나 순서가
  // 바뀌면 함수는 **여전히 같은 답을 하고 테스트는 초록인 채** 실제 띠는 다른 모양이 된다.
  // (2026-08-14 두 번째 지시로 다섯 → 여섯. 늘어난 하나가 '편집 이력' 이고 줌 **바로 뒤**다.)
  it('직계 자식이 정확히 여섯이고 코트 라벨은 없다(세로 기둥 전용)', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().children).toHaveLength(trayBandSectionsPx(44, 2).length);
    expect(rail().children).toHaveLength(6);
    // 대조군: 세로 기둥은 코트 라벨이 붙어 일곱이다(TRAY_SECTIONS).
    expect(screen.queryByText('풀 코트')).toBeNull();
  });

  it('순서가 줌 · 편집 이력 · 구분선 · 벤치 · 구분선 · 기능 이다', () => {
    render(<Rail orientation="horizontal" />);
    const kids = [...rail().children] as HTMLElement[];
    expect(kids.map((el) => el.getAttribute('aria-label') ?? '구분선')).toEqual(
      trayBandSectionsPx(44, 2).map((s) => s.name),
    );
  });

  it('구분선 한 줄은 가로로 9px 을 먹는다 — 선 1 + 좌우 margin 4', () => {
    render(<Rail orientation="horizontal" />);
    const divider = [...rail().children].find((el) => (el as HTMLElement).style.width === '1px') as HTMLElement;
    expect(divider, '구분선 선택자가 낡았다').toBeDefined();
    expect(divider.style.margin).toBe('6px 4px');
    // 구분선은 이제 셋째다 — 줌·편집 이력 뒤.
    expect(trayBandSectionsPx(44, 2)[2]!.w).toBe(9);
  });

  it('벤치 구역은 띠 안에서 **자기 폭을 그대로** 쓴다 — 모형이 561 을 세는 근거', () => {
    // flex:'none' 이라 base 가 max-content 다. shrink 로 접히면 줄나눔이 달라져 모형이 거짓말한다.
    // (jsdom 의 cssstyle 은 축약형 `none` 을 longhand `0 0 auto` 로 펼쳐 둔다 — 같은 말이다.)
    render(<Rail orientation="horizontal" />);
    for (const name of ['개체', '기능', '확대', '편집 이력']) {
      expect(screen.getByRole('group', { name }).style.flex, name).toBe('0 0 auto');
    }
  });
});
