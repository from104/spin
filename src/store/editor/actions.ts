// §6.7 리듀서 액션. src/model/edits.ts(§3.7, Wave 2 완성) 의 편집 연산 20종과 1:1 대응한다.
// PLACE_COMMIT 의 chairs/balls/cones 필드는 계약서 스니펫에 타입이 적혀 있지 않다 — 드래그
// 정착 시점의 스텝 전체 pose 맵(PoseMap)을 그대로 담아 present 를 단방향 교체하는 용도이므로
// DrillStep 의 동명 필드와 같은 타입으로 채웠다(§6.7 "PLACE_COMMIT 은 이미 DOM/물리와 값이
// 같으므로 어떤 재동기화도 하지 않는다" 문단과 일관).
import type { ChairId, StepId, ArrowId, NoteId, CastId, BallId, ConeId, ShapeId, StrokeId } from '../../core/ids.ts';
import type { Vec2 } from '../../core/units.ts';
import type { Drill, ChairDef, NoteLabel, PoseMap } from '../../model/drill.ts';
import type { Shape } from '../../model/shape.ts';
import type { StoredChairPose } from '../../model/chair.ts';
import type { Arrow } from '../../model/arrow.ts';
import type { Stroke } from '../../model/stroke.ts';
import type { ToolId } from '../../physics/index.ts';
import type { ZOp } from '../../model/zOrder.ts';

export type EditorAction =
  // UI (히스토리 제외)
  /** 사용자가 도구를 골랐다. **같은 도구를 한 번 더** 고르면 그 도구가 고정된다(§6.10a) —
   *  빈 자리였던 항등 통과에 뜻을 얹은 것이다. 고정을 푸는 일은 여기가 아니라 uiReducer 의
   *  `KEEPS_TOOL_LOCK` 이 한다: "다른 동작이 끼면 즉시 풀린다" 를 액션마다 적으면 새 액션이
   *  생길 때 빠뜨린 쪽이 **잠긴 채 남는** 고장이 된다. */
  | { type: 'TOOL_SET'; tool: ToolId }
  /** 개체 하나를 **새로 놓았다**(§6.10a). 배치의 뒷정리를 전부 한 액션에 모은다:
   *  방금 놓은 것을 선택하고, 고정이 아니면 선택 도구로 돌아간다.
   *
   *  ⚠️ 선택을 `SELECT_SET` 으로 따로 보내면 안 된다 — 그러면 "고정을 살려 두는 동작" 목록에
   *  `SELECT_SET` 이 들어가야 하고, 그 순간 **사용자가 다른 개체를 고르는 것**도 고정을
   *  살려 두게 된다. 배치가 낸 선택과 사람이 낸 선택은 액션부터 달라야 구별할 수 있다. */
  | { type: 'PLACED'; id: string }
  | { type: 'CONE_SLOT_SET'; slot: 0 | 1 }
  | { type: 'SELECT_SET'; ids: string[] }
  | { type: 'SELECT_TOGGLE'; id: string }
  | { type: 'SELECT_CLEAR' }
  | { type: 'STEP_SELECT'; id: StepId } // ★ index 가 아니라 id
  | { type: 'SAVED'; at: number }
  | { type: 'COMMIT_BREAK' } // 키 리피트 경계
  // 자유 전술판 전용 — **코트 갈아끼우기**. `past` 에 쌓는 COMMIT 이라 되돌릴 수 있고,
  // 되돌리면 코트까지 함께 돌아온다(courtMode 가 Drill 안에 있다).
  //
  // ⚠️ **2026-08-28 에 두 가지가 함께 뒤집혔다**(기현님 지적). 그전까지 이 액션은 히스토리를
  //    통째로 **비웠고**, [비우기]도 여기로 왔다. 사슬은 게이트였다: 게이트가
  //    `past.length === 0` 를 "판이 비었다" 의 대용으로 썼으므로 비우기가 COMMIT 이면
  //    비우자마자 코트 전환이 잠겼다. 게이트가 판 위 개체를 직접 세게 되면서(EditorWorkspace)
  //    그 사슬이 끊겼고, 이제 ① [비우기]는 DRILL_LOAD 로 가고(제목·id 를 유지해야 해서다 —
  //    BoardScreen.onReset) ② 이 액션도 되돌릴 수 있다.
  //    옛 근거 *"전환 결과는 언제나 그 코트의 기본 배치이므로 되돌릴 과거가 의미 없다"* 는
  //    전환 **결과**에만 맞는 말이었다: 코트를 바꾸려면 판이 비어 있어야 하므로 비우기와 코트
  //    전환은 붙어 다니고, 그 **과거**에는 방금 지운 배치가 있다.
  | { type: 'BOARD_SET'; drill: Drill }
  // 드릴 데이터 (히스토리 커밋)
  | { type: 'DRILL_LOAD'; drill: Drill }
  // §5.4 배치 프리셋([포메이션으로 채우기] · 세트피스 3종). `model/fillPreset.applyPlacement`
  // 가 만든 판을 통째로 앉힌다.
  //
  // ⚠️ **DRILL_LOAD 로 대신할 수 없다.** DRILL_LOAD 는 uiReducer 에서 stepId 를 첫 스텝으로
  //    되돌리고 선택·저장 기준선까지 리셋한다 — 3번 스텝에서 프리셋을 누르면 1번 스텝으로
  //    끌려간다. 이 액션은 uiReducer 에 갈래가 **없어서**(default 통과) 시점을 건드리지 않는다.
  // ⚠️ CHAIR_PLACE 8번으로 대신할 수도 없다: 되돌리기가 8칸이 되고 물리 월드가 8번 재생성된다.
  //    EPOCH_BUMP_TYPES 에 들어 있는 것이 중요하다 — 그래야 EditorProvider 가 world.load 로
  //    바디를 새 좌표에 다시 세우고 writeFrame 이 즉시 그린다(안 그러면 모델만 바뀌고 화면의
  //    칩은 옛 자리에 남는다).
  | { type: 'PRESET_APPLY'; drill: Drill }
  // C7(2026-08-18) — patch 의 **명시적 undefined 는 이제 "키를 지워라"** 다(reducer 가
  // 병합 후 그 키를 delete 한다). 옛 경고("undefined 를 싣지 마라 — 두 얼굴 문서가 된다")의
  // 함정 자체가 사라졌다: 선택 필드(situation 등)를 '미지정' 으로 되돌리는 유일한 통로다.
  // 필수 필드는 여전히 구체값('' · 0 · [])을 보낸다 — 지우면 validate 가 기본값으로 되살린다.
  | {
      type: 'META_SET';
      patch: Partial<
        Pick<
          Drill,
          // 드릴 신원 (v8: category → drillType, situation·variation 합류, 훈련량 폐기)
          | 'title'
          | 'drillType'
          | 'situation'
          | 'level'
          | 'durationMin'
          | 'tags'
          | 'description'
          | 'variation'
          | 'formation'
          // §3.2 교육 필드
          | 'objective'
          | 'coachingPoints'
          | 'playersNeeded'
          | 'equipment'
          // 진영(2026-08-15). 골 지역 3인 반칙이 어느 팀에 걸리는지를 정한다 —
          // 되돌리기에 남아야 하므로 다른 메타와 같은 통로로 간다.
          | 'defense'
          // 팀 이름(§0.5 미배송 빚, 2026-08-20). drill.teams[side].label — 다른 메타와
          // 같은 이유로 되돌리기에 남아야 한다. 색상은 여기 없다(설정 전용, 드릴 자신의
          // 값을 편집하는 자리는 이번에 만들지 않기로 결정 — 로드맵 §0.5 참조).
          | 'teams'
        >
      >;
    }
  /** 스텝 복제(§복제, 기현님 확정 2026-08-17) — **후방 복제가 기본**이라 `toIndex` 를
   *  안 주면 `model/edits.ts duplicateStep` 계약대로 바로 뒤(`i+1`)에 꽂힌다. 카드 자체의
   *  복제 버튼과 틈(gap) g>0 의 + 버튼은 그 기본값 그대로 쓴다(틈 g 는 위 스텝 g-1 을
   *  복제해 자기 자리 g 에 넣는 것뿐인데, g-1 의 기본 삽입 위치가 이미 g 다).
   *
   *  `toIndex` 는 **맨 앞 틈(g=0)** 하나만을 위해 존재한다: 그 틈은 "아래(첫) 스텝의 복제를
   *  맨 앞에" 넣어야 하는데, 복제 대상(첫 스텝, index 0)의 기본 삽입 위치(1)와 원하는 자리
   *  (0)가 어긋난다 — 그래서 그 한 경우만 명시적으로 0 을 실어 보낸다. */
  | { type: 'STEP_DUPLICATE'; id: StepId; toIndex?: number }
  | { type: 'STEP_DELETE'; id: StepId }
  | { type: 'STEP_REORDER'; id: StepId; toIndex: number }
  /** `patch.cut`(④ 사슬 토글, 기현님 확정 2026-08-17)은 **그 자체가 저장값이 아니라 명령이다**:
   *  `true` 는 이 스텝을 앞 스텝과 끊는다(경계에 `cut: true` 를 싣는다), `false` 는 **키를
   *  지운다**(`cut: false` 를 저장하는 게 아니다 — `DrillStep.cut` 은 리터럴 `true` 만 정의역
   *  이라 저장하면 validate.ts 정화기가 버린다, drill.ts 교리 주석 참고). name/note/durationMs
   *  와 같은 통로를 타는 이유: 스텝 하나의 속성 patch 라는 점이 같고, 되돌리기·coalesce·
   *  history 등록을 새로 만들 이유가 없다. */
  /** `patch.seamless`(2026-09-08 딜레이 없는 연결, PLAN-STEP-LINK 결정 1)도 `patch.cut` 과
   *  같은 명령이다 — `true` 는 이 스텝의 트윈을 구간 전체로 늘리고, `false` 는 키를 지운다.
   *  둘을 함께 싣는 것은 `model/stepLink.ts` 의 `stepLinkPatch` 뿐이다(셋 중 하나로 덮어쓰는
   *  조작이라 안 실은 키가 옛 값으로 남으면 배타가 깨진다). */
  | {
      type: 'STEP_META';
      id: StepId;
      patch: { name?: string; note?: string; durationMs?: number; cut?: boolean; seamless?: boolean };
    }
  // ── ⑤ 다중 선택(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md §다중 선택) ─────────────────
  // 선택 상태(어떤 카드가 체크됐나) 자체는 **컴포넌트 로컬(ephemeral)** 이라 여기 실리지
  // 않는다 — 화면 상태지 문서 상태가 아니라서 리듀서·undo 가 몰라야 한다(StepSidebar.tsx
  // 머리말). 세 액션은 "선택된 id 묶음으로 무엇을 했나" 라는 **결과** 만 받는다.
  /** 일괄 이동. 단일 `STEP_REORDER` 를 ids 개수만큼 반복 dispatch 하면 되돌리기가 조각난다
   *  (한 번 끈 이동을 Ctrl+Z 여러 번으로 풀어야 한다) — 그래서 한 칸짜리 새 액션이 필요했다.
   *  `toIndex` 는 **선택되지 않은 나머지 스텝들의 순서 안에서의 삽입 자리**다
   *  (model/edits.ts moveSteps 의 계약 그대로 — 미리보기(`movedOrderGroup`)와 좌표계가 같아야
   *  드래그 중 보이는 것과 커밋 결과가 어긋나지 않는다). */
  | { type: 'STEPS_MOVE'; ids: StepId[]; toIndex: number }
  /** 일괄 복제. 선택 묶음의 사본을 **마지막 선택 카드 바로 뒤**에 상대 순서대로 삽입한다
   *  (edits.ts duplicateSteps 참고). 정원(LIMITS.maxSteps)을 넘기면 리듀서가 조용히
   *  원본을 돌려준다 — 사이드바 버튼이 미리 잠가서 보통은 여기까지 안 온다. */
  | { type: 'STEPS_DUPLICATE'; ids: StepId[] }
  /** 일괄 삭제. 드릴에는 스텝이 **최소 1장은 남아야 한다**(기존 `STEP_DELETE` 와 같은 가드,
   *  edits.ts deleteSteps 참고). 현재 스텝(`stepId`)이 삭제 묶음에 들어 있으면
   *  `store/editor/reducer.ts` 의 `uiReducer` 가 (기존 `STEP_DELETE` 의 이웃 선택 로직을
   *  일반화해) 남는 스텝으로 옮긴다 — 이 액션 자체는 `Drill` 만 바꾼다. */
  | { type: 'STEPS_DELETE'; ids: StepId[] }
  /** id 를 **부르는 쪽이 짓는다**(2026-08-16) — 도형·메모·화살표가 이미 그렇다. 놓자마자
   *  선택하려면(§6.10a `PLACED`) 부르는 쪽이 방금 놓은 개체의 이름을 알아야 한다. */
  | { type: 'OBJECT_ADD'; kind: 'ball' | 'cone'; at: Vec2; colorIndex?: 0 | 1; id: BallId | ConeId }
  /** 삭제 범위. **사용자가 고르지 않는다** — 개체 성격에 따라 UI 가 정한다:
   *  메모·화살표는 그 스텝의 설명이라 `thisStep`, 선수·공·콘은 `onward`(인스펙터 참고).
   *  2026-08-16 — 키보드에서 Alt 로 범위를 고르던 길은 없앴다(Alt 는 보기 토글 전용 채널이
   *  됐다). `'everywhere'` 는 아무도 디스패치하지 않아 함께 걷어냈다. */
  | { type: 'OBJECT_REMOVE'; id: CastId; scope: 'onward' | 'thisStep' }
  /** 스텝 하나를 통째로 **비운다**([비우기], 2026-08-28 기현 지시로 드릴 편집에도 생겼다).
   *
   *  개체를 하나씩 지우는 `OBJECT_REMOVE` 를 반복하지 **않는다**: 그러면 되돌리기가 개체 수만큼
   *  필요해져(EditorWorkspace 의 eraseIds 가 그렇다) "한 번에 비웠는데 되돌리려면 열 번" 이 된다.
   *  비우기는 한 동작이므로 되돌리기도 한 칸이어야 한다.
   *
   *  스텝 **id 를 유지**하므로 uiReducer 가 stepId 를 손볼 일이 없다(STEP_DELETE 류와 다르다). */
  | { type: 'STEP_CLEAR'; id: StepId }
  | { type: 'CHAIR_PLACE'; id: ChairId; pose: StoredChairPose }
  | { type: 'CHAIR_DEF'; id: ChairId; patch: Partial<Omit<ChairDef, 'id' | 'team'>> }
  // §7 5.2 — **선택된 공을 그 자리에서 다시 탭했다**(2026-08-13, 기현님 실기 피드백 ③).
  // 액션이 '다음 상태' 를 싣지 않고 '사건' 만 싣는 이유: 순환의 다음 칸은 지금 값에서 나오고
  // (없음→3 m→5 m→없음), **5 m 에서만 선택도 함께 풀려야** 한다. 둘을 화면 쪽에서 계산하면
  // 읽고-쓰는 사이에 상태가 바뀌는 길이 열리고, 무엇보다 순환 규칙이 리듀서 밖으로 새 나가
  // 순수 함수로 단언할 수 없게 된다. 그래서 한 번의 dispatch 가 uiReducer(선택 해제)와
  // drillReducer(원 순환) 양쪽에서 갈라진다 — undo 한 칸, 저장 한 번.
  | { type: 'BALL_RETAP'; id: BallId }
  | { type: 'OBJECT_NUDGE'; id: CastId; d: Vec2; dTheta: number } // 키보드 미세조정
  /** 고른 개체를 **통째로** 옮긴다(§6.10b). 종류를 가리지 않는다 — 한 선택 안에 휠체어·공·
   *  콘·메모·화살표·도형이 섞여 있어도 같은 델타로 함께 간다.
   *
   *  ⚠️ `OBJECT_NUDGE` 를 개수만큼 보내는 것으로 대신할 수 없다. 그 액션은 캐스트(칩·공·콘)
   *  전용이라 메모·화살표·도형을 못 옮기고, 무엇보다 **되돌리기가 개체 수만큼 쌓인다** —
   *  한 번 끈 것을 되돌리려고 Ctrl+Z 를 네 번 눌러야 한다.
   *
   *  ⚠️ 물리 드래그(`world.beginDrag`)로도 대신할 수 없다. 물리 월드는 드래그 세션을 **한 번에
   *  하나만** 쥔다(physics/index.ts 의 `session` — 새 세션은 이전 것을 endDrag 로 덮는다).
   *  그래서 덩어리 이동은 키보드 이동과 같은 길을 간다: 모델을 옮기고 물리에 자세를 밀어 넣는다.
   *  겹침은 손을 뗄 때 물리가 푼다(정착) — 놓기가 이미 그렇게 동작한다. */
  | { type: 'GROUP_NUDGE'; ids: string[]; d: Vec2 }
  | { type: 'PLACE_BEGIN' } // 드래그 시작: 히스토리 경계만
  | {
      type: 'PLACE_COMMIT';
      stepId: StepId;
      chairs: PoseMap<ChairId, StoredChairPose>;
      balls: PoseMap<BallId, Vec2>;
      cones: PoseMap<ConeId, Vec2>;
    } // 경계 닫기 (past 안 건드림)
  // ★ 정착 후 재커밋(§4.2 P0-2). PLACE_COMMIT 과 결과는 같지만 **의미가 다르다**: 손을 뗀
  // 시점이 아니라 물리가 다 선 시점의 좌표다. 경계를 새로 열지 않는 것은 PLACE_COMMIT 과
  // 같고(드래그 1회 = undo 1회), 추가로 자동저장 억제 창(settleHoldUntil)을 닫는다.
  | {
      type: 'PLACE_SETTLE';
      stepId: StepId;
      chairs: PoseMap<ChairId, StoredChairPose>;
      balls: PoseMap<BallId, Vec2>;
      cones: PoseMap<ConeId, Vec2>;
    }
  // 자동저장 억제 창을 연다(§4.2 A-5). 손을 뗀 시점에 걸고, 정착 재커밋이 닫는다 — 이게
  // 없으면 드래그 1회에 IDB CAS 쓰기가 두 번 나간다(디바운스 800ms < 정착 시간).
  | { type: 'SETTLE_ARM'; until: number }
  | { type: 'ARROW_SET'; arrow: Arrow }
  | { type: 'ARROW_REMOVE'; id: ArrowId }
  /** 자유 그리기 획(2026-09-03). 캡처가 끝난 새 획도, 앵커로 돌리거나 색·굵기·화살촉을 바꾼
   *  편집도 **같은 액션**이다 — 화살표·도형이 걸어 둔 길이고(`ARROW_SET`/`SHAPE_SET`), 갈래를
   *  나누면 되돌리기·병합·자동저장 세 곳에 각각 예외가 생긴다. */
  | { type: 'STROKE_SET'; stroke: Stroke }
  | { type: 'STROKE_REMOVE'; id: StrokeId }
  | { type: 'NOTE_SET'; note: NoteLabel }
  | { type: 'NOTE_REMOVE'; id: NoteId }
  // 작도 도형(2026-08-14). 화살표·메모와 **완전히 같은 모양**의 쌍이다 — 도형만 다른 규칙을
  // 갖게 하면 되돌리기·병합·자동저장 세 곳에 각각 예외가 생긴다.
  | { type: 'SHAPE_SET'; shape: Shape }
  | { type: 'SHAPE_REMOVE'; id: ShapeId }
  /** 개체 상태 플래그(2026-08-14). 대상이 여섯 종류라 id 는 그냥 string 이다 —
   *  브랜드 타입으로 좁히면 여섯 갈래 유니온이 되고, 리듀서가 그것을 다시 넓혀야 한다.
   *
   *  **여럿을 한 번에** 받는다(§6.10b) — 고른 넷을
   *  잠그는 것은 사용자에게 한 번의 조작이므로 되돌리기도 한 칸이어야 한다. id 하나씩
   *  네 번 보내면 Ctrl+Z 를 네 번 눌러야 원래대로 돌아온다. */
  | { type: 'FLAG_SET'; flag: 'locked' | 'ignored'; ids: string[]; on: boolean }
  /** 표시 순서 한 칸(2026-09-06, `docs/PLAN-Z-ORDER.md` 결정 8). `FLAG_SET` 과 같은 부류의
   *  **이산 클릭**이라 COMMIT_TYPES 에만 넣고 COALESCE_TYPES 에는 넣지 않는다 — 700ms 안의
   *  두 번을 한 칸으로 묶으면 "두 단계 올렸다가 한 단계만 되돌리기" 가 손 빠르기에 따라
   *  갈린다(`BALL_RETAP` 을 병합에서 뺀 그 증상). EPOCH_BUMP_TYPES 에도 넣지 않는다: 개체는
   *  한 픽셀도 안 움직이므로 물리 월드를 다시 세울 이유가 없다.
   *
   *  ⚠️ **여럿을 받지 않는다**(FLAG_SET 과 갈리는 점). 흩어진 여럿의 "한 단계" 는 답이 하나가
   *  아니라 메뉴 자체가 단일 선택 전용이다(계획서 결정 10) — id 를 배열로 열어 두면 부르는
   *  쪽이 언젠가 그 답 없는 조작을 시도한다.
   *  겹침 판정(어느 것을 건너뛰는가)은 리듀서가 `physics/bounds.overlappingIds` 로 그 자리에서
   *  다시 뜬다 — 액션에 실어 보내면 메뉴를 연 시점의 낡은 겹침으로 판이 바뀔 수 있다. */
  | { type: 'Z_ORDER'; id: string; op: ZOp }
  | { type: 'UNDO' }
  | { type: 'REDO' };

/** 드릴 데이터를 바꾸는 액션 전부(§6.7 COMMIT_TYPES) — withHistory 가 drillReducer 를 태우는 기준. */
export const COMMIT_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'DRILL_LOAD',
  'PRESET_APPLY',
  'META_SET',
  'STEP_DUPLICATE',
  'STEP_DELETE',
  'STEP_REORDER',
  'STEP_META',
  'STEPS_MOVE',
  'STEPS_DUPLICATE',
  'STEPS_DELETE',
  'OBJECT_ADD',
  'OBJECT_REMOVE',
  'STEP_CLEAR',
  'CHAIR_PLACE',
  'CHAIR_DEF',
  // 5.2 원 순환은 **드릴 내용**이라 되돌리기에 실린다 — `CHAIR_DEF`(개별 색·이름·역할)와 같은
  // 부류다. 실지 않으면 present 가 바뀔 길이 아예 없다(withHistory 는 COMMIT_TYPES 아닌 액션에
  // 대해 s 를 그대로 돌려준다) → 원이 화면에도 파일에도 남지 않는다.
  // COALESCE_TYPES 에는 **넣지 않는다**: 700ms 안의 두 탭이 한 칸으로 병합되면 "5 m 를 3 m 로
  // 되돌리려고 Ctrl+Z 를 눌렀는데 없음까지 갔다" 가 탭 속도에 따라 나온다.
  // EPOCH_BUMP_TYPES 에도 **넣지 않는다**: 개체가 하나도 안 움직였는데 물리 월드를 재생성하면
  // 탭 한 번에 판 전체가 다시 서고 진행 중이던 정착 통지가 유실된다.
  'BALL_RETAP',
  'OBJECT_NUDGE',
  'GROUP_NUDGE',
  'PLACE_COMMIT',
  'PLACE_SETTLE',
  'ARROW_SET',
  'ARROW_REMOVE',
  'NOTE_SET',
  'NOTE_REMOVE',
  'SHAPE_SET',
  'SHAPE_REMOVE',
  'STROKE_SET',
  'STROKE_REMOVE',
  'FLAG_SET',
  'Z_ORDER',
]);

/** COALESCE_TYPES(§6.7) — 연속 입력을 700ms/5s 창 안에서 병합한다. */
export const COALESCE_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'META_SET',
  'STEP_META',
  'NOTE_SET',
  'ARROW_SET',
  // 도형은 끌면 매 프레임 SHAPE_SET 이 난다 — 병합 없이는 한 번 끄는 데 되돌리기 수십 칸이다.
  'SHAPE_SET',
  // 획도 같다 — 회전 앵커를 끄는 동안 매 프레임 STROKE_SET 이 난다.
  // ⚠️ 대가를 알고 넣는다: 굵기·색 순환(반복 클릭)도 같은 액션이라 700ms 안의 연타가 한 칸으로
  // 병합된다(`BALL_RETAP` 을 여기서 뺀 이유가 정확히 그 증상이다). 그래도 넣는 것은 화살표가
  // 이미 같은 처지이기 때문이다 — `ARROW_SET` 이 굽힘점 색 순환과 드래그를 함께 나른다. 획만
  // 다르게 굴면 같은 판 위의 두 선이 되돌리기에서 다르게 반응한다.
  'STROKE_SET',
  'OBJECT_NUDGE',
  // 덩어리를 끄는 동안 매 프레임 난다 — 병합 없이는 한 번 끄는 데 되돌리기 수십 칸이다.
  'GROUP_NUDGE',
]);

/** epoch 를 증가시키는 액션(§6.7) — 구조 변경·시점 점프. */
export const EPOCH_BUMP_TYPES: ReadonlySet<EditorAction['type']> = new Set([
  'UNDO',
  'REDO',
  'DRILL_LOAD',
  'PRESET_APPLY',
  'STEP_DUPLICATE',
  'STEP_DELETE',
  'STEP_REORDER',
  // 일괄 이동·복제·삭제도 구조 변경이다 — 단일 형제(STEP_REORDER/STEP_DUPLICATE/STEP_DELETE)와
  // 같은 이유로 epoch 를 올린다. 특히 STEPS_DELETE 는 uiReducer 가 stepId 를 다른 스텝으로
  // 옮길 수 있어(§복제 이관), 물리 월드를 새 시점에 맞춰 다시 세워야 한다.
  'STEPS_MOVE',
  'STEPS_DUPLICATE',
  'STEPS_DELETE',
  'OBJECT_ADD',
  'OBJECT_REMOVE',
  // 판이 통째로 비므로 물리 바디도 전량 사라져야 한다 — 안 올리면 모델은 비었는데 칩이 남는다.
  'STEP_CLEAR',
  'CHAIR_PLACE',
]);
