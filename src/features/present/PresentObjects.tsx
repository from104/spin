// §6.9/§3.6 — 재생 프레임의 개체 렌더러.
//
// 판단 근거(§8 파일 소유권 위반 없이 §3.6 opacity 요건을 채우는 법): render-stage(§8 소유)의
// ChairChip/BallDot/ConeMark 는 편집기용이라 opacity prop 이 없다(그 파일들을 고칠 권한은
// 없다 — §8). 대신 그 컴포넌트들을 그대로 재사용하되 감싸는 바깥 `<g>` 하나를 이 모듈이 소유해
// opacityWriter 로 직접 DOM 에 적어 넣는다 — position(transform)은 기존 TransformWriter 를
// 그대로 재사용한다(둘 다 §6.2 의 "숫자 우선비교·클로저 지역함수" 요건을 만족하는 60fps 경로).
//
// 화살표·메모는 다르다: ArrowPath 는 `d` 속성을 `arrow` prop 에서 매 렌더 계산하므로(§6.6,
// writer 없음) 애초에 React 재렌더 경로다. 캐스트(휠체어·공·콘)와 달리 화살표·메모는 스텝마다
// 존재하는 개체 집합 자체가 바뀌고(§3.5, cast 소속이 아니다) 보통 개수가 적어(캐스트는 최대
// 8+10+무제한 콘, 화살표·메모는 스텝당 소수) React 트리를 격리된 하위 컴포넌트(PresentArrowLayer/
// PresentNoteLayer)로 한정하면 매 프레임 갱신 비용이 낮다 — §6.2 가 우려한 "콘 40개 GC 스파이크"
// 시나리오가 여기엔 없다(콘은 캐스트라 이미 imperative 경로).
import { memo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChairChip } from '../../render/objects/ChairChip.tsx';
import { BallDot } from '../../render/objects/BallDot.tsx';
import { ConeMark } from '../../render/objects/ConeMark.tsx';
import { ArrowPath } from '../../render/objects/ArrowPath.tsx';
import { NOTE_DEFAULT_SIZE_PX, noteLineDy, noteLines } from '../../render/objects/noteChip.ts';
import { NOTE } from '../../core/constants.ts';
import { teamMarkFor } from '../../render/teamMark.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { OpacityWriter } from './opacityWriter.ts';
import type { ChairDef, ConeDef, TeamSide, TeamStyle } from '../../model/drill.ts';
import type { RenderFrame } from '../../model/playback.ts';
import type { BallId } from '../../core/ids.ts';

/** ChairDef.color 개별 지정이 팀 색을 덮어쓴다(§3.5 주석 그대로) — GK 는 팀별 GK 색.
 *
 *  4.6 부터 규칙 본체는 `render/teamMark.ts` 하나에 있다. 예전에는 같은 식이 여기와
 *  `features/export/teamMark.ts` 두 곳에 적혀 있었고 대조 테스트로 드리프트를 막았는데,
 *  4.6 이 색 밖 채널(테두리 파선·볼가드 톤)을 더하면서 **세 경로가 같은 표식을 봐야 한다**는
 *  요구가 생겼다. 복제를 셋으로 늘리는 대신 아래층으로 내리고 여기는 색만 꺼내 쓴다 —
 *  ⚠️ 여기서 규칙을 다시 손으로 적으면 화면과 종이의 팀 표식이 갈라진다. */
export function chairColorFor(def: ChairDef, teams: Record<TeamSide, TeamStyle>): string {
  return teamMarkFor(def, teams).fill;
}

// memo — opacity 는 이 컴포넌트들의 prop 이 아니라 opacityWriter 가 DOM 에 직접 쓴다(위 헤더
// 주석). 즉 마운트 이후로는 props 가 절대 바뀌지 않으므로, PresentStage 가 화살표/메모 때문에
// 60fps 로 리렌더되어도(§6.2 가 우려한 "정지 개체도 매 프레임 재생성") 이 서브트리는 memo 에서
// 곧바로 멈춘다 — 콘이 많을 때 특히 효과가 크다.
const Fade = memo(function Fade({ id, opacityWriter, children }: { id: string; opacityWriter: OpacityWriter; children: ReactNode }) {
  const ref = useRef<SVGGElement | null>(null);
  useEffect(() => {
    opacityWriter.register(id, ref.current);
    return () => opacityWriter.register(id, null);
  }, [opacityWriter, id]);
  return <g ref={ref}>{children}</g>;
});

export const PresentChairMark = memo(function PresentChairMark({
  def,
  teams,
  writer,
  opacityWriter,
}: {
  def: ChairDef;
  teams: Record<TeamSide, TeamStyle>;
  writer: TransformWriter;
  opacityWriter: OpacityWriter;
}) {
  const label = `${teams[def.team].label} ${def.number}번${def.isGk ? ' 골키퍼' : ''}`;
  return (
    <Fade id={def.id} opacityWriter={opacityWriter}>
      <ChairChip
        id={def.id}
        writer={writer}
        color={chairColorFor(def, teams)}
        team={def.team}
        number={def.number}
        selected={false}
        active={false}
        ariaLabel={label}
      />
    </Fade>
  );
});

export const PresentBallMark = memo(function PresentBallMark({ id, writer, opacityWriter }: { id: BallId; writer: TransformWriter; opacityWriter: OpacityWriter }) {
  return (
    <Fade id={id} opacityWriter={opacityWriter}>
      <BallDot id={id} writer={writer} selected={false} active={false} ariaLabel="공" />
    </Fade>
  );
});

export const PresentConeMark = memo(function PresentConeMark({ def, writer, opacityWriter }: { def: ConeDef; writer: TransformWriter; opacityWriter: OpacityWriter }) {
  return (
    <Fade id={def.id} opacityWriter={opacityWriter}>
      <ConeMark id={def.id} writer={writer} colorIndex={def.colorIndex} selected={false} active={false} ariaLabel={`콘 ${def.colorIndex === 0 ? '주황' : '파랑'}`} />
    </Fade>
  );
});

/** 화살표 — 매 프레임 React 로 다시 그린다(위 헤더 주석 근거). `id` 는 부모(PresentStage)가
 *  `ConeId` 등과 겹치지 않게 이미 보장한 값이 아니라 ArrowId 그대로라 React key 로 충분하다. */
export function PresentArrowLayer({ arrows, markerUid }: { arrows: RenderFrame['arrows']; markerUid: string }) {
  return (
    <>
      {arrows.map((a) => (
        <g key={a.id} opacity={a.opacity}>
          <ArrowPath arrow={a} markerUid={markerUid} selected={false} active={false} />
        </g>
      ))}
    </>
  );
}

const FONT = "'Pretendard',sans-serif";

/** 메모 — 화살표와 같은 이유로 React 재렌더 경로. NoteLabel(render-stage)은 writer 기반
 *  포지셔닝을 강제해 여기 용도(매 프레임 x/y 갱신)와 맞지 않아 최소 구현을 직접 그린다. */
export function PresentNoteLayer({ notes }: { notes: RenderFrame['notes'] }) {
  return (
    <>
      {notes.map((n) => {
        const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
        const lines = noteLines(n.text, size);
        return (
          <g key={n.id} opacity={n.opacity} transform={`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`}>
            <text
              x={0}
              y={0}
              fontFamily={FONT}
              fontSize={size}
              fontWeight={600}
              fill={n.color ?? '#ffffff'}
              textAnchor={n.align ?? 'middle'}
              dominantBaseline="central"
            >
              {/* 줄 나눔은 편집 화면과 **같은 함수**가 정한다(noteChip.ts). 시연에서만 한 줄로
                  이어 붙으면 코치가 판에서 본 것과 관객이 보는 것이 달라진다. */}
              {lines.map((line, i) => (
                <tspan key={i} x={0} dy={i === 0 ? noteLineDy(0, lines.length) : NOTE.lineHPx}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </>
  );
}
