// §6.4 태블릿 표시 회전을 스테이지 안쪽 컴포넌트에 흘려보내는 통로.
//
// 회전 자체는 CourtStage 가 월드 콘텐츠 전체를 감싼 `<g>` 하나로 처리한다. 그런데 **글자는
// 같이 돌면 안 된다** — 등번호·격자 라벨·메모가 옆으로 누우면 판을 읽을 수 없다. 그래서
// 글자를 그리는 쪽만 이 값을 받아 자기를 반대로 되돌린다.
//
// prop 으로 내리지 않고 Context 로 두는 이유: 등번호는 CourtStage → ObjectLayer → ChairChip
// 3단계 아래에 있고, ObjectLayer 는 회전과 아무 상관이 없다. 상관없는 층에 prop 을 뚫는 대신
// 필요한 잎만 구독하게 한다. rot 은 화면 방향이 바뀔 때만 변하므로 리렌더 비용도 무시할 만하다.
//
// ⚠️ 60fps 경로(transformWriter)는 건드리지 않는다. writer 는 지금도 등번호에 rotate(−θ) 를
// 기록하는데, 거기에 회전을 더하려면 매 프레임 문자열에 손대야 하고 EPS 캐시까지 무효화해야
// 한다. 대신 writer 가 쓰는 `<g>` **안쪽에** 정적 `rotate(−rot)` 를 하나 더 두면 곱해져서
// 같은 결과가 나온다 — 프레임 루프는 회전의 존재조차 모른다.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { StageRot } from './useStageMetrics.ts';

const StageRotContext = createContext<StageRot>(0);

export function StageRotProvider({ rot, children }: { rot: StageRot; children: ReactNode }) {
  return <StageRotContext.Provider value={rot}>{children}</StageRotContext.Provider>;
}

export function useStageRot(): StageRot {
  return useContext(StageRotContext);
}

/** 글자를 바로 세우는 transform. 회전이 없으면 `undefined` 를 돌려줘 속성 자체를 안 붙인다
 *  (불필요한 transform 은 SVG 텍스트 렌더링 품질을 떨어뜨린다).
 *
 *  `cx,cy` 는 회전 중심 — 글자의 앵커를 그대로 넘긴다. 생략하면 그 요소의 원점을 쓴다. */
export function useUprightTransform(cx?: number, cy?: number): string | undefined {
  return uprightAt(useStageRot(), cx, cy);
}

/** 훅이 아닌 판. 격자 라벨처럼 **반복문 안에서** 좌표마다 만들어야 할 때 쓴다
 *  (훅은 루프 안에서 부를 수 없다). */
export function uprightAt(rot: StageRot, cx?: number, cy?: number): string | undefined {
  if (rot === 0) return undefined;
  return cx === undefined || cy === undefined ? `rotate(${-rot})` : `rotate(${-rot} ${cx} ${cy})`;
}
