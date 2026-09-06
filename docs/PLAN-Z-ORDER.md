# PLAN — 개체 표시 순서(z-order) · [표시순서] 하위메뉴 (2026-09-06)

기현님 지시(2026-09-06, 원문):

> 큰 기능 추가해야한다.
> - 드릴 편집에서 객체들의 표시 레이어조정
> - 각 개체가 겹칠 때 어느것이 뒤에표시되고 앞에 표시되나.
> - 데이터 구조를 바꿔야하고 겹침 판정해예한다.
> - 오른쪽 메뉴에서 표시순서 라는 하위메뉴에 맨뒤로,한단계 뒤로, 한단계 앞으로, 맨 앞으로 구현

이 문서는 이 기능의 **정본 계획서**다. 상위 정본은 `AGENTS.md`(관행) 와 `docs/DESIGN.md`(계약). 랜딩하면
DESIGN.md §3.5 · `FALSIFICATION-BASELINE.md` 를 같은 커밋에서 옮긴다(AGENTS.md §8).

> ⚠️ **옛 결정을 뒤집는다** (AGENTS.md §2). `docs/PLAN-2026-08.md` 「하지 않는 것」표는 *"겹친 칩 순환 선택 /
> z-order 조작"* 을 **1.3 겹친 휠체어 자가 분리로 대체된다** 며 기각했고, `DESIGN.md` §3.5 는 *"렌더 레이어 순서
> (고정, per-object z 없음)"* 을 계약으로 못박았다. 그 전제(판이 스스로 벌어지니 아래 것을 고를 일이 없다)는
> **휠체어끼리의 물리 충돌**에만 산다 — 화살표·획·도형·메모·콘은 서로 밀어내지 않으므로 겹치면 아래 것은
> 영영 가려진다. 전제가 죽은 범위만큼 뒤집는다: 휠체어 자가 분리는 그대로 두고, 그 위에 **사용자가 정하는
> 순서**를 얹는다. 두 문서의 옛 근거는 지우지 않고 옆에 ⚠️ 2026-09-06 표식을 단다.

## 0. 한 줄 원칙

**순서는 스텝이 쥔 id 목록 하나(`DrillStep.zOrder`)이고, 그 목록을 푸는 함수도 하나(`sceneOrder`)다.**
판·시연·인쇄·PNG·썸네일 다섯 렌더 경로와 히트테스트가 전부 그 한 함수를 읽는다 — 이 저장소에서 네 번
터진 "경로별 드리프트" 의 다섯째 사례를 만들지 않는다. 목록이 없으면 지금의 §3.5 고정 순서가 그대로다
(옛 드릴은 한 픽셀도 안 변한다).

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | `DrillStep.zOrder?: string[]` — **아래→위**, 7종 개체 id 를 한 목록에(접두 `cn fh ar ch bl nt sh` 로 종류가 구별된다). **스텝별**. 첫 재배치 때 그 스텝의 전체 순서를 물질화한다 | `locked`/`ignored`/`cut` 이 전부 "스텝이 쥔 id 목록" 이다(`drill.ts:128` 주석: 개체마다 필드를 달면 저장 방식이 둘이 된다). chairs/balls/cones 는 PoseMap 이라 순서를 담을 자리가 없다. `duplicateStep` 의 `structuredClone` 이 공짜로 복제한다 |
| 2 | 유효 순서는 `src/model/zOrder.ts` 의 **`sceneOrder(step, cast): SceneRef[]`** 하나. 규칙: ① `zOrder` 가 없으면 §3.5 기본층 순서(콘→획→화살표→휠체어→공→메모… 도형은 맨 아래, 결정 4) 안에서 배열/캐스트 순서. ② 있으면 그 순서대로, 스텝에 없는 id 는 무시. ③ 목록에 **없는** 개체(나중에 놓은 것)는 기본층 순서대로 **끝(맨 위)** 에 붙는다 | 그리기 도구의 관례 — 방금 놓은 것이 위. "목록 있는 스텝에서 새 콘이 칩 위에 온다" 는 기본층과 다르지만, 새 개체를 기본층 자리에 끼우면 사용자가 정한 순서 사이로 파고들어 더 놀란다 |
| 3 | 스키마 **v10 → v11** 도장. 마이그레이션은 v4·v10 과 같은 「⚠️ 적을 참말이 없는 상승」(필드 추가 없음) | 옛 앱은 `zOrder` 를 모른 채 고정 순서로 그린다 = 조용히 **다른 그림**(`drill.ts` 의 ② 기준). 정책은 거절(`'too-new'`). 규칙 장면 19벌은 `77edbf9` 꼴로 재도장(리터럴 10→11 + 출처 주석, `scripts/import-rule-scene.mjs --check` 는 그대로 통과해야 한다) |
| 4 | 대상은 **7종 전부** — 콘·획·화살표·휠체어·공·메모·**도형**. 도형은 `ShapeLayer` 를 떠나 `ObjectLayer` 의 정렬 목록 안에서 그려진다. 기본층에서는 여전히 맨 아래 | 2026-08-14 지시("도형은 코트보다 높고 칩·화살표보다 낮게")는 **기본값**으로 산다. 사용자가 뒤집을 수 있게 되는 것만 바뀐다 — `model/shape.ts`·`CourtStage.tsx` 의 그 주석에 ⚠️ 를 단다. 골대·규칙존·격자·선택 강조·핸들은 대상이 아니다(개체가 아니다) |
| 5 | 명령 의미(겹침 인지): **한 단계 앞으로** = 자기 위에 있는 개체 중 **나와 겹치는** 가장 가까운 것 **바로 위**로. **한 단계 뒤로** = 대칭. **맨 앞으로/맨 뒤로** = 목록 끝/처음. 겹치는 것이 그 방향에 없으면 그 항목은 disabled | 안 겹치는 개체와 자리를 바꾸면 화면이 안 변해 "눌렀는데 아무 일 없음" 이 된다. 지시의 "겹침 판정" 은 이 문지기다 |
| 6 | 겹침 = **월드 px AABB 교차**(`src/physics/bounds.ts`: `objectBounds`·`overlappingIds`). 휠체어 = 회전 hull 의 AABB(차체 치수는 `chairOverlap.ts`/`obb.ts` 의 정본), 공·콘 = 반지름(`hitTest.ts` 의 시각 반지름 상수), 메모 = 칩 반폭·반높이(`noteChip.ts`), 화살표 = from/ctrl/to AABB + 선폭 반, 획 = 점 AABB + 굵기 반, 도형 = 회전 포함 AABB | 정확 판정이 아니라 **문지기**다. 오탐의 값은 "눌러도 화면이 안 바뀜" 이고 미탐의 값은 "가려진 것을 못 꺼냄" 이라 AABB 로 오탐 쪽에 서는 게 맞다. 정확 기하(SAT·베지에)는 필요해지면 그때 |
| 7 | 메뉴: `ObjectMenu` 에 **[표시순서 ▸]** 항목(단일 선택 · 잠기지 않음 일 때만 표시; 겹치는 개체가 없으면 `aria-disabled` + 힌트 "겹친 개체 없음"). 누르면 **같은 패널이 하위 화면으로 바뀐다**: [← 돌아가기] · [맨 앞으로] · [한 단계 앞으로] · [한 단계 뒤로] · [맨 뒤로]. 하위 항목은 눌러도 **메뉴가 안 닫힌다**(한 단계씩 여러 번). 불가능한 항목은 disabled. Esc·바깥 클릭·돌아가기로 닫는다. 자리는 [미세 조정] 바로 아래(같은 "맞추기" 뭉치) | hover 플라이아웃은 이 사용자군(터치·발 마우스)에 취약 — 클릭 2단이 안전. 미세 조정을 `NudgePad` 로 뺀 근거(불투명 메뉴가 개체를 가린다)는 안다 — 지시가 하위메뉴이므로 따르되, 실기에서 가림이 문제면 패드 꼴로 옮기는 것이 다음 수(§4) |
| 8 | 액션 `{ type: 'Z_ORDER'; id: string; op: 'back'\|'backward'\|'forward'\|'front' }` → `COMMIT_TYPES`(클릭 1 = undo 1, 병합 없음). 리듀서는 순수 함수 `moveZ(step, cast, id, op, overlaps: ReadonlySet<string>)` 를 부른다 | `FLAG_SET` 선례(`actions.ts:211`, `reducer.ts:420`). 드래그류 coalesce 와 무관한 이산 클릭 |
| 9 | 히트테스트: **선택된 개체의 핸들(화살표·획; ⚠️ 2026-09-06 검수: 존 핸들은 몸통 **뒤** — 레버 셋이 차체 안에 앉아 앞에 두면 선택 휠체어 몸을 못 짚는다, §5) → 엄격 몸통을 `sceneOrder` 의 위→아래로(위가 이긴다) → 관대 패스는 지금 그대로**. 종류 서열(공/콘/메모 → 휠체어 → … → 화살표·획 "가까운 쪽") 은 폐기 | "앞으로 보냈는데 클릭은 뒤의 것이 잡힌다" 는 순서 기능의 뜻을 죽인다. §6.5 blocker(저배율 공 히트원이 휠체어를 덮음)는 공이 기본층에서 휠체어 위라 그대로 안전하고, 사용자가 공을 휠체어 밑으로 보냈다면 휠체어가 잡히는 것이 **맞는** 답이다. `hitTest.contract.test.ts` 의 "가까운 쪽이 이긴다" 단언은 뜻이 뒤집힌다 — 지우지 않고 왜 뒤집혔는지 적는다(`44048a2` 선례). 지우기 도구의 `forgivingRadius` 가드는 손대지 않는다 |
| 10 | 다중 선택에는 [표시순서] 를 **내지 않는다** | 흩어진 여럿의 "한 단계" 는 답이 하나가 아니다. [수정]·[같은 것 고르기] 의 단일 전용 결 |
| 11 | 단축키 없음(이번 범위 밖). `Ctrl+[`/`Ctrl+]` 가 비어 있음은 기록만 | `[`/`]` 는 개체 순회가 점유. 도움말·keymap 계약까지 번지는 일은 다음에 |
| 12 | 시연(`PresentStage`)·인쇄·PNG·썸네일 전부 반영. 시연은 **현재 스텝의 순서**로 DOM 을 재배열(React key 유지, 트윈 중에는 목표 스텝 순서) | 판과 종이가 다르면 그것이 버그다(`buildStaticSvg.ts:480` 주석) |
| 13 | 정리: `stripStepFlags` 가 `zOrder` 도 걷어낸다(삭제 경로 전부가 거길 지난다). `validate.ts` 의 `sanitizeZOrder` 는 스텝에 있는 id 만·중복 제거·상한은 개체 총수. `fillPreset` 이 남기는 고아는 `sceneOrder` 가 무시하고 다음 validate 가 지운다 | 고아 id 가 저장본에 쌓이는 것이 이 저장소의 반복 사고 |

## 2. 손대는 곳 (구조 지도 2026-09-06, 순서대로)

**모델(A)** `model/drill.ts`(`zOrder` 필드 + v11 근거 주석, `CURRENT_DRILL_SCHEMA = 11`) → `model/migrate.ts`(10→11) →
`model/validate.ts`(`sanitizeZOrder`) → `model/zOrder.ts`(신규: `SceneRef`, `DEFAULT_TIERS`, `sceneOrder`, `moveZ`,
`zMoves(step, cast, id, overlaps)` = 네 명령의 가능 여부) → `model/edits.ts`(`stripStepFlags`) → 규칙 장면 19벌 재도장 +
`ruleScenes.test`. `model/thumb.ts` 는 순서를 요약하지 않는다(썸네일 렌더가 `sceneOrder` 를 직접 읽는다).
**겹침(B)** `physics/bounds.ts`(신규: `AABB`, `objectBounds`, `overlappingIds`). 정본 치수는 `chairOverlap.ts`·`obb.ts`·
`hitTest.ts` 상수·`noteChip.ts`·`model/stroke.ts`(`STROKE_WIDTHS`)·`model/arrow.ts` 에서 **가져다 쓴다**(복사 금지).
**상태·메뉴(C)** `store/editor/actions.ts`(`Z_ORDER`, `COMMIT_TYPES`) → `reducer.ts` → `features/editor/ObjectMenu.tsx`
(`onZOrder(id, op)`, `zMoves` 결과로 disabled, 하위 화면 상태) → `EditorStage.tsx`(배선: 겹침 집합 계산·액션 디스패치) →
`i18n/{ko,en,ja}.ts`(`editor.objectMenu.zOrder`, `.zOrder.front/forward/backward/back/backToMenu/noOverlap`) →
`objectMenu.test.tsx` · HomeNav 류 목 갱신.
**렌더(D)** `render/ObjectLayer.tsx`(7종 정렬 목록 하나로 렌더, 도형 포함 — `ShapeLayer` 의 도형 하나 그리기는
`render/objects/ShapeMark.tsx` 로 뽑아 재사용) → `render/CourtStage.tsx`(ShapeLayer 삽입 제거) → `features/present/PresentStage.tsx`
→ `features/print/PrintCourt.tsx` → `features/export/buildStaticSvg.ts` → `render/CourtThumbnail.tsx` → `render/renderPaths.ts`
(순서 주석) → `ObjectLayer.test.tsx`(기본층 단언 유지 + `zOrder` 가 DOM 순서를 바꾼다는 단언 1개).
**히트(E)** `physics/hitTest.ts`(`SceneSnapshot.order?: SceneRef[]`, 결정 9) → `features/editor/useEditorPointer.ts`(`buildScene`
에 순서 싣기) → `hitTest.contract.test.ts`.
**문서(F)** `DESIGN.md` §3.5 · `PLAN-2026-08.md:678` 행(⚠️ 뒤집힘) · `FALSIFICATION-BASELINE.md`(히트 규칙) ·
`CHANGELOG.md/.en.md/.ja.md` [Unreleased] 추가됨 · 이 문서 §5.

## 3. 착수 순서

1. **모델(A)** ∥ 2. **겹침 기하(B)** — 병렬, 파일이 겹치지 않는다(B 는 타입만 읽는다).
3. **상태·메뉴(C)** ∥ 4. **렌더 5경로(D)** ∥ 5. **히트테스트(E)** — 1·2 뒤 병렬. C 는 `EditorStage.tsx`, E 는
   `useEditorPointer.ts`, D 는 `CourtStage.tsx` — 서로의 파일을 만지지 않는다.
6. 검수(typecheck·lint·전체 테스트·돌연변이) → 문서(F) → 실기.

테스트는 AGENTS.md 「테스트 작성 규칙」대로 — 각 단언에 "지우면 새는 실기 버그" 가 있어야 하고 돌연변이로 실효를
증명한다. 새로 값 있는 것: `sceneOrder` 규칙 ①②③, `moveZ` 의 겹침 건너뛰기·경계, `overlappingIds` 의 회전 휠체어,
`sanitizeZOrder`, 히트 "위가 이긴다", `ObjectLayer` 의 `zOrder` DOM 순서, 메뉴 disabled 게이트, v11 거절. DOM 스냅샷·해시는 금지.

## 4. 실기 확인(jsdom 이 못 재는 것)

- 메뉴가 개체를 가려 "한 단계" 의 결과가 안 보이는지(결정 7 의 알려진 긴장) — 문제면 `NudgePad` 꼴 패드로 옮긴다.
- 터치(태블릿)에서 긴 터치 → [표시순서 ▸] → 하위 항목 연타가 매끄러운지, 하위 화면의 첫 포커스.
- 시연 화면에서 스텝을 넘길 때 순서가 바뀌는 개체가 깜빡이거나 트윈이 끊기는지(결정 12).
- 인쇄 미리보기·PNG 내보내기·목록 썸네일이 판과 같은 순서인지 — 셋 중 하나만 다르면 드리프트다.
- 옛 기기(v10 앱)가 동기화로 v11 드릴을 받았을 때 `'too-new'` 거절 문구.

## 5. 구현 결과·검수 (2026-09-06)

구현은 A(모델)·B(겹침)·C(상태·메뉴)·D(렌더)·E(히트) 다섯 에이전트가 §3 순서로 병렬 랜딩했고, 검수(fable)가
마지막 관문에서 통합·수정했다. 커밋은 아직 없다(기현님 실기 뒤).

### 5.1 관문 숫자

| 관문 | 결과 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run lint` | 경고 48 = HEAD 48(HEAD 워크트리와 파일·규칙 단위로 diff, **새 경고 0**) |
| `npx vitest run` 전체 | 288 파일 **3728 케이스 전부 통과**(부하 경쟁·unhandled 없음) |
| 돌연변이 | 구현 에이전트 보고 42건 + **검수가 직접 14건**(§5.4) — 전부 빨강 |
| 헤드리스(CDP) | 새 개발 서버(5199)에서 겹친 사각 둘 → 오른쪽 클릭 → [표시순서] → [맨 뒤로] 가 **DOM 순서와 저장본 `zOrder` 를 뒤집는 것** 확인 |

### 5.2 검수가 고친 것 (에이전트 보고서의 blockers 를 닫은 것)

1. **판이 순서를 안 받고 있었다** — `EditorStage.tsx` 가 `sceneOrder` 를 `CourtStage`(`order` prop)로 안 내려, 모델·메뉴·렌더 테스트가
   전부 초록인 채 **앱에서는 [맨 뒤로]를 눌러도 화면이 그대로**였다(D blocker ②). 한 줄 배선 + `objectMenu.test.tsx` 「무대 끝까지」
   1케이스(저장본으로 메모 둘을 심고 메뉴 → DOM 순서 뒤집힘까지).
2. **PNG 가 순서를 안 날랐다** — `rasterizeFrameToPng` 4번째 인자 `order` + `ExportSheet.tsx` 가 `sceneOrder(step, cast)` 를 넘긴다(D blocker ③).
   `ExportSheet.test.tsx` 1케이스(메모→도형으로 뒤집은 스텝의 4번째 인자).
3. **`sceneOrder` 가 키 없는 옛 스텝 객체에서 죽었다** — `baseOrder` 의 `step.shapes`·`step.notes` 를 `?? []` 로(D blocker ④). `physics/bounds.ts`
   `stepEntries` 도 같은 방어. `PrintCourt`·`PresentStage` 의 우회(`{ ...step, shapes: [] }`)는 걷었다.
4. **썸네일이 순서를 못 따르던 것**(D blocker ⑤) — 계획 §2 의 *"썸네일 렌더가 `sceneOrder` 를 직접 읽는다"* 는 전제(썸네일이 스텝을 본다)가
   틀렸다: 카드는 요약(`ThumbSpec`)만 받고 요약에는 id 가 없다. 그래서 요약에 **평탄 목록 첨자 순열 `z`** 를 싣고(`model/thumb.ts`,
   기본층과 같으면 키 없음 → `SUMMARY_BUILD` 불변 — `arrows.c` 와 같은 논증) `CourtThumbnail` 이 `thumbSequence` 로 푼다.
   `thumb.test.ts` 2케이스 + `zOrderPaths.test.tsx` 썸네일 케이스(네 경로 → 다섯 경로).
5. **`shapeTool.test.tsx` 의 빨간 단언** — 골대를 "개체" 로 삼아 도형이 그 아래임을 재던 것을 ⚠️ 표식과 함께 뒤집었다(골대는 판의 부속,
   결정 4). `CourtThumbnail.test.tsx` 의 층 단언도 "svg 직계 g" 에서 문서 순서로 옮겼다(뜻은 그대로).

### 5.3 계획과 달리 한 것 (뒤집기 쉽게 근거와 함께)

- **결정 6** `objectBounds(kind, obj, ctx?)` 의 `ctx` 는 없다 — 7종 모두 개체 자신이 크기·회전·굵기를 들고 있고 `noUnusedParameters` 가
  빈 인자를 막는다. 종류→타입 짝은 `BoundsInput` 매핑으로 컴파일러가 강제한다. `physics → render/objects/noteChip.ts` 의존이 하나 생겼다
  (칩 폭·높이는 줄바꿈 함수라 복제하면 알고리즘이 두 벌).
- **결정 9** 존 핸들은 (가)가 아니라 **(다)** — 몸통 뒤. 핸들 레버 −22.5·0·22.5·45 px 중 셋이 차체(rear 6.5~front 26 px) **안**에 앉고 반경이
  22 CSS px 이라, 몸통 앞에 두면 선택된 휠체어의 몸을 짚는 길이 사라진다(`tapDeselect.test` 4건이 실측으로 빨개졌다). 화살표·획 앵커만 (가).
- **결정 5** `front`/`back` 도 겹침이 없으면 막힌다(안 겹치면 눌러도 화면이 안 변한다) — 계획 문면은 "그 방향에 겹치는 것이 없으면" 이
  `forward`/`backward` 만 말하지만 같은 이유가 넷에 다 통한다.
- **결정 12** 렌더 경로는 `order` 가 모르는 개체를 **버리지 않고 기본층 순서로 맨 위**에 붙인다(`sceneOrder` 규칙 ③과 같은 처리) — 스텝 전환 중
  퇴장 페이드(이전 스텝 소속 화살표·메모)가 지금 스텝의 순서에 없기 때문. 시연은 캐스트 전량을 마운트한 채 유지(opacityWriter 구조).
- **결정 4 의 대가** 골대 vs 도형이 한 칸 뒤집혔다(도형이 골대 기둥 위). 인쇄의 `ruleSvg`(링·소유 화살표)는 개체 블록 **앞**으로 옮겨 판과 같은
  자리가 됐다(종이에서만 콘이 도형 아래이던 옛 드리프트 소멸).
- **결정 3** `scripts/import-rule-scene.mjs --check` 는 못 돌렸다 — 원본 봉투(`SPIN_backup_20260831…`)가 저장소에 없고, v10 재도장 때 이미
  영구 불일치. 실질 게이트는 `ruleScenes.test.ts` 의 도장 19벌(초록).

### 5.4 검수가 직접 돌린 돌연변이 (14/14 빨강, 각각 원복 뒤 초록 재확인)

| # | 망가뜨린 것 | 빨개진 테스트 |
|---|---|---|
| M1 | `sceneOrder` 규칙 ③ `push`→`unshift` | zOrder.test 1 |
| M2 | `moveZ` forward 의 겹침 건너뛰기 → `i+1` | zOrder.test 1 |
| M3 | `aabbIntersects` `<=`→`<` | bounds.test 1 |
| M4 | 하위 항목이 `onClose()` 를 부름 | objectMenu.test 2 |
| M5 | `COMMIT_TYPES` 에서 `Z_ORDER` 제거 | reducer.test 1 + objectMenu 무대 끝까지 1 |
| M6 | `stripStepFlags` 가 `zOrder` 를 안 걷음 | edits.test 2 |
| M7 | `hitTest` 몸통 순회 아래→위 | hitTest.contract 5 |
| M8 | `EditorStage` 의 `order={zRefs}` 삭제 | objectMenu 무대 끝까지 1 |
| M9 | `buildStepThumb` 이 `z` 를 안 실음 | thumb.test 1 + zOrderPaths 썸네일 1 |
| M10 | `CourtThumbnail` 이 `z` 를 안 읽음 | zOrderPaths 썸네일 1 |
| M11 | `ExportSheet` 가 4번째 인자를 안 넘김 | ExportSheet.test 1 |
| M12 | `ObjectLayer` 가 `order` 를 무시 | ObjectLayer.test 2 |
| M13 | `sanitizeZOrder` 무력화 | validate.test 2 |
| M14 | v10→v11 이 `zOrder: []` 를 찍음 | migrate.test 1 |

### 5.5 검수가 배운 것 (다음 기능에 그대로 쓸 것)

1. **배선 한 줄은 단위 테스트 다섯 벌로도 안 잡힌다.** 모델·메뉴·렌더가 각자 초록이어도 "누가 그 값을 읽는가" 는 저장본을 심고 화면 끝까지
   도는 테스트 하나가 있어야 잡힌다. jsdom 에서는 포인터로 놓은 개체 좌표가 전부 `Infinity`(무대 rect 0)라 겹침 문지기가 안 열린다 —
   **`saveBoard` 로 심어 BoardScreen 부팅 ②를 타게** 하면 된다(`objectMenu.test.tsx` 「무대 끝까지」).
2. **오래 뜬 개발 서버는 옛 모듈을 낸다.** 5173(기현님 서버)은 `actions.ts` 를 `Z_ORDER` 없는 판으로 내고 있었다(HMR 무효화가 안 된 상태) —
   헤드리스에서 "눌러도 안 변함" 이 그 때문이었고, 새로 띄운 5199 에서는 첫 회에 통과했다. **실기 전에 5173 을 재시작**해야 한다.
3. 계획서의 "썸네일이 `sceneOrder` 를 읽는다" 처럼 **호출부의 입력 형태를 안 본 문장**은 착수 전에 `rg` 한 번으로 전제를 확인한다.

### 5.6 남은 실기 항목 (§4 에 더해)

- **5173 개발 서버 재시작** 뒤 태블릿에서: 겹친 개체 → 긴 터치 → [표시순서] → 연타. 하위 화면 폭이 첫 화면보다 넓어지는 것('한 단계 앞으로' 가
  `minWidth 128` 을 넘는다)이 개체를 더 가리는지 — 가리면 `NudgePad` 꼴로 옮긴다.
- 죽은 칸의 `title` 힌트("겹친 개체 없음")는 터치에서 안 뜬다 — 필요하면 라이브리전.
- 드릴 목록 카드·스텝 띠(`StepSidebar`)의 썸네일이 순서를 바꾼 스텝에서 판과 같은 앞뒤인지(§5.2-4 가 처음 배송하는 것).
- 인쇄 미리보기에서 규칙 링·소유 화살표가 콘 **아래**로 내려간 것(§5.3 결정 4 대가)이 어색하지 않은지.
- 도형을 화살표 위로 올린 뒤 그 겹친 자리를 눌러 도형이 잡히는지(도형만 SVG 네이티브 히트).
- 문서(F): `DESIGN.md` §3.5 · `PLAN-2026-08.md` · `FALSIFICATION-BASELINE.md` · CHANGELOG 3벌은 F 가 같은 회차에 고쳤다 — 커밋 전에
  세 CHANGELOG 의 항목 수가 같은지 한 번 더 본다.
