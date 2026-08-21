// 옆모습 경기용 파워체어 — 제2조·제4조 도해가 함께 쓰는 공용 그림(2026-08-21).
//
// 처음엔 제2조 도해(BallFigure.tsx) 안에 `SideChair` 로 갇혀 있었다. 제4조(장비)도 같은
// 체어가 필요해지면서 밖으로 뺐다 — 두 조항이 **같은 체어**를 그려야 "이 앱 세계관 안에서
// 일관된 장비"로 읽힌다. 로컬 좌표 비례는 스트라이크포스(Power Soccer Shop 제작, 경기 전용
// 파워체어) 실물 옆모습을 옮긴 것이다(2026-08-21 기현님이 실물 사진을 줌).
//
// ⚠️ 좌표계: 원점(0,0)이 **구동륜 접지점**, 앞은 +x, `scale` 은 호출부가 넘긴다. 로컬 상수
// (`CHAIR_TAIL_LOCAL`·`CHAIR_NOSE_LOCAL`)는 스케일 **적용 전** 값이다 — 호출부가 스케일 적용
// 후 좌표가 필요하면 반드시 자기 스케일을 곱해야 한다(제2조 도해가 이미 그렇게 한다).
//
// `showAntiTip`·`showBelt`·`showArmrest` 는 전부 기본 false 다 — 제2조 도해는 이 셋을 안 켜서
// **기존 렌더와 픽셀 단위로 같다**(회귀 없음). 제4조 장비 도해만 켠다.
export const CHAIR_TAIL_LOCAL = -44; // 밀대 뒤끝
export const CHAIR_NOSE_LOCAL = 82; // 볼가드 앞코
export const CHAIR_LEN_LOCAL = CHAIR_NOSE_LOCAL - CHAIR_TAIL_LOCAL;

const LINE = 'var(--border-strong)';
const DIM = 'var(--muted)';

export interface PowerchairSideProps {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  /** 전도방지 바(뒷바퀴 위) + 후방 전도방지 캐스터 — Strike Force 매뉴얼의 Anti-Tip 시스템.
   *  제4조 도해 전용: 공을 타고 넘거나 뒤로 넘어지는 것을 막는 실물 부착물이다. */
  showAntiTip?: boolean;
  /** 랩 시트벨트(제4조 필수 장비). */
  showBelt?: boolean;
  /** 좌우 측면지지대(암레스트) — 옆모습이라 한쪽만 그려지지만 규정은 양쪽 다 요구한다
   *  (호출부 라벨에서 그 사실을 명시한다). */
  showArmrest?: boolean;
}

export function PowerchairSide({ x, y, rotate = 0, scale = 0.88, showAntiTip = false, showBelt = false, showArmrest = false }: PowerchairSideProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      {/* 구동륜(큼) · 앞 캐스터(작음) */}
      <circle cx={0} cy={-12} r={12} fill="var(--panel)" stroke={LINE} strokeWidth={2} />
      <circle cx={49} cy={-5} r={5} fill="var(--panel)" stroke={LINE} strokeWidth={1.6} />
      {/* 섀시 · 시트 · 다리받침 */}
      <rect x={-13} y={-21} width={45} height={11} rx={3} fill="var(--elev)" stroke={LINE} strokeWidth={1.8} />
      <rect x={-17} y={-30} width={45} height={9} rx={3} fill="var(--elev)" stroke={LINE} strokeWidth={1.8} />
      <rect x={27} y={-26} width={7} height={16} rx={2} fill="var(--elev)" stroke={LINE} strokeWidth={1.6} />
      {/* 뒤로 젖혀진 등받이 + 밀대 */}
      <polygon points="-24,-29 -13,-29 -21,-57 -32,-57" fill="var(--elev)" stroke={LINE} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={`M -28 -57 C -38 -63 ${CHAIR_TAIL_LOCAL - 2} -58 ${CHAIR_TAIL_LOCAL} -50`} fill="none" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" />
      {/* 볼가드 — 섀시에서 앞아래로 뻗은 버팀대 + 길고 낮은 프레임 + 앞코 범퍼 */}
      <path d="M 2 -22 L 14 -22 L 24 -9 L 12 -9 Z" fill="var(--elev)" stroke={LINE} strokeWidth={1.6} strokeLinejoin="round" />
      <rect x={14} y={-20} width={CHAIR_NOSE_LOCAL - 14} height={12} rx={3} fill={DIM} stroke={LINE} strokeWidth={1.6} />
      <rect x={CHAIR_NOSE_LOCAL - 6} y={-23} width={6} height={18} rx={2} fill={DIM} stroke={LINE} strokeWidth={1.6} />

      {showArmrest && (
        /* 좌우 측면지지대 — 시트 위, 등받이 앞쪽. 대표로 한쪽만(다른 쪽은 그림 밖) 그린다. */
        <rect x={-13} y={-40} width={17} height={6} rx={2.5} fill="var(--elev)" stroke={LINE} strokeWidth={1.6} />
      )}
      {showBelt && (
        /* 랩 시트벨트 — 시트 대각선 스트랩. 버클을 작은 사각으로 표시한다. */
        <g stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round">
          <line x1={-15} y1={-29} x2={22} y2={-22} />
          <rect x={0.5} y={-27.5} width={5} height={4} rx={1} fill="var(--accent)" stroke="none" />
        </g>
      )}
      {showAntiTip && (
        <>
          {/* 전도방지 바 — 구동륜 위를 감싸는 후프. 공을 타고 오르거나 전복되는 것을 막는다
              (제2조 공기압 도해의 "체어가 타고 넘는다"를 체어 쪽에서 막는 부착물). 실선 도형
              위에 겹치므로 마지막에 그려 항상 위로 보이게 한다. */}
          <path d="M -13 -19 Q -13 -32 0 -33 Q 13 -32 13 -19" fill="none" stroke={DIM} strokeWidth={2.6} strokeLinecap="round" />
          {/* 후방 전도방지 캐스터 — 밀대 아래, 뒤로 넘어지는 것을 막는 보조 바퀴. */}
          <circle cx={-38} cy={-4} r={4} fill="var(--panel)" stroke={DIM} strokeWidth={1.4} />
        </>
      )}
    </g>
  );
}
