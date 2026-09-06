# 렌더 경로 대조 — 편집·시연·PNG·인쇄 (2026-09-06, 검수 2026-09-07)

> 기현 지시(2026-09-06, 버그 수정): *"드릴 편집 화면, 시연 화면과 png, 인쇄 화면에 객체·코트
> 요소(격자 및 번호, 골에어리어 강조, 골대 등) 등이 동일하게 나오는지 철저하게 점검. 직접 본 것:
> png 에 격자는 나오는데 격자 번호는 안 나옴, 골대 밑판 위에 코트 라인이 보임 등."*

**정본 지위**: 기록이다. 계약의 정본은 `src/render/renderPaths.ts`(그리는가) ·
`src/render/courtFurniture.order.test.tsx`(층 순서, 편집 화면을 읽어 와 잰다) ·
`src/render/CourtSurface.tsx` `COURT_LINE_WEIGHTS`(굵기·크기) · `docs/DESIGN.md`(골대 각주, 렌더
레이어 순서). 여기 적힌 값이 코드와 다르면 코드가 맞다.

**정본 화면은 편집 화면**(`CourtStage` → `CourtSurface` · `GridOverlay` · `RuleZones` ·
`SideMarks` · `RuleOverlay` · `ObjectLayer`)이다. 시연(`features/present/PresentStage.tsx`) ·
PNG(`features/export/buildStaticSvg.ts` + `staticSceneLayout.ts` + `rasterize.ts`) ·
인쇄(`features/print/PrintCourt.tsx`)가 그것과 같아야 한다. 썸네일은 일부러 축약(`THUMB`)이라
대상이 아니다.

## 1. 점검 방법 셋

| | 방법 | 무엇을 재나 | 한계 |
|---|---|---|---|
| A | 소스 대조 + 스크래치 기하 측정 | 네 경로의 코드를 요소별로 파일:줄로 대조. `court/grid/sideFlags` 기하와 `PrintCourt` DOM · `buildStaticSvg` 문자열을 jsdom 에서 직접 재서 겹침(밑판 x 21.25~40 ∩ 규칙존 x ≥ 37.5)을 수치로 확정 | 화면 픽셀은 못 잰다 |
| B | jsdom 인벤토리 diff | 7종 개체 + 공 링 + 소유 화살표 + 규칙 존 + 격자 + 잠금·무시를 담은 드릴을 full·half 로 네 경로에 렌더 → SVG 요소 시그니처(태그·class·stroke-width·fill·opacity·r·순서) 개수표와 문서 순서(층) 비교 | 편집 화면은 rAF 가 안 돌아 규칙 판정이 기본 상태. PNG 의 캔버스 글자는 SVG 인벤토리에 안 나온다 |
| C | 헤드리스 크롬 CDP 캡처 | 규칙 장면 드릴 3개(골에어리어 반칙 · 회전킥 · 골킥)를 dev 서버 + CDP 로 편집·시연·PNG(내보내기 blob)·인쇄(print 클론) 네 경로에서 찍어 몽타주로 눈 대조. 수정 전 `shot-c*`, 수정 후 `parity-after-*` | 스크린샷은 실기 대체가 아니다(AGENTS §6) |

## 2. 어긋남 표

| # | 요소 | 갈린 경로 | 처리 | 근거 · 지키는 자리 |
|---|---|---|---|---|
| 1 | 격자 칸·축 번호 | PNG 만 없음 | **고침** — `staticSceneLayout.ts buildTextPlacements` 가 `GridOverlay`·`gridInk.ts` 와 같은 출처로 캔버스 어댑터에 싣는다 | 기현 관찰 ①. `renderPaths.ts png.gridLabels` no→YES(옛 사유 보존). ★[A-9] `<text>` 0개 계약 유지. `staticSceneLayout.test.ts` 3케이스 |
| 2 | 골대(받침판+기둥)의 층 | 시연·PNG·인쇄가 코트 라인 직후(격자·존·깃발·규칙 표시 **아래**), 편집은 `ObjectLayer`(그 넷 **위**) | **고침** — `Full/HalfCourtLines` 에서 떼어 규칙 표시 뒤·개체 앞으로 | 기현 관찰 ② 의 첫째 원인(규칙 존 파선·붉은 면이 밑판 위 2.5 px 띠에 얹힘). `courtFurniture.order.test.tsx`, DESIGN.md 골대 각주 |
| 3 | 받침판의 주황 테두리 | 시연·PNG·인쇄(그룹 stroke 상속) | **고침** — `stroke="none"` 명시 | 관찰 ② 의 둘째 원인. `courtLines.contract.test.ts` |
| 4 | 규칙 존 2겹(α .22→.39) | 인쇄 | **고침** — `ruleMarkup` 이 존을 안 굽고 `<RuleZones>` 한 벌만 | order 테스트 '한 벌씩만' |
| 5 | 골라인 밖 공의 붉은 색 | PNG·인쇄(`BALL_FILL` 고정) | **고침** — `staticBallFill()` 한 곳 | `ballOutFill.paths.test.tsx`(화면 writer 결과를 기대값으로) |
| 6 | 무시(ignored) 휠체어 흐림 | 시연·PNG·인쇄 없음 | **고침** — `IGNORED_OPACITY` 를 `playback.ts` 프레임 opacity 에 곱해 세 경로가 분기 없이 따라온다 | `ignoredDim.paths.test.tsx`(편집 화면 값을 읽어 와 비교) |
| 7 | 골대 기둥 굵기 리터럴 1.6(어느 표에도 없는 짝) | 편집 | **고침** — `COURT_LINE_WEIGHTS.editor` 파생(1.5) | `GoalPost.tsx`. 돌연변이 커버 없음(0.1 px, 인라인 스타일 검사 금지) — 실기 ⑤ |
| 8 | 기둥의 흰 0.4 덧테 | 편집에만 | **고침** — 정적 셋에 더함(편집이 정본) | `GoalPostMarks.tsx` · `goalPostsMarkup` |
| 9 | 진영 깃발 자리(존 앞) | PNG·인쇄 | **고침** — 격자·존 뒤로 | order 테스트 |
| 10 | 빈 메모 플레이스홀더 | 시연 없음 | **고침**(시연) · **유지**(PNG) | PNG 는 *"앱의 안내문이 찍히면 그게 곧 오독"*(`staticSceneLayout.ts`) |
| 11 | 코트 배경 모서리 rx 14/16/16/10 | 시연·PNG·인쇄 | **고침** — `COURT_SURFACE_RX = 14` 하나 | `core/constants.ts` — 실기 ⑥ |
| 12 | `prefers-contrast` 규칙 존 선택자 | 인쇄 누락 | **고침** — `.spin-print-court` 추가 | `contrast.css` · `contrast.test.tsx` |
| 13 | 값 두 벌(규칙 표시 굵기·격자 잉크·콘 도형·차체 테두리·골대 두 색) | 여러 | **고침** — `ruleOverlay.ts` · `gridInk.ts` · `coneGeom.ts` · `teamMark.CHAIR_STROKE_W` · `colors.ts GOAL_POST_*` 로 이관 | AGENTS §3 |
| 14 | 계약표 자체 | — | **고침** — `ignoredDim`·`lockTint` 2종 추가, `thumbnail.goalPosts` YES→no(거짓이었다), 머리말에 「이 표가 말하지 않는 두 축」 | `renderPaths.ts` · `renderPaths.test.ts` |
| 15 | §6.6 굵기표(라인 3 vs 3.2, 기둥 r 4 vs 4.4 등) | 편집 vs 나머지 | **유지** | `CourtSurface.tsx` §6.6 이 세 변형을 명시한 설계. 기현 지시 인용은 없다 — 뒤집을지는 기현님 판단 자리(뒤집으면 `editor` 행 삭제 + 계약 테스트 동반) |
| 16 | 인쇄만 진한 격자 잉크(.55/.75/.55) | 인쇄 | **유지** | `GridOverlay` *"잉크 절약 설정에서 격자가 통째로 사라진다"* |
| 17 | 잠김(lock-tint) 덮개 | 편집에만 | **유지** | `renderPaths.ts LOCK_IS_EDITING` — 옮길 손이 없는 곳엔 뜻이 없다(선택 링·핸들과 같은 부류) |
| 18 | 선택·포커스 링·존 커서·`court-obj` | 화면 둘에만 | **유지** | 편집 도구이지 장면의 내용이 아니다(renderPaths 머리말) |
| 19 | PNG 격자 번호가 **개체 위**에 찍힘(편집은 개체 아래) | PNG | **남김** | 캔버스 글자는 `drawImage` 뒤에 찍힌다. 몽타주에서 메모 위에 `b2` 가 비친다(불투명도 .2). 고치려면 SVG 를 두 장(부속/개체)으로 갈라 굽는다 — img 로드 2회 · 골든 갱신. 실기 ① 에서 거슬리면 착수 |
| 20 | `ruleActors` 가 무시된 칩을 인원에 셈 | 정적 3경로 | **남김** | 표시가 아니라 판정의 축. 편집 화면은 물리 월드가 그 칩을 빼므로 같은 스텝에서 판은 깨끗한데 그림만 붉을 수 있다 |

## 3. 검수 관문 (2026-09-07)

- `npm run typecheck` 0 · `npm run lint` 경고 48 = HEAD 48(새 경고 0, `git stash` 없이 비교) ·
  `npx vitest run` 291 파일 3758 통과(검수에서 1회 — 이전 단계 3회까지 더해 4회 초록, 실패 집합 없음).
- 캡처 C 재실행: `parity-after-{1..4}-*.png`(골에어리어 반칙 스텝 2) · `parity-after-spin-*` ·
  `parity-after-gkick-*`(스텝 2, 인쇄는 뷰포트를 키워 쪽 경계 오려냄 제거) + 골대 부위 크롭 몽타주.
  네 경로에서 격자 번호 · 골대가 규칙 존 위 · 골 지역 강조 농도 · 깃발 · 칩/메모/화살표 스타일 ·
  골라인 밖 공의 붉은 색이 같았다. 남은 눈에 띄는 차이는 #19 하나.
- 돌연변이 8건(검수 몫, 이전 단계 11건과 별개): PNG 격자 라벨 블록 무력화 → `staticSceneLayout`
  3 빨강 · 인쇄 골대를 규칙 표시 앞으로 → order 1 빨강 · 시연 골대를 깃발 앞으로 → order 1 빨강 ·
  PNG 골대를 `ruleMarkup` 앞으로 → order 1 빨강 · `IGNORED_OPACITY`→0.5 → ignoredDim 3 빨강 ·
  인쇄 공 색 `BALL_FILL` 고정 → ballOutFill 2 빨강 · `RING_CASING_W`→7 → order 2 빨강.
  **초록 1건**: PNG 격자선 잉크 `GRID_INK.screen.line`→0.5 — 격자 잉크의 경로 간 일치는 어떤
  테스트도 안 잰다(상수 하나를 세 경로가 import 하므로 갈리려면 손으로 리터럴을 써야 한다;
  인라인 값 검사는 「테스트 작성 규칙」이 금지하는 감지기라 일부러 안 붙였다).

## 4. 남은 실기 (100.75.15.13:5173 — jsdom·헤드리스가 못 재는 것)

1. PNG 로 뽑은 그림에 `a1…e3`(플랫은 `a~t`/`1~17`)가 찍히는가. 그 글자가 메모·칩 위에 얹히는 것(#19)이 거슬리는가.
2. 골대 밑판 위로 코트 라인·규칙 존 파선이 더 이상 안 지나가는가 — 시연·PNG·인쇄 세 곳.
3. 인쇄 미리보기의 골 지역 강조 농도가 화면과 같은가(2겹 → 1겹).
4. 정적 세 경로 골대 기둥에 새로 생긴 흰 덧테가 밝은/어두운 코트에서 어떻게 보이는가.
5. 편집 화면 골대 테 1.6→1.5 가 눈에 띄는가.
6. 인쇄 코트 모서리 반경 10→14. 종이만 덜 둥글어야 할 이유가 있으면 사유와 함께 되돌린다.
7. §6.6 굵기표(#15)를 둘지 — 기현님 판단.
