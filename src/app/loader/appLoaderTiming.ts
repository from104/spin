// 화면 로더의 시계 — 최소 표시 시간·사이클 길이·등장/퇴장 길이·마크 크기의 단일 출처
// (PLAN-0-6-3-LOADER-NOTICE 결정 4·8·19·21, §5 타임라인).
//
// 왜 한 파일인가: 같은 숫자가 CSS(사이클)와 TS(최소 표시 시간)로 갈리면 "로더가 반 바퀴에서
// 끊긴다" 같은 어긋남이 생기고, 고칠 때 두 곳을 찾아야 한다. 사이클 값은 여기서 나와
// `animation-duration` 인라인 스타일로 내려간다(키프레임 백분율이 정본, 길이만 변주 — 결정 21).
//
// ⚠️ 이 파일의 숫자를 다른 곳에서 다시 적지 마라. 테스트도 값을 대조하지 말고 **시계를 그만큼
// 돌리는 데만** 쓴다(§7).
//
// 결정 4 — 레일 전환 1000ms 는 **미정값**이다. lazy 가 없어 전환 로더가 덮는 실제 작업은 0 이고,
// 레일 왕복은 세션당 수십 번이라 순수 인위적 지연이다. 실기에서 1000/600/0 을 비교해 확정한다
// (§4-7). 지시대로 1000 으로 배송하되 "확정값" 으로 읽히지 않게 여기 박아 둔다.
//
// 결정 14 — React 안의 로더는 번들이 이미 파싱된 뒤 뜨므로 **부팅 1500ms 는 전부 인위적
// 시간이다.** 나중에 값을 낮출 근거가 이 한 줄이다.

/** 로더의 두 변주. 덮는 대상이 다르다: 부팅은 첫 마운트, 레일은 큰 메뉴 간 전환. */
export type AppLoaderKind = 'boot' | 'rail';

/** 최소 표시 시간(ms). 이 시간이 지나기 전에는 로더가 안 걷힌다 — 단 아무 입력이 들어오면
 *  즉시 걷힌다(결정 5). 레일 값은 미정(결정 4). */
export const APP_LOADER_MS: Record<AppLoaderKind, number> = { boot: 1500, rail: 1000 };

/** 회전 한 사이클(ms). 백분율 키프레임은 하나이고 이 값만 갈린다(결정 21).
 *  부팅 1200 에서 접촉이 790ms(65.83%), 전환 820 에서 같은 백분율이 540ms 에 온다. */
export const CYCLE_MS: Record<AppLoaderKind, number> = { boot: 1200, rail: 820 };

// ── ⚠️ 2026-09-04: `ENTER_MS`(등장 transition, boot 220 / rail 140)는 은퇴했다 ──────────
// 옛 근거(지우지 않는다): *"등장·퇴장이 keyframes 가 아니라 transition 인 이유는 결정 16 —
// 퇴장 중에 다음 전환이 들어오면 현재 opacity 값에서 되조준해야 하는데 keyframes 는 그 중단을
// 못 한다."* 그 전제가 **등장에서만** 죽었다: 이 판은 물러난 화면이 아니라 새 화면 위에 얹히는
// 덮개라, 등장 페이드 구간이 곧 덮으려던 내용이 비치는 구간이다(헤드리스 실측). 등장은 이제
// 길이 0 이고 상수가 필요 없다 — 값을 남겨 두면 아무도 안 읽는 숫자가 정본 표에 남는다.
// 되살릴 일이 생기면(예: 로더가 실제 대기를 덮게 되어 부드럽게 들어와도 되는 날) 이 두 값이
// 출발점이다. 퇴장은 그대로 `EXIT_MS` 가 진다.

/** 퇴장 transition(ms). 퇴장은 밀려나는 게 아니라 다가와서 녹는다(scale 1 → 1.06 + opacity 0)
 *  — 로더가 물러나는 것이 아니라 앱이 열리는 것으로 읽힌다(§5). */
export const EXIT_MS: Record<AppLoaderKind, number> = { boot: 200, rail: 160 };

/** 마크 크기 = `clamp(min, vmin%, max)`(§5). CSS 문자열이 아니라 수로 두는 이유:
 *  `SpinLoaderMark` 의 계약이 `sizePx: number` 라(§2) 크기 계산이 한 곳에 있어야 한다. */
export const MARK_SIZE = {
  boot: { minPx: 96, vmin: 20, maxPx: 144 },
  rail: { minPx: 72, vmin: 16, maxPx: 112 },
} as const;

/** `clamp()` 와 같은 뜻: `max(min, min(vmin 값, max))`. `viewportMinPx` 는 vmin 의 원단위
 *  (창의 짧은 변). 순수 함수라 창을 스텁하지 않고도 값을 잴 수 있다. */
export function markSizePx(kind: AppLoaderKind, viewportMinPx: number): number {
  const s = MARK_SIZE[kind];
  return Math.round(Math.min(Math.max(s.minPx, (s.vmin / 100) * viewportMinPx), s.maxPx));
}

/** 최소 표시 시간의 실효값. **0 이면 로더는 한 프레임도 존재하지 않는다**(결정 8, §0 원칙).
 *
 *  0 이 되는 두 경우:
 *  1. 감축 모션 — 지시 그대로다. 덮을 실제 로딩이 0 이므로 결과적으로 로더 부재가 옳다.
 *     판정은 호출부가 `effectiveReduceMotion`(store/editor/tween.ts)으로 이미 접어서 넘긴다
 *     — 여기서 다시 조립하면 판정이 두 벌이 된다.
 *  2. ⚠️ 테스트 환경(`MODE === 'test'`) — 기존 렌더 테스트 6개(AppShell.wiring 40여 케이스 등)를
 *     한 줄도 고치지 않기 위한 스위치다(§7). 이 스위치는 테스트가 배송 경로와 **다른 경로**를
 *     돈다는 뜻이라 사각지대를 만든다. 그 사각지대는 `appLoader.test.tsx` 가 `MODE` 를
 *     'production' 으로 덮어써서 산다 — 그 파일을 지우면 이 분기가 곧 미검증 코드가 된다. */
/** 첫 방문에 자동으로 뜨는 안내(도움말 [시작하기])를 이 환경에서 띄우는가. 위 2 와 같은
 *  스위치다 — 테스트 환경에서는 AppShell 을 그리는 렌더 테스트 20여 개가 첫 방문 상태로 돌아
 *  모달이 그 위에 서면 초점·게이트 단언이 전부 흔들린다. 같은 사각지대·같은 처방:
 *  `appLoader.test.tsx` 가 MODE 를 덮어써 이 경로를 산다(2026-09-08). */
export function firstVisitPromptsEnabled(): boolean {
  return import.meta.env?.MODE !== 'test';
}

export function loaderMinMs(kind: AppLoaderKind, reduced: boolean): number {
  if (reduced) return 0;
  if (import.meta.env?.MODE === 'test') return 0;
  return APP_LOADER_MS[kind];
}
