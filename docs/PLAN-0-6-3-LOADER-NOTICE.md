# PLAN — 화면 로더 · 작은 화면 안내 (2026-09-04, v0.6.3)

> 이 문서가 **이 기능의 정본**이다. 상위 정본은 `AGENTS.md`(관행) · `DESIGN.md`(계약) ·
> `docs/FALSIFICATION-BASELINE.md`(반증선). 여기 적힌 결정과 코드가 어긋나면 **코드가 틀린 것**이고,
> 결정을 뒤집을 때는 §1 표의 근거를 지우지 말고 뒤집힘 표시를 달아 남긴다(AGENTS §2).

기현님 지시(2026-09-04, 원문):

> 1. **핸드폰·7인치 미만 태블릿은 사용을 권장하지 않는다는 안내 모달.** 결정: 열 때마다 뜨되
>    [다시 보지 않기] 체크를 제공한다(체크하면 그 기기에서는 다시 안 뜬다). 사용을 막지는 않는다.
> 2. **로딩 화면**: 첫 방문 때, 그리고 큰 메뉴(왼쪽 레일 5개: 보드·드릴·세션·규칙·설정) 간 전환 때마다
>    약 1~2초 보여준다. 애니메이션은 **휠체어가 270° 이상 돌며 회전킥을 차는** 동작이고, 모티브는 앱
>    아이콘(public/logo.svg — 코트 원 두 겹, 45° 눕힌 둥근 사각 휠체어, 차체 뒤끝 흰 파선, 머리 흰 원,
>    노란 공). 결정: 첫 방문 1.5초, 레일 전환 1.0초를 **최소 표시 시간**으로 둔다. 화면 코드를 실제로
>    분할 로딩(React.lazy)해 로더가 진짜 일을 덮게 하는 것을 기본으로 검토하되, 그 위험을 따져라.

---

## 0. 한 줄 원칙

**로더는 덮개일 뿐 문이 아니다.** 화면은 지금처럼 동기로 마운트되고(React.lazy 없음), 로더는 그
위에 얹히는 오버레이 하나다. 그래서 로더가 뜨든 안 뜨든 **앱의 동작·발표·포커스 계약이 같아야
한다** — 감축 모션·테스트에서 최소 표시 시간이 0 이면 로더는 한 프레임도 존재하지 않고, 그때 앱은
2026-09-04 이전과 **글자 하나 다르지 않게** 움직인다. 안내 모달도 같은 규율이다: 막지 않고,
알리고, 끌 수 있다.

---

## 1. 결정 (뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | **React.lazy 를 이번 릴리스에 넣지 않는다.** 대신 `useAppLoader({ pending })` 시그니처만 열어 두고 아무도 안 넘긴다 | 넣는 쪽 근거(기록): 단일 번들 1.37MB 를 쪼갠다. 안 넣는 쪽 근거(채택): ① 저장소에 ErrorBoundary 가 **0개**(`rg` 확인) — 청크 로드 실패(오프라인·배포 중 해시 교체)가 곧 앱 전체 흰 화면 ② `App.tsx:127` 이 `file:` 에서 `createHashRouter` 로 분기하는데 vite `base` 가 `/` 라 동적 import 가 절대 경로를 물어 Tauri·로컬 열기에서 깨진다 ③ 규칙 화면은 프리렌더 33장의 착지점이라 갈라선 안 되고, 정작 큰 덩어리(board = editor + matter-js)는 기본 착지 화면이라 대문 첫 로드가 거의 안 준다 ④ 최소 표시 시간 1000~1500ms 가 어차피 지배적이라 lazy 는 그 그늘에 가린다 |
| 2 | 로더가 덮는 범위는 **헤더 + 본문 열 전체**. 레일은 안 덮는다 | 본문만 덮으면 board/present 전환 동안 헤더가 빈 줄로 보인다 — `AppShell.tsx:146` 이 기록한 "헤더가 통째로 사라진" 사고와 같은 그림이다. 레일은 전환 중에도 마음을 바꿀 수 있어야 한다 |
| 3 | 오버레이는 **기존 열 노드**(`AppShell.tsx:347` 의 `<div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>`)에 `position:'relative'` 만 더하고 그 안의 마지막 자식으로 `position:absolute; inset:0` | 새 래퍼 `<div>` 를 끼우면 화면 root `<main style={{flex:1, overflowY:'auto'}}>` 가 flex 자식 자리를 잃는다. 이 파일은 코트 축척 여유가 **1px** 이라고 스스로 경고한다(`AppShell.tsx:294`). 절대 위치는 흐름 밖이라 기둥을 안 건드린다. body 포털도 검토했으나(전체 뷰포트, DOM 무접촉) 레일까지 덮게 되어 #2 와 어긋난다 |
| 4 | 최소 표시 시간 **첫 방문 1500ms / 레일 전환 1000ms**, 상수는 `appLoaderTiming.ts` 한 곳 — ⚠️ **레일 값은 미정으로 둔다**(실기에서 1000/600/0 비교 후 확정) | lazy 가 없으므로 전환 로더가 덮는 실제 작업은 **0** 이다 = 순수 인위적 지연이고, 레일 왕복은 세션당 수십 번이다. 지시대로 1000 으로 배송하되 "확정값" 으로 오해되지 않게 미정임을 여기 박는다 |
| 5 | **아무 입력(pointerdown/keydown/wheel, capture, preventDefault 없음)에나 로더가 즉시 걷힌다** | 인위적 지연의 유일한 실질 결함(급한 사람이 갇힌다)을 없앤다. 좁은 창에서 헤더 3칸 세그먼트가 유일한 이동 수단인 상황의 완화책이기도 하다 |
| 6 | 로더 루트는 `aria-hidden="true"`, 덮인 열에는 `aria-busy="true"` + `inert` | 1초짜리 인위적 지연에 "불러오는 중" 을 방송하면 전환마다 발표가 두 번이 되어 소음이고, `role="status"` 로 초점을 끌면 "로더는 초점을 훔치지 않는다" 를 어긴다. `inert` 는 보이지 않는 컨트롤이 Tab 에 잡히는 문제(WCAG 2.4.7/2.4.11)를 원천 차단한다. #5 만으로는 **사용자가 입력하기 전** 창을 못 막는다 |
| 7 | §7.6 effect(`#main` 포커스 + `announceFor` 발표)는 **로더가 걷히는 시점**으로 옮긴다. ⚠️ 단 `minMs === 0` 이면 **지금과 똑같이 같은 effect 안에서 동기로** 발화한다 | `inert` 로 덮인 동안 `focus()` 는 무효라 초점이 body 로 떨어진다. 0ms 경로를 명시하지 않으면 감축 모션 사용자와 `AppShell.wiring.test.tsx` 의 발표 단언이 **영영 발화하지 않는다**(심사에서 잡힌 자기모순) |
| 8 | 감축 모션(`prefs.a11y.reduceMotion==='always'` 또는 OS)이면 `loaderMinMs` 가 **0** → 로더가 한 프레임도 안 뜬다. 판정은 `effectiveReduceMotion`(`store/editor/tween.ts`) 재사용 | 지시 그대로("회전을 돌리지 말고 인위적 최소 시간도 두지 말아야"). 덮을 실제 로딩이 0 이므로 결과적으로 로더 부재가 옳다. 판정을 새로 조립하면 PresentRunner 가 지역 복제했다가 2026-08-31 에 걷어낸 그 왕복을 반복한다 |
| 9 | 그래도 CSS 로 `animation: none` 을 **명시**한다(두 셀렉터: `@media (prefers-reduced-motion: reduce)` + `:root[data-reduce-motion="true"]`) | `tokens.css:55-70` 의 전역 억제는 `animation-iteration-count: 1` 을 함께 걸어 애니메이션을 **마지막 프레임에 고정**한다. 우리 사이클의 100% 는 우연히 정지 자세와 같지만 **그 안전이 우연**이다 — 나중에 끝 프레임을 만지는 사람이 감축 모션에서 공 없는 반쪽 마크를 만든다 |
| 10 | 전환 열쇠는 이미 계산돼 있는 **`activeRail`**(`AppShell.tsx:274`) 하나. 열쇠 계산은 `loaderKeyFor()` 한 함수로 뺀다 | 지시가 "레일 5개 간 전환" 이다. 같은 값에서 뽑아야 표시(레일 활성)와 동작(로더)이 어긋날 수 없다(`screens.ts railFor` 의 규율). 부수 효과: 드릴 열기·시연 진입·규칙 주제 상세에는 **안 뜬다** — 가장 무거운 마운트(EditorWorkspace + matter-js)가 맨몸으로 일어난다는 뜻이므로, 넓히려면 `loaderKeyFor` 한 곳만 고친다 |
| 11 | **뒤로/앞으로가기(popstate)에는 로더를 띄우지 않는다** | 되돌아가기가 갈 때보다 느려지면 안 된다. `useAppHistory` 의 `back()`·popstate 경로에서 온 전환은 열쇠가 바뀌어도 한 회 면제한다(플래그 하나). 레일 연타는 앞 타이머를 `clearTimeout` 하고 **새로 시작**한다(이어붙이지 않는다 — 앞 화면의 남은 시간이 뒤 화면을 조기 종료시키면 안 된다) |
| 12 | 첫 방문 = **이번 페이지 로드에서 처음**(prefs 도장을 안 쓴다) | 로더의 목적이 부팅을 덮는 것이고, 도장을 쓰면 둘째 실행부터 아무 일도 안 하는 화면에 1.5초 정지만 남는다. 뒤집으려면 `prefs.bootLoaderSeen` 을 얹으면 되고 그때 이 칸에 뒤집힘 표시를 단다 |
| 13 | **프리렌더 착지 면제** — 이번 로드가 프리렌더 페이지에서 시작했으면 첫 방문 로더를 건너뛴다. 판정은 `document.querySelector('.seo-prerender') !== null` 을 **`createRoot` 전에** 모듈 최상위에서 1회 읽어 상수로 굳힌다 | 검색으로 `/ja/rules/two-on-one` 에 들어온 사람은 **이미 읽을 것을 보고 있다.** 그 글을 1.5초 스플래시로 덮는 것은 후퇴이고 LCP 도 로더 마크로 바뀐다. 라우트 이름(`nav.screen==='rules'`)이 아니라 "지금 화면에 이미 읽을 것이 그려져 있는가" 를 보는 쪽이 정확하다. ⚠️ `createRoot().render()` 가 `#root` 자식을 지우므로 **읽는 시점이 계약**이다 |
| 14 | 부팅 로더를 **`index.html` 정적 마크업으로 내리지 않는다** | 얻는 것(번들 파싱 전부터 보임)보다 대가가 크다: `prerender.mjs:70` 이 의존하는 `<div id="root"></div>` 리터럴 옆에 이웃을 붙이는 결합(깨지면 33장이 **에러 없이** 본문 없이 구워진다), FOUC 부트 스크립트가 `theme` 하나만 읽어 앱 설정 감축 모션을 못 봄, 대문 LCP 가 로더 마크가 됨. ⚠️ 그 검토가 남긴 사실 하나는 남긴다: **React 안의 로더는 번들이 이미 파싱된 뒤 뜨므로 부팅 1.5초는 전부 인위적 시간이다.** 나중에 값을 낮출 근거다 |
| 15 | 키프레임은 새 CSS 파일이 아니라 **`src/styles/a11y.css`** 에 둔다 | 이 저장소의 모든 `@keyframes`(court-fade-in, tray-drop-in, rules-card-in …)가 거기 산다. 새 파일은 `main.tsx` import 순서라는 계약을 하나 더 만든다 |
| 16 | **등장·퇴장은 transition, 회전 사이클만 keyframes** — ⚠️ **2026-09-04 정정: 등장은 은퇴했고 transition 은 퇴장에만 남는다** | 퇴장 중에 다음 전환이 들어오면 오버레이를 재사용하고 현재 opacity 값에서 되조준해야 한다 — keyframes 는 그 중단을 못 한다. 옛 근거는 지우지 않는다(AGENTS §2): 되조준이라는 취지는 그대로이고 **등장에서만** 전제가 죽었다 — 이 판은 물러난 화면이 아니라 새 화면 위에 얹히는 덮개라, 등장 페이드 구간이 곧 덮으려던 내용이 비치는 구간이었다(헤드리스 실측). 등장은 이제 길이 0 이고 `ENTER_MS` 상수도 없다(`appLoaderTiming.ts` 의 은퇴 블록). 대가로 딸려 온 계약 하나: 퇴장이 **160~200ms 더 덮는다**는 사실을 밖에서도 알아야 해서 오버레이가 `onExited` 를 발행하고 결정 30 의 "걷힘" 이 그 시점을 뜻하게 됐다 |
| 17 | 회전축은 **(180.48, 281.52)** — 차체 도형 중심(228,234)이 아니다 | `logo.svg` 주석이 못박은 실제 피벗은 뒤에서 길이의 20%(`core/constants.ts` CHAIR, sPivot 0.2)다. 로컬 x = −112 + 0.2×224 = −67.2 → 루트 (228−47.52, 234+47.52). 중심으로 돌리면 앱이 코트에 그리는 휠체어와 **다른 축**이고, 더 결정적으로 중심 기준 모서리 최대반경 hypot(112,65)=129.5 < 공까지 135 라 **차체가 공에 닿지 못한다** |
| 18 | 회전 방향은 **반시계**, 접촉까지 연속 308° | 그 피벗에서 공은 +27.0°(r 139.8), 차체 앞면은 −45°(r 179.2). 시계로 돌면 **72° 만에 차 버려** "돈다" 가 안 읽힌다. 반시계 288.3° 여야 접촉이 회전의 **끝**에 오고 지시의 270° 이상이 성립한다. 예비동작 +20° 를 더해 접촉까지 308.3° 가 쓸린다 |
| 19 | 한 사이클 순환량은 정확히 **−360°**, `animation-iteration-count: infinite` | 시작 자세와 끝 자세가 같아 이음매가 안 보이고, 로딩이 최소시간보다 길어도(나중에 pending 이 붙으면) 그냥 한 바퀴 더 돈다 |
| 20 | 이징은 앱 표준 `easeStandard(.4,0,.2,1)` 의 **반쪽 짝만** — 가속 `(.4,0,1,1)`, 감속 `(0,0,.2,1)` | `a11y.css` 주석이 "다른 곡선을 쓰면 앱 안에 모션 언어가 두 갈래로 갈린다" 고 경고한 자리다. UI 에 `ease-in` 을 쓰는 예외 사유(여기서 가속하는 것은 UI 가 아니라 **물리 묘사**이고, 최고속을 사용자가 보는 순간=접촉에 놓는다)를 파일 머리말에 적는다 |
| 21 | 백분율이 정본, 두 변주(부팅/전환)는 `animation-duration` **하나만** 바꾼다 | 두 변주가 같은 동작으로 읽히고, 길이 조정 시 손댈 곳이 한 곳이다 |
| 22 | 작은 기기 판정: `Math.min(screen.width, screen.height) < 600` **AND** `matchMedia('(pointer: coarse)').matches` | ① 창이 아니라 **기기 화면**이다 — `useIsNarrow`(창 폭 1100)는 데스크톱 창을 좁힌 것과 폰을 못 가른다 ② 회전에 판정이 뒤집히면 안 되므로 짧은 변만 본다 ③ 문턱 600 = 안드로이드 sw600dp, 7인치는 600×960 이라 "7인치 미만" 이 정확히 <600 이다 ④ **coarse AND 의 진짜 이유는 확대 차단** — 브라우저 200~300% 확대에서 `screen.width` 는 CSS px 로 줄어 1280 데스크톱이 427 로 보고된다. 그 저시력 사용자에게 "작은 기기입니다" 를 띄우는 것은 접근성 기능이 접근성 사용자를 때리는 꼴이다. `navigator.maxTouchPoints > 0` 은 터치 노트북을 못 거르므로 쓰지 않는다 |
| 23 | 판정은 **마운트 1회**(`useState` 초기화 함수). resize·matchMedia 구독 없음 | 기기 등급은 세션 중에 안 바뀐다. 판정을 하나 더 늘리면 "이 기기에서 왜 이렇게 보이나" 를 아무도 재현 못 한다(`useIsNarrow.ts` 머리말의 그 경고) |
| 24 | 저장은 `prefs.smallScreenNoticeDismissed?: boolean`(최상위 옵셔널, 기본 false). **`CURRENT_PREFS_SCHEMA` 는 3 그대로** | 옵셔널 키 추가는 스키마를 안 올린다는 `tutorialsSeen`(prefs.ts:112)·`a11y.sound` 선례. ⚠️ 손볼 곳 **셋**(인터페이스 · `makeDefaultPrefs` · `validatePrefs` 화이트리스트)을 같은 커밋에서 — 셋째를 빠뜨리면 저장 왕복에서 **소리 없이 증발**한다 |
| 25 | 저장 시점은 **`onClose` 한 곳**(✕·Esc·백드롭·[계속하기] 전부) | 경로마다 저장을 흩으면 Esc 로 닫은 사람만 체크가 무시되는 반쪽 상태가 생긴다. 닫기 = 확인이다 |
| 26 | 되돌리는 손잡이를 **설정 화면에 둔다** — [도움말] 절의 [튜토리얼 다시 보기](`SettingsScreen.tsx:454`) 옆에 [작은 화면 안내 다시 보기] | 2026-08-21 감사에서 "코드에만 있고 화면에서 닿을 수 없는 값" 3종을 유령 설정으로 폐기한 그 규율에 정면으로 걸린다. 한 번 체크하면 영영 못 보는 값을 남기지 않는다 |
| 27 | 안내 모달의 초기 초점은 **주지 않는다**(Modal 기본 = 닫기 ✕) | [계속하기]에 초점을 두면 스크린리더 사용자가 본문과 체크박스를 지나쳐 확인 버튼에 서고, **체크박스의 존재를 모른 채** 닫는다. (반대 근거 기록: 가장 흔한 동작에 Tab 없이 닿는다 — 채택 안 함) |
| 28 | `Modal.tsx` 에 옵셔널 `descriptionId` 를 더해 패널에 `aria-describedby` 를 건다 | 지금 Modal 은 `aria-labelledby` 뿐이라(`Modal.tsx:146`) 초점이 버튼에 서면 제목과 버튼 이름만 읽힌다. **본문이 전부인 모달**이라 손실이 크다. 기존 6개 사용처에 무영향인 가산적 확장이다 |
| 29 | 닫은 뒤 초점은 `returnFocusRef={#main}` 으로 돌린다(`onClose` 안 `focus()` 호출이 아니라) | 여는 트리거가 없어 Modal 의 기본 복귀 대상이 `<body>` 인데 body 는 포커스를 못 받아 Tab 이 문서 처음부터 다시 시작한다. Modal 이 이미 지는 복귀 계약 **안에** 남는 쪽이 낫다. ref 는 `open` 이 선 뒤 effect 에서 `getElementById('main')` 으로 채운다(첫 렌더에는 `#main` 이 없다) |
| 30 | **첫 실행 3중 순서를 못박는다: 로더 걷힘 → 안내 모달 닫힘 → 튜토리얼 시작.** 게이트는 `src/ui/tutorial/tutorialGate.tsx`(Provider + `useTutorialGate`), `useTutorial` 이 그것을 읽어 `if (!autoStart || !gateReady) return`. AppShell 이 `ready = !loader.visible && !noticeOpen` 를 발행한다 — ⚠️ **2026-09-04 정정: 발행식은 `coverSettled && noticeDecided && !noticeOpen` 이다**(§10.6) | 새 폰 첫 실행에서 셋이 같은 1~2초를 놓고 겹친다. 튜토리얼은 `TutorialOverlay` z-index **300/301** 로 로더(z 220)를 뚫고 나오고 `aria-modal="true"` 를 두 개 세운다. 게이트를 화면 7곳이 아니라 훅 안에 두는 이유: `useTutorial(screen, steps, autoStart)` 호출부 7곳(LibraryScreen·SessionsScreen·SessionEditorScreen·EditorWorkspace·PresentRunner·RulesScreen)을 안 건드린다. 기본값 `ready: true` 라 Provider 밖(테스트·단독 렌더)에서는 지금과 같다 |
| 31 | z-index: 로더 **220** (Modal 200 위, TutorialOverlay 300 아래) | 위여야 하는 이유는 전환 중에 아무것도 안 보여야 하기 때문이고, 아래여야 하는 이유는 튜토리얼 스포트라이트가 로더에 가리면 안 되기 때문이다. #30 의 순서 규칙이 실제로 둘이 겹치는 일을 없앤다 |
| 32 | 마크 색 3종(#2f5d2b·#a4e70c·#2e6db6)은 `tokens.css` 에 넣지 않는다. 공은 `core/colors.ts` 의 `BALL_FILL` 을 import | 토큰은 **테마마다 갈리는 값**의 자리다. 이 셋은 브랜드 색이라 양 테마에서 같다(레일 로고가 이미 그렇다). 정본은 `public/logo.svg` 이고, 두 파일 머리말에 상호 참조를 단다(AGENTS §3) |
| 33 | 강제색(`forced-colors: active`)에서 텍스트는 `CanvasText`, 배경은 `Canvas`. **이 블록에 hex 를 쓰지 않는다** | `contrast.test.tsx` 가 못박은 규율. 마크 본체의 초록·파랑·노랑은 SVG presentation attribute 라 강제색이 안 건드린다 — 강제색에서도 "초록 코트 위 파란 휠체어와 노란 공" 이 그대로 보인다 |
| 34 | 이번에 생기는 관행 둘을 **적용 커밋과 같이 `AGENTS.md` 에** 올린다: (a) UI 크롬 애니메이션은 편집기가 아니라 코드로 만든다(§5 "시연은 편집기로" 의 명시적 예외) (b) 인위적 최소 표시 시간은 테스트 환경에서 0 이다 | `AGENTS.md` 가 관행의 정본이다. 계획서에만 적으면 다음 사람이 §5 를 어긴 코드로 읽는다 |

---

## 2. 손대는 곳 (파일별 무엇을)

**신규 — 로더**
- `src/app/loader/appLoaderTiming.ts` — `APP_LOADER_MS = { boot: 1500, rail: 1000 }`, `CYCLE_MS = { boot: 1200, rail: 820 }`, `EXIT_MS`, ~~`ENTER_MS`~~(⚠️ 2026-09-04 은퇴 — 등장은 길이 0 이라 상수가 없다, 결정 16 정정), `loaderMinMs(kind, reduced)`(감축 모션·`import.meta.env.MODE==='test'` 이면 0). 머리말에 결정 4(값 미정)와 결정 14(부팅 1.5초는 전부 인위적 시간)를 적는다. 구현에는 `MARK_SIZE`·`markSizePx()` 도 함께 산다(§10.1).
- `src/app/loader/prerenderLanding.ts` — 모듈 최상위 `export const LANDED_ON_PRERENDER = typeof document !== 'undefined' && document.querySelector('.seo-prerender') !== null;` ⚠️ `main.tsx` 가 `createRoot` **전에** 이 모듈을 물어야 한다는 계약을 머리말에 적는다.
- `src/app/loader/loaderKeyFor.ts` — 전환 열쇠 계산 한 곳(지금은 `activeRail` 그대로 반환). 넓힐 때 여기만 고친다.
- `src/app/loader/useAppLoader.ts` — 상태기계. `useAppLoader({ key, reduceMotion, skipBoot, fromHistory, pending? }): { visible, kind }`. `minMs === 0` 이면 **`visible` 을 true 로 만들지 않는다**(초기값부터 false). 타이머 clear, 입력 리스너(capture) 부착·해제, 언마운트 정리.
- `src/app/loader/SpinLoaderMark.tsx` — `logo.svg` 도형 6개 + 회전 그룹 분리. props `{ animated: boolean, sizePx: number, cycleMs: number }`.
- `src/app/loader/AppLoaderOverlay.tsx` — `position:absolute; inset:0`, 불투명 `var(--bg)`, 중앙 마크, `aria-hidden="true"`, 포커스 가능 요소 0개, 텍스트 0개. 퇴장 transition 을 스스로 지므로 **퇴장이 끝난 시점을 밖에 알린다**: 옵셔널 `onExited?: () => void`(2026-09-04, §10.6). 한 번도 `visible` 이 아니었으면 안 부른다.
- `src/app/loader/spinMarkColors.ts` — 브랜드 색 3종 + `BALL_FILL` 재수출. 머리말에 정본이 `public/logo.svg` 임을 적는다.

**신규 — 안내**
- `src/app/smallScreen.ts` — `SMALL_SCREEN_MIN_PX = 600`, `isSmallDevice(m: { width; height; coarse })` 순수 함수 + 호출부용 `readDeviceMetrics()`. 순수 함수라 window 스텁 없이 표본으로 검증된다.
- `src/app/SmallScreenNotice.tsx` — `{ open, onClose(dismissed) }` 만 받는다(prefs 직접 접근 없음 → 단독 마운트 가능). `ChangelogModal`·`LanguageModal` 과 같은 자리.

**신규 — 튜토리얼 게이트**
- `src/ui/tutorial/tutorialGate.tsx` — `TutorialGateProvider` + `useTutorialGate()`(기본 `true`).

**수정**
- `src/app/AppShell.tsx` — ① 열 노드에 `position:'relative'` + `aria-busy` + `inert` ② 오버레이 마운트 ③ `useAppLoader` 배선(열쇠 = `activeRail`) ④ §7.6 effect 시점 분기(결정 7) ⑤ `SmallScreenNotice` 마운트(로더가 걷힌 뒤) ⑥ `TutorialGateProvider` 로 감싸기. **결정 2·3 을 주석으로 못박는다**(나중에 "헤더는 남기는 게 예쁘다" 며 좁히지 않도록).
- `src/ui/tutorial/useTutorial.ts` — `gateReady` 를 자동 시작 조건에 AND. 수동 시작([이 화면 투어 다시 보기])은 게이트 무관.
- `src/ui/Modal.tsx` — 옵셔널 `descriptionId` → 패널 `aria-describedby`.
- `src/storage/prefs.ts` — `smallScreenNoticeDismissed` 세 곳(인터페이스·기본값·화이트리스트). 스키마 도장 불변.
- `src/features/settings/SettingsScreen.tsx` — [도움말] 절에 되돌리기 Row 하나.
- `src/styles/a11y.css` — `@keyframes` 3개(chair·ball·mark pulse) + dash 행진 + 감축 모션 2셀렉터 + `forced-colors` 블록.
- `src/i18n/{ko,en,ja}.ts` — 새 키 6개(§6).
- `src/app/useAppHistory.ts` — 이번 전환이 popstate/back 에서 왔는지 한 회 신호(결정 11). 기존 API 를 깨지 않는 부가 필드 하나.

**문서·버전**
- `package.json` 0.6.2 → 0.6.3, `CHANGELOG.md` / `.en.md` / `.ja.md`(세 언어 같은 커밋), `ROADMAP.md`, `AGENTS.md`(결정 34), `DESIGN.md`(로더·안내의 계약 한 절), 이 계획서.

---

## 3. 착수 순서 (파일 충돌 없는 병렬 단위)

| # | 단위 | 만지는 파일 | 선행 |
|---|---|---|---|
| U1 | 타이밍·상태기계·오버레이·마크 | `src/app/loader/*`(신규 7) | — |
| U2 | 키프레임·감축모션·강제색 CSS | `src/styles/a11y.css` | — |
| U3 | prefs 필드 3곳 + 왕복 단언 한 줄 | `src/storage/prefs.ts`, `src/storage/prefs.test.ts` | — |
| U4 | Modal `descriptionId` | `src/ui/Modal.tsx` | — |
| U5 | i18n 세 언어 6키 | `src/i18n/{ko,en,ja}.ts` | — |
| U6 | 튜토리얼 게이트 | `src/ui/tutorial/tutorialGate.tsx`(신규), `src/ui/tutorial/useTutorial.ts` | — |
| U7 | 기기 판정 + 안내 모달 + 테스트 | `src/app/smallScreen.ts`, `src/app/SmallScreenNotice.tsx`, `src/app/smallScreen.test.ts` | U3·U4·U5 |
| U8 | 히스토리 신호 | `src/app/useAppHistory.ts` | — |
| U9 | AppShell 배선(로더·안내·게이트·§7.6·inert) | `src/app/AppShell.tsx` | U1·U6·U7·U8 |
| U10 | 설정 되돌리기 손잡이 | `src/features/settings/SettingsScreen.tsx` | U3·U5 |
| U11 | 로더 계약 테스트 | `src/app/loader/appLoader.test.tsx`(신규) | U9 |
| U12 | 버전·문서 | `package.json`, `CHANGELOG*.md`, `ROADMAP.md`, `AGENTS.md`, `DESIGN.md`, 이 계획서 | 전부 |

U1~U6·U8 은 서로 독립이라 동시에 맡길 수 있다. U9 가 유일한 합류점이고, 그 파일은 한 명만 만진다.

---

## 4. 실기 확인 (jsdom 이 못 재는 것)

연출
1. **차가 공을 통과하지 않는가.** DevTools 애니메이션 검사기 0.25배속으로 프레임을 넘겨, 겹침 창(§5) 동안 공이 이미 떠나고 있는지 본다. "옆 범퍼가 스친다" 로 보이는가, "통과했는데 공이 튄다" 로 보이는가.
2. 회전이 **네 박자**(예비 → 가속 → 접촉 → 브레이크)로 읽히는가. 안 읽히면 순서대로: ① 예비 정지 구간을 늘린다 ② 접촉 직전 최고속 구간을 늘린다 ③ 임팩트 펄스를 1.03 → 1.05. **회전량(288.3°)은 마지막에 만진다 — 기하가 정한 값이다.**
3. 루프 이음매(사이클 100%)에서 휠체어가 튀지 않는가, 공이 뿅 하고 나타나지 않는가.
4. 라이트/다크 양쪽에서 마크가 배경과 구분되는가. Windows 고대비(강제색)에서 텍스트·배경이 살아 있는가.
5. 저사양 태블릿 60fps. 떨어지면 `stroke-dashoffset` 행진 한 줄만 뺀다(다른 것에 의존이 없다).
6. 1024×600 급 작은 창에서 마크가 잘리지 않는가.

시간·배선
7. **레일 전환 1.0초가 답답한가.** 보드→드릴→세션→규칙→설정을 연속으로 눌러 보고 `APP_LOADER_MS.rail` 을 1000/600/0 으로 바꿔 비교한다. 이 판정이 결정 4 를 확정한다.
8. 로더가 걷히는 순간 화면이 번쩍이지 않는가. board → present → rules 처럼 **헤더 소유자가 바뀌는** 전환에서 헤더가 한 프레임 비었다 차는가(비면 로더 종료와 `useAppHeader` 발행 사이에 rAF 한 틱이 필요하다).
9. 뒤로가기가 갈 때보다 느려지지 않는가(결정 11 이 실제로 먹는가).
10. 로더 1초 동안 Tab 연타 → 가려진 헤더 버튼에 초점이 안 들어가는가(`inert`). 걷힌 뒤 Tab 이 `#main` 부터 시작하는가. 아무 키나 눌렀을 때 즉시 걷히는가(그리고 그 키가 삼켜지지 않는가).
11. 스크린리더(NVDA/VoiceOver/TalkBack)로 레일 전환 시 발표가 **화면 이름 한 번뿐**인가.
12. 감축 모션 OS 채널·앱 설정('항상 켬') 각각에서 로더가 **한 프레임도 안 뜨고** 전환이 지금처럼 즉시인가.
13. 검색으로 `/ja/rules/...` 직접 진입 시 프리렌더 본문이 안 덮이는가. 대문 `/` 에서는 뜨는가.
14. 좁은 창(태블릿 세로)에서 헤더 3칸 세그먼트가 1초 덮이는 것이 견딜 만한가 — 한 번 탭(로더 걷힘) → 두 번째 탭(이동)이 자연스러운가.

안내 모달
15. 실기 3종 실측: 폰 = 뜸, 7인치(600×960) = 안 뜸(경계), 10인치 = 안 뜸. `window.screen.width/height` 와 `matchMedia('(pointer: coarse)').matches` 값을 직접 찍어 본다.
16. **데스크톱을 175~300% 확대해도 안 뜨는가**(coarse 차단이 먹는가). 창을 좁히는 것으로는 안 떠야 한다.
17. [다시 보지 않기] 체크 후 **Esc 로** 닫고 앱을 완전히 새로고침 → 안 뜬다. 체크 없이 닫으면 다음 실행에 다시 뜬다.
18. 설정 → [작은 화면 안내 다시 보기] 를 누른 뒤 새로고침 → 다시 뜬다.
19. 모달이 **로더가 걷힌 뒤** 뜨는가. 닫으면 초점이 `#main` 으로 가는가(스크린리더로). 제목 다음에 본문이 읽히는가(`aria-describedby`).
20. 새 폰 첫 실행에서 **로더 → 안내 → 튜토리얼** 순서가 실제로 지켜지는가(둘이 겹치면 게이트 배선이 틀린 것이다).
21. 세 언어 문안이 실제 폭에서 안 넘치는가(영어·일본어가 한국어보다 길다).

---

## 5. 애니메이션 타임라인

**좌표계** `viewBox="0 0 512 512"`(logo.svg 와 동일). 도형은 원본 값 그대로 옮기고, 바뀌는 것은 노드가 3그룹으로 묶이는 것뿐이다. `.spin-chair` 는 원본 `translate(228 234) rotate(-45)` 그룹을 **감싸는** 새 그룹이다 — 그 안쪽을 만지면 마크가 아닌 것이 된다.

```
.spin-chair { transform-box: view-box; transform-origin: 180.48px 281.52px; }
.spin-ball  { transform-box: view-box; transform-origin: 305px 345px; }
```

**기하 상수** (피벗 기준)

| 항목 | 값 |
|---|---|
| 피벗 | (180.48, 281.52) = (228,234) + R(−45°)·(−67.2, 0) |
| 공 | 방향 **+27.0°**, 반경 139.8, r 34(+테두리 8) |
| 차체 앞면 중앙 | 방향 **−45.0°**, 반경 179.2 |
| 차체가 쓸고 가는 반경 | 0 ~ 190.6 (먼 모서리 hypot(179.2, 65)) |
| **겹침 창** | 앞축이 공 방향 **±43.4°** 안에 있는 동안 = 사이클당 **정확히 한 번**. (반경 140 에서 차체 폭이 덮는 각 ±27.7° + 공 반경분 ±15.7°) |
| z 순서 | 공이 차체보다 **위**(logo.svg 의 그리기 순서 그대로) — 겹침 구간에도 공이 안 사라진다 |

접촉은 **겹침 창의 시작**이다: 앞축이 공 방향 43° 앞에 왔을 때 선행 모서리가 공에 닿고, 그 순간 공이 떠난다. 앞축이 공 방향을 정확히 지나는 각(−288.3°)에는 공이 이미 반경 190 밖으로 나가 있다(비행 속도 320/270ms 에서 약 42ms).

**기준 사이클 1200ms(부팅) — 백분율이 정본, 전환은 820ms 로 duration 만 바꾼다**

`.spin-chair` 회전 A(deg, 0 = 정지 자세)

| ms | % | A | 다음 구간 이징 | 뜻 |
|---|---|---|---|---|
| 0 | 0 | 0 | `(0,0,.2,1)` | 정지 자세(= logo.svg) |
| 160 | 13.33 | **+20** | `linear` | 예비동작(반대로 감기) |
| 200 | 16.67 | +20 | `(.4,0,1,1)` **가속** | 한 박 멈춤 |
| 700 | 58.33 | −140 | `linear` | 160° 쓸림 |
| **790** | **65.83** | **−245** | `(0,0,.2,1)` **감속** | **겹침 창 시작 = 접촉 = 공 이탈** |
| 815 | 67.92 | −288 | — | 앞축이 공 방향 통과(공은 이미 없다) |
| 958 | 79.83 | −331 | — | 겹침 창 끝 |
| 1060 | 88.33 | −350 | — | 팔로스루 |
| 1200 | 100 | **−360** | — | 정지 자세 복귀 = 무이음 반복 |

연속 회전량 +20 → −360 = **380°**, 접촉까지 **308.3°**(요구 270° 이상 충족).

`.spin-ball`

| ms | % | 변환 | 이징 |
|---|---|---|---|
| 0 → 790 | 0 → 65.83 | translate(0,0) scale(1) opacity 1 | `linear` |
| 812 | 67.67 | translate(12,−24) **scale(1.14, .88)** 눌림 | `(0,0,.2,1)` |
| 850 | 70.83 | translate(34,−67) scale(1) 펴짐 | `(0,0,.2,1)` |
| 1000 | 83.33 | translate(110,−218) scale(.92) opacity 1 | `linear` |
| 1060 | 88.33 | **translate(144,−286)** scale(.85) opacity **0** | — |
| 1140 | 95 | translate(0,0) scale(.9) opacity 0 | — (안 보이는 동안 제자리로) |
| 1200 | 100 | translate(0,0) scale(1) opacity 1 | — |

비행 방향 근거: 접촉 순간 속도는 반지름에 수직이고 반시계이므로 `(sin 27°, −cos 27°) = (0.454, −0.891)` — 오른쪽 위. 320 단위 = `translate(144px, −286px)` 이면 코트 원(중심 256, r 234) **밖**으로 나간다. 위에서 본 그림이므로 **직선이다**(포물선은 틀린 물리).

`.spin-mark` 임팩트 펄스 — 790ms(65.83%) scale 1 → 860ms(71.67%) **1.03** → 960ms(80%) 1. 접촉은 20~40ms 사건이라 마크가 한 번 튀지 않으면 "맞았다" 가 안 읽힌다.

차체 뒤끝 흰 파선 — `stroke-dashoffset: 0 → 72`(dasharray 21+15 = 36 의 **정확히 두 주기**), `linear`, 사이클 전체. 바퀴가 돈다는 공짜 단서이고 이음매가 안 보인다.

**두 변주**

| | 부팅(첫 방문) | 레일 전환 |
|---|---|---|
| 사이클 | 1200ms × ∞ (접촉 790ms) | 820ms × ∞ (접촉 540ms) |
| 최소 표시 | 1500ms | 1000ms *(미정 — 결정 4)* |
| ~~등장(transition)~~ ⚠️ 은퇴 | ~~220ms opacity 0→1 + scale .94→1~~ → **0ms, 첫 프레임부터 불투명·배율 없음** | ~~140ms 같은 값~~ → **0ms** |
| 퇴장(transition) | 200ms opacity 1→0 + scale 1→1.06 | 160ms 같은 값 |
| 마크 크기 | `clamp(96px, 20vmin, 144px)` | `clamp(72px, 16vmin, 112px)` |

⚠️ **2026-09-04 정정 — 등장 행은 은퇴했다**(결정 16 정정). 옛 값(위 취소선)은 지우지 않는다: 되살릴
일이 생기면 그 두 숫자가 출발점이다. 이유는 이 판이 물러난 화면이 아니라 **새 화면 위에 얹히는
덮개**라, 페이드인 구간이 곧 덮으라고 세운 내용이 비치는 구간이었다는 것(헤드리스 실측). 퇴장만
남으면서 "덮개가 걷힌다" 는 사건이 **두 시점**으로 갈라졌다 — `visible=false`(페이드 시작)와 판이
트리에서 사라지는 순간(페이드 끝). 결정 30 의 순서가 뜻하는 것은 **뒤쪽**이다(§10.6).

퇴장은 **밀려나는 게 아니라 다가와서 녹는다** — 로더가 물러나는 것이 아니라 앱이 열리는 것으로 읽힌다. 아래 화면은 따로 애니메이션하지 않는다(레일 전환마다 4px 씩 미끄러지면 그게 곧 소음이다). 진행 막대·퍼센트·문구는 두지 않는다 — 아무것도 안 재는 진행 표시는 거짓말이고, 문구는 i18n 3파일과 폰트 로드를 물고 들어온다.

**감축 모션** — `.spin-chair`·`.spin-ball`·`.spin-mark` 에 `animation: none`(2셀렉터), 등장·퇴장은 `transform: none` 으로 덮고 opacity 만 남긴다. `animation: none` 일 때의 기본 자세가 **logo.svg 정지 자세와 정확히 같아야 한다**(정지 각 0° 는 안쪽 정적 `<g>` 의 `rotate(-45)` 가 지므로, 바깥 `.spin-chair` 는 변환 없음이 곧 정지 자세다). 다만 결정 8 에 따라 감축 모션에서는 로더가 애초에 뜨지 않는다 — 이 경로는 나중에 `pending` 이 붙는 날을 위한 것이고, 그 조건을 주석에 적는다.

---

## 6. 문안 (세 언어)

| 키 | ko | en | ja |
|---|---|---|---|
| `app.smallScreen.title` | 작은 화면에서는 쓰기 불편할 수 있습니다 | This screen may be too small to work on | 画面が小さいと使いにくいことがあります |
| `app.smallScreen.body` | SPIN 은 코트 전체를 보면서 개체를 끌어 옮기는 앱입니다. 화면의 짧은 쪽이 좁으면 코트가 많이 줄어들고 도구가 서로 붙습니다. 7인치 이상 태블릿이나 컴퓨터에서 여시면 훨씬 편합니다. 이 기기에서 그대로 계속 쓰셔도 됩니다. | SPIN is built around seeing the whole court while you drag pieces across it. When the short side of the display is narrow, the court shrinks a long way and the tools crowd together. A 7-inch or larger tablet, or a computer, is much easier to work on. You can keep going on this device. | SPIN はコート全体を見ながら駒をドラッグして使うアプリです。画面の短い辺が狭いとコートが大きく縮み、道具どうしが近づきます。7インチ以上のタブレットやパソコンで開くと、ずっと扱いやすくなります。この端末のまま続けることもできます。 |
| `app.smallScreen.dismiss` | 이 기기에서 다시 보지 않기 | Don't show this again on this device | この端末では次から表示しない |
| `app.smallScreen.continue` | 계속하기 | Continue | 続ける |
| `settings.smallScreen.resetTitle` | 작은 화면 안내 다시 보기 | Show the small-screen notice again | 小さい画面の案内を再表示 |
| `settings.smallScreen.resetDesc` | [다시 보지 않기] 를 껐던 것을 되돌립니다. | Undoes "Don't show this again" for this device. | 「次から表示しない」を解除します。 |

문안 규율: 막지 않고 알린다("사용을 막지는 않는다" — 지시). 이모지·경고 아이콘을 넣지 않는다. "7인치" 라는 숫자를 본문에 두는 이유는 사용자가 자기 기기를 판정할 수 있는 유일한 척도이기 때문이다.

---

## 7. 테스트 계획

**기존 렌더 테스트 6개를 한 줄도 고치지 않는다.** 대상: `AppNavSegment.test.tsx` · `languageModal.test.tsx` · `AppShell.wiring.test.tsx`(40여 케이스) · `AppRail.test.tsx` · `changelogModal.test.tsx` · `src/test/boardTargetBudget.test.tsx`. 조건 넷, 전부 설계에 박혀 있다.

1. `loaderMinMs` 가 `MODE === 'test'` 에서 0 을 돌려준다(vitest 가 MODE 를 'test' 로 놓는다). 환경 분기 선례: `LanguageModal.tsx:38`, `model/defaults.ts:175`.
2. `minMs === 0` 이면 `visible` 이 **초기값부터 false** 다 — true 였다 꺼지는 중간 프레임이 없으므로 오버레이 DOM 도, 타이머도, document 리스너도 트리에 한 번도 안 생긴다. `aria-busy`·`inert` 도 안 붙는다.
3. **결정 7 의 0ms 경로**: `minMs === 0` 이면 §7.6 effect 가 지금과 같은 시점에 동기로 발화한다 → `AppShell.wiring.test.tsx` 의 발표·포커스 단언이 그대로 산다. ⚠️ 이 한 줄이 없으면 그 단언들이 **영영 발화하지 않는다**(심사에서 잡힌 자기모순).
4. jsdom 의 `window.screen` 은 1024×768 이고 `matchMedia` 는 setup.ts 에 없다 → `isSmallDevice` 가 false 로 빠져 안내 모달이 안 열린다. 튜토리얼 게이트는 Provider 밖에서 기본 `true` 라 화면 단독 테스트도 그대로다.

⚠️ **`src/test/setup.ts` 에 `matchMedia` 전역 스텁을 깔지 않는다.** 지금은 필요한 테스트가 파일마다 `stubMedia()` 로 깔았다가 `afterEach` 에서 지운다(`boardTargetBudget.test.tsx:79-103`, `AppShell.wiring.test.tsx:773-786`). 전역에 깔면 `useIsNarrow`·`useIsPortrait`·`useStageRot`·EditorWorkspace 계열 20여 파일의 판정이 한꺼번에 흔들린다. 기존 두 스텁은 `max-width` 외의 질의에 `matches:false` 를 돌려주므로 `(pointer: coarse)` 는 안전하게 false 다 — 다음 사람이 재확인하지 않게 여기 적어 둔다.

**새 테스트 — `src/app/smallScreen.test.ts` (판정식 표본, 렌더 없음)**
지우면 새는 버그: 데스크톱 오판으로 노트북 사용자가 매번 안내를 본다.

| 표본 | 기대 |
|---|---|
| 440×956, coarse | true (폰) |
| 600×960, coarse | **false** (7인치 = 경계, "7인치 미만" 이므로) |
| 768×1024, coarse | false (iPad mini) |
| 427×240, **fine** | false (300% 확대한 데스크톱 — 이 줄이 이 테스트의 존재 이유) |

돌연변이 확인: 문턱 600 → 601, `min` → `max`, coarse 조건 제거 — 셋 다 빨간불이어야 한다.

**새 테스트 — `src/storage/prefs.test.ts` 에 한 줄** (새 파일을 만들지 않는다)
`smallScreenNoticeDismissed: true` 저장 → `loadPrefs` 왕복 → true. 화이트리스트 누락(결정 24 의 함정)이 정확히 여기서 잡힌다. 돌연변이: 화이트리스트에서 필드 삭제 → 빨간불.

**새 테스트 — `src/app/loader/appLoader.test.tsx` (3케이스, fake timers)**
이 파일만 `vi.stubEnv('MODE','production')` + 모듈 리셋으로 실제 경로를 탄다(그 우회 사유를 파일 머리말에 적는다). 테스트 환경 0 스위치가 사각지대가 되지 않게 하는 것이 이 파일의 자격이다.

1. 전환에서 오버레이가 뜨고 최소시간 뒤 사라진다. 상수는 `appLoaderTiming.ts` 에서 import 해 **시계를 그만큼 돌리는 데만** 쓴다(값 대조가 아니다). 지우면: 로더가 안 뜨거나 영영 안 걷힌다.
2. `reduceMotion: 'always'` 면 **한 번도 뜨지 않는다.** 접근성 계약이다. 돌연변이: `loaderMinMs` 의 `reduced` 분기 제거 → 빨간불.
3. 로더가 떠 있는 동안 콘텐츠 열에 `aria-busy="true"` 와 `inert` 가 서고, 걷힌 뒤 사라지며 그 시점에 `#main` 이 초점을 받고 발표가 **한 번** 난다. 지우면: §7.6 포커스가 body 로 떨어지는 회귀 — 이 기능이 실제로 깨뜨릴 수 있는 유일한 기존 계약이다.

**안 쓰는 것**: 키프레임 %·ms·회전 각도·이징 문자열 대조(소스 베끼기 + 인라인 스타일 값 검사, 둘 다 금지), SVG 도형 개수·색 문자열, 오버레이 z-index, DOM 스냅샷, 세 언어 문안 대조, 모달의 Esc·포커스 트랩 재검사(`Modal` 자체 테스트 소관), "레일 5개 각각에서 뜬다" 5중 반복(하나면 배선이 증명된다). **애니메이션이 킥으로 읽히는지는 jsdom 이 못 잰다 — §4 항목이다.**

**돌리는 명령**: `npm run test:rel src/app/smallScreen.test.ts src/storage/prefs.test.ts src/app/loader/appLoader.test.tsx` 로 좁혀 돌리고, 그다음 기존 6개 파일을 좁혀 한 번. 커밋 직전에 `npm test` + `npm run lint` + `npm run typecheck` 각 한 번. 전체 스위트는 부하에 약해 실패 집합이 회차마다 바뀌므로 빨간 것은 **단독으로 재확인**한다. 커밋 본문에 "기존 렌더 테스트 6개 무개조 통과" 와 "돌연변이 N건으로 실효 확인" 을 검증 줄로 적는다.

---

## 8. 남는 위험 (알고 넘기는 것)

1. **레일 전환 1.0초는 순수 인위적 지연이다.** 로더는 기다림을 가리는 물건이지 만드는 물건이 아니라는 원칙과 어긋나는 유일한 지점. 완화는 상수 한 곳(결정 4)과 입력 즉시 걷기(결정 5), 확정은 실기(§4-7).
2. `inert` 는 Chrome 102 / Safari 15.5 / Firefox 112 이상이다. 그 아래에서는 가려진 컨트롤이 Tab 에 잡힌다 — 폴백으로 `tabIndex` 를 손대지 않는다(대상 밖 브라우저). `aria-busy` 만 남는다는 것을 알고 넘긴다.
3. `transform-box: view-box` 는 Chrome 64+ / Safari 15.4+ / Firefox 55+. 구형 웹뷰에서는 회전축이 요소 박스 기준으로 읽혀 차체가 엉뚱하게 돈다(§4-1 에서 눈으로 잡힌다).
4. **확대한 터치 태블릿**은 여전히 작은 기기로 오판한다(`screen.width` 가 줄고 pointer 는 coarse 그대로). 결과가 닫을 수 있는 안내 한 장이고 되돌리는 손잡이(결정 26)가 있어 감수한다.
5. **[다시 보지 않기] 도장이 백업 봉투를 탄다.** `prefs` 가 통째로 실리므로(`transfer.test.ts` 확인) 폰에서 체크한 뒤 그 백업을 다른 기기에 복원하면 도장이 따라간다. 큰 기기에서는 애초에 안 뜨므로 실해가 없다 — `sync.enabled` 가 백업을 타는 것과 같은 급의 허용으로 둔다. 문구의 "이 기기에서" 와 데이터의 실제 수명이 완전히 같지는 않다.
6. 레일 열쇠라 **드릴 열기·시연 진입에는 로더가 안 뜬다** — 가장 무거운 마운트가 맨몸으로 일어난다(결정 10 에 뒤집는 법을 적었다).
7. `MODE === 'test'` 스위치는 테스트가 배송 경로와 다른 경로를 돈다는 뜻이다. `appLoader.test.tsx` 가 그 자격을 산다 — **그 파일을 지우면 스위치가 곧 사각지대가 된다.**

## 9. 다음 릴리스에서 React.lazy 를 넣을 때의 전제조건

결정 1 을 뒤집는 날, 아래 셋이 **같은 커밋에** 들어와야 한다.

1. **ErrorBoundary + [다시 시도]** — 저장소에 0개다. 없으면 청크 로드 실패가 곧 앱 전체 흰 화면이다.
2. **`file:` 프로토콜 대책** — `App.tsx:127` 이 Tauri·로컬 열기에서 `createHashRouter` 로 분기하는데 vite `base` 가 `/` 라 동적 import 가 절대 경로를 문다. 데스크톱 빌드를 상대 base 로 굽거나 그쪽만 분할을 끈다.
3. **`RulesScreen` 은 가르지 않는다** — 프리렌더 33장의 착지점이다. 크롤러가 렌더 스냅숏을 이르게 찍으면 규칙 본문 자리에 로더만 있는 페이지 33장이 색인된다.

배선은 이미 열려 있다: `useAppLoader({ pending })` 에 `<Suspense>` 의 대기 신호를 넘기면 게이트가 "타이머 OR 서스펜스" 로 켜지고 나머지는 그대로다. Suspense 경계는 `renderScreen` 호출 하나를 감싸는 자리이고 **헤더는 반드시 경계 밖**이다(결정 2 의 그 사고).

---

## 10. 구현 결과 (2026-09-04)

U1~U11 이 병렬로 랜딩했다(신규 12파일 · 수정 9파일). 아래는 각 단위가 남긴 것을 한 곳에 모은
것이다 — **정정**은 이 계획서가 틀렸던 곳, **채운 것**은 계획서가 안 정해 구현이 고른 곳,
**남는 것**은 §4 실기 확인에 합류하는 것이다. 결정 표(§1)의 근거는 지우지 않는다(AGENTS §2).

### 10.1 계획서 정정

- **결정 30 의 "호출부 7곳" 은 6곳이다** — `LibraryScreen`·`SessionsScreen`·`SessionEditorScreen`·
  `EditorWorkspace`·`PresentRunner`·`RulesScreen`. 같은 칸의 나열이 맞고 숫자만 틀렸다.
- **§2 의 `sizePx: number` 와 §5 의 `clamp(96px, 20vmin, 144px)` 는 형이 다르다**(수 vs CSS 문자열).
  잇는 방법: `appLoaderTiming.ts` 에 `MARK_SIZE` 표와 순수 함수 `markSizePx(kind, viewportMinPx)` 를
  두고, 오버레이가 렌더 시점의 `Math.min(innerWidth, innerHeight)` 로 계산해 넘긴다. 대가는
  **로더가 떠 있는 1.0~1.5초 안의 창 크기 변화를 안 따라가는 것**이다(구독 없음).
- **§7 의 "모듈 리셋" 은 필요 없다** — `loaderMinMs` 가 `import.meta.env.MODE` 를 **호출 시점에**
  읽으므로 `vi.stubEnv('MODE','production')` 만으로 배송 경로를 탄다. `vi.resetModules()` 는
  나중에 MODE 가 모듈 최상위 상수로 접히는 날을 위한 가드로만 남겼다.
- **§7 의 `appLoader.test.tsx` 는 3케이스가 아니라 5케이스다** — 계획서 3항목 + `inert`·발표 분리
  1 + `loaderMinMs(...) > 0` 스위치 가드 1. 가드가 없으면 나머지가 "0ms 라 아무 일도 안 일어난다"
  를 초록으로 지난다(값 대조가 아니라 0 초과만 본다).
- **§7 의 smallScreen 표본 4행은 4케이스 6단언으로 갔다** — 폰을 가로·세로 둘로, 경계를 599·600
  둘로 쪼갰다. 표본 성격은 그대로다.
- **§7 의 "`prefs.test.ts` 에 한 줄" 은 새 `it()` 하나**로 이행했다(계획서 표기가 정본).
- **§7 의 새 테스트 목록에 없던 파일이 하나 늘었다** — `src/ui/tutorial/tutorialGate.test.tsx`
  (3케이스). 게이트 고장 셋(조건 누락·의존성 누락·기본값 뒤집기)이 전부 "자동 시작이 조용히
  증발" 로만 나타나 `appLoader.test.tsx` 가 못 잡기 때문이다(AGENTS 테스트 규칙 「쓰는 것 — 게이트」).

### 10.2 계획서가 안 정한 자리를 구현이 채운 것

- **결정 7 의 판정식은 `loader.visible` 이 아니라 `loaderMinMs('rail', reduceMotion) > 0` 이다.**
  '지금 덮여 있나' 가 아니라 '이 환경에서 덮개가 존재할 수 있나' 를 본다. `loader.visible` 로는
  원리적으로 안 된다 — 전환이 일어난 그 커밋에서 `useAppLoader` 의 setState 는 아직 반영 전이라
  항상 false 이고, 곧 `inert` 가 될 화면에 대고 `focus()` 를 부르게 된다(돌연변이로 실증).
  ⚠️ 부수 효과: 배송 빌드에서 **로더가 실제로는 안 뜨는 전환**(뒤로가기 면제 · 같은 레일 안의
  대상 변경 = 규칙 주제 상세·드릴 열기·시연 대상 교체)도 발표·포커스가 한 커밋 뒤에 난다(사람
  눈에는 같은 프레임). 0ms 환경은 예약 자체가 없어 완전히 동기라 기존 단언은 무영향이다. 더
  깨끗한 대안은 `useAppLoader` 가 "이번 전환을 덮는가" 를 스스로 돌려주는 것이다.
  - ── ⚠️ **2026-09-04 정정: 판정식은 `loader.visible` 로 돌아갔다.** 위 문단은 지우지 않는다
    (AGENTS §2) — 그 전제("전환 커밋에서 setState 가 아직 반영 전")가 **같은 날 죽었다**.
    `useAppLoader` 가 열쇠 변화를 effect 가 아니라 **렌더 중 파생**으로 보게 바뀌면서 덮개가
    새 화면과 같은 커밋에 서기 때문이다. 대가로 얻은 것: 덮개가 실제로는 안 뜨는 전환에서
    발표·포커스가 한 커밋 늦던 위 부수 효과가 사라졌다. 정본은 `AppShell.tsx` 의 그 effect
    주석이다. ⚠️ 발표·포커스의 기준은 **`visible` 그대로**이지 아래 `coverSettled` 가 아니다 —
    `inert` 가 `visible` 과 같이 떨어지므로 그 순간 이미 `focus()` 가 먹고, 퇴장 페이드
    160~200ms 를 더 기다리면 발표가 그만큼 늦어진다.
- **`AppLoaderOverlay` 는 스스로 마운트·언마운트를 진다.** `{loader.visible && <AppLoaderOverlay/>}`
  로 감싸면 퇴장 transition 이 죽는다 — 무조건 렌더하고 `visible` 만 넘긴다. 한 번도 visible 이
  아니었으면 스스로 `null` 이라 DOM 이 0 개다(§7 조건 2 가 그대로 성립한다).
- **`spinMarkColors.ts` 에 네 번째 리터럴 `MARK_WHITE = '#fff'`** (차체 뒤끝 파선 + 머리). 결정 32 는
  3종만 적었지만 색 리터럴이 컴포넌트로 새지 않게 한 파일에 모았다.
- **`AppLoaderOverlay` 에 옵셔널 `reduceMotion`**(기본 false). 인라인 `transform` 이 CSS 의
  `transform: none` 을 캐스케이드에서 이기기 때문이다. 결정 8 대로 오늘은 도달하지 않는 갈래이고
  `pending` 이 붙는 날을 위한 것이다.
- **새 CSS 클래스 둘** — 파선 행진 `.spin-dash`, 오버레이 루트 `.spin-loader`(감축 모션
  `transform:none` + 강제색 배경). §5 는 셋만 적었다.
- **`useAppHistory.lastNavFromHistory` 는 옵셔널이다.** 필수로 하면 저장소 전역의 목 리터럴 24개
  파일이 typecheck 에러가 난다. 소비처는 `?? false` 로 받는다.
- **안내 모달의 `onClose(false)` 는 prefs 를 아예 안 쓴다.** 결정 25 를 "저장 시점은 `onClose` 한
  곳" 으로 읽었지 "닫을 때마다 false 를 쓴다" 로 읽지 않았다.
- **[설정] 새 Row 는 `settings.smallScreen.resetTitle` 하나를 제목·버튼 라벨·토스트 문구 셋에
  재사용한다.** §6 문안 표에 전용 버튼·토스트 키가 없다(튜토리얼 Row 는 셋이 전부 다른 문구라
  결이 다르다). **남는 빚** — 전용 키를 원하면 `ko/en/ja` 3파일에 두 키를 더하고 그 Row 의 두
  자리만 바꾼다.

### 10.3 남는 것 — §4 실기 확인에 합류

- ⚠️ **결정 33 의 근거가 사실과 어긋난다.** "마크 본체의 초록·파랑·노랑은 SVG presentation
  attribute 라 강제색이 안 건드린다" 고 적혀 있으나, 이 저장소는 정반대 사실 때문에
  `contrast.css` 가 `.stage-svg, .spin-print-court { forced-color-adjust: none }` 을 미디어쿼리
  **밖**에 두고 `contrast.test.tsx` 가 그것을 못박고 있다 — 강제색은 SVG `fill`/`stroke` 도
  치환한다. 결정을 고치지 않고 그대로 이행했으므로 Windows 고대비에서 마크가 단색 덩어리가 될
  가능성이 높다(기능 손실은 아니다). 의도("강제색에서도 초록 코트 위 파란 휠체어와 노란 공")를
  지키려면 `.spin-mark { forced-color-adjust: none; }` 한 줄이면 되지만 그것은 결정을 바꾸는
  일이다 → **§4-4 에서 눈으로 보고 판정한다.**
  - ── ⚠️ **2026-09-04 정정: "안 넣었다" 가 사실과 다르다.** 위 문단은 지우지 않는다(AGENTS §2)
    — 결정 33 의 근거가 틀렸다는 지적은 그대로 유효하다. 틀린 것은 **구현 보고**다:
    `src/styles/a11y.css` 의 `@media (forced-colors: active)` 블록 안에 이미
    `.spin-mark { forced-color-adjust: none; }` 이 들어 있다. 그래서 오늘의 실제 동작은
    "강제색에서도 초록 코트 위 파란 휠체어와 노란 공" 이고, 결정 33 의 **의도대로** 도는 중이다.
    남는 것은 결정 33 의 *근거 문장*("SVG presentation attribute 라 강제색이 안 건드린다")을
    언젠가 바로잡는 일뿐이고, 판정 항목이던 §4-4 는 "단색 덩어리가 되는가" 가 아니라
    "치환을 끈 마크가 강제색 배경과 충분히 구분되는가" 를 보는 것으로 뜻이 바뀐다.
- `a11y.css` 의 `forced-colors` 블록은 **아무 테스트도 안 지킨다**(`contrast.test.tsx` 는
  `contrast.css`·`tokens.css` 만 읽는다). 규율(hex·`var()` 0개)은 지켜서 썼지만 회귀 방지 장치는
  없다. §7 이 CSS 문자열 대조를 금지하므로 새 테스트를 만들지 않았다.
- **차체 타임라인의 속도가 접촉에서 위로 튄다.** 58.33→65.83% 는 1.167°/ms(최고속 등속)인데 바로
  다음 65.83→67.92% 가 1.72°/ms 다 — "브레이크" 가 최고속보다 빠르게 시작한다. §5 표 값 그대로
  옮긴 결과이고 임팩트 스냅으로 읽힐 수 있어 손대지 않았다. §4-2 에서 어색하면 첫 손잡이는
  67.92% 의 −288 을 −270 근처로 낮추는 것이다(회전량 288.3°·43.4° 는 기하가 정한 값이라 맨
  마지막에 만진다).
- **§5 의 공 표는 이징 열이 "그 시점부터" 인지 "그 시점까지" 인지 말하지 않는다**(차체 표만
  "다음 구간 이징" 이라 밝힌다). CSS 네이티브 의미(그 키프레임에서 **시작하는** 구간)로
  이행했고 차체 표의 표기와도 맞는다. 반대 뜻이었다면 67.67%·70.83%·83.33% 의 이징이 한 줄씩
  위로 옮겨간다.
- **감축 모션에서 끝 자세가 `scale(1)` 이 아닌 채 굳지 않는지.** `a11y.css` 의 감축 모션 블록은
  `!important` 를 안 쓰므로(그 파일 관례) 인라인 `transform` 이 이기고, `tokens.css` 가
  transition-duration 을 0.01ms 로 죽여 움직임만 없앤다. 결정 8 대로 오늘은 로더가 아예 안 뜨는
  갈래라 도달하지 않지만, `pending` 이 붙는 날의 확인 항목이다(§4-12 옆).
- **StrictMode(개발 서버 5173) 한정** — 마운트 effect 가 두 번 도는 것은 이번 변경 **이전부터**
  있던 성질인데, 그 잉여 발표가 이제 '로더가 걷힌 뒤' 로 옮겨 붙는다. 첫 진입에서 화면 이름이
  한 번 더 발표될 수 있다(배송 빌드에는 없다). §4-11 에서 같이 본다.
- **같은 세션 안에서 [설정] → [작은 화면 안내 다시 보기] 를 눌러도 즉시 다시 뜨지 않는다**
  (안내는 이번 실행에 1회라는 도장을 쓴다). §4-18 이 "누른 뒤 새로고침 → 다시 뜬다" 로 적고
  있어 그대로 이행했다.
- `readDeviceMetrics()` 는 `window` 가 없으면 width/height 를 `Infinity` 로 돌려 not-small 로
  떨어지고, `matchMedia` 가 없는 구형 웹뷰도 `coarse:false` 로 떨어져 안내가 안 뜬다 — **모를
  때는 안 띄우는 쪽**으로 기울였다.
- 등장·퇴장 곡선은 `cubic-bezier(.4,0,.2,1)` **리터럴**이다 — `tokens.css` 에 이징 토큰이 없다.
  토큰을 만드는 날 `a11y.css` 와 `AppLoaderOverlay.tsx` 두 곳을 같이 고친다.
- `smallScreen.test.ts` 의 경계 케이스는 `SMALL_SCREEN_MIN_PX` 를 **import 하지 않고** 600/599
  리터럴로 적었다 — 상수를 쓰면 문턱이 밀릴 때 검사표가 같이 밀려 돌연변이가 초록으로 지난다
  (자기증명). 상수와 검사표가 갈라져 보이는 것이 의도다.
- `AppShell.wiring.test.tsx` 의 렌더 헬퍼는 export 되지 않아 `appLoader.test.tsx` 가 관례만 따라
  다시 썼다(그 파일은 한 줄도 안 고쳤다). 시연 화면은 `PresentRunner` 가 아니라 `PresentScreen`
  째로 목을 씌운다 — 이 파일은 시연 대상 배선을 안 보므로 matter-js 를 아예 안 물리는 쪽이 싸다.
- **이번 배선이 특히 실기에서 걸리는 §4 항목**: §4-2(네 박자) · §4-3(루프 이음매) · §4-4(강제색) ·
  §4-6(작은 창 마크 크기) · §4-8(헤더 소유자가 바뀌는 전환에서 걷히는 순간 한 프레임 빔) ·
  §4-10(`inert` 로 Tab 이 막히고 걷힌 뒤 `#main` 부터) · §4-11(발표가 화면 이름 한 번뿐인가) ·
  §4-14(좁은 창 3칸 세그먼트) · §4-19·20(안내가 로더 뒤에 뜨는가, 로더→안내→튜토리얼 순서).

### 10.4 해결된 것

- U2 가 새로 지은 클래스 이름(`.spin-dash`·`.spin-loader`)을 U1 의 마크·오버레이가 그대로 달았다.
  레일 변주(820ms)는 `SpinLoaderMark` 가 `animationDuration` 을 **네 요소 전부**(chair·ball·mark·
  dash)에 걸어 접촉 순간이 안 흩어진다.
- 작업 중 여러 단위가 본 typecheck 에러(`app.smallScreen.*` 키 누락 · `lastNavFromHistory` 없음 ·
  `zzGateCheck.test.tsx` 의 `ready` prop)는 전부 **다른 단위가 아직 안 올린 파일** 때문인 일시
  상태였다. 문서 단계에서 `npm run typecheck` 0 을 확인했다.
- `Modal.descriptionId` 는 미지정 시 React 가 속성 자체를 안 렌더해 기존 6개 사용처에 무영향이다
  (결정 28 의 "가산적 확장" 이 실제로 성립했다).
- 계획서 §7 의 조건 넷이 전부 성립해 **기존 렌더 테스트 6개를 한 줄도 안 고쳤다.**

### 10.5 문서 반영

- `AGENTS.md` — §5 끝에 「UI 크롬 애니메이션은 코드로 만든다」(시연 콘텐츠 규칙의 명시적 예외),
  §6 에 「인위적 최소 표시 시간은 테스트 환경에서 0 이다」(결정 34).
- `DESIGN.md` — §6.13 신설(로더·안내의 계약 여덟 줄), §7.6 에 `※ 정정`(발표·포커스 시점),
  §0.1 정정 색인에 그 줄.
- `CHANGELOG.md`·`.en.md`·`.ja.md` — `## [Unreleased]` 절에 추가됨 2줄(세 언어 항목 수 동일).
- 버전 범프(`package.json` 0.6.2 → 0.6.3)와 `ROADMAP.md` 는 **하지 않았다** — 릴리스 커밋이
  따로 온다(AGENTS §7).

### 10.6 검수가 잡은 것 (2026-09-04, 랜딩 뒤)

둘 다 **경로 하나만 다르게 도는** 결함이라 화면을 보아도 눈에 안 띄는 종류였다.

- **결정 25 가 Esc 경로에서만 깨져 있었다.** `SmallScreenNotice` 는 나가는 문을 `close()` 하나로
  모았지만, Modal 의 Esc 리스너는 `open` 이 서던 순간의 `onClose` 를 붙잡고 있어(`Modal.tsx` 가
  "onClose identity 변화로 트랩을 재설정하지 않는다" 고 스스로 밝힌 성질) 첫 렌더의 `dismissed`
  = false 를 넘겼다. ✕·백드롭·[계속하기]는 렌더 본문이라 최신 값을 쓴다. 즉 **Esc 로 닫은 사람의
  [다시 보지 않기] 만 조용히 버려졌다.** 고치는 자리는 이 컴포넌트다 — 체크 상태를 ref 로도 들고
  `close` 가 ref 를 읽는다. Modal 의 의존성을 늘리는 쪽은 열려 있는 동안 트랩이 재설정되어 6개
  사용처의 포커스 계약을 흔든다. 교훈: **문을 하나로 모으는 것만으로는 부족하고, 그 문이 언제
  만들어진 값을 읽는지가 같아야 한다.** 회귀 한 케이스를 `SmallScreenNotice.test.tsx` 에 남겼다.
- **퇴장 페이드 동안 오버레이가 포인터 입력을 삼켰다.** `inert` 는 `loader.visible` 과 같이
  떨어지는데 판은 `EXIT_MS`(160~200ms) 더 살아 있고(결정 16), 그 사이 `pointer-events` 가 기본
  `auto` 라 화면이 열린 것을 보고 누른 첫 탭이 핸들러 없는 판에 먹혔다. 결정 5(아무 입력에 즉시
  걷기)와 겹치면 걷은 그 탭에 이어지는 두 번째 탭까지 같은 판이 먹는다. `pointerEvents: exiting ?
  'none' : undefined` 한 줄로 고쳤다 — 떠 있는 동안 값을 안 주는 것은 `inert` 를 모르는 구형
  브라우저(§8-2)에서 이 판이 가린 컨트롤을 대신 막아 주기 때문이다. 인라인 스타일 값은 테스트를
  붙이지 않는다(AGENTS 테스트 규칙) — §4 실기 확인에서 본다.

### 10.7 검수 2차가 잡은 것 — "걷힘" 의 뜻 (2026-09-04)

10.6 의 둘과 같은 뿌리다: **퇴장 transition 이 생기면서 "덮개가 걷힌다" 가 두 시점으로 갈라졌는데
(`visible=false` = 페이드 시작, 판이 트리에서 사라짐 = 페이드 끝) 결정 30 의 순서는 앞쪽을
읽고 있었다.** 실측 프레임에서 로더가 아직 거의 불투명한데 그 위에 튜토리얼 말풍선(z 300)이 이미
떠 있었다 — 결정 30 이 막으려던 바로 그 그림이, 막는 식이 한 박자 이른 탓에 다시 나온 것이다.

- **오버레이가 `onExited?: () => void` 를 발행한다.** 퇴장이 끝나 스스로 `null` 이 되는 그 순간
  (`setMounted(false)` 직후) 한 번 부른다. 퇴장 길이는 `kind` 마다 다르고 퇴장 중에 다음 전환이
  들어오면 되조준되어 아예 안 오므로, **판 자신 말고는 그 시점을 아무도 계산할 수 없다.**
  콜백은 ref 로 읽는다 — effect 의존성에 넣으면 부모가 퇴장 중에 재렌더할 때마다 타이머가 다시
  걸려 퇴장이 영영 안 끝난다. ⚠️ `visible` 이 한 번도 참이 아니었던 0ms 환경에서는 **절대 안
  불린다**(타이머 자체가 안 생긴다 — §7-2 의 성질을 그대로 물려받는다).
- **AppShell 의 게이트 식이 `coverSettled && noticeDecided && !noticeOpen` 이 됐다.**
  - `coverSettled` 초기값은 `!loader.visible` 이다. 0ms 환경(감축 모션·테스트)과 프리렌더 착지
    (`skipBoot`)에서는 `onExited` 가 영영 안 오므로, 초기값이 그 신호를 대신해야 한다. 판정을
    새로 조립하지 않고 상태기계가 이미 낸 답을 읽는 것이 판정 두 벌을 막는다.
  - 덮개가 서는 그 커밋에 게이트도 같이 닫히도록 **렌더 중 파생**으로 끈다
    (`if (loader.visible && coverSettled) setCoverSettled(false)`). `useAppLoader` 가 열쇠 변화를
    렌더 중에 보는 것과 같은 규율이고, effect 로 미루면 새 화면의 첫 커밋에 ready 가 참이다.
  - `noticeDecided` 는 두 번째 구멍을 막는다: 작은 기기에서 안내 모달을 여는 effect 가 돌기
    **전 커밋**에 ready 가 참이라 튜토리얼이 안내보다 먼저 시작할 수 있었다. "안 뜨는 기기라서
    안 열린 것" 과 "곧 열릴 것" 은 `noticeOpen` 만으로 구별되지 않는다. 안내 판정 자체의 기준도
    `!loader.visible` 에서 `coverSettled` 로 옮겼다 — 페이드가 남은 동안 열면 반투명한 판 너머로
    모달이 비친다.
  - 0ms 환경에서 치르는 대가: `noticeDecided` 가 첫 effect 에서 서므로 자동 시작이 **한 커밋
    늦다.** `useTutorial` 이 `gateReady` 를 effect 의존성에 두고 있어 그 커밋에서 이어받는다 —
    기존 렌더 테스트(`AppShell.wiring` 35케이스·`tutorialGate`·`boardTargetBudget`)는 한 줄도
    안 고쳤고 그대로 초록이다.
- **`appLoader.test.tsx` 에 케이스 하나**(6 → 7). 세션 화면 목만 `useTutorialGate()` 를 읽어
  `data-gate` 로 내보낸다 — 게이트는 상태일 뿐 DOM 을 안 만들어 밖에서 관측할 길이 없고,
  Provider 안에 넣을 수 있는 노드는 화면뿐이다. 목 팩토리를 `async` 로 두어 `vi.resetModules()`
  뒤의 레지스트리에서 컨텍스트를 물어 온다(AppShell 이 무는 것과 **같은 인스턴스**라야 값이 통한다).
  단언 순서가 계약이다: 전환 커밋에 닫힘 → `APP_LOADER_MS.rail` 뒤(`visible=false`, 판은 아직
  살아 있음)에도 닫힘 → `EXIT_MS.rail` 뒤에 열림. **돌연변이 1건으로 실효 확인** — `onExited`
  배선을 지우면 마지막 단언이 `closed` 로 빨간불이다.
- **계획서 정정 여섯 곳**: 결정 16(등장 은퇴) · 결정 30(발행식) · §2 의 `ENTER_MS` · §5 두 변주
  표의 등장 행 · §10.2 첫 항목(결정 7 판정식이 `loader.visible` 로 돌아감) · §10.3 의
  "`.spin-mark forced-color-adjust` 를 안 넣었다"(a11y.css 에 들어 있다).
