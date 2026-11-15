// 페이지 **안에서** 도는 함수들 — 두 드라이버(PlaywrightApp 의 page.evaluate, WdioApp 의 WebDriver execute)가 함께 쓴다.
// docs/PLAN-TEST-SUITE.md §4·§11. QCalc `feature/e2e-suite` 의 e2e/drivers/page-functions.ts 와 같은 자리다.
//
// ⚠️ 함수는 toString() 으로 직렬화되어 브라우저로 넘어간다 — 바깥 변수·import 를 참조하면 안 되고(타입만 된다),
//    인자는 **하나**(필요하면 객체 하나로 묶는다)다. Playwright 의 page.evaluate(fn, arg) 가 인자를 하나만 받기 때문이다.
//
// 판정을 한 곳에 두는 이유: 준비·정착·좌표 판정이 드라이버마다 따로 있으면 "웹에선 초록, 앱에선 빨강" 이 앱 차이인지
// 판정 차이인지 가를 수 없다. 여기 있는 것은 같은 DOM 을 같은 식으로 읽는다.
import type { AnchorProbe, CourtObject, CourtPoint, ScreenPoint, StepState, WorldPoint } from './SpinApp.ts';

type Box = { left: number; top: number; right: number; bottom: number };

/** 앱이 준비됐다 — 부팅 마크(`#spin-boot`)가 걷히고 `app-shell` 이 섰고 로더가 덮고 있지 않고(`aria-busy` 없음) 로더 덮개가 DOM 에서 빠졌다 */
export const appReadyInPage = (): boolean =>
  !document.getElementById('spin-boot') &&
  !!document.querySelector('[data-testid="app-shell"]') &&
  !document.querySelector('[aria-busy="true"]') &&
  !document.querySelector('.spin-loader');

/**
 * 레이아웃이 다 섰다 — 글꼴이 다 들어오고 화면 본문·코트 무대의 상자가 연속 두 프레임 같다(5초 상한, 넘으면 던진다).
 * 부팅 직후 글꼴이 늦게 들어오며 머리띠 높이가 바뀌어 무대가 4~5px 밀린다(chromium-mobile 실측).
 */
export const layoutStableInPage = async (): Promise<void> => {
  await document.fonts.ready;
  const box = () =>
    ['#main', '[data-testid="court-stage"]']
      .map((sel) => document.querySelector(sel)?.getBoundingClientRect())
      .map((r) => (r ? `${r.x},${r.y},${r.width},${r.height}` : '-'))
      .join('|');
  const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const deadline = performance.now() + 5_000;
  let prev = box();
  for (;;) {
    await frames();
    const next = box();
    if (next === prev) return;
    if (performance.now() > deadline) throw new Error(`레이아웃이 5초 안에 멈추지 않음 — 마지막 ${next}`);
    prev = next;
  }
};

/** 다리의 모델 자세 */
export const objectsInPage = (): CourtObject[] => {
  const bridge = window.__spinE2E;
  if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다 — 편집기가 안 떠 있거나 ?e2e=1 이 빠졌다');
  return bridge.objects();
};

/** 다리의 판 종류('board'|'drill'). 다리가 없으면 null */
export const surfaceInPage = (): string | null => window.__spinE2E?.surface ?? null;

export const stepStateInPage = (): StepState => {
  const bridge = window.__spinE2E;
  if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다');
  return { stepIndex: bridge.stepIndex, stepCount: bridge.stepCount, playing: bridge.playing };
};

export const autosaveInPage = (): string => {
  const bridge = window.__spinE2E;
  if (!bridge) throw new Error('시험 다리(window.__spinE2E)가 없다');
  return bridge.autosave;
};

/** 화면이 다 섰는가 한 번 잰다 — 다리 busy 가 내려가 있고 자세가 두 프레임 사이 같다 */
export const settleProbeInPage = async (): Promise<{ ok: boolean; why: string }> => {
  const bridge = window.__spinE2E;
  if (!bridge) return { ok: false, why: '다리 없음' };
  if (bridge.busy) return { ok: false, why: 'busy' };
  const a = JSON.stringify(bridge.objects());
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (bridge.busy) return { ok: false, why: 'busy' };
  return JSON.stringify(bridge.objects()) === a ? { ok: true, why: '' } : { ok: false, why: '자세가 바뀌는 중' };
};

/** 코트 무대의 화면 크기. 없으면 null */
export const courtSizeInPage = (): { width: number; height: number } | null => {
  const el = document.querySelector('[data-testid="court-stage"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
};

export const rectOfInPage = (testId: string): Box | null => {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

export const courtRotInPage = (): string | null =>
  document.querySelector('[data-testid="court-stage"]')?.getAttribute('data-rot') ?? null;

export const screenKeyInPage = (): string | null =>
  document.querySelector('[data-testid="app-shell"]')?.getAttribute('data-screen') ?? null;

/** 코트 점 → 화면 점 — court-field 의 getBBox 비율을 court-world 의 getScreenCTM 으로 푼다(앱 산술과 독립인 판정자) */
export const courtToScreenInPage = ({ u, v }: CourtPoint): ScreenPoint => {
  const field = document.querySelector<SVGGraphicsElement>('[data-testid="court-field"]');
  const world = document.querySelector<SVGGraphicsElement>('[data-testid="court-world"]');
  const ctm = world?.getScreenCTM();
  if (!field || !ctm) throw new Error('court-field/court-world 가 없다 — 편집기가 안 떠 있다');
  const b = field.getBBox();
  const p = new DOMPoint(b.x + u * b.width, b.y + v * b.height).matrixTransform(ctm);
  return { x: p.x, y: p.y };
};

export const worldToScreenInPage = ({ x, y }: WorldPoint): ScreenPoint => {
  const ctm = document.querySelector<SVGGraphicsElement>('[data-testid="court-world"]')?.getScreenCTM();
  if (!ctm) throw new Error('court-world 가 없다 — 편집기가 안 떠 있다');
  const p = new DOMPoint(x, y).matrixTransform(ctm);
  return { x: p.x, y: p.y };
};

export const objectCenterInPage = (objId: string): ScreenPoint | null => {
  const el = document.getElementById(`obj-${objId}`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

export const objectBoxInPage = (objId: string): Box | null => {
  const el = document.getElementById(`obj-${objId}`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** 지금 서 있는 aria-modal 대화 상자들의 data-testid */
export const dialogsInPage = (): string[] =>
  Array.from(document.querySelectorAll('[aria-modal="true"]')).map((d) => d.getAttribute('data-testid') ?? 'unnamed');

/** data-testid 요소가 자기 중심에서 맨 위인가 — 자리를 옮기는 transition 이 끝난 뒤에 잰다 */
export const onTopInPage = async (testId: string): Promise<boolean> => {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) return false;
  // 감축 모션에서도 0.01ms 짜리가 한 프레임은 돈다(tokens.css). 끝나기 전에 재면 옛 자리를 잰다(2026-11-15 S7b 실측)
  await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
  const r = el.getBoundingClientRect();
  return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
};

/** 화면에 보이는 글과 접근성 이름(aria-label·title·placeholder·alt) — 숨은 것 제외 */
export const uiStringsInPage = (): { text: string[]; names: string[] } => {
  const visible = (el: Element): boolean => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
    }
    return true;
  };
  const text: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    const p = n.parentElement;
    if (s && p && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) && visible(p)) text.push(s);
  }
  const names: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll('[aria-label], [title], [placeholder], [alt]'))) {
    if (!visible(el)) continue;
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(attr);
      if (v) names.push(v);
    }
  }
  return { text, names };
};

/** `data-tut` 닻의 화면 상태 */
export const anchorInPage = (anchor: string): AnchorProbe | null => {
  const all = document.querySelectorAll(`[data-tut="${anchor}"]`);
  const el = all[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    count: all.length,
    rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
    inViewport: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
    onTop: !!top && el.contains(top),
  };
};

export const horizontalOverflowInPage = (): number =>
  Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;

export const viewportSizeInPage = (): { width: number; height: number } => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * 열린 스텝 목록의 **바깥** 점 — 덮개(`data-sidebar-backdrop`)가 맨 위이고 그 아래에 누를 것이 없는 점. 덮개는
 * pointerdown 에서 닫히므로, 터치의 뒤늦은 click 이 덮개가 사라진 자리 아래 단추에 떨어진다(S7c 가 붙잡은 앱 버그).
 * 그래서 아래가 단추·입력이 아닌 점을 격자로 훑어 고른다. 덮개가 없으면 null
 */
export const stepListOutsideInPage = (): ScreenPoint | null => {
  const backdrop = document.querySelector<HTMLElement>('[data-sidebar-backdrop]');
  if (!backdrop) return null;
  const r = backdrop.getBoundingClientRect();
  const interactive = 'button, a, input, select, textarea, [role="button"], [role="radio"], [role="switch"]';
  for (let fy = 0.5; fy < 1; fy += 0.1) {
    for (let fx = 0.9; fx > 0; fx -= 0.1) {
      const x = r.x + r.width * fx;
      const y = r.y + r.height * fy;
      if (document.elementFromPoint(x, y) !== backdrop) continue;
      backdrop.style.pointerEvents = 'none';
      const beneath = document.elementFromPoint(x, y);
      backdrop.style.pointerEvents = '';
      if (!beneath?.closest(interactive)) return { x, y };
    }
  }
  return null;
};

/**
 * 누를 자리 — 선택자의 index 번째 요소가 보이고(상자가 0 이 아님) 움직이지 않고(애니메이션 끝) 자기 중심에서 맨 위일 때
 * 그 중심. 뷰포트 밖이면 먼저 굴려 들인다. 아직 누를 수 없으면 이유를 돌려준다 — Playwright 의 click() 이 하는
 * "누를 수 있을 때까지" 판정(actionability)을 WebDriver 쪽에서 같은 뜻으로 재는 것이다(WdioApp.activate).
 */
export const hitPointInPage = async ({
  selector,
  index,
  inner,
}: {
  selector: string;
  index: number;
  /** 고른 요소 안에서 다시 고를 선택자(첫 것) — 예: index 번째 카드의 첫 단추 */
  inner?: string;
}): Promise<{ point: ScreenPoint | null; why: string }> => {
  const outer = document.querySelectorAll(selector)[index];
  const el = inner ? outer?.querySelector(inner) : outer;
  if (!el) return { point: null, why: '요소 없음' };
  let r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { point: null, why: '크기 0(숨김)' };
  if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return { point: null, why: '뷰포트 밖 — 굴리는 중' };
  }
  await Promise.all(el.getAnimations({ subtree: false }).map((a) => a.finished.catch(() => undefined)));
  r = el.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const top = document.elementFromPoint(x, y);
  if (!top || !el.contains(top)) return { point: null, why: `다른 요소에 가려짐(${top?.tagName ?? '없음'})` };
  if ((el as HTMLButtonElement).disabled) return { point: null, why: '비활성' };
  return { point: { x, y }, why: '' };
};

/** 다음 페인트까지 기다린다 — 고정 sleep 이 아니라 브라우저의 프레임이다 */
export const nextFrameInPage = (): Promise<void> => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** 지금 초점이 대화 상자 안 form 에 있는가(SaveAsDrillDialog 의 첫 초점 = 이름 칸) */
export const focusInModalFormInPage = (): boolean => document.activeElement?.closest('[aria-modal="true"] form') != null;
