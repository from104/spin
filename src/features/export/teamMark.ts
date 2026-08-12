// §6.2 PNG — 팀 표식의 **재수출 지점**. 구현은 `src/render/teamMark.ts` 로 옮겼다(4.6).
//
// ── 4.4 가 여기 적어 두었던 판단과, 4.6 이 그것을 어떻게 이었는가 ────────────────────
// 4.4 는 `features/present/PresentObjects.tsx` 의 `chairColorFor` 를 import 하지 않고
// **같은 규칙을 한 번 더 적었다**. 이유는 지금도 유효하다: 화면 렌더러(§8 screen-present 소유)
// 는 React 컴포넌트 모듈이고, 내보내기 경로가 그 파일을 붙들면 그쪽 리팩터가 PNG 를 깨뜨린다.
// 대신 복제가 갈라지는 것을 teamMark.test.ts 의 대조 테스트가 막고 있었다.
//
// 4.6 은 팀 구분을 **색 밖의 채널**(테두리 파선 · 볼가드 톤)로 넓히면서, 그 표식이 화면 ·
// PNG · 인쇄 **세 경로에 모두** 있어야 한다는 요구를 받았다. 복제를 셋으로 늘리면 "한 곳만
// 고치고 나머지를 잊는" 사고가 확정된다. 그래서 규칙을 `src/render/teamMark.ts` 라는
// **React 도 DOM 도 없는 순수 모듈**로 내렸다 — render 층은 화면·인쇄·내보내기가 이미 전부
// 의존하는 아래층이라 4.4 가 경계한 '컴포넌트 모듈 결합'이 생기지 않는다.
//
// ⚠️ 이 파일을 지우지 마라. 4.4 가 4.5/4.6/4.7 에 공표한 시그니처 자리가 여기다
//    (`features/export/teamMark.ts` 의 `teamMarkFor` · `CHAIR_STROKE_W`). 옮긴 것은 구현뿐이고,
//    호출자(buildStaticSvg.ts · staticSceneLayout.ts)는 계속 이 경로를 읽는다.
export { CHAIR_STROKE_W, teamMarkFor, teamPatternFor, TEAM_PATTERNS } from '../../render/teamMark.ts';
export type { TeamMark, TeamPattern } from '../../render/teamMark.ts';
