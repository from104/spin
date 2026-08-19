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
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { TRAY_BAND_PAD_X, TRAY_BAND_PAD_Y } from './trayMetrics.ts';
import { BALL, CONE } from '../../core/constants.ts';
import type { ChairId } from '../../core/ids.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// ToolRail 이 useT()/useLocale()(→ SettingsProvider)을 쓴다(C7) — 이 파일 전체를 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

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
      // 2026-08-14 — 되돌리기·다시하기가 헤더에서 줌 아래로 왔다. 줄나눔 모형
      // (trayBandSectionsPx)이 이 구역을 세므로 여기서 빠지면 모형과 화면이 갈라진다.
    />
  );
}

const rail = () => screen.getByRole('navigation', { name: '도구' });

/** 픽셀 식과 같은 식의 calc — **리터럴이다.** 상수를 import 해 비교하면 식이 틀려도 테스트가
 *  따라 움직여 아무것도 못 잡는다(ToolRail.hit.test.tsx 의 같은 관례). */
const BAND_1ROW_CSS = 'calc(max(50px, var(--hit)) + 16px)';

describe('세로 띠 — 높이가 못박혀 있다 (코트가 안 흔들리는 근거)', () => {
  it('★ height 가 2행 calc 식이다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.height).toBe(BAND_1ROW_CSS);
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
    expect(screen.getByRole('button', { name: /^선$/ })).toBeInTheDocument();
    expect(rail().style.height).toBe(before);
    expect(rail().style.minHeight, '최소 높이로 슬쩍 자라면 못박음이 아니다').toBe('');
    expect(rail().style.maxHeight).toBe('');
  });
});

describe('가로 띠 — nowrap 과 그 교차축 정렬 (2026-08-14: wrap → nowrap)', () => {
  it('★ flexWrap 이 nowrap 이다 — wrap 이 살아나면 띠가 2행이 되어 코트가 66px 더 줄어든다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.flexWrap).toBe('nowrap');
  });

  it('대조군 — 세로 기둥의 nav 는 아예 선언이 없다(접히는 것은 그 안 구역들이다)', () => {
    render(<Rail />);
    expect(rail().style.flexWrap).toBe('');
  });

  it('★ alignContent 가 flex-start 다 — nowrap 이라 지금은 놀지만, wrap 이 되살아나는 순간 산다', () => {
    // §3 불변식 1 의 세로판. 줄이 하나 늘 때 중앙정렬이면 선수 칩이 통째로 위로 올라간다.
    render(<Rail orientation="horizontal" />);
    expect(rail().style.alignContent).toBe('flex-start');
    expect(rail().style.alignContent).not.toBe('center');
  });

  it('★ overflowX 가 auto 다 — 1행이 넘칠 때 유일한 도달 경로', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.overflowX).toBe('auto');
    // 세로로는 넘칠 수 없다(1행 + 높이 고정). 열어 두면 1px 반올림에 스크롤바가 생겨 띠가 좁아진다.
    expect(rail().style.overflowY).toBe('hidden');
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
  it('★ 주축이 row 이고 **safe center** 다 — 가운데 정렬이되 넘치면 왼쪽으로 되돌아간다', () => {
    // 2026-08-14 기현님 지시로 `flex-start` → `safe center`. `safe` 가 없으면 넘칠 때 양쪽으로
    // 넘쳐 **시작 쪽 넘침을 scrollLeft 로 못 간다** — 7인치에서 1번 선수가 영영 안 잡힌다.
    // 그래서 이 단언은 `center` 로 바꿔 쓰면 안 된다: 낱말 하나가 도달 가능성의 전부다.
    render(<Rail orientation="horizontal" />);
    expect(rail().style.flexDirection).toBe('row');
    expect(rail().style.justifyContent).toBe('safe center');
    expect(rail().style.justifyContent, "'safe' 없는 center 는 첫 항목을 못 잡게 만든다").not.toBe('center');
  });

  it('서랍 내용은 앞쪽 표적보다 문서 순서상 뒤다 — 끝에 폭이 붙어도 앞이 안 밀린다', async () => {
    render(<Rail orientation="horizontal" />);
    await userEvent.setup().click(screen.getByRole('button', { name: /^작도/ }));
    const first = screen.getByRole('button', { name: '2번 선수 배치' });
    for (const opened of ['선']) {
      // 정확 매칭 — '선' 은 '선택' 과 접두가 겹친다(2026-08-16 도구 통합).
      const el = screen.getByRole('button', { name: new RegExp(`^${opened}$`) });
      expect(first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING, opened).toBeTruthy();
    }
  });

  it('띠 패딩이 8/13 그대로다 — 줄나눔 모형이 세는 26px 이 여기서 온다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.padding).toBe(`${TRAY_BAND_PAD_Y}px ${TRAY_BAND_PAD_X}px`);
    expect(rail().style.padding).toBe('8px 13px');
  });
});

describe('띠는 언제나 1행이다 — 줄나눔 모형이 사라진 자리 (2026-08-14)', () => {
  // ⚠️ 여기 있던 것은 **줄나눔 모형의 하네스 검증**이었다: trayBandSectionsPx 가 구역 여섯을
  // 그 순서로 전제하고 높이를 답했으므로, 화면이 정말 그 여섯인지를 DOM 에서 대조해야 했다.
  // 띠가 `nowrap` 1행이 되면서 모형도 물음도 함께 사라졌다(trayBand.test 머리말이 경위를 쥔다).
  // 남은 계약은 둘뿐이고, 그 둘이 "1행" 을 실제로 보장한다.
  it('nowrap 이다 — wrap 이 살아나면 띠가 2행이 되어 코트가 그만큼 줄어든다', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.flexWrap).toBe('nowrap');
  });

  it('넘치면 **좌우로** 스크롤한다 — 세로 스크롤은 닫혀 있다(1행이라 넘칠 수 없다)', () => {
    render(<Rail orientation="horizontal" />);
    expect(rail().style.overflowX).toBe('auto');
    expect(rail().style.overflowY, '열어 두면 1px 반올림에 세로 스크롤바가 생겨 띠가 좁아진다').toBe('hidden');
  });

  it('구역들이 자기 폭을 그대로 쓴다 — shrink 로 접히면 첫 항목이 스크롤 밖으로 밀린다', () => {
    render(<Rail orientation="horizontal" />);
    for (const name of ['개체', '기능']) {
      expect(screen.getByRole('group', { name }).style.flex, name).toBe('0 0 auto');
    }
  });
});
