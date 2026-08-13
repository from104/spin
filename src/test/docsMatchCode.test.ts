// 6.3 — **문서가 사실인지 확인하는 테스트.**
//
// 이 저장소는 *"주석이 사실인지 확인하는 테스트가 없으면 주석은 언젠가 거짓이 된다"* 를 이미
// 겪었다(2026-08-11: 파일 상단에 '좌표 출처는 COURT_DEFS 하나뿐' 이라 적혀 있었지만 외곽선·
// 센터서클이 리터럴이라, 마진을 넓히자 골대가 선 밖으로 나갔다). 같은 일이 **문서 단위**로
// 일어난 것이 6.3 이 닫는 드리프트다: `REQUIREMENTS.md` 는 재편 내내 아무 테스트도 읽지 않는
// 파일이었고, 그래서 viewBox(800×500)·공 개수(10)·화면 수(5)가 **전부 거짓인 채로 2442개가
// 초록불**이었다.
//
// 그래서 이 파일은 `docs/REQUIREMENTS.md` 를 **텍스트로 읽어** 코드 상수와 대조한다.
// 양방향으로 빨개진다 — 코드를 바꾸고 문서를 안 고쳐도, 문서를 잘못 고쳐도 빨갛다.
//
// ⚠️ 여기에 **손으로 적은 숫자를 넣지 마라.** 기대값은 전부 `courtDefFor`/`BALL`/`CONE`/
//    `LIMITS`/`SCREEN_ORDER` 에서 파생시킨다. 손-숫자를 넣는 순간 이 파일 자체가 다음번
//    드리프트의 발원지가 된다(그것이 `defaults.test.ts:45` 에서 실제로 일어난 일이다).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALL, CONE } from '../core/constants.ts';
import { COURT_BG, OBJ_STROKE } from '../core/colors.ts';
import { compositeOver, contrastRatio } from '../styles/contrastMath.ts';
import { PX_PER_M } from '../core/units.ts';
import { COURT_SIZES, COURT_DEFS, courtDefFor } from '../model/court.ts';
import { LIMITS } from '../model/validate.ts';
import { RAIL_ITEMS, SCREEN_ORDER, SCREEN_NAV_LABELS } from '../app/screens.ts';

const DOC = readFileSync('docs/REQUIREMENTS.md', 'utf-8');

/** `## <제목>` 부터 **다음 `## `** 직전까지. 못 찾으면 빈 문자열이다 —
 *  파일 끝까지 돌려주면 (cssContract.ts 머리말이 적어 둔 그 고장) 절 밖의 문장이 절 안의
 *  단언을 통과시킨다. 특히 이 문서는 머리에 '정정 이력' 표가 있어서 **옛 숫자를 인용**한다:
 *  절을 안 자르면 "옛 값이 §3 에 없다" 단언이 그 인용문 때문에 영영 빨갛다. */
export function sectionOf(md: string, heading: string): string {
  const head = `\n## ${heading}`;
  const at = md.indexOf(head);
  if (at < 0) return '';
  const from = at + head.length;
  const next = md.indexOf('\n## ', from);
  return next < 0 ? md.slice(from) : md.slice(from, next);
}

/** 문서 표기 규약: 소수점 둘째 자리까지 반올림한 뒤 **꼬리 0 을 턴다**(750 → `750`,
 *  37.5 → `37.5`, 116.666… → `116.67`). 문서에 사람이 적는 모양 그대로다. */
const num = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');

describe('sectionOf — 파서 자체의 대조군', () => {
  it('없는 절은 빈 문자열이다 (파일 전체를 돌려주지 않는다)', () => {
    expect(sectionOf(DOC, '없는 절 제목입니다')).toBe('');
  });

  it('절은 다음 `## ` 앞에서 끊긴다', () => {
    const s3 = sectionOf(DOC, '3. 코트 규격');
    expect(s3.length).toBeGreaterThan(200);
    expect(s3).toContain('viewBox');
    expect(s3).not.toContain('4.2 휠체어 회전축'); // 다음 절로 새지 않는다
  });
});

describe('§3 코트 규격 표 = COURT_DEFS', () => {
  const S = sectionOf(DOC, '3. 코트 규격');

  it.each(COURT_SIZES)('풀 코트 %s 의 viewBox·경기면이 courtDefFor 와 같다', (size) => {
    const d = courtDefFor('full', size);
    const [lengthM, widthM] = size.split('x').map(Number) as [number, number];
    expect(S).toContain(`| ${lengthM} × ${widthM} m |`);
    expect(S).toContain(`\`0 0 ${d.vbW} ${d.vbH}\``);
    const { x, y, w, h } = d.surface;
    expect(S).toContain(`x ${num(x)}..${num(x + w)}, y ${num(y)}..${num(y + h)} (${num(w)} × ${num(h)})`);
  });

  it('하프 코트의 viewBox·경기면', () => {
    const d = COURT_DEFS.half;
    expect(S).toContain(`\`0 0 ${d.vbW} ${d.vbH}\``);
    const { x, y, w, h } = d.surface;
    expect(S).toContain(`x ${num(x)}..${num(x + w)}, y ${num(y)}..${num(y + h)} (${num(w)} × ${num(h)})`);
  });

  it('플랫 코트의 viewBox 는 하프와 같다 (D12)', () => {
    expect(COURT_DEFS.flat.vbW).toBe(COURT_DEFS.half.vbW);
    expect(COURT_DEFS.flat.vbH).toBe(COURT_DEFS.half.vbH);
    expect(S).toContain(`\`0 0 ${COURT_DEFS.flat.vbW} ${COURT_DEFS.flat.vbH}\``);
  });

  it('마진은 문서와 코드가 같은 값이다', () => {
    const marginPx = COURT_DEFS.full.surface.x;
    expect(S).toContain(`마진은 ${marginPx / PX_PER_M} m(${num(marginPx)} px)`);
  });

  it('⚠️ 옛 값(마진 1.0 m 시절)은 이 절에 남아 있지 않다', () => {
    // 대조군: 이 두 문자열은 '정정 이력' 표에는 **있다**. 절을 안 자르면 이 단언이 무의미해진다.
    expect(DOC).toContain('`0 0 800 500`');
    expect(S).not.toContain('0 0 800 500');
    expect(S).not.toContain('0 0 500 425');
  });

  it('센터 서클이 삭제됐다는 사실이 코드와 문서 양쪽에 있다', () => {
    // 코드: 풀 코트에는 centerMark("X")만 있고 원은 없다. 하프에는 그것조차 없다
    // (하프라인을 그리지 않는 판이라 X 를 찍으면 코치가 코트 가장자리를 센터로 읽는다).
    // '어느 판에도 센터 서클의 자리가 없다' 는 courtMarks.test.ts 가 따로 지킨다 —
    // 여기서 재는 것은 **문서가 그 사실을 말하는가** 뿐이다.
    expect(COURT_DEFS.full.centerMark).not.toBeNull();
    expect(COURT_DEFS.half.centerMark).toBeNull();
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    expect(S).toContain('센터 서클은 없다');
  });
});

describe('§4.1 개체 수량 표 = constants / LIMITS', () => {
  const S = sectionOf(DOC, '4. 물리 · 조작 요구사항 (핵심)');

  it('공 상한은 BALL.maxCount 다', () => {
    expect(S).toContain(`| **최대 ${BALL.maxCount}개** |`);
  });

  it('콘 상한은 색상별 CONE.maxCountPerColor, 합은 그 두 배다', () => {
    expect(S).toContain(`**색상별 ${CONE.maxCountPerColor}개**`);
    expect(S).toContain(`코트 위 최대 ${CONE.maxCountPerColor * 2}`);
  });

  it('화살표·메모·스텝 상한은 LIMITS 다', () => {
    expect(S).toContain(`스텝당 최대 ${LIMITS.maxArrowsPerStep}`);
    expect(S).toContain(`스텝당 최대 ${LIMITS.maxNotesPerStep}`);
    expect(S).toContain(`드릴당 최대 ${LIMITS.maxSteps}`);
  });

  it('LIMITS 가 UI 상한이 아니라 파일 방어 클램프라는 사실이 숫자와 함께 적혀 있다', () => {
    expect(S).toContain(`\`maxBalls: ${LIMITS.maxBalls}\``);
    expect(S).toContain(`\`maxCones: ${LIMITS.maxCones}\``);
    // 대조군 — 두 숫자가 **다르다**는 것이 이 문단의 존재 이유다. 같아지면 문단이 거짓이 된다.
    expect(LIMITS.maxBalls).not.toBe(BALL.maxCount);
  });
});

describe('§5 격자 표 = COURT_DEFS[*].grid', () => {
  const S = sectionOf(DOC, '5. 격자 오버레이 (토글 옵션)');

  it('풀·하프의 칸 수', () => {
    const full = COURT_DEFS.full.grid;
    const half = COURT_DEFS.half.grid;
    expect(S).toContain(`가로 **${full.cols}** × 세로 **${full.rows}** 칸`);
    expect(S).toContain(`가로 **${half.cols}** × 세로 **${half.rows}** 칸`);
    expect(S).toContain(`(칸 크기 ${num(half.cellW / PX_PER_M)} m × ${num(half.cellH / PX_PER_M)} m)`);
  });

  it.each(COURT_SIZES)('풀 코트 %s 의 칸 치수 (m 와 px 양쪽)', (size) => {
    const g = courtDefFor('full', size).grid;
    expect(S).toContain(`| ${(g.cellW / PX_PER_M).toFixed(2)} × ${(g.cellH / PX_PER_M).toFixed(2)} |`);
    expect(S).toContain(`| ${num(g.cellW)} × ${num(g.cellH)} |`);
  });

  it('칸 수는 세 크기에서 같다 — "a1 쪽" 이 코트마다 다른 자리를 가리키면 안 된다', () => {
    const gs = COURT_SIZES.map((s) => courtDefFor('full', s).grid);
    expect(new Set(gs.map((g) => `${g.cols}x${g.rows}`)).size).toBe(1);
    // 그런데 칸의 픽셀 치수는 **전부 다르다**(대조군 — 같으면 위 표가 세 줄 다 같은 값이 된다).
    expect(new Set(gs.map((g) => g.cellW)).size).toBe(COURT_SIZES.length);
  });

  it('플랫 격자의 칸 수·축 헤더 마지막 라벨', () => {
    const g = COURT_DEFS.flat.grid;
    const lastCol = String.fromCharCode(97 + g.cols - 1);
    expect(S).toContain(`축 헤더 (\`a\`…\`${lastCol}\` / \`1\`…\`${g.rows}\`)`);
    expect(S).toContain(`${g.cols} × ${g.rows} = **${g.cols * g.rows}칸**`);
    expect(S).toContain(`한 칸이 ${num(g.cellW)} × ${num(g.cellH)} px`);
  });
});

// ── 주석 안의 숫자도 문서다 ────────────────────────────────────────────────────────────────
//
// 5차 검증관이 지목한 `colors.ts` 의 "5.34:1" 은 **불투명 흰색** 기준이라 실제 렌더값(알파 .92
// 합성)과 달랐다. 같은 파일의 `ARROW_CASING` 주석이 *똑같은 함정*을 이미 기록해 뒀는데도
// 흰색 쪽은 3차수 동안 그대로 남아 있었다 — 주석은 아무도 읽지 않는 테스트이기 때문이다.
// 그래서 그 한 줄을 파일에서 **실제로 읽어** 계산과 대조한다.
describe('src/core/colors.ts 의 대비 주석 = 실제 합성 대비', () => {
  const SRC = readFileSync('src/core/colors.ts', 'utf-8');

  /** `… // 흰선/코트 4.78:1` 같은 꼬리 주석에서 비율을 뽑는다. 못 찾으면 `null` —
   *  0 이나 NaN 을 돌려주면 아래 대조가 조용히 통과한다. */
  function ratioInComment(src: string, marker: string): number | null {
    const line = src.split('\n').find((l) => l.includes(marker) && l.includes(':1'));
    const m = line?.match(/(\d+\.\d+):1/);
    return m ? Number(m[1]) : null;
  }

  it('OBJ_STROKE 주석의 숫자가 compositeOver 계산과 일치한다', () => {
    const claimed = ratioInComment(SRC, "export const OBJ_STROKE = 'rgba(255,255,255,.92)'");
    expect(claimed).not.toBeNull();
    const actual = contrastRatio(compositeOver(OBJ_STROKE, COURT_BG), COURT_BG);
    expect(claimed).toBeCloseTo(actual, 1);
  });

  it('대조군 — 파서가 아무 숫자나 돌려주지 않는다', () => {
    expect(ratioInComment(SRC, '존재하지 않는 마커')).toBeNull();
    // 그리고 옛 값(불투명 흰색 기준 5.34)은 실제 합성값과 **다르다**. 같았다면 위 단언이
    // 무엇을 적어도 통과했을 것이다.
    const actual = contrastRatio(compositeOver(OBJ_STROKE, COURT_BG), COURT_BG);
    expect(Math.abs(actual - 5.34)).toBeGreaterThan(0.4);
  });
});

describe('§7.1 화면 구조 = app/screens.ts', () => {
  const S = sectionOf(DOC, '7. 디자인');

  it('화면 키 개수·이름', () => {
    expect(S).toContain(`— **${SCREEN_ORDER.length}개**`);
    for (const s of SCREEN_ORDER) expect(S, s).toContain(`\`${s}\``);
  });

  it('레일 항목 개수·이름(한글 라벨까지)', () => {
    expect(S).toContain(`— **${RAIL_ITEMS.length}개**`);
    for (const k of RAIL_ITEMS) expect(S, k).toContain(`\`${k}\`(${SCREEN_NAV_LABELS[k]})`);
  });

  it('present 는 화면 키이면서 레일에는 없다 — 문서가 그 비대칭을 말한다', () => {
    expect(SCREEN_ORDER).toContain('present');
    expect(RAIL_ITEMS as readonly string[]).not.toContain('present');
    expect(S).toContain('레일에서는 빠지고');
  });

  it('옛 불릿 "- 5개 화면:" 은 사라졌다 (인용으로만 남아 있다)', () => {
    // 대조군 — 문장 자체는 §7.1 이 **무엇이 틀렸는지 말하려고** 인용하고 있다. 그래서
    // "문자열이 아예 없다" 로 재면 안 되고, **불릿 항목으로 서 있지 않다**를 재야 한다.
    expect(S).toContain('5개 화면');
    expect(S).not.toContain('- 5개 화면:');
  });
});
