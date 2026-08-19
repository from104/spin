// §2.9 색 토큰·팔레트. 대비값은 전부 WCAG 상대휘도로 계산했다 (§2.8).
import type { Locale } from '../i18n/locale.ts';
export const COURT_BG = '#1f7a46'; // 다크·라이트 공통 (라이트 #2f9e5c 는 흰 라인 3.41:1
// 로 떨어지고 격자·존이 전부 무효가 되어 폐기)
/** 개체·라인의 밝은 테두리. **코트(#1f7a46) 위 4.78:1.**
 *
 *  ⚠️ 2026-08-13(6.3) 정정 — 여기에는 *"흰선/코트 5.34:1"* 이라고 적혀 있었다. 5.34 는
 *  **불투명 흰색** 기준이고, 실제로 쓰는 값은 알파 .92 라 코트 위에 합성하면 rgb(240,246,242)
 *  가 되어 **4.78:1** 이다. 바로 아래 `ARROW_CASING` 주석이 *같은 함정*(알파 .62 검정을
 *  불투명 검정 3.93 으로 적어 둔 것)을 이미 기록해 뒀는데, 흰색 쪽은 그대로 남아 있었다.
 *  기준(비텍스트 3:1)은 어느 쪽으로 세어도 넉넉히 넘으므로 **조치가 아니라 숫자 정정**이다.
 *
 *  검산: `contrastRatio(compositeOver(OBJ_STROKE, COURT_BG), COURT_BG)`.
 *  `src/test/docsMatchCode.test.ts` 가 이 줄의 숫자를 **파일에서 읽어** 그 계산과 대조한다 —
 *  숫자를 고치려면 계산이 먼저 바뀌어야 한다. */
export const OBJ_STROKE = 'rgba(255,255,255,.92)'; // 흰선/코트 4.78:1
/** 밝은 차체 위에 얹는 **어두운** 테두리(6.5). 알파를 OBJ_STROKE 와 **같은 .92** 로 둔 이유:
 *  파선의 틈으로 드러나는 코트 위 대비를 두 방향에서 같은 방식으로 계산하기 위해서다.
 *  검산(compositeOver 로 실제 합성색을 만들어 잰 값) — 코트(#1f7a46) 위 **3.75:1**(≥3 통과).
 *  불투명 #000 이면 3.93 이지만, 그러면 코트 위에서 화살표 케이싱(ARROW_CASING)과 같은 색이 되어
 *  칩 테두리와 화살표 밑선이 한 덩어리로 붙어 보인다 — 그래서 알파를 남겼다. */
export const OBJ_STROKE_DARK = 'rgba(0,0,0,.92)';
// 알파 .62 검정을 코트(#1f7a46) 위에 합성한 실제 색은 (1-.62)*코트 ≈ rgb(12,46,27) 이고
// 이 합성색 자체가 코트와 대비되는 값은 2.75:1(주석에 있던 3.93 은 불투명 검정 기준이라
// 렌더 결과와 다르다) — §7.1 이 요구하는 3.93 을 채우려면 알파를 버리고 불투명 #000 을 써야
// 한다. 검산: 불투명 #000 vs #1f7a46 = 3.93:1.
export const ARROW_CASING = '#000000'; // 검정(불투명)/코트 3.93:1 — 화살표 대비 확보

/** 드릴 유형(v8, model/drill.ts DRILL_TYPES) 배지·점 색. **키가 string 인 이유**: core 는
 *  model 을 import 할 수 없다(의존 방향 §9 — 아래 ARROW_COLORS 주석과 같은 사정). 닫힌 검증은
 *  model/validate.ts 몫이고 여기는 색만 준다 — 모르는 키(옛 세션 캐시의 한국어 category 등)는
 *  fallback 회색이다.
 *  색값 5종은 v7 까지의 카테고리 팔레트를 그대로 물려받았다(전부 대비 검증을 거친 값 —
 *  '#0f7a51' 은 흰 글자 4.5:1 미달로 명도를 낮춘 이력이 있는 그 색이다). */
export const DRILL_TYPE_COLORS: Record<string, string> = {
  technical: '#e08a12',
  tactical: '#1f6bb8',
  'set-piece': '#7c5cd6',
  'game-scenario': '#d93a3a',
  conditioning: '#0f7a51',
};
export const TYPE_FALLBACK_COLOR = '#6b7280';
export const drillTypeColor = (t: string): string => DRILL_TYPE_COLORS[t] ?? TYPE_FALLBACK_COLOR;

/** 팀 색 선택지. 프로토타입의 #2b7fd4 는 흰 글자 대비 4.13:1 로 등번호가 읽히지 않아
 *  #1f6bb8 (5.45:1) 로 교체했다. 나머지 3색은 프로토타입 그대로. */
export const TEAM_COLOR_CHOICES = ['#d93a3a', '#1f6bb8', '#e08a12', '#7c5cd6'] as const;
/** 팀 색의 한국어 이름 — 색 스와치 `aria-label` 용. hex 문자열을 그대로 라벨로 내걸면
 *  스크린리더가 '빨강' 대신 "#d93a3a" 를 낱글자로 읽는다(2026-08-14 선행 수리, 설계서 §7 표).
 *  키를 TEAM_COLOR_CHOICES 원소 유니언으로 못박아 선택지에 색을 추가하면 tsc 가 먼저
 *  이름을 요구한다. SettingsScreen.tsx 의 COLOR_NAMES 와 같은 이름을 쓴다(빨강·파랑·주황·보라). */
// i18n C3 — 로케일 차원이 붙었다(전에는 한국어 고정). 유일한 소비처(SettingsScreen)가
// [locale] 로 인덱싱한다.
export const TEAM_COLOR_NAMES: Record<Locale, Record<(typeof TEAM_COLOR_CHOICES)[number], string>> = {
  ko: { '#d93a3a': '빨강', '#1f6bb8': '파랑', '#e08a12': '주황', '#7c5cd6': '보라' },
  en: { '#d93a3a': 'Red', '#1f6bb8': 'Blue', '#e08a12': 'Orange', '#7c5cd6': 'Purple' },
  ja: { '#d93a3a': '赤', '#1f6bb8': '青', '#e08a12': 'オレンジ', '#7c5cd6': '紫' },
};
export const GK_HOME_COLOR = '#f2c811'; // 어두운 잉크 10.51:1
export const GK_AWAY_COLOR = '#22a95b'; // 어두운 잉크 5.56:1 (흰 글자였으면 3.05:1 실패)
export const BALL_FILL = '#fbbf24';
/** §4.3 P1-5 메모 = 종이 쪽지. '종이'가 어두운 쪽인 것은 글자색 기본이 흰색이기 때문이다
 *  (§3.5 NoteLabel 스키마) — 밝은 종이로 만들면 기본 메모의 글자가 통째로 사라진다.
 *  불투명으로 둔 근거는 ARROW_CASING 과 같다: 알파를 코트(#1f7a46) 위에 합성하면 실제 대비가
 *  주석의 숫자와 달라진다. 검산 — 흰 글자/#0f1a14 = 17.9:1, 칩/코트 = 3.31:1(§7.1 비텍스트 3:1). */
export const NOTE_FILL = '#0f1a14';
/** 접힌 모서리. 칩보다 밝아 '접혔다'가 읽힌다(장식이라 3:1 요건 대상이 아니다). */
export const NOTE_FOLD_FILL = '#2a3a30';
/** 빈 메모의 플레이스홀더 글자. 칩 위 5.8:1 — 흐리지만 읽힌다. */
export const NOTE_PLACEHOLDER_FILL = 'rgba(255,255,255,.62)';
/** 훈련 콘 2색(기현 지시 2026-08-11: 주황·파랑). 슬롯 0, 1.
 *  파랑은 원정팀(#1f6bb8)·이동 화살표(#38bdf8)와 겹치지 않게 고른 값이다.
 *  주황과의 이색각 분리도 확인했다(적색맹 0.84 · 녹색맹 0.95 — 콘 구분 임계 0.25). */
export const CONE_COLORS = ['#ff6b1a', '#2563eb'] as const;
/** 화살표 색 3단 — 굽힘점(ctrl)을 거듭 누르면 이 순서로 돈다(기현 지시 2026-08-17.
 *  순환 규칙과 색값의 근거는 `model/arrow.ts` 의 `ARROW_COLOR_CYCLE`).
 *
 *  ⚠️ **값이 왜 core 에 있고 model 에 없나**: 썸네일이 `CONE_COLORS`·`TEAM_COLOR_CHOICES` 와
 *  똑같이 **색이 아니라 이 배열의 첨자를 저장하기** 때문이다(`model/thumb.ts` — "색을 굽지
 *  않는다"). 첨자를 푸는 쪽이 `render/CourtThumbnail.tsx` 인데, 옛 구조에서는 core 가 model 을
 *  import 할 수 없어(의존 방향 §9) 기본색 리터럴이 core·model 두 곳에 적혀 있었다. 이제
 *  model 이 여기를 읽으므로 리터럴은 **한 곳뿐**이다 — 색을 고치면 저장된 썸네일까지 따라온다.
 *  ⚠️ 첫 값은 기본색이다. 이 순서를 바꾸면 이미 저장된 썸네일의 첨자가 다른 색을 가리킨다. */
export const ARROW_COLORS = ['#38bdf8', '#fde047', '#ef4444'] as const;
/** 기본 화살표 색 = 순환의 첫 값. `model` 의 `ARROW_STYLE.color` 가 이것을 그대로 쓴다. */
export const ARROW_COLOR: string = ARROW_COLORS[0];

const srgb = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function relLuminance(hex: string): number {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => srgb(parseInt(x, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** ⚠️ 밝기 뒤집기의 **유일한 임계**. 글자(inkFor)와 테두리(strokeFor)가 같은 자리에서 뒤집혀야
 *  한 칩 안에서 "밝은 차체 = 어두운 잉크·어두운 선" 이 어긋나지 않는다. 리터럴로 갈라 놓으면
 *  둘 중 하나만 뒤집히는 색 구간이 생긴다(#22a95b L .295 가 바로 그 구간이었다 — 글자는 이미
 *  어두웠는데 테두리만 흰색이라 2.80:1 이었다). */
export const OBJ_INK_L = 0.25;
/** 배경색 위에 얹을 글자색. 임계 0.25 는 팔레트 전체가 ≥4.5:1 을 만족하도록 정한 값.
 *  검산: #d93a3a(L .181)→흰 4.55 / #1f6bb8(.143)→흰 5.45 / #7c5cd6(.168)→흰 4.82
 *       #e08a12(.341)→어둠 6.30 / #f2c811(.602)→어둠 10.51 / #22a95b(.295)→어둠 5.56 */
export const inkFor = (fill: string): string => (relLuminance(fill) > OBJ_INK_L ? '#14200a' : '#ffffff');
/** ★ 6.5 — 개체 테두리색도 **차체 밝기로 뒤집는다**. inkFor 와 같은 임계·같은 방향이다.
 *
 *  ── 무엇이 잘못돼 있었나 (5차 검증관 실측, 2026-08-13) ──────────────────────────────
 *  4.6 은 팀 구분을 색 밖으로 빼면서 상대팀 차체에 **파선 테두리**를 둘렀다. 그런데 그 선 색이
 *  OBJ_STROKE(흰 α.92) **고정**이라, 밝은 차체에서는 선과 면의 대비가 3:1 아래로 내려가
 *  **파선을 그렸는데 그 파선이 안 보이는** 상태였다. 차체 위 대비 실측:
 *    #d93a3a 4.06 · #1f6bb8 4.88 · #7c5cd6 4.36 · **#e08a12 2.50** · **#22a95b 2.80** · **#f2c811 1.55**
 *  #22a95b 는 `DEFAULT_TEAMS.away.gkColor` 라 **기본 설정에서 이미** 발생했다. 즉 4.6 의 주
 *  채널이 기본값에서 절반만 작동하고 있었다.
 *
 *  ── 뒤집은 뒤 (같은 계산) ───────────────────────────────────────────────────────────
 *    #d93a3a 4.06 · #1f6bb8 4.88 · #7c5cd6 4.36 · #e08a12 **7.28** · #22a95b **6.44** · #f2c811 **11.84**
 *  임계 .25 는 **RGB 큐브 전수 탐색**(16,777,216색)으로 확인한 값이다: 이 임계에서 최솟값이
 *  3.084:1(#f80bd5 부근)로 3:1 을 넘고, .28 로 올리면 2.82 로 깨진다. 즉 §3.5 개별 색 지정이
 *  어떤 색을 넣어도 테두리가 보인다. ⚠️ 이 값을 올리지 마라(teamMarkContrast.test.tsx 가 잰다). */
export const strokeFor = (fill: string): string => (relLuminance(fill) > OBJ_INK_L ? OBJ_STROKE_DARK : OBJ_STROKE);

/** 잠긴 개체를 덮는 보라(2026-08-14 기현 지시, 실측 뒤 붉은 테두리에서 바뀜).
 *
 *  ⚠️ 팀 색 팔레트에 보라(#7c5cd6)가 **이미 있다.** 그것과 갈리도록 채도를 훨씬 높이고
 *  명도를 낮췄다 — #7c5cd6 은 밝은 라벤더(L≈52)이고 이쪽은 진한 바이올렛(L≈40)이다.
 *  코트(#1f7a46) 위에 42% 로 합성하면 #4a4a7a 근처가 되어, 초록 위에서 "덮였다" 가
 *  한눈에 읽힌다. 액센트(라임 #c2f74e)와는 색상환 반대편이라 선택 표시와도 안 섞인다. */
export const LOCK_TINT_COLOR = '#7b1fd4';
/** 덮개 불투명도. 개체가 **무엇인지는 여전히 보여야** 하므로(등번호·색·모양) 반투명이다.
 *  0.42 는 등번호 흰 글자가 덮개 아래에서도 4.5:1 을 넘는 상한이다. */
export const LOCK_TINT_OPACITY = 0.42;
