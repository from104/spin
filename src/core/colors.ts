// §2.9 색 토큰·팔레트. 대비값은 전부 WCAG 상대휘도로 계산했다 (§2.8).
export const COURT_BG = '#1f7a46'; // 다크·라이트 공통 (라이트 #2f9e5c 는 흰 라인 3.41:1
// 로 떨어지고 격자·존이 전부 무효가 되어 폐기)
export const OBJ_STROKE = 'rgba(255,255,255,.92)'; // 흰선/코트 5.34:1
// 알파 .62 검정을 코트(#1f7a46) 위에 합성한 실제 색은 (1-.62)*코트 ≈ rgb(12,46,27) 이고
// 이 합성색 자체가 코트와 대비되는 값은 2.75:1(주석에 있던 3.93 은 불투명 검정 기준이라
// 렌더 결과와 다르다) — §7.1 이 요구하는 3.93 을 채우려면 알파를 버리고 불투명 #000 을 써야
// 한다. 검산: 불투명 #000 vs #1f7a46 = 3.93:1.
export const ARROW_CASING = '#000000'; // 검정(불투명)/코트 3.93:1 — 화살표 대비 확보

export const CATEGORY_COLORS: Record<string, string> = {
  '공격': '#d93a3a',
  '수비': '#1f6bb8',
  '슈팅': '#e08a12',
  '세트피스': '#7c5cd6',
  // 프로토타입의 #128a5c 는 흰 글자 대비 4.36:1 로, 10.5px 굵은 글씨인 카테고리 배지에서
  // AA(4.5:1)에 못 미친다. 색상을 유지한 채 명도만 낮춰 5.35:1 확보.
  '볼 운반': '#0f7a51',
};
export const CATEGORY_FALLBACK_COLOR = '#6b7280';
export const categoryColor = (c: string): string => CATEGORY_COLORS[c] ?? CATEGORY_FALLBACK_COLOR;
export const KNOWN_CATEGORIES = ['공격', '수비', '슈팅', '세트피스', '볼 운반'] as const;

/** 팀 색 선택지. 프로토타입의 #2b7fd4 는 흰 글자 대비 4.13:1 로 등번호가 읽히지 않아
 *  #1f6bb8 (5.45:1) 로 교체했다. 나머지 3색은 프로토타입 그대로. */
export const TEAM_COLOR_CHOICES = ['#d93a3a', '#1f6bb8', '#e08a12', '#7c5cd6'] as const;
export const GK_HOME_COLOR = '#f2c811'; // 어두운 잉크 10.51:1
export const GK_AWAY_COLOR = '#22a95b'; // 어두운 잉크 5.56:1 (흰 글자였으면 3.05:1 실패)
export const BALL_FILL = '#fbbf24';
/** 훈련 콘 2색(기현 지시 2026-08-11: 주황·파랑). 슬롯 0, 1.
 *  파랑은 원정팀(#1f6bb8)·이동 화살표(#38bdf8)와 겹치지 않게 고른 값이다.
 *  주황과의 이색각 분리도 확인했다(적색맹 0.84 · 녹색맹 0.95 — 콘 구분 임계 0.25). */
export const CONE_COLORS = ['#ff6b1a', '#2563eb'] as const;
export const ARROW_COLORS = { move: '#38bdf8', pass: '#fbbf24', shot: '#fbbf24' } as const;

const srgb = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function relLuminance(hex: string): number {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => srgb(parseInt(x, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** 배경색 위에 얹을 글자색. 임계 0.25 는 팔레트 전체가 ≥4.5:1 을 만족하도록 정한 값.
 *  검산: #d93a3a(L .181)→흰 4.55 / #1f6bb8(.143)→흰 5.45 / #7c5cd6(.168)→흰 4.82
 *       #e08a12(.341)→어둠 6.30 / #f2c811(.602)→어둠 10.51 / #22a95b(.295)→어둠 5.56 */
export const inkFor = (fill: string): string => (relLuminance(fill) > 0.25 ? '#14200a' : '#ffffff');
