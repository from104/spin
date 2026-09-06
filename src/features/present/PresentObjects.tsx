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
import { StrokePath } from '../../render/objects/StrokePath.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { NOTE_DEFAULT_SIZE_PX, NOTE_PLACEHOLDER, noteChipHeightPx, noteChipPathD, noteChipWidthPx, noteFoldPathD, noteLineDy, noteLineHeightPx, noteLines } from '../../render/objects/noteChip.ts';
import { NOTE } from '../../core/constants.ts';
import { NOTE_FILL, NOTE_FOLD_FILL, NOTE_PLACEHOLDER_FILL, OBJ_STROKE } from '../../core/colors.ts';
import { teamMarkFor } from '../../render/teamMark.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { RuleOverlayApi } from '../../render/ruleOverlay.ts';
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
  const t = useT();
  const label = t('present.objects.chairAriaLabel', { team: teams[def.team].label, number: def.number, gkSuffix: def.isGk ? t('present.objects.goalkeeperSuffix') : '' });
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

export const PresentBallMark = memo(function PresentBallMark({
  id,
  writer,
  opacityWriter,
  rules,
}: {
  id: BallId;
  writer: TransformWriter;
  opacityWriter: OpacityWriter;
  /** 아웃오브플레이(Law 9) 표시 — 규칙 화면·규칙 표시가 켜진 시연에서 넘어온다(PresentStage). */
  rules?: RuleOverlayApi;
}) {
  const t = useT();
  return (
    <Fade id={id} opacityWriter={opacityWriter}>
      <BallDot id={id} writer={writer} selected={false} active={false} ariaLabel={t('present.objects.ballAriaLabel')} rules={rules} />
    </Fade>
  );
});

export const PresentConeMark = memo(function PresentConeMark({ def, writer, opacityWriter }: { def: ConeDef; writer: TransformWriter; opacityWriter: OpacityWriter }) {
  const t = useT();
  const color = def.colorIndex === 0 ? t('team.colorNames.orange') : t('team.colorNames.blue');
  return (
    <Fade id={def.id} opacityWriter={opacityWriter}>
      <ConeMark id={def.id} writer={writer} colorIndex={def.colorIndex} selected={false} active={false} ariaLabel={t('present.objects.coneAriaLabel', { color })} />
    </Fade>
  );
});

/** 화살표 — 매 프레임 React 로 다시 그린다(위 헤더 주석 근거). `id` 는 부모(PresentStage)가
 *  `ConeId` 등과 겹치지 않게 이미 보장한 값이 아니라 ArrowId 그대로라 React key 로 충분하다. */
export function PresentArrowMark({ arrow, markerUid }: { arrow: RenderFrame['arrows'][number]; markerUid: string }) {
  return (
    <g opacity={arrow.opacity}>
      <ArrowPath arrow={arrow} markerUid={markerUid} selected={false} active={false} />
    </g>
  );
}

/** 여러 개를 한 번에. ⚠️ 2026-09-06 부터 **시연 화면은 이것을 쓰지 않는다** — 개체 표시
 *  순서(z-order)가 화살표 사이에 도형·콘을 끼울 수 있게 되면서 "화살표 층" 이라는 덩어리가
 *  성립하지 않기 때문이다(`PresentStage` 는 `PresentArrowMark` 를 순서 목록 안에서 부른다).
 *  남겨 둔 것은 층 단위로 재는 테스트(`render/strokeRender.paths.test.tsx` 의 획 판)와, 순서와
 *  무관하게 화살표 뭉치만 그리면 되는 자리를 위해서다. */
export function PresentArrowLayer({ arrows, markerUid }: { arrows: RenderFrame['arrows']; markerUid: string }) {
  return (
    <>
      {arrows.map((a) => (
        <PresentArrowMark key={a.id} arrow={a} markerUid={markerUid} />
      ))}
    </>
  );
}

/** 획 — 화살표와 **같은 경로·같은 근거**다(위 헤더 주석). `StrokePath` 를 그대로 쓰고
 *  `writer` 는 안 넘긴다: 시연의 좌표는 매 프레임 `interpolateSteps` 가 만든 프레임에서 오고,
 *  그 값이 곧 `stroke.points` 라 React 재렌더가 이미 모양을 갱신한다(편집기만 트윈 writer 로
 *  `d` 를 직접 쓴다).
 *
 *  ⚠️ 읽기 전용이다 — `onPointerDown` 을 안 넘기므로 `StrokePath` 가 커서도 안 걸고 손도 안
 *  받는다. `aria-hidden` 을 씌우는 것은 시연 화면이 개체 하나하나를 읽히는 자리가 아니기
 *  때문이다(관객용 재생이고, 내용은 스텝 메모가 말한다). */
export function PresentStrokeMark({ stroke, markerUid }: { stroke: RenderFrame['strokes'][number]; markerUid: string }) {
  return (
    <g opacity={stroke.opacity}>
      <StrokePath stroke={stroke} markerUid={markerUid} selected={false} active={false} />
    </g>
  );
}

/** 여러 개를 한 번에 — 위 `PresentArrowLayer` 와 같은 사정이다(2026-09-06 이후 시연 본편은
 *  `PresentStrokeMark` 를 순서 목록 안에서 부른다). */
export function PresentStrokeLayer({ strokes, markerUid }: { strokes: RenderFrame['strokes']; markerUid: string }) {
  return (
    <g aria-hidden="true">
      {strokes.map((s) => (
        <PresentStrokeMark key={s.id} stroke={s} markerUid={markerUid} />
      ))}
    </g>
  );
}

const FONT = "'Pretendard',sans-serif";

/** 메모 — 화살표와 같은 이유로 React 재렌더 경로. NoteLabel(render-stage)은 writer 기반
 *  포지셔닝을 강제해 여기 용도(매 프레임 x/y 갱신)와 맞지 않아 최소 구현을 직접 그린다. */
export function PresentNoteMark({ note: n }: { note: RenderFrame['notes'][number] }) {
    const locale = useLocale();
    const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
    const lines = noteLines(n.text, size);
    const align = n.align ?? 'middle';
    const halfW = noteChipWidthPx(n.text, size) / 2;
    const halfH = noteChipHeightPx(n.text, size) / 2;
    // NoteLabel/PrintCourt 와 같은 규약 — align 은 글 정렬이자 칩 안에서의 글 위치다.
    const textX = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;
    // 빈 메모의 안내 글자(2026-09-06). 편집 화면(NoteLabel)·인쇄(PrintCourt)가 이미 그리는데
    // **시연만** 빈 쪽지를 내놓고 있었다 — 관객은 "왜 빈 종이가 붙어 있지" 로 읽는다.
    // ⚠️ PNG 는 일부러 안 그린다(staticSceneLayout: *"앱의 안내문이 찍히면 그게 곧 오독"*) —
    //    거기는 코치가 남에게 보내는 **파일**이고, 시연은 코치가 옆에서 설명하는 화면이다.
    const empty = n.text.length === 0;
    return (
      <g opacity={n.opacity} transform={`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`}>
        {/* C11(2026-08-19 기현님) — **쪽지 칩 배경**. 여기만 글자만 떠 있어서, 어두운 코트
            위에서 메모가 판의 일부처럼 안 읽혔다. 기하·색은 편집기(NoteLabel)·인쇄
            (PrintCourt)와 같은 함수·같은 토큰이다 — 세 화면이 같은 쪽지를 그린다. */}
        <path d={noteChipPathD(halfW, halfH)} fill={NOTE_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
        <path d={noteFoldPathD(halfW, halfH)} fill={NOTE_FOLD_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
        <text
          className={empty ? 'note-placeholder' : undefined}
          x={empty ? 0 : textX}
          y={0}
          fontFamily={FONT}
          fontSize={empty ? NOTE.placeholderSizePx : size}
          fontWeight={600}
          fill={empty ? NOTE_PLACEHOLDER_FILL : (n.color ?? '#ffffff')}
          textAnchor={empty ? 'middle' : align}
          dominantBaseline="central"
        >
          {/* 줄 나눔은 편집 화면과 **같은 함수**가 정한다(noteChip.ts). 시연에서만 한 줄로
              이어 붙으면 코치가 판에서 본 것과 관객이 보는 것이 달라진다. */}
          {empty
            ? NOTE_PLACEHOLDER[locale]
            : lines.map((line, i) => (
                <tspan key={i} x={textX} dy={i === 0 ? noteLineDy(0, lines.length, size) : noteLineHeightPx(size)}>
                  {line}
                </tspan>
              ))}
        </text>
      </g>
    );
}

/** 여러 개를 한 번에 — 위 `PresentArrowLayer` 와 같은 사정이다. */
export function PresentNoteLayer({ notes }: { notes: RenderFrame['notes'] }) {
  return (
    <>
      {notes.map((n) => (
        <PresentNoteMark key={n.id} note={n} />
      ))}
    </>
  );
}
