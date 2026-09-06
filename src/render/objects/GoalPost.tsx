// §5.4/§6.6 골대 포스트. **실제 코트에서 골대는 고정돼 있지 않다** — 휠체어가 부딪히면
// 밀리도록 만들어져 있고(안 밀리면 안전 사고가 난다), 이 앱도 그대로 따른다.
//
// 그래서 코트 라인(CourtSurface)의 정적 원이 아니라 **writer 가 구동하는 개체**다. 편집기
// 변형에서만 이렇게 그리고, 시연·인쇄·PNG 는 정적 표시(`courtLines/GoalPostMarks.tsx`)를 쓴다
// (그쪽은 물리가 돌지 않아 움직일 일이 없다). ⚠️ 2026-09-06 — 그 정적 표시는 이제 코트 라인
// 그룹이 아니라 **규칙 표시 뒤·개체 앞**, 즉 이 파일이 편집 화면에서 차지하는 자리와 같은
// 층에서 그려진다(근거는 GoalPostMarks.tsx 머리말). 썸네일은 애초에 기둥을 안 그린다
// (COURT_LINE_WEIGHTS.thumb 에 spotR 이 없다).
//
// 사용자가 직접 **끌 수는** 없다: 드래그 대상이 아니고 포커스도 받지 않는다(§7.5b 순회
// 순서에도 들어가지 않는다). 오직 휠체어에 밀려서 움직인다.
//
// ── 제자리 복귀 손잡이 (2026-08-29 기현 지시) ──────────────────────────────────────────
// *"제자리에 있지 않은 골대 위로 마우스 오버 시 복귀를 표시할 수 있는 커서로 바꾸고 클릭 시
//  모든 골대 원위치 트리거 발동해."*
//
// **밀렸을 때만** 포인터를 받는다. 제자리에 있는 골대가 커서를 바꾸면 "여기 뭔가 할 수 있다"
// 는 거짓말이 되고, 무엇보다 코트 위에서 클릭이 먹히는 자리가 늘어 고무줄 선택이 빗나간다.
//
// ⚠️ **누르는 곳은 한 대인데 돌아가는 것은 전부다.** 지시가 그렇고, 그것이 [보드 설정] 안
//    [골대 원위치] 버튼과 같은 동작이기도 하다 — 두 손잡이가 다른 일을 하면 하나를 배운 사람이
//    다른 하나에서 틀린다. 밀린 골대가 여럿일 때 한 대씩 되돌리는 길은 만들지 않는다.
//
// ── 터치에서도 보이는 표시 (2026-08-29) ────────────────────────────────────────────────
// 위 손잡이는 처음에 **커서로만** 알렸다. 커서는 마우스에만 있으므로 태블릿에서는 발견 경로가
// 0이었다 — 눌리기는 하는데 누를 수 있다는 것을 아무도 모른다. 그래서 밀렸을 때 화면에 남긴다:
//   ① 밀린 골대에 **실선 강조 링** — "이건 누를 수 있다"
//   ② 제자리에 **점선 유령**(GoalHomeGhost, ObjectLayer 가 코트 좌표에 정적으로 그린다)
//      — "원래 여기 있어야 한다"
// 실선/점선의 갈림이 뜻을 나른다: 실선은 지금 있는 표적, 점선은 비어 있는 자리다. 색만으로
// 전하지 않는다(§3 — 강제색·흑백 인쇄에서도 실선/점선은 남는다).
//
// ⚠️ `aria-hidden` 을 **유지한다.** 이 칸은 마우스 지름길이지 새 기능이 아니다 — 같은 동작이
//    이름 있는 버튼([보드 설정] > [골대 원위치])으로 이미 있고, 키보드·스크린리더는 그쪽으로
//    간다. 여기를 접근성 트리에 올리면 이름 없는 표적이 하나 늘고(§3 표적 예산) 순회 순서에도
//    끼어든다 — 얻는 것 없이 잃기만 한다.
import { memo, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { GOAL_BASE_FILL, GOAL_POST_EDGE, GOAL_POST_FILL, OBJ_STROKE } from '../../core/colors.ts';
import { goalBaseLocalRect } from '../../model/court.ts';
import { COURT_LINE_WEIGHTS } from '../CourtSurface.tsx';
import type { Vec2 } from '../../core/units.ts';
import type { TransformWriter } from '../transformWriter.ts';

export interface GoalPostProps {
  id: string;
  writer: TransformWriter;
  /** 받침판을 놓을 방향(±1 성분). `model/court.ts` 의 `goalBaseDir` 가 정한다 — 없으면 판을
   *  안 그린다(플랫 코트처럼 골대가 없는 판, 또는 방향을 못 정한 경우). */
  baseDir?: Vec2 | null;
  /** 제자리에서 벗어나 있는가. 참일 때만 커서가 바뀌고 눌린다. */
  displaced?: boolean;
  /** 누르면 **모든** 골대를 원위치로. 없으면 이 칸은 예전처럼 포인터를 안 받는다. */
  onReturn?: () => void;
}

/** 기둥 원의 반지름·테 굵기. 물리 바디로 바뀌었다고 생김새까지 달라지면 "골대가 다른 것으로
 *  교체됐다" 로 읽히므로, 코트 라인의 spot 표시와 **같은 표**에서 파생한다(§6.6 굵기표).
 *
 *  ⚠️ 2026-09-06 — 그 전에는 `const R = 4` 와 `strokeWidth={1.6}` 이 **리터럴**이었고 주석은
 *  *"FullCourtLines 의 goalPosts 원과 동일"* 이라고 적었다. 그 문장은 참이 아니었다: 정적
 *  경로가 읽는 것은 `present` 행(r 4.4 · sw 1.6)이고 편집기 행은 r 4 · sw **1.5** 다 — 즉
 *  반지름은 편집기 행과 같고 굵기만 present 행과 같은, 어느 표에도 없는 짝이었다.
 *  값을 표에서 파생시켜 그 어긋남을 지운다(AGENTS §3 *"치수를 리터럴로 적지 않는다"*).
 *  변형별로 굵기가 갈리는 것 자체는 §6.6 이 정한 설계라 그대로 둔다. */
const W = COURT_LINE_WEIGHTS.editor;
const R = W.spotR!;
const EDGE_W = W.spotSw!;

/** 보이지 않는 손잡이 반지름. 보이는 원(R=4)은 화면에서 4 px 안팎이라 그대로는 못 겨눈다.
 *  §7.3 의 44 px 을 그대로 쓰지는 않는다 — 코트 좌표에서 22 는 휠체어 한 대(32.5×20)보다 큰
 *  구멍이라 그 근처의 고무줄 선택과 칩 집기를 통째로 삼킨다. 12(지름 24 ≈ 화면 22~24 px)면
 *  겨누기에 충분하면서 이웃을 안 먹는다. 밀린 동안에만 존재하는 표적이기도 하다. */
const HIT_R = 12;

/** 밀렸음을 **보이게** 하는 강조 링 반지름. 손잡이(12)보다 안쪽이라 링을 겨누면 반드시 손잡이
 *  안이고, 보이는 원(4)보다 바깥이라 골대 자체를 가리지 않는다. */
const RING_R = 8.5;

/** 골대의 두 색. 링·유령도 같은 색을 쓴다 — 다른 색을 쓰면 "다른 것"으로 읽힌다.
 *  ⚠️ 2026-09-06 — 리터럴이던 두 값을 `core/colors.ts` 로 올렸다(정적 경로·PNG 가 같은 값을
 *  따로 적고 있었다). 여기 별칭만 남긴다. */
const GOAL_FILL = GOAL_POST_FILL;
const GOAL_EDGE = GOAL_POST_EDGE;

/** 밝고 어두운 코트를 모두 견디게 하는 밑깔이 두께(흰 후광). 커서 아이콘과 같은 수법이다. */
const HALO_W = 2.4;

/** 골대가 **원래 있어야 할 자리**에 남기는 점선 유령. 밀린 골대마다 한 개.
 *
 *  writer 가 구동하는 GoalPost 와 달리 **코트 좌표에 정적으로** 선다 — 제자리는 코트 정의에서
 *  오는 고정값이라 프레임마다 바뀌지 않는다(그래서 물리도, 리렌더도 타지 않는다). */
export const GoalHomeGhost = memo(function GoalHomeGhost({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <circle cx={x} cy={y} r={R} fill="none" stroke={GOAL_FILL} strokeWidth={HALO_W} opacity={0.7} />
      <circle cx={x} cy={y} r={R} fill="none" stroke={GOAL_EDGE} strokeWidth={1.2} strokeDasharray="2.2 1.8" />
    </g>
  );
});

/** 복귀를 뜻하는 커서 — 반시계 회살표(되돌리기와 같은 어휘). 흰 테두리를 두른 이유는 코트가
 *  밝고 어두운 테마를 오가기 때문이다: 한 색으로만 그리면 한쪽 테마에서 안 보인다.
 *  마지막의 `pointer` 는 폴백이다(데이터 URI 커서를 막는 환경에서도 "누를 수 있다" 는 남는다). */
const RETURN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.5 8.5v5h5'/%3E%3Cpath d='M5.9 13.2A7 7 0 1 0 7.6 7.6'/%3E%3C/g%3E%3Cg fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.5 8.5v5h5'/%3E%3Cpath d='M5.9 13.2A7 7 0 1 0 7.6 7.6'/%3E%3C/g%3E%3C/svg%3E") 12 12, pointer`;

/** 받침판. 기둥 로컬 좌표(원점 = 기둥)로 그린다 — 정적 경로의 `GoalPostMarks` 와 같은
 *  기하(`goalBaseLocalRect`)를 쓰므로 편집기와 시연이 어긋날 자리가 없다. */
function BasePlate({ dir }: { dir: Vec2 }) {
  const r = goalBaseLocalRect(dir);
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={GOAL_BASE_FILL} />;
}

export const GoalPost = memo(function GoalPost({ id, writer, baseDir, displaced = false, onReturn }: GoalPostProps) {
  const ref = useRef<SVGGElement | null>(null);
  const live = displaced && onReturn !== undefined;

  useEffect(() => {
    writer.register(id, ref.current);
    return () => writer.register(id, null);
  }, [writer, id]);

  return (
    <g
      ref={ref}
      className="goal-post"
      aria-hidden="true"
      pointerEvents={live ? 'auto' : 'none'}
      style={live ? { cursor: RETURN_CURSOR } : undefined}
      // ⚠️ `pointerdown` 에서 끝낸다(click 이 아니다). 코트의 손짓은 전부 pointerdown 에서
      //    시작하므로(CourtStage), click 까지 기다리면 그 사이에 고무줄 선택이 이미 열린다.
      //    stopPropagation 이 그 열림 자체를 막는다.
      onPointerDown={
        live
          ? (e: ReactPointerEvent<SVGGElement>) => {
              if (e.button !== 0) return; // 오른쪽·가운데는 판의 것이다(CourtStage 와 같은 규율)
              e.stopPropagation();
              onReturn();
            }
          : undefined
      }
    >
      {/* 받침판이 **맨 아래**다 — 기둥은 판에 꽂힌 것이므로 위에 있어야 한다. 로컬 좌표라
          골대가 밀려도 판이 함께 따라간다(실물에서도 붙어 있다). 판은 물리 바디가 아니다:
          충돌은 계속 기둥만 한다(GOAL.baseSidePx 주석의 ⚠️). */}
      {baseDir && <BasePlate dir={baseDir} />}
      {/* 손잡이가 **먼저** 온다 — 뒤에 오면 보이는 원 위에 덮여 그 4 px 만 눌린다. */}
      {live && (
        <>
          <circle cx={0} cy={0} r={HIT_R} fill="transparent" />
          <circle cx={0} cy={0} r={RING_R} fill="none" stroke={GOAL_FILL} strokeWidth={HALO_W} opacity={0.85} />
          <circle cx={0} cy={0} r={RING_R} fill="none" stroke={GOAL_EDGE} strokeWidth={1.2} />
        </>
      )}
      <circle cx={0} cy={0} r={R} fill={GOAL_FILL} stroke={GOAL_EDGE} strokeWidth={EDGE_W} />
      <circle cx={0} cy={0} r={R} fill="none" stroke={OBJ_STROKE} strokeWidth={0.4} />
    </g>
  );
});
