# 반증 기준선 (Falsification Baseline) — 0.3 + 0.4

> **작성**: 2026-08-12 · 계획서 `docs/PLAN-2026-08.md` 0차 항목 0.3(반증 기준선 고정) + 0.4(수호 단언)의 산출물.
> 사전 조사: 계획서가 지목한 후보 8개 파일 전수 검증(경로 실재·인용 줄 대조·깨짐 판정).

## 1. 이 문서의 용법

재편(2.1 개명 · 레일 3단 · NavEntry 확장 · 1.3 자가 분리)을 실행하면 아래 §3 표의 테스트들이
**의도적으로** 빨간불이 된다 — 그것은 계획대로다. 반대로 **이 문서에 없는 테스트가 빨간불이면
그건 회귀다.** 작업 중 예상 밖의 빨간불을 만나면 "재편 중이라 원래 깨지는 것"이라고 넘기지 말고,
먼저 이 표에 있는지 확인하라. 표에 없으면 그 커밋은 잘못 건드린 것이다. 표의 갱신 방법을 벗어나는
수정(특히 §4 의 수호 단언을 고치는 수정)도 회귀로 취급한다.

## 2. 기준선

2026-08-12 실측 (devel, `ddb699f` 기준):

| 항목 | 결과 | 명령 |
|------|------|------|
| 테스트 | **99 파일 874 테스트 전부 통과** (실패 0, 스킵 0) | `npx vitest run` |
| 타입체크 | 에러 0 | `npm run typecheck` (`tsc -b --noEmit`) |
| oxlint | 에러 0 · exit 0 (기존 경고 33건은 기준선에 원래 있던 것) | `npm run lint` |

재편의 각 커밋 후에도 이 세 명령이 판정 기준이다. 874 에서 줄어든 수만큼이 §3 표와 정확히
일치해야 하고, 갱신을 마친 시점에는 다시 전부 초록불이어야 한다.

## 3. 의도적으로 깨질 테스트 — 사전 등록

원인 표기: **(a)** 2.1 개명(`home`→`board`, `library`→`drills`) · **(b)** 레일 3단(조사 결과
ToolRail **모드 도구** 구역 5종→3종 이야기다 — AppRail 이 아니다) · **(c)** NavEntry 확장
(`target`/`depth` 필드) · **(d)** 1.3 겹친 휠체어 자가 분리.

### 3.1 런타임에서 깨진다 — 확정 9건 + 조건부 3건

| 파일 | 줄 | it() 이름 | 원인 | 갱신 방법 |
|------|----|-----------|------|-----------|
| `src/app/screens.test.ts` | 9 (기대값은 6, 단언은 10) | SCREEN_ORDER 는 재편 후 4화면(§6.8)과 순서까지 정확히 같다 | (a) — `EXPECTED` 의 `'home'`/`'library'` 리터럴 | `EXPECTED` 를 `['board','drills','present','settings']` 로. 4개 유지·순서 불변이 계약이다(계획서 2.1) |
| `src/app/screens.test.ts` | 20 | SCREEN_TITLES/SCREEN_NAV_LABELS 는 4화면 전부에 빈 문자열이 아닌 값을 갖는다 | (a) — `EXPECTED` 순회 중 `SCREEN_TITLES['home']` 이 undefined | 위 `EXPECTED` 갱신으로 함께 해소. `home` 예외 분기(부제)는 `board` 로 키만 바꾼다 |
| `src/app/AppRail.test.tsx` | 28 (단언은 38-42) | 4개 화면 링크 + aria-current="page" 를 현재 화면에 표시한다 | (a) — Harness 가 `useAppHistory('home')` 으로 시작, 개명 후 `nav.screen` 이 `'board'` 와 절대 불일치 → 38행 aria-current 단언 실패 | Harness 초기 화면을 `'board'` 로. 개명이 레일 라벨(`'목록'` 등)까지 바꾸는지는 **미확인** — 바꾸면 40-41행도 추가 실패하므로 라벨 상수 확정 후 함께 갱신. 레일 3단(2.1, `RAIL_ITEMS` 3개 — present 를 레일에서 제거)이 40행의 `'시연'` 버튼 단언에 미치는 영향은 조사 범위 밖이라 **미확인** — 2.1 착수 시 재판정할 것 |
| `src/app/useAppHistory.test.ts` | 13 (단언은 16) | history.state 가 없으면 initial(기본값 home)로 시작하고 depth 0 을 심는다 | (c) — `toEqual` 은 정확 일치라 `target` 필드 추가로 실패. (a)의 기본 initial 개명으로도 깨진다 | `toEqual` 기대 객체를 확장된 NavEntry 형태로(신 키 + `target`). state `toEqual` 은 16·34·38·46행 4곳 전부다 |
| `src/app/useAppHistory.test.ts` | 30 (단언은 34·38) | go(next) 는 pushState + depth++ 를 하고 화면을 바꾼다 | (c) | 위와 동일 |
| `src/app/useAppHistory.test.ts` | 41 (단언은 46) | back(fallback) 은 depth 0 이면 go(fallback) 과 동일하게 동작한다 | (c) | 위와 동일. 참고: `go()` 는 키를 검증하지 않아 이 파일의 `'library'` 리터럴 테스트 다수가 (a)만으로는 런타임에서 우연히 통과한다 — 타입체크가 잡는다(§3.2) |
| `src/features/present/PresentRunner.test.tsx` | 52 (단언은 57) | target 이 null 이면 빈 상태 + [목록으로] | (a) — `expect(nav.back).toHaveBeenCalledWith('library')`, 컴포넌트가 `back('drills')` 를 부르게 되면 실패 | 기대 인자를 `'drills'` 로 |
| `src/features/present/PresentRunner.test.tsx` | 120 (단언은 128) | 우상단 [시연 종료]·헤더 [편집으로] 모두 nav.back('editor') 를 부른다 | (a) — it 이름은 낡았고 실제 단언은 `toHaveBeenCalledWith('home')`, `back('board')` 가 되면 실패 | 기대 인자를 `'board'` 로. 낡은 it 이름(`'editor'`)도 이때 함께 갱신 |
| `src/features/editor/ToolRail.test.tsx` | 45 (버튼 확인은 47) | 모드 도구 5종을 렌더한다 | (b) — 현재 `['선택','이동','패스','메모','지우개']` 5개 전부를 getByRole 로 확인 | 살아남는 3종으로 목록·it 이름 갱신. **어떤 3종이 남는지는 계획서가 확정하지 않아 미확인** — 확정 후 갱신 |
| `src/features/editor/ToolRail.test.tsx` | 195 | 기능 도구는 끌 수 없다 — 모드라서 끌 것이 없다 | (b) **조건부** — `'지우개'` 버튼을 getByRole 로 잡으므로, 잔존 3종에 지우개가 없을 때만 깨진다 | 지우개 잔존 여부 확정 전까지 **미확인**. 잔존하면 무수정 통과 |
| `src/physics/world.test.ts` | 727-813 (describe 'push 모드') | it 728 '대기 칩은 dynamic, 드래그 칩은 static 이다' · it 767 '밀린 칩은 손을 뗀 뒤 곧 선다'(790행 allAtRest 단언) | (d) **조건부** — 자가 분리를 충돌 필터·static 전환으로 구현하면 깨질 후보 | 구현 방식 확정 전까지 **미확인**. 1.3 착수 시 재판정 |
| `src/physics/world.test.ts` | 340-375 (describe freeze 회귀, 주석 '살짝 겹친 채 멈춘 드래그') | it 357 · it 366 | (d) **조건부** — 구현이 freeze 경로를 건드릴 때만 | 구현 방식 확정 전까지 **미확인**. 1.3 착수 시 재판정 |

**소계**: 런타임 확정 9 it (screens 2 + AppRail 1 + useAppHistory 3 + PresentRunner 2 + ToolRail 1),
조건부 최대 +3 파일분(ToolRail 195 · world push 모드 · world freeze) — 조사 판정 기준 확정 9, 최대 12.

### 3.2 타입체크만 깨진다 (vitest 는 초록불)

| 파일 | 줄 | 무엇이 | 원인 | 갱신 방법 |
|------|----|--------|------|-----------|
| `src/app/screens.test.ts` | 6 | `EXPECTED` 의 `'home'`/`'library'` 리터럴이 `Screen` 타입에서 빠짐 | (a) | §3.1 첫 행과 같은 갱신으로 해소 |
| `src/app/AppRail.test.tsx` | 14 | `useAppHistory('home')` | (a) | `'board'` 로 |
| `src/app/useAppHistory.test.ts` | 파일 전역 | `'home'`/`'library'` 리터럴 다수 | (a) | 파일 전체를 신 키로 일괄 치환 — 파일 전체가 사전 등록 대상 |
| `src/features/editor/EditorScreen.test.tsx` | 33 | `const nav: AppHistoryApi = { screen: 'home', … }` | (a) | `'board'` 로. **런타임에서는 (a)~(d) 어느 것에도 깨지지 않는다** — 4개 it 전부 useAppHeader effect 산출물을 단언하고, 도구 레일 단언('공'·'스텝 추가')은 (b)의 모드 도구 축소와 무관. 계획서의 후보 지정은 타입체크 의미로만 유효 |
| `src/features/board/BoardScreen.test.tsx` | 44 | `screen: 'home'` (EditorScreen 과 같은 패턴) | (a) | `'board'` 로. **계획서 0.3 후보 목록에 누락돼 있던 파일** — 여기서 추가 등록한다 |

## 4. 수호 단언 — 절대 깨지면 안 되는 것 (0.4)

`src/app/screens.test.ts:13-18` 전문:

```ts
it("'editor' 는 더 이상 화면 키가 아니다", () => {
  // 2026-08-09 재편: 자유 전술판과 드릴 편집은 둘 다 home 자리에 뜬다(AppShell 의 StageTarget).
  // 이 단언이 없으면 어디선가 go('editor') 를 되살렸을 때 SCREEN_SET 이 걸러 조용히 무시하고,
  // 화면이 안 바뀌는 이유를 찾기 어려워진다.
  expect(SCREEN_ORDER).not.toContain('editor');
});
```

이것이 **이 안(안 1, Board-First)이 안 2(화면 분리안)와 갈리는 유일한 구조적 분기의 수호선**이다.
안 2 는 `board`/`edit` 로 화면 키를 쪼개며 2026-08-09 의 "editor 를 별도 화면 키에서 없앴다"
결정을 되돌리려 했다(계획서 2.1 원칙 1). 채택안은 개명만 하고 화면 키를 늘리지 않으므로,
`SCREEN_ORDER` 가 `['board','drills','present','settings']` 가 돼도 이 it 은 `SCREEN_ORDER` 와
문자열 `'editor'` 만 참조해 **손대지 않은 채** 통과한다.

**재편의 어느 커밋에서든 이 it() 을 수정하거나 삭제하는 diff 가 나타나면, 그 커밋은 안 2 로
미끄러진 것이다. 갱신 대상이 아니라 판정 기준이다.**

## 5. 조사에서 계획서(0.3 후보 목록)가 틀렸다고 드러난 것

1. **`SettingsScreen.test.tsx:133-166` — 후보에서 제외해야 한다.** 줄 범위는 실재하지만
   (a)~(d) 어느 것에도 깨지지 않는다. 존 경계 슬라이더 it 2개는 기대값을 리터럴이 아닌
   `DEFAULT_ZONES.sTowRearMax` 에서 동적으로 읽도록 일부러 설계돼 있어(주석: "리터럴로 두면
   기본값을 조정할 때마다 … 빨간불"), (d)가 존 기본값을 바꿔도 살아남는다.
2. **`world.test.ts:400-406` — (d)와의 연결이 약하다.** 줄 번호는 실재하지만 해당 it
   ('휠체어만 있으면(공 없음) 즉시 true')은 휠체어 **1대**짜리라 겹침이 성립할 수 없다.
   자가 분리가 겹친 쌍에만 작용하면 안 깨지고, 매 프레임 분리 속도 주입처럼 단독 칩까지
   깨우는 구현일 때만 깨진다. (d)의 실제 위험 구역은 **727-813행 push 모드 describe** 와
   **340-375행 freeze 회귀 describe** 다(§3.1 조건부 행 참조). 계획서 1.3 의 "400-406 은 값을
   갱신" 지시도 이 판정에 맞춰 재검토가 필요하다.
3. **`EditorScreen.test.tsx` — 런타임 후보가 아니라 타입체크 후보다.** 4개 it 전부 런타임에서는
   살아남고, line 33 의 `screen: 'home'` 타입 에러만 남는다(§3.2).
4. **`BoardScreen.test.tsx:44` — 계획서 목록에 누락.** EditorScreen 과 같은 `screen: 'home'`
   패턴이 있어 (a) 타입체크 사전 등록에 추가했다(§3.2).
5. **규모 추정 "≈ 40건" 은 과대.** 실측 사전 등록은 런타임 확정 9 it, 조건부 포함 최대 12 it 이다
   (+타입체크 전용 5개 지점).
6. 경로 자체가 틀린 후보는 없었다 — 8개 파일 전부 계획서가 지목한 경로에 실재하고,
   `PresentRunner.test.tsx` 경로도 그대로 맞다.

## 6. (d) 1.3 겹친 휠체어 자가 분리 — 착수 후 재판정 (2026-08-12)

§3.1 의 조건부 (d) 3행과 §5.2 가 "1.3 착수 시 재판정" 으로 남겨 둔 것을 구현 확정 후 실측했다.
**결론: (d)로 깨진 사전 등록 테스트는 0 건이다.** `world.test.ts` 는 한 줄도 바뀌지 않았다.

구현이 고친 자리가 `world.allAtRest` 이 아니라 **`createPhysicsWorld` 가 `createLoop` 에 넘기는
정착 술어**이기 때문이다(계획서 1.3 의 "allAtRest 의 의미를 바꾸지 마라" 를 그대로 지켰다).
`world.test.ts` 는 전 구간이 `createWorld` + `Engine.update` 를 직접 도는 기전 테스트라
`createPhysicsWorld` 의 루프를 아예 지나가지 않는다.

| 사전 등록 행 | 재판정 | 근거 |
|---|---|---|
| `world.test.ts` 400-406 ('휠체어만 있으면 즉시 true') | **갱신 불필요 — 초록불 유지** | §5.2 의 지적이 맞았다. addChair 1대라 겹침이 성립하지 않고, `allAtRest` 자체를 안 건드렸다. **계획서 1.3 의 "값을 갱신하라" 지시는 폐기한다** |
| `world.test.ts` 727-813 (push 모드) | **깨지지 않음 — 초록불 유지** | 충돌 필터·static 전환을 쓰지 않는 구현이다. 자가 분리는 루프 수명만 늘린다 |
| `world.test.ts` 340-375 (freeze 회귀) | **깨지지 않음 — 초록불 유지** | freeze 경로를 건드리지 않았다. 기하 분리 폴백만 `world.freeze` 를 쓰는데 그건 상한(8초)에 닿았을 때뿐이다 |

대신 **사전 등록 목록에 없던 파일 하나를 갱신했다**: `src/test/helpers/physicsProbe.test.ts` 의
P0-1 describe. 이 파일은 0.2(하네스)의 산출물이라 0.3 기준선(`ddb699f`) 시점에 존재하지 않았고,
파일 머리말이 "1.3 이 버그를 고치면 골든값을 반드시 갱신하라" 고 스스로 예고해 둔 것이다.
갱신 범위는 골든값 3개(`framesToStop` 1→30, "정지 후 0 substep" → "두 substep 만에 2.728 → 0",
루프 생사 false→true)이고, 자기검산 describe 2개(클럭 34.7222 px / 해석적 겹침 12.5)와
"손을 떼기 직전 12.50 px 겹친 채로 isSettled()===true" 는 **손대지 않은 채 초록불**이다 —
원인(속도만 보는 판정)은 고친 뒤에도 그대로이기 때문이다.
