# PLAN — 자유 그리기(획) · 지우기 도구 (2026-09-03)

기현님 지시(2026-09-03, 원문):

> * 드릴 편집 작도에 자유 그리기 추가. 백터로 그리고 3개의 앵커 회전, 양끝 화살표 그냥 클릭 3단계,
>   약간 외각에 회전(드래그는 회전, 그냥 클릭은 색 순환). 선 (반복 클릭 굵기 3단계, 드래그 이동).
> * 메모 옆에 (객체)지우기 버튼 추가. 클릭하고 보드로 커서가 가면 붉은 "X" 변화. 연속 삭제 가능.
>   빈 곳을 클릭하거나 다시 지우기 버튼을 누르거나 esc를 누르면 선택으로 복귀

## 0. 한 줄 원칙

**획은 화살표의 N점 판이다.** 화살촉 3단계(`none→thin→wide`)·회전 앵커(드래그 회전 / 클릭 색 순환)·색 팔레트
(`ARROW_COLORS` 3색, 한 바퀴 돌면 키 삭제)는 `model/arrow.ts` 의 계약을 **그대로** 쓴다. 새로 생기는 것은
둘뿐 — 점 목록(`points`)과 **굵기 3단계**(`width` 인덱스). 화살표(`Arrow`)에는 굵기를 소급하지 않는다
(`ARROW_STYLE.width` 를 5곳이 파생해 쓴다 — 함정 5).

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 새 객체 `Stroke { id: 'fh…', points: Pt[], color?, width?: 0\|1\|2, headFrom?, headTo? }` — 스텝 소유(`DrillStep.strokes`) | 화살표·메모·도형과 같은 부류(스텝 전량 소유). cast 아님 |
| 2 | 스키마 **v9 → v10** | 옛 앱이 파일을 멀쩡히 열면서 획을 통째로 잃는다 = 이 저장소가 v2~v9 내내 "도장을 올리는" 기준(`drill.ts` 주석). 옛 기기는 `'too-new'` 로 거절 — 정책 |
| 3 | 점은 **월드 px** 로 저장, 캡처 때 2px 미만 이동은 버리고 RDP(ε 1.5px)로 단순화, 렌더는 Catmull-Rom → 3차 베지에 | 벡터("백터로") + 파일 크기. 스텝당 40획·획당 400점 상한(validate 절단) |
| 4 | 굵기 3단계 `STROKE_WIDTHS = [2.4, 3.4, 5.2]`, 기본 인덱스 1(=화살표와 같은 3.4) | 선 클릭이 순환. 케이싱·선택 halo·화살촉 마커는 굵기에서 파생 |
| 5 | 화살촉 기본 `none/none` (화살표는 to 가 `thin`) | "자유 그리기" 는 선이 기본, 화살촉은 사용자가 켠다 |
| 6 | 앵커 3개: 양끝 + 회전(끝점 기준 48px 바깥, `ARROW_ROTATE_GAP_PX`) — 클릭/드래그 판정은 `arrowHandleDragRef.moved` 스위치의 확장 | 사용자가 "화살표와 같은 앵커" 를 그림 |
| 7 | 도구 `freehand` 는 [작도] 서랍의 `line` 옆(기본 첫 칸은 그대로 `line`) | 서랍이 "그리는 것" 의 집 |
| 8 | 도구 `eraser` 는 서랍이 아니라 **[메모] 옆 단독 버튼**(`SOLO_TOOLS`) — `LOCKABLE_TOOLS` 에 넣지 않는다 | 연속 삭제는 도구의 성질이지 고정이 아니다. 고정에 넣으면 파괴 모드가 잠긴 채 남는다(함정 2) |
| 9 | 지우기 히트는 **엄격 패스만** — `forgivingRadius` 의 `tool==='select'` 가드 유지 | 44px 반경 파괴 도구가 된다(FALSIFICATION F1, PLAN-2026-08 A-2) |
| 10 | 지우기의 삭제 경로는 트레이 드롭과 같은 `onEraseIds(ids, scope)` — cast 는 개체 메뉴의 기본 스코프, 획·화살표·메모·도형은 그 스텝에서 삭제. 되돌리기는 히스토리 | 삭제 입구가 하나 더 느는 것은 맞다(2026-08-16 에 지운 이유) — 그때는 지우개가 **선택과 겹치는 드래그 도구**였고, 지금 것은 클릭만·붉은 X 커서·빈 곳 클릭이면 빠지는 **일시 모드**다. DESIGN.md §6.10 에 이 차이를 적고 옛 근거는 남긴다 |
| 11 | 커서: `CourtStage` 의 `dragCursor` 분기에 붉은 X(SVG data-URI, 24px, 핫스팟 중앙) | 이미 `panArmed→crosshair` 와 같은 자리 |
| 12 | 빠지는 길 셋: 빈 곳 클릭(hit null) · 버튼 재클릭(토글) · Esc(EditorStage 의 Escape 분기) → `TOOL_SET select` | 지시 그대로 |

## 2. 손대는 곳 (구조 지도 2026-09-03, 순서대로)

**모델** `core/ids.ts`(접두 `fh`) → `model/stroke.ts`(신규: 타입·`strokePath`·`cycleStrokeWidth`·`rotateStrokeAbout`·
`nudgeStroke`·`strokeHandlePoints`·`simplify`) → `model/drill.ts`(필드·v10 근거) → `model/migrate.ts`(v9→v10) →
`model/validate.ts`(`sanitizeStrokes`·`LIMITS`) → `model/edits.ts` → `model/thumb.ts` → `defaults/seed`.
**상태** `store/editor/actions.ts`(`STROKE_SET/REMOVE`, `COMMIT_TYPES`) → `reducer.ts`(분기·`KEEPS_*` 허용 목록) → `tween.ts`.
**도구·입력** `physics/hitTest.ts`(`ToolId` + `stroke|strokeHandle`) → `core/keymap.ts`·`i18n/keymapDesc.ts` →
`features/editor/toolDefs.ts` → `useEditorPointer.ts`(획 캡처 세션·앵커 스위치·지우기 분기) → `placement.ts` →
`EditorStage.tsx`(Esc·커서) → `render/CourtStage.tsx`(커서) → `ToolRail.tsx` → `ui/icons.tsx`·`i18n/*`.
**렌더** `render/renderPaths.ts`(`'strokes'` 행 5개) → `render/objects/StrokePath.tsx`·`render/StrokeHandles.tsx`(신규) →
`ObjectLayer.tsx` → `present/PresentObjects.tsx` → `export/buildStaticSvg.ts` → `print/PrintCourt.tsx` → `CourtThumbnail.tsx`.
**문서·테스트** `REQUIREMENTS.md` §4.1 표(docsMatchCode) · `DESIGN.md` §6.10 · `PLAN-2026-08.md:671` 행("→ 착수") ·
`ToolRail.test/band/hit` 좌표 **새 값으로 재계산** · `boardTargetBudget` ≤40 확인 · `renderPaths.test` · `hitTest.contract`.

## 3. 착수 순서

1. **지우기 도구**(모델 무관) ∥ 2. **획 모델·스키마 v10**(입력·렌더 무관) — 병렬, 파일이 겹치지 않는다.
3. 획 **입력**(도구·캡처·앵커 상호작용) ∥ 4. 획 **렌더**(편집·시연·PNG·인쇄·썸네일) — 2 가 끝난 뒤 병렬.
5. 문서·예산 테스트·실기 확인.

## 4. 실기 확인(jsdom 이 못 재는 것)

터치로 그린 획의 매끄러움(RDP ε)·앵커 크기, 붉은 X 커서가 태블릿(터치)에서 뜻이 있는지(커서가 없다 — 버튼
활성 표시가 대신 말해야 한다), 굵기 3단계의 체감 차이.
