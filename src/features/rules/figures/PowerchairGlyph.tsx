// 옆모습 경기용 파워체어 — 제2조(공)·거리 도해가 함께 쓰는 공용 그림(2026-08-21).
//
// 🪦 2026-09-03: 제4조 장비 도해(EquipmentFigure)가 지워졌다 — 기현님이 *"휠체어 관련 도해는 조악하다"*
// 고 판정했다. 그 도해만 켜던 시트벨트·측면지지대·전도방지 바 옵션 셋도 함께 지웠다(호출자 0).
// 이 글리프 자체가 남는 이유: 공 도해는 공 크기를 **체어에 맞춰 역산**하고, 거리 도해는 3m·5m 링을
// 사람 스케일로 읽히게 하려고 체어를 놓는다 — 둘 다 체어가 없으면 그림의 뜻이 사라진다.
// ⚠️ 같은 판정이 이 글리프에도 미친다면(공·거리 도해의 체어가 조악하다면) 그때는 글리프를 고치거나
//    두 도해에서 체어를 빼는 것이지, 여기 옵션을 되살리는 것이 아니다.
//
// 처음엔 제2조 도해(BallFigure.tsx) 안에 `SideChair` 로 갇혀 있었다. 다른 도해도 같은
// 체어가 필요해지면서 밖으로 뺐다 — 여러 도해가 **같은 체어**를 그려야 "이 앱 세계관 안에서
// 일관된 장비"로 읽힌다. 로컬 좌표 비례는 스트라이크포스(Power Soccer Shop 제작, 경기 전용
// 파워체어) 실물 옆모습을 옮긴 것이다(2026-08-21 기현님이 실물 사진을 줌).
//
// ⚠️ 좌표계: 원점(0,0)이 **구동륜 접지점**, 앞은 +x, `scale` 은 호출부가 넘긴다. 로컬 상수
// (`CHAIR_TAIL_LOCAL`·`CHAIR_NOSE_LOCAL`)는 스케일 **적용 전** 값이다 — 호출부가 스케일 적용
// 후 좌표가 필요하면 반드시 자기 스케일을 곱해야 한다(제2조 도해가 이미 그렇게 한다).
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
}

export function PowerchairSide({ x, y, rotate = 0, scale = 0.88 }: PowerchairSideProps) {
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

    </g>
  );
}
