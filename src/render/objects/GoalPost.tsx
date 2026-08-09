// §5.4/§6.6 골대 포스트. **실제 코트에서 골대는 고정돼 있지 않다** — 휠체어가 부딪히면
// 밀리도록 만들어져 있고(안 밀리면 안전 사고가 난다), 이 앱도 그대로 따른다.
//
// 그래서 코트 라인(CourtSurface)의 정적 원이 아니라 **writer 가 구동하는 개체**다. 편집기
// 변형에서만 이렇게 그리고, 시연·썸네일은 여전히 코트 라인 쪽 정적 표시를 쓴다(그쪽은 물리가
// 돌지 않아 움직일 일이 없다).
//
// 사용자가 직접 잡을 수는 없다: 드래그 대상이 아니고 포커스도 받지 않는다(§7.5b 순회 순서에도
// 들어가지 않는다). 오직 휠체어에 밀려서 움직이고, `골대 원위치` 버튼으로 되돌린다.
import { memo, useEffect, useRef } from 'react';
import { OBJ_STROKE } from '../../core/colors.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface GoalPostProps {
  id: string;
  writer: TransformWriter;
}

/** 코트 라인의 spot 표시와 같은 색·크기다(FullCourtLines 의 goalPosts 원과 동일) — 물리 바디로
 *  바뀌었다고 생김새까지 달라지면 "골대가 다른 것으로 교체됐다" 로 읽힌다. */
const R = 4;

export const GoalPost = memo(function GoalPost({ id, writer }: GoalPostProps) {
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    writer.register(id, ref.current);
    return () => writer.register(id, null);
  }, [writer, id]);

  return (
    <g ref={ref} className="goal-post" aria-hidden="true" pointerEvents="none">
      <circle cx={0} cy={0} r={R} fill="#f5f5f5" stroke="#c2410c" strokeWidth={1.6} />
      <circle cx={0} cy={0} r={R} fill="none" stroke={OBJ_STROKE} strokeWidth={0.4} />
    </g>
  );
});
