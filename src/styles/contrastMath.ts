// §5.6 — 대비 계산 순수 함수. `relLuminance` 는 core/colors.ts 의 것을 그대로 쓴다(팔레트를
// 정하는 계산과 그것을 검증하는 계산이 갈라지면 검증이 무의미해진다).
//
// 여기 있는 세 함수는 전부 **테스트가 단언할 수 있는 성질**을 코드로 옮긴 것이다. 특히
// `dashChannelVisible` 은 이 항목의 핵심 판단(강제색에서 판을 제외할 것인가)을 참/거짓으로
// 만들어 준다 — 그 판단을 산문으로만 남기면 되돌려도 아무 테스트가 빨개지지 않는다.
import { relLuminance } from '../core/colors.ts';

/** WCAG 대비율. 1(같은 색) ~ 21(흑백). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const hex2 = (n: number): string => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** `rgba(r,g,b,a)` / `#rrggbb` 를 불투명 배경 위에 합성한 **실제 화면색**.
 *  ⚠️ 알파를 무시하고 대비를 계산하면 숫자가 실물과 달라진다 — colors.ts 의 ARROW_CASING 주석이
 *  같은 함정을 기록해 두었다(알파 .62 검정의 실제 대비는 3.93 이 아니라 2.75 였다). */
export function compositeOver(color: string, bgHex: string): string {
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color.trim());
  if (!m) return color; // 이미 불투명 hex
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const bg = (bgHex.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
  const fg = [Number(m[1]), Number(m[2]), Number(m[3])];
  return '#' + [0, 1, 2].map((i) => hex2(a * fg[i]! + (1 - a) * (bg[i] ?? 0))).join('');
}

/** 비텍스트 대비 하한(WCAG 2.2 SC 1.4.11). 팀 표식·코트 라인은 전부 이 기준으로 잰다. */
export const NON_TEXT_MIN = 3;

/** ★ 이 항목의 판단을 참/거짓으로 만든 함수.
 *
 *  4.6 이 만든 "상대팀 = 파선 테두리" 채널은 **테두리 색이 채움 색과 대비될 때에만** 존재한다.
 *  파선은 "선이 있는 곳"과 "없는 곳"을 번갈아 보여 주는 표식인데, 선 색과 그 아래 면 색이 같으면
 *  있는 곳과 없는 곳이 **같은 색**이 되어 무늬가 통째로 사라진다 — 마크업에는 `stroke-dasharray`
 *  가 그대로 남아 있으므로 **마크업 단언만으로는 이 소실이 잡히지 않는다.**
 *
 *  강제색 모드가 SVG 의 fill·stroke 를 함께 시스템 색으로 치환하면 정확히 그 상태가 된다
 *  (fill=CanvasText, stroke=CanvasText). 그래서 판은 강제색에서 제외해야 한다 — 근거는
 *  contrast.css ① 블록. */
export function dashChannelVisible(fill: string, stroke: string, dash?: string): boolean {
  if (dash === undefined || dash === '' || dash === 'none') return false;
  const fillHex = compositeOver(fill, '#ffffff');
  const strokeHex = compositeOver(stroke, fillHex);
  return contrastRatio(strokeHex, fillHex) >= NON_TEXT_MIN;
}
