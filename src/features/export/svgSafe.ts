// §6.2 PNG — 내보낸 SVG 문자열에 **모델에서 온 문자열이 그대로 실리는 두 자리**를 좁힌다.
//
// 왜 필요한가: `validate.ts` 는 색을 `typeof raw.color === 'string'` 으로만 받는다(:168, :237,
// :254, :292). 즉 남이 보낸 드릴 파일의 색이 `#fff" onload="…` 여도 모델에는 그대로 들어온다.
// 화면 렌더는 React 가 속성값을 이스케이프하니 문제가 없었지만, 여기서는 **우리가 문자열을
// 손으로 잇는다** — 이스케이프 없이 이으면 내보낸 SVG 가 통째로 다른 문서가 된다.
//
// 글자(제목·메모·등번호)는 애초에 SVG 에 들어가지 않으므로(§6.2 [A-9] 텍스트는 캔버스가
// 그린다) 여기서 막아야 할 것은 **색과 id 둘뿐**이다. 그게 A-9 의 부수 이득이다.

/** 색으로 받아 줄 형태. `#rgb`~`#rrggbbaa` · `rgb()/rgba()` 숫자꼴 · 순수 알파벳 이름. */
const COLOR_HEX = /^#[0-9a-fA-F]{3,8}$/;
const COLOR_FUNC = /^rgba?\(\s*[\d.,%\s/]+\)$/;
const COLOR_NAME = /^[a-zA-Z]{3,20}$/;

/** 수상한 색은 조용히 기본값으로 바꾼다. **던지지 않는다** — 코치가 내보내기를 눌렀는데
 *  예외로 아무 그림도 안 나오는 것보다, 색 하나가 기본값인 그림이 낫다. */
export function safeColor(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const v = value.trim();
  if (COLOR_HEX.test(v) || COLOR_FUNC.test(v) || COLOR_NAME.test(v)) return v;
  return fallback;
}

/** id 속성에 실을 수 있는 문자만 남긴다(§3.1 실제 id 는 `ch_` + base36 이라 원형 그대로 남는다).
 *  파일에서 온 이상한 id 는 잘려 나갈 뿐 SVG 구조를 깨지 못한다. */
export function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '');
}

/** 좌표·굵기를 문자열로. NaN/Infinity 는 **속성 자체를 무효로 만들어** 그 개체가 통째로
 *  안 보이게 되므로 0 으로 접는다 — 물리에서 NaN 이 새어 나온 적이 있다(world.test.ts). */
export function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}
