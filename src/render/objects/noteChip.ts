// §4.3 P1-5 "메모 = 종이 쪽지" 의 **기하**. 컴포넌트(NoteLabel.tsx)에서 떼어 둔 이유는 두 가지다:
// ① 순수 함수라 컴포넌트를 마운트하지 않고 잴 수 있다, ② 컴포넌트 파일에 컴포넌트 아닌 export 를
// 두면 Fast Refresh 가 깨진다(oxlint `react(only-export-components)`).
//
// 숫자의 출처는 전부 `core/constants.ts` 의 `NOTE` 다 — 히트 반경(physics/hitTest.ts)·선택 링
// (render/SelectionOverlay.tsx)과 같은 곳에서 와야 "보이는데 안 잡힌다" 가 다시 생기지 않는다.
//
// ── 줄바꿈 (기현 지시 2026-08-17) ──────────────────────────────────────────────────────
// *"메모 표시나 편집에 줄바꿈 가능하게"*. 그래서 이 파일이 **글을 줄로 쪼개는 곳**이 됐다.
// 쪼개는 규칙이 한 곳이어야 하는 이유는 폭·높이·히트 상자·인쇄·내보내기가 **같은 줄 나눔**을
// 봐야 하기 때문이다. 다섯 곳이 각자 `split('\n')` 하면 화면과 인쇄가 다른 줄 수를 그린다.
//
// 접는 것(자동 줄바꿈)까지 여기서 하는 이유는 안전이다. 예전에는 600자를 한 줄로 쓰면 칩이
// 8000 px 로 늘어 코트를 덮었고 — 그때는 픽 원이 22 px 로 캡돼 있어 "안 잡히는" 쪽으로만
// 틀렸다 — 이제 히트가 칩 상자를 쓰므로 그 칩이 코트의 모든 탭을 삼킨다. 상한
// (`NOTE.chipMaxWPx` · `NOTE.maxLines`)이 그 두 재앙을 함께 막는다.
import { NOTE } from '../../core/constants.ts';
import { SUPPORTED_LOCALES, type Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';

/** 빈 메모에 얹는 흐린 안내. "여기 쪽지가 놓였고, 글은 아직 없다" 를 뜻한다.
 *  인라인 편집은 만들지 않는다 — SVG 위 HTML 오버레이는 §6.4 판 회전과 좌표 변환을 둘 다
 *  따라가야 해서 비싸다. 글은 **모달**에서 쓴다(NoteEditModal: 배치 직후 · 더블클릭 ·
 *  개체 메뉴의 [수정]). 인스펙터의 [개체] 탭에도 같은 입력이 남아 있다. */
export const NOTE_PLACEHOLDER: Record<Locale, string> = Object.fromEntries(
  SUPPORTED_LOCALES.map((l) => [l, translate(l, 'noteChip.placeholder')]),
) as Record<Locale, string>;

/** §3.5 NoteLabel 스키마 `size` 의 기본값. 여기저기 박혀 있던 `n.size ?? 14` 의 그 14 다 —
 *  칩 크기를 재는 쪽(히트테스트·인쇄·내보내기)이 렌더와 **같은 기본값**을 써야 한다. */
export const NOTE_DEFAULT_SIZE_PX = 14;

/** 잘려서 안 보이는 줄이 있음을 알리는 꼬리. 글을 **버리는 것이 아니다** — 모달을 열면
 *  전문이 그대로 있다. 이 한 글자가 "여기서 끝이 아니다" 를 말한다. */
const ELLIPSIS = '…';

/** 한글·전각 글자. 폭 어림에서 1 em 으로 세는 범위다(한글 자모·완성형·CJK·전각 기호). */
const WIDE_CHAR = /[ᄀ-ᇿ⺀-꓏ꥠ-꥿가-퟿豈-﫿︰-﹏＀-｠￠-￦]/;

/** 글자 하나의 폭 어림(월드 px). 실측하지 않는 이유는 `noteChipWidthPx` 머리말과 같다. */
function charWidthPx(ch: string, size: number): number {
  return WIDE_CHAR.test(ch) ? size : size * 0.55;
}

/** 한 줄의 폭 어림(월드 px). */
function lineWidthPx(line: string, size: number): number {
  let w = 0;
  for (const ch of line) w += charWidthPx(ch, size);
  return w;
}

/** 글자가 들어갈 수 있는 최대 폭 — 칩 상한에서 좌우 여백을 뺀 값. */
function textMaxWidthPx(): number {
  return NOTE.chipMaxWPx - NOTE.chipPadXPx * 2;
}

/** 한 줄을 폭 상한에 맞춰 접는다. **띄어쓰기를 우선 끊고**, 한 낱말이 통째로 넘치면
 *  글자 단위로 끊는다 — 한국어는 띄어쓰기가 드물어 글자 끊기가 정상 경로다. */
function wrapLine(line: string, size: number, maxW: number): string[] {
  if (lineWidthPx(line, size) <= maxW) return [line];
  const out: string[] = [];
  let cur = '';
  let curW = 0;
  /** 마지막으로 지나온 띄어쓰기 자리(cur 안의 인덱스). 없으면 −1. */
  let lastSpace = -1;
  for (const ch of line) {
    const w = charWidthPx(ch, size);
    if (curW + w > maxW && cur.length > 0) {
      // 낱말 중간이면 직전 띄어쓰기까지만 내보내고 나머지는 다음 줄로 넘긴다.
      if (lastSpace > 0 && lastSpace < cur.length - 1) {
        out.push(cur.slice(0, lastSpace));
        cur = cur.slice(lastSpace + 1);
        curW = lineWidthPx(cur, size);
      } else {
        out.push(cur);
        cur = '';
        curW = 0;
      }
      lastSpace = -1;
    }
    if (ch === ' ') lastSpace = cur.length;
    cur += ch;
    curW += w;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** 화면에 그릴 **줄들**. 빈 글은 빈 배열이다(플레이스홀더는 호출부가 얹는다).
 *
 *  ⚠️ 여기서 나온 배열이 폭·높이·히트 상자·인쇄·내보내기의 유일한 출처다.
 *  `text.split('\n')` 을 다른 데서 다시 하지 말 것 — 접기와 줄 수 상한이 빠진다. */
export function noteLines(text: string, size: number): string[] {
  if (text.length === 0) return [];
  const maxW = textMaxWidthPx();
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    for (const line of wrapLine(raw, size, maxW)) out.push(line);
  }
  if (out.length <= NOTE.maxLines) return out;
  const shown = out.slice(0, NOTE.maxLines);
  shown[NOTE.maxLines - 1] = `${shown[NOTE.maxLines - 1]!}${ELLIPSIS}`;
  return shown;
}

/** 칩의 가로 크기(월드 px). 가장 긴 줄이 정한다. 빈 메모는 정확히 `NOTE.chipMinWPx` 다.
 *
 *  왜 실측하지 않는가: `getComputedTextLength()` 는 레이아웃 왕복이라 렌더마다 부르면 §6.1 이
 *  막는 비용이 생기고, 마운트 **전에는** 값 자체가 없어 첫 페인트에 칩이 헛크기로 뜬다.
 *  그래서 넉넉한 쪽으로 어림한다 — 좁게 어림하면 글이 칩 밖으로 새고, 넓게 어림하면 여백만
 *  조금 늘어난다. */
export function noteChipWidthPx(text: string, size: number): number {
  let w = 0;
  for (const line of noteLines(text, size)) w = Math.max(w, lineWidthPx(line, size));
  return Math.max(NOTE.chipMinWPx, Math.min(w + NOTE.chipPadXPx * 2, NOTE.chipMaxWPx));
}

/** 칩의 세로 크기(월드 px). **한 줄이면 정확히 `NOTE.chipHPx`** 라, 줄바꿈이 없는 메모는
 *  2026-08-17 이전과 한 픽셀도 다르지 않다. 줄이 하나 늘 때마다 `NOTE.lineHPx` 만큼 자란다. */
export function noteChipHeightPx(text: string, size: number): number {
  const n = noteLines(text, size).length;
  return NOTE.chipHPx + Math.max(0, n - 1) * NOTE.lineHPx;
}

/** i 번째 줄의 세로 오프셋(칩 중심 기준). 줄 뭉치는 칩 한가운데 놓인다 — 앵커가 곧 칩의
 *  중심이라(§3.5 좌표는 점 하나) 위로도 아래로도 똑같이 자라야 자리가 안 튄다. */
export function noteLineDy(index: number, count: number): number {
  return (index - (count - 1) / 2) * NOTE.lineHPx;
}

/** 선택 링·잠김 덮개의 반지름. 칩을 통째로 감싸는 원이되 빈 칩에서는 예전 값(22) 그대로다.
 *  링이 원인 이유: 링은 `upright` **밖**에 있어 판을 돌려도 안 돌아간다(§6.4) — 사각형이면
 *  판이 돌 때 칩과 어긋난다. */
export function noteRingRadiusPx(text: string, size: number): number {
  const halfW = noteChipWidthPx(text, size) / 2;
  const halfH = noteChipHeightPx(text, size) / 2;
  return Math.max(NOTE.ringRadiusPx, Math.hypot(halfW, halfH) + 2);
}

/** 오른쪽 위 모서리를 잘라낸 쪽지 본체. */
export function noteChipPathD(halfW: number, halfH: number): string {
  const f = NOTE.foldPx;
  return `M${-halfW},${-halfH} H${halfW - f} L${halfW},${-halfH + f} V${halfH} H${-halfW} Z`;
}

/** 잘라낸 자리에 얹는 접힘 삼각형 — 이것이 "쪽지" 를 읽히게 하는 유일한 형태 신호다. */
export function noteFoldPathD(halfW: number, halfH: number): string {
  const f = NOTE.foldPx;
  return `M${halfW - f},${-halfH} L${halfW},${-halfH + f} H${halfW - f} Z`;
}
