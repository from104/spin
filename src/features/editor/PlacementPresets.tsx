// §5.4 배치 프리셋의 **진입점**. [포메이션으로 채우기] + 세트피스 3종(킥인·코너킥·골 클리어런스).
//
// ⚠️⚠️ **여기가 인스펙터(오버레이 시트) 안인 것이 이 파일의 설계 결정이다.** 규칙 9 —
// 첫 화면 표적 예산은 상한 40 에 실측 40, **여유가 0** 이다(src/test/boardTargetBudget.test.tsx).
// 계획서 §3 의 예산 내역은 *"빈 판 [포메이션 채우기] 1"* 을 초기 화면에 잡아 뒀지만, 4차에
// [내보내기]가 하단 바에 들어오면서 그 한 칸이 이미 소진됐다(BoardBar.tsx 머리말 ⚠️ 가
// [골대 원위치]를 모달로 내린 경위를 적어 두었다). 그래서 5.4 는 **표적을 하나도 더하지 않는
// 길**을 택했다: 인스펙터는 결정 ③A 이후 기본 접힘 오버레이라 초기 상태 DOM 에 없고,
// 여는 버튼([속성])은 이미 예산에 잡혀 있다. 프리셋 4개를 여기 두면 순증이 **0** 이다.
// 이 구역을 판(하단 바·트레이·스테이지 컨트롤)으로 옮기면 게이트가 즉시 빨개진다.
//
// 배치 좌표를 만드는 일은 한 줄도 하지 않는다 — 전부 순수 함수(model/fillPreset.ts ·
// model/setPiece.ts)다. 성질(전부 surface 안 · 5 m 이격 · 겹침 없음)이 컴포넌트 안에 있으면
// 단언이 닿지 않기 때문이고, 이것이 drillUses.ts 가 태어난 것과 같은 이유다.
import type { CSSProperties, Dispatch } from 'react';
import type { Drill } from '../../model/drill.ts';
import { applyPlacement, COURT_FILL_SPECS, fillSummary, formationPlan, type PlacementPlan } from '../../model/fillPreset.ts';
import { SET_PIECE_DEFS, setPieceKindsFor, setPiecePlan } from '../../model/setPiece.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';

export interface PlacementPresetsProps {
  drill: Drill;
  /** 지금 보고 있는 스텝. 프리셋은 **이 스텝만** 바꾼다. */
  stepIndex: number;
  dispatch: Dispatch<EditorAction>;
}

const chipStyle: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 12px',
  borderRadius: 9,
  border: '1px solid var(--border-strong)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const SECTION_LABEL: CSSProperties = {
  fontSize: '0.65625rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'var(--faint-text)',
  marginBottom: 11,
  textTransform: 'uppercase',
};

export function PlacementPresets({ drill, stepIndex, dispatch }: PlacementPresetsProps) {
  const kinds = setPieceKindsFor(drill.courtMode);
  const spec = COURT_FILL_SPECS[drill.courtMode];

  const apply = (plan: PlacementPlan | null, said: string) => {
    if (!plan) return;
    dispatch({ type: 'PRESET_APPLY', drill: applyPlacement(drill, stepIndex, plan) });
    // 판이 통째로 바뀌는 조작이라 스크린리더에게 결과를 말해 준다 — 화면을 못 보는 사용자에게
    // "눌렀는데 아무 일도 안 일어난 것" 과 구분되지 않으면 안 된다.
    liveRegion.say(said);
  };

  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>배치</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          style={chipStyle}
          // 표(COURT_FILL_SPECS)와 코트 정의가 만든 한 줄 — 문구를 손으로 적으면 표만 고쳐진 날
          // 화면이 옛말이 된다.
          title={fillSummary(drill.courtMode)}
          onClick={() => apply(formationPlan(drill), `${drill.formation} 포메이션으로 채웠습니다.`)}
        >
          포메이션으로 채우기
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            style={chipStyle}
            title={`${SET_PIECE_DEFS[k].law} — ${SET_PIECE_DEFS[k].desc}`}
            onClick={() => apply(setPiecePlan(drill, k), `${SET_PIECE_DEFS[k].label} 배치를 세웠습니다.`)}
          >
            {SET_PIECE_DEFS[k].label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.5, margin: '10px 0 0' }}>
        {spec.formationAware
          ? `포메이션(${drill.formation})대로 ${spec.chairs}대를 세웁니다.`
          : `이 코트는 포메이션과 무관하게 ${spec.chairs}대를 세웁니다.`}
      </p>
      <p style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.5, margin: '4px 0 0' }}>
        {kinds.length > 0
          ? // 규정을 화면에 적어 둔다 — 이 앱의 목적이 "규칙을 잘못 가르치지 않는 것" 이다.
            '세트피스는 상대만 5 m 물러섭니다. 코너킥의 5 m 는 공이 아니라 코너 삼각형에서 잽니다.'
          : '플랫 코트에는 라인이 없어 세트피스 기준점이 없습니다.'}
      </p>
    </div>
  );
}
