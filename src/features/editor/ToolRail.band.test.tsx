// 2026-08-14 P5 — **세로 띠의 DOM 배선.** trayBand.test.ts 가 숫자를 재고, 여기서는 화면이
// 정말 그 식을 걸고 있는지를 본다.
//
// 높이 못박음 — `height` 가 없으면 띠가 내용을 따라 들쭉날쭉해지고 **코트 크기가 흔들린다.**
import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
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

describe('세로 띠 — 높이가 못박혀 있다 (코트가 안 흔들리는 근거)', () => {
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
});
