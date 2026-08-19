// §6.6 코트 라인 존재·굵기 검증. 좌표는 court.ts/grid.ts 가 이미 검산했으므로 여기서는
// "프로토타입 마크업이 그대로 이식됐는가" + "variant 굵기표가 맞는가"만 본다.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { CourtSurface } from './CourtSurface.tsx';
import { CourtThumbnail } from './CourtThumbnail.tsx';
import { COURT_DEFS, COURT_SIZES, courtDefFor, SPOT_CROSS_HALF_PX } from '../model/court.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

// CourtThumbnail 이 aria-label 번역에 useLocale()(→ SettingsProvider)을 쓴다(C7) — 이 파일
// 아래쪽의 몇몇 render(<CourtThumbnail .../>) 호출을 위해 한 곳에서 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

function renderCourt(mode: 'full' | 'half' | 'flat', variant: 'editor' | 'present' | 'thumb') {
  return render(
    <svg>
      <CourtSurface mode={mode} variant={variant} />
    </svg>,
  ).container;
}

/** 코트 라인이 그리는 모든 path 의 `d`. 5.2/5.3 은 "무엇이 늘었나" 보다 **"무엇이 없어졌나"** 가
 *  중요한 항목이라, 부재 단언이 실제로 문자열을 훑고 있는지 개수로 먼저 확인한다. */
function pathDs(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
}

describe('FullCourtLines', () => {
  it('editor: 외곽선 rect·하프라인·모서리컷 4 + 인크로치먼트 4 + 골지역 2 + 센터 마크 1 을 그린다', () => {
    const c = renderCourt('full', 'editor');
    const outline = c.querySelector('rect[width="750"][height="450"]');
    expect(outline).not.toBeNull();
    expect(outline).toHaveAttribute('stroke-width', '3');
    expect(c.querySelector('line[x1="412.5"]')).not.toBeNull(); // 하프라인 = 경기면 중앙
    // 모서리컷 4 + 인크로치먼트 마크 4 + 골지역 2 + 센터 마크 1 = path 11개
    // (골십자 X표시 path 는 stroke-linecap=round 인 별도 g 라 여기 안 든다)
    const straightPaths = c.querySelectorAll('g[stroke-linecap="butt"] > path');
    expect(straightPaths).toHaveLength(11);
  });

  // ── 5.2 코너킥 인크로치먼트 마크 (Laws 2025 신설) ─────────────────────────────────────────
  it('5.2: 인크로치먼트 마크가 **4개** 그려지고 좌표는 COURT_DEFS 그대로다', () => {
    // 골대 2개 × 포스트 2개 = 4. 개수를 세는 이유는 "한쪽 골대만 그리는" 사고가 그림으로는
    // 자연스러워 보이기 때문이다(골대 하나만 보고 있으면 눈치채지 못한다).
    expect(COURT_DEFS.full.encroachMarks).toHaveLength(4); // 대조군: 0개라서 통과하는 길 차단
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const ds = pathDs(renderCourt('full', variant));
      for (const d of COURT_DEFS.full.encroachMarks) expect(ds, variant).toContain(d);
    }
    // 굵기는 외곽선과 같다(같은 페인트로 그은 코트 라인이다).
    const c = renderCourt('full', 'present');
    const mark = Array.from(c.querySelectorAll('path')).find((p) => p.getAttribute('d') === COURT_DEFS.full.encroachMarks[0])!;
    expect(mark.getAttribute('stroke-width')).toBe('3.2');
  });

  // ── 5.3 센터 마크 도입 / 센터 서클 삭제 (§9 결정 ⑧) ───────────────────────────────────────
  // ⚠️ 제목이 "15 cm X" 였다. **2026-08-13 기현님 실기 지시로 표시 크기가 페널티 스팟 십자와
  //    같은 28 cm 로 커졌다**(규격 15 cm 는 court.ts 의 `CENTER_MARK_SPEC_PX` 로 남아 있다).
  it('5.3: 센터 마크 X 를 그리고 **흰 센터 점은 없다**', () => {
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('full', variant);
      expect(pathDs(c), variant).toContain(COURT_DEFS.full.centerMark);
      // 옛 센터 점(circle fill=#ffffff r=4.5/5/2)은 X 를 통째로 덮어 가린다 — 지운 채로 둔다.
      expect(c.querySelector('circle[fill="#ffffff"]'), variant).toBeNull();
    }
  });

  // ── 2026-08-13 기현님 실기 지시 ①: "센터 중앙 x자를 패널티스팟과 같은 크기로" ──────────────
  it('⚠️ 5.3(뒤집힘): 화면에서 잰 센터 X 의 폭이 골 십자(페널티 스팟)와 **같다**', () => {
    // 모델 상수끼리 비교하는 것은 courtMarks.test.ts 가 한다. 여기서는 **그려진 DOM 을** 잰다 —
    // "모델은 커졌는데 화면은 옛 리터럴로 그린다" 를 잡는 자리다(이 저장소가 겪은 사고 형태).
    const c = renderCourt('full', 'present');
    const span = (d: string): number => {
      const xs = [...d.matchAll(/[ML](-?[\d.]+),/g)].map((m) => Number(m[1]));
      expect(xs.length, `좌표를 못 읽었다: ${d}`).toBe(4);
      return Math.max(...xs) - Math.min(...xs);
    };
    const crossPath = Array.from(c.querySelectorAll('g[stroke-linecap="round"] > path'))[0]!.getAttribute('d')!;
    expect(span(COURT_DEFS.full.centerMark!)).toBeCloseTo(span(crossPath), 9);
    expect(span(COURT_DEFS.full.centerMark!)).toBeCloseTo(2 * SPOT_CROSS_HALF_PX, 9);
    // 대조군 — 이 자를 옛 규격값(3.75 px)에 대면 실제로 틀리다. 무엇에나 참인 자가 아니다.
    expect(span(COURT_DEFS.full.centerMark!)).not.toBeCloseTo(3.75, 9);
  });

  it('⚠️ 5.3: 어느 variant 에도 **센터 서클(r=75)이 없다** — 규정에 없는 선이다', () => {
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('full', variant);
      expect(c.querySelector('circle[r="75"]'), variant).toBeNull();
      // 호(A) 명령으로 몰래 되살아나는 길도 막는다 — 하프 코트의 반원이 그 형태였다.
      for (const d of pathDs(c)) expect(d).not.toMatch(/[Aa]\d/);
    }
    // 대조군 — 부재 단언이 아무 선택자에나 참인 것이 아니다. present 에는 원이 실제로 4개 있다
    // (골대 원). 그리고 path 를 실제로 훑고 있다(11개).
    const present = renderCourt('full', 'present');
    expect(present.querySelectorAll('circle')).toHaveLength(4);
    expect(pathDs(present).length).toBe(13); // 11 + 골 십자 2
  });

  it('editor: 골 십자 2개는 그리되 골대 원은 그리지 않는다 (§5.4)', () => {
    // 편집기에서 골대는 물리 바디라 ObjectLayer 가 그린다 — 휠체어에 밀리기 때문이다.
    // 코트 라인이 같은 자리에 정적 원을 또 그리면 밀린 골대와 원위치 표시가 겹쳐 두 개로 보인다.
    const c = renderCourt('full', 'editor');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    const crossGroup = Array.from(c.querySelectorAll('g')).find((g) => g.getAttribute('stroke-width') === '2.2');
    expect(crossGroup?.querySelectorAll('path')).toHaveLength(2);
  });

  it('present variant 는 굵기표대로 3.2/3/2.4/r4.4·sw1.6/X2.4 를 쓴다', () => {
    const c = renderCourt('full', 'present');
    expect(c.querySelector('rect[width="750"]')).toHaveAttribute('stroke-width', '3.2');
    const spots = c.querySelectorAll('g[fill="#f5f5f5"] > circle');
    expect(spots).toHaveLength(4);
    spots.forEach((s) => expect(s).toHaveAttribute('r', '4.4'));
    // 5.3 이후 센터의 굵기는 **점의 반지름이 아니라 X 의 선 굵기**다.
    expect(c.querySelector(`path[d="${COURT_DEFS.full.centerMark}"]`)).toHaveAttribute('stroke-width', '2.4');
  });

  it('thumb variant 는 골 십자·킥인 원을 그리지 않고 센터 마크만 X2 로 남는다', () => {
    const c = renderCourt('full', 'thumb');
    expect(c.querySelector('rect[width="750"]')).toHaveAttribute('stroke-width', '4');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    expect(c.querySelector(`path[d="${COURT_DEFS.full.centerMark}"]`)).toHaveAttribute('stroke-width', '2');
  });
});

describe('HalfCourtLines', () => {
  it('editor: 외곽 path·하프라인·골지역 1개를 그리고 골대 원·센터점은 없다 (§5.4)', () => {
    const c = renderCourt('half', 'editor');
    expect(c.querySelector('path[d^="M37.5,37.5 L37.5,412.5"]')).not.toBeNull();
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(0);
    expect(c.querySelector('circle[fill="#ffffff"]')).toBeNull();
  });

  it('⚠️ 5.3: 센터 서클 **반원(A75,75)이 없다** — 지운 것은 지워진 채로 둔다', () => {
    // 2026-08-12 까지 이 테스트의 제목은 "…, 그리고 센터 마크도 없다" 였고 아래에
    // `expect(COURT_DEFS.half.centerMark).toBeNull()` 이 있었다. **2026-08-13 기현님 실기
    // 지시로 하프에도 센터 마크가 생겼다** — 그 단언은 지우지 않고 바로 아래 테스트로
    // 뒤집어 승격시켰다. 여기 남은 것은 **반원 부재**뿐이고 그것은 그대로 유효하다
    // (지시는 "X 를 표시" 였지 "원을 되살려라" 가 아니다).
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const ds = pathDs(renderCourt('half', variant));
      expect(ds.length, variant).toBeGreaterThanOrEqual(5); // 대조군: 훑을 path 가 실제로 있다
      for (const d of ds) expect(d, variant).not.toMatch(/[Aa]\d/);
    }
    expect(renderCourt('half', 'present').querySelector('circle[r="75"]')).toBeNull();
  });

  // ── 2026-08-13 기현님 실기 지시 ②: "하프코트에서도 표시" ─────────────────────────────────
  it('⚠️ 5.3(뒤집힘): 하프 코트에도 센터 마크가 그려진다 — variant 셋 전부', () => {
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('half', variant);
      expect(pathDs(c), variant).toContain(COURT_DEFS.half.centerMark);
      // 흰 센터 **점**은 여전히 없다 — X 를 통째로 덮어 가린다(뒤집힌 것은 X 뿐이다).
      expect(c.querySelector('circle[fill="#ffffff"]'), variant).toBeNull();
    }
    expect(COURT_DEFS.half.centerMark).not.toBeNull();
    // 대조군 ① — 풀 코트 좌표를 그대로 베껴 그린 것이 아니다.
    expect(pathDs(renderCourt('half', 'present'))).not.toContain(COURT_DEFS.full.centerMark);
    // 대조군 ② — `flat` 은 그대로 null 이고 아무것도 그리지 않는다. 존재 단언이 아무 판에나
    // 참인 것이 아니다(과잉 수정으로 자유판까지 X 가 뜨는 길을 막는다).
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    expect(renderCourt('flat', 'present').querySelectorAll('path')).toHaveLength(0);
  });

  it('하프 센터 마크의 굵기도 variant 표를 탄다 (X2.2 / X2.4 / X2)', () => {
    // 좌표만 재면 "굵기 0 으로 그려 안 보이는" 길이 남는다. 굵기는 풀 코트와 같은 표다.
    const expected = { editor: '2.2', present: '2.4', thumb: '2' } as const;
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('half', variant);
      expect(c.querySelector(`path[d="${COURT_DEFS.half.centerMark}"]`), variant).toHaveAttribute('stroke-width', expected[variant]);
    }
  });

  it('5.2: 인크로치먼트 마크가 **2개**다 — 골대가 하나뿐이다', () => {
    expect(COURT_DEFS.half.encroachMarks).toHaveLength(2);
    const ds = pathDs(renderCourt('half', 'present'));
    for (const d of COURT_DEFS.half.encroachMarks) expect(ds).toContain(d);
    // 대조군 — 풀 코트(4개)와 실제로 다르다. 같은 목록을 두 번 센 것이 아니다.
    expect(COURT_DEFS.full.encroachMarks).toHaveLength(4);
    for (const d of COURT_DEFS.full.encroachMarks) expect(ds).not.toContain(d);
  });

  it('present 에는 골대 원 2개가 그대로 남는다 — 시연·썸네일은 물리가 돌지 않는다', () => {
    const c = renderCourt('half', 'present');
    expect(c.querySelectorAll('g[fill="#f5f5f5"] > circle')).toHaveLength(2);
  });
});

// 감사 2026-08-08 minor #7 회귀 — COURT_DEFS.goalPosts/cornerCuts/spotMarks 를 courtLines
// 컴포넌트가 실제로 읽는지 확인한다. 리터럴 좌표로 되돌아가면(진실 공급원이 다시 둘로 갈라지면)
// COURT_DEFS 값을 바꿔도 렌더가 따라가지 않으므로 이 테스트가 깨진다.
describe('courtLines — COURT_DEFS 가 단일 진실 공급원이다(minor #7)', () => {
  it('COURT_DEFS.full.goalPosts 를 바꾸면 골대 원 중심도 따라간다', () => {
    const original = COURT_DEFS.full.goalPosts;
    COURT_DEFS.full.goalPosts = [{ x: 999, y: 888 }, ...original.slice(1)];
    try {
      // editor 는 이제 정적 원을 안 그리므로 present 로 본다(§5.4).
      const c = renderCourt('full', 'present');
      expect(c.querySelector('g[fill="#f5f5f5"] > circle[cx="999"][cy="888"]')).not.toBeNull();
    } finally {
      COURT_DEFS.full.goalPosts = original;
    }
  });

  it('COURT_DEFS.half.cornerCuts 를 바꾸면 모서리컷 path 도 따라간다', () => {
    const original = COURT_DEFS.half.cornerCuts;
    COURT_DEFS.half.cornerCuts = ['M1,2 L3,4', ...original.slice(1)];
    try {
      const c = renderCourt('half', 'editor');
      expect(c.querySelector('path[d="M1,2 L3,4"]')).not.toBeNull();
    } finally {
      COURT_DEFS.half.cornerCuts = original;
    }
  });

  it('COURT_DEFS.full.spotMarks 를 바꾸면 골 십자 위치도 따라간다', () => {
    const original = COURT_DEFS.full.spotMarks;
    COURT_DEFS.full.spotMarks = [{ x: 200, y: 300 }, original[1]!];
    try {
      const c = renderCourt('full', 'editor'); // editor: dy=3, dx=3.5 → M196.5,297 L203.5,303 ...
      expect(c.querySelector('path[d="M196.5,297 L203.5,303 M203.5,297 L196.5,303"]')).not.toBeNull();
    } finally {
      COURT_DEFS.full.spotMarks = original;
    }
  });
});

describe('FlatCourtLines', () => {
  it('세 variant 모두 아무것도 그리지 않는다("라인 없음")', () => {
    for (const variant of ['editor', 'present', 'thumb'] as const) {
      const c = renderCourt('flat', variant);
      expect(c.querySelectorAll('svg > *').length).toBe(0);
    }
  });
});

// ── 외곽선도 COURT_DEFS 를 따라간다 (2026-08-10 회귀) ─────────────────────────────────────
// ⚠️ minor #7 가드는 goalPosts/cornerCuts/spotMarks 만 봤다. 그래서 외곽선·하프라인·
//    센터서클·골지역이 **리터럴로 남아 있는데도** 전부 초록불이었고, 마진을 1.5 m 로
//    넓히자 외곽선만 옛 자리에 남아 골대와 골지역이 선 밖으로 삐져나왔다(기현 실기 신고).
//    파일 상단 주석은 진작 "좌표 출처는 COURT_DEFS 하나뿐" 이라고 적혀 있었다 — 주석이
//    사실인지 확인하는 테스트가 없었을 뿐이다.
describe('courtLines — 외곽선·골지역도 COURT_DEFS 에서 파생된다', () => {
  it('full: surface 를 바꾸면 외곽선 rect 가 따라간다', () => {
    const original = COURT_DEFS.full.surface;
    COURT_DEFS.full.surface = { x: 11, y: 22, w: 333, h: 444 };
    try {
      const c = renderCourt('full', 'editor');
      expect(c.querySelector('rect[x="11"][y="22"][width="333"][height="444"]')).not.toBeNull();
      // 하프라인·센터서클도 경기면 중앙에서 나온다.
      expect(c.querySelector('line[x1="177.5"]')).not.toBeNull();
    } finally {
      COURT_DEFS.full.surface = original;
    }
  });

  it('full: ruleZones 를 바꾸면 골 지역 path 가 따라간다', () => {
    const original = COURT_DEFS.full.ruleZones;
    COURT_DEFS.full.ruleZones = [
      { x: 37.5, y: 100, w: 60, h: 70 },
      { x: 600, y: 100, w: 60, h: 70 },
    ];
    try {
      const c = renderCourt('full', 'editor');
      const paths = Array.from(c.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
      expect(paths.some((d) => d.includes('97.5,100'))).toBe(true); // 좌측 골지역 우상단
      expect(paths.some((d) => d.includes('600,100'))).toBe(true); // 우측 골지역 좌상단
    } finally {
      COURT_DEFS.full.ruleZones = original;
    }
  });

  it('half: surface 를 바꾸면 외곽 path 가 따라간다', () => {
    // ⚠️ 옛 판에는 여기에 센터 서클 반원(`M85,20 A75,75`)이 따라오는지 보는 단언이 하나 더
    //    있었다. 5.3 이 그 반원을 지웠으므로 그 단언은 위 '반원이 없다' 로 **승격**했다.
    const original = COURT_DEFS.half.surface;
    COURT_DEFS.half.surface = { x: 10, y: 20, w: 300, h: 200 };
    try {
      const c = renderCourt('half', 'editor');
      expect(c.querySelector('path[d^="M10,20 L10,220"]')).not.toBeNull();
      expect(c.querySelector('line[x1="10"][x2="310"]')).not.toBeNull(); // 하프라인(위쪽 변)
    } finally {
      COURT_DEFS.half.surface = original;
    }
  });

  // 5.2/5.3 이 새로 더한 두 필드도 같은 규약을 지킨다 — 리터럴로 되돌아가면 여기서 잡힌다.
  it('full: encroachMarks 를 바꾸면 마크 path 가 따라간다', () => {
    const original = COURT_DEFS.full.encroachMarks;
    COURT_DEFS.full.encroachMarks = ['M5,6 L7,8'];
    try {
      const c = renderCourt('full', 'editor');
      expect(c.querySelector('path[d="M5,6 L7,8"]')).not.toBeNull();
      // 옛 좌표는 사라진다 — 컴포넌트가 자기 리터럴을 따로 들고 있지 않다는 뜻이다.
      expect(c.querySelector(`path[d="${original[0]}"]`)).toBeNull();
    } finally {
      COURT_DEFS.full.encroachMarks = original;
    }
  });

  it('half: centerMark 를 바꾸면 센터 마크 path 가 따라가고, null 이면 아예 안 그린다', () => {
    // 하프 쪽에도 같은 가드를 둔다 — 2026-08-13 에 X 를 넣으면서 **좌표를 컴포넌트에 리터럴로
    // 적는** 것이 가장 쉬운 지름길이었다(court.ts 를 안 고쳐도 화면에는 X 가 뜬다). 그러면
    // 인쇄·PNG 는 여전히 X 가 없고, 아무 테스트도 빨개지지 않는다.
    const original = COURT_DEFS.half.centerMark;
    COURT_DEFS.half.centerMark = 'M3,3 L4,4';
    try {
      expect(renderCourt('half', 'editor').querySelector('path[d="M3,3 L4,4"]')).not.toBeNull();
      expect(renderCourt('half', 'editor').querySelector(`path[d="${original}"]`)).toBeNull();
      COURT_DEFS.half.centerMark = null;
      const c = renderCourt('half', 'editor');
      expect(c.querySelector('path[d="M3,3 L4,4"]')).toBeNull();
      // null 대조군: 마크만 빠지고 나머지 라인(코너컷 2 · 인크로치먼트 2 · 외곽 1 · 골지역 1)은 6개다.
      expect(c.querySelectorAll('g[stroke-linecap="butt"] > path')).toHaveLength(6);
    } finally {
      COURT_DEFS.half.centerMark = original;
    }
  });

  it('full: centerMark 를 바꾸면 센터 마크 path 가 따라가고, null 이면 아예 안 그린다', () => {
    const original = COURT_DEFS.full.centerMark;
    COURT_DEFS.full.centerMark = 'M1,1 L2,2';
    try {
      expect(renderCourt('full', 'editor').querySelector('path[d="M1,1 L2,2"]')).not.toBeNull();
      COURT_DEFS.full.centerMark = null;
      const c = renderCourt('full', 'editor');
      expect(c.querySelector('path[d="M1,1 L2,2"]')).toBeNull();
      // null 대조군: 마크만 빠지고 나머지 라인(코너컷·인크로치먼트·골지역)은 그대로 10개다.
      expect(c.querySelectorAll('g[stroke-linecap="butt"] > path')).toHaveLength(10);
    } finally {
      COURT_DEFS.full.centerMark = original;
    }
  });
});

// ── 화면 축 열거 — 코트를 그리는 화면은 **다섯**이다 (2026-08-13 ①) ──────────────────────
//
// ⚠️ 이 저장소가 실제로 겪은 헛통과: 5차에서 "코트를 그리는 화면이 몇 개인가" 를 아무도 묻지
//    않아 **시연 화면만** 강제색에서 팀 구분을 잃은 채 2233 테스트가 초록이었다
//    (contrast.test.tsx 의 '화면 축 열거' 가 그 자리다). 센터 마크도 같은 위험이 있다 —
//    편집기에서 X 를 보고 "됐다" 하면 코치가 들고 나가는 **종이**에는 없을 수 있다.
//
// 다섯 화면과 각각의 보장 방식:
//   ① 편집기  CourtStage.tsx        → <CourtSurface> 재사용 (아래 파일 텍스트 계약)
//   ② 시연    PresentStage.tsx      → <CourtSurface> 재사용 (아래 파일 텍스트 계약)
//   ③ 인쇄    PrintCourt.tsx        → <CourtSurface> 재사용 (PrintCourt.test.tsx 가 실제로 렌더)
//   ④ PNG     buildStaticSvg.ts     → **손 이식본**. courtLines.contract.test.ts 가 도형 대조 +
//                                      같은 파일의 '센터 마크가 실제로 있다' 존재 단언
//   ⑤ 썸네일  CourtThumbnail.tsx    → <CourtSurface> 재사용 (아래에서 실제로 렌더)
//
// "저절로 따라오겠지" 를 믿지 않고 **그 저절로가 성립하는 조건**(= CourtSurface 를 쓴다)을
// 단언한다. 어느 화면이 코트 라인을 손으로 그리기 시작하면 여기가 빨개진다.
describe('센터 마크 — 코트를 그리는 다섯 화면 전부에 닿는다', () => {
  const REUSERS = [
    { name: '① 편집기', file: 'src/render/CourtStage.tsx' },
    { name: '② 시연', file: 'src/features/present/PresentStage.tsx' },
    { name: '③ 인쇄', file: 'src/features/print/PrintCourt.tsx' },
    { name: '⑤ 썸네일', file: 'src/render/CourtThumbnail.tsx' },
  ] as const;

  it('대조군 — 열거가 4 + PNG 1 = 5 개다 (0개라서 통과하는 길을 막는다)', () => {
    expect(REUSERS.length).toBe(4);
    expect(existsSync('src/features/export/buildStaticSvg.ts')).toBe(true); // ④
  });

  it.each(REUSERS)('$name ($file) 는 CourtSurface 를 그대로 쓴다 — 라인을 손으로 그리지 않는다', ({ file }) => {
    const src = readFileSync(file, 'utf-8');
    expect(src).toContain('<CourtSurface');
    // 그리고 **센터 마크 좌표를 자기가 만들지 않는다.** 여기에 centerMarkD 를 흉내 낸 식이
    // 생기면 court.ts 를 고쳐도 그 화면만 옛 크기·옛 자리에 남는다.
    expect(src).not.toContain('centerMark');
  });

  it('⑤ 썸네일은 실제로 full·half 두 판 모두에 센터 마크를 그린다', () => {
    // 파일 텍스트만으로는 "CourtSurface 를 부르지만 mode 를 안 넘겨 늘 full 을 그리는" 사고를
    // 못 잡는다. 그래서 렌더해서 좌표를 직접 확인한다.
    for (const mode of ['full', 'half'] as const) {
      const { container } = render(<CourtThumbnail mode={mode} />);
      const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
      expect(ds, mode).toContain(COURT_DEFS[mode].centerMark);
      // 굵기는 thumb 표(X2)다.
      expect(container.querySelector(`path[d="${COURT_DEFS[mode].centerMark}"]`), mode).toHaveAttribute('stroke-width', '2');
    }
    // 대조군 — flat 썸네일에는 없다(전량 참이라 통과한 것이 아니다).
    const { container: flat } = render(<CourtThumbnail mode="flat" />);
    expect(flat.querySelectorAll('path')).toHaveLength(0);
  });

  it('⑤ 썸네일: 풀 코트 크기 3단 전부에서 각 크기의 X 가 그려진다', () => {
    // 코트 축(3크기)을 화면 축과 곱한다 — size prop 을 빼먹으면 25×14 썸네일에 30×18 의 X 가
    // 뜬다(§6.4 가 실제로 겪은 사고의 형태다).
    const seen = new Set<string>();
    for (const size of COURT_SIZES) {
      const { container } = render(<CourtThumbnail mode="full" size={size} />);
      const d = courtDefFor('full', size).centerMark!;
      expect(Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d')), size).toContain(d);
      seen.add(d);
    }
    expect(seen.size, '세 단의 X 좌표가 실제로 서로 다르다').toBe(3);
  });
});
