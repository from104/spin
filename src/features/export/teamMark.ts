// §6.2 PNG — **팀을 구분하는 표식이 나오는 유일한 자리**. (4.4)
//
// ★ 4.6(흑백 인쇄 대책)이 고칠 곳은 이 파일 하나다. 지금 팀 구분은 색 하나(#d93a3a /
//   #1f6bb8)에만 걸려 있어서 흑백 프린터에서는 **확정적으로** 두 팀이 같아 보인다. 그때
//   더할 것(테두리 파선 패턴 · 모양 · 번호 접두)의 자리를 `TeamMark` 필드로 미리 뚫어 두고,
//   `buildStaticSvg`/`buildTextPlacements` 는 **오직 이 함수의 반환값만** 읽는다.
//   그래서 4.6 은 SVG 조립부·텍스트 배치부를 건드리지 않고 여기만 고치면 된다.
//
// 왜 `features/present/PresentObjects.tsx` 의 `chairColorFor` 를 import 하지 않는가:
// 화면 렌더러(§8 screen-present 소유)를 내보내기가 붙들면 그쪽 리팩터가 PNG 를 깨뜨린다.
// 대신 **같은 규칙을 여기 한 번 더 적고, 둘이 어긋나면 빨간불이 되는 대조 테스트**를
// teamMark.test.ts 에 둔다(`chairColorFor` 와 값이 같은지 3경우로 대조). 복제를 두되
// 복제가 갈라지는 것을 테스트가 막는 형태다.
import { inkFor, OBJ_STROKE } from '../../core/colors.ts';
import type { ChairDef, TeamSide, TeamStyle } from '../../model/drill.ts';

/** 칩 하나를 그리는 데 필요한 팀 표식 전량. 여기 없는 값으로 팀을 구분하면 안 된다. */
export interface TeamMark {
  /** 차체 채움색. */
  fill: string;
  /** 차체 테두리색. */
  stroke: string;
  strokeWidth: number;
  /** 차체 테두리 파선 패턴. `undefined` = 실선.
   *  ★ 4.6 이 흑백 구분을 넣을 첫 후보다 — 색을 지워도 남는 채널이기 때문이다. */
  strokeDash?: string;
  /** 칩 위에 찍는 글자(등번호 · 골키퍼 'G'). ★ 4.6 이 접두를 붙일 자리.
   *  SVG 에는 들어가지 않는다 — 래스터 어댑터가 캔버스에서 그린다(§6.2 [A-9]). */
  label: string;
  /** 글자색. 배경 밝기로 고른다(colors.ts `inkFor` — 팔레트 전체가 ≥4.5:1 이 되는 임계). */
  ink: string;
}

/** 차체 테두리 굵기. ChairChip.tsx 의 본체 `<rect strokeWidth={2.2}>` 과 같은 값이다 —
 *  다르면 내보낸 그림의 칩이 화면과 다른 두께로 보인다. */
export const CHAIR_STROKE_W = 2.2;

/** ChairDef → 팀 표식. `def.color` 개별 지정이 팀 색을 덮어쓰는 규칙(§3.5)까지 그대로다. */
export function teamMarkFor(def: ChairDef, teams: Record<TeamSide, TeamStyle>): TeamMark {
  const team = teams[def.team];
  const fill = def.color ?? (def.isGk ? team.gkColor : team.color);
  return {
    fill,
    stroke: OBJ_STROKE,
    strokeWidth: CHAIR_STROKE_W,
    label: def.number,
    ink: inkFor(fill),
  };
}
