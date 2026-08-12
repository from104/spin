// 4.4 검증 — **PNG 에 글자가 실제로 들어가는가.**
//
// ★ 이 파일이 생긴 이유(2026-08-13 회의적 검증에서 실측한 구멍):
//   `rasterizeFrameToPng` 에서 `paintTexts(ctx, scene.texts, metrics)` **한 줄을 지워도
//   전건 1872 테스트가 전부 초록이었다.** 즉 등번호·골키퍼 'G'·메모·캡션이 통째로 빠진
//   PNG 가 나가도 아무도 못 잡는 상태였다. buildStaticSvg.test.ts 의 `<text>` 0개 단언은
//   글자를 SVG 에 **안 넣는 것**만 지키므로, 지우면 오히려 더 확실히 통과한다 —
//   ★[A-9] 설계는 "SVG 에서 빼고 **캔버스에 그린다**" 인데 뒷문장을 아무도 안 붙잡고 있었다.
//   그 한 줄이 이 앱에서 유일하게 글자를 PNG 에 넣는 자리다.
//
// jsdom 에는 캔버스도 Image 디코더도 없다(rasterize.ts 머리말). 그래서 files.test.ts 가
// URL.createObjectURL 에 쓴 것과 같은 수법으로 **셋을 직접 심는다** — getContext·toBlob·Image.
// 심은 ctx 는 호출을 받아 적는 기록기라, "무엇을 어디에 어떤 글꼴로 그렸는가" 까지 단언할 수
// 있다. 실제 글리프 래스터화(폰트 로드·tofu·하프톤)는 여전히 실기 확인 항목이다.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { paintTexts, rasterizeFrameToPng, svgDataUri } from './rasterize.ts';
import { buildStaticScene, type StaticSceneOpts } from './buildStaticSvg.ts';
import { staticSceneMetrics, textToOutputPx, type SceneMetrics, type TextPlacement } from './staticSceneLayout.ts';
import { makeFrame, TEAMS } from './sceneFixture.ts';

const OPTS: StaticSceneOpts = {
  mode: 'full',
  teams: TEAMS,
  caption: { title: '전환 훈련', stepIndex: 2, stepCount: 7, stepName: '왼쪽 전환' },
};

interface FillCall {
  text: string;
  x: number;
  y: number;
  font: string;
  align: string;
  baseline: string;
  fillStyle: string;
  alpha: number;
}

/** 캔버스 2D 컨텍스트의 기록기. 그리기 시점의 상태를 함께 박제한다 —
 *  font/align 은 fillText **전에** 세팅되어야 의미가 있으므로 호출 시점 값을 남긴다. */
function makeCtx() {
  const calls: FillCall[] = [];
  const draws: Array<{ w: number; h: number }> = [];
  const ctx = {
    textBaseline: 'alphabetic',
    textAlign: 'start',
    font: '10px sans-serif',
    fillStyle: '#000000',
    globalAlpha: 1,
    fillText(text: string, x: number, y: number) {
      calls.push({
        text,
        x,
        y,
        font: ctx.font,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        fillStyle: ctx.fillStyle,
        alpha: ctx.globalAlpha,
      });
    },
    drawImage(_img: unknown, _x: number, _y: number, w: number, h: number) {
      draws.push({ w, h });
    },
  };
  return { ctx, calls, draws };
}

describe('paintTexts — 배치 목록을 캔버스로 옮긴다', () => {
  const metrics: SceneMetrics = staticSceneMetrics(OPTS);
  const place = (over: Partial<TextPlacement> = {}): TextPlacement => ({
    text: '4',
    x: 100,
    y: 200,
    sizePx: 13.33,
    weight: 700,
    color: '#ffffff',
    align: 'middle',
    font: 'number',
    opacity: 1,
    ...over,
  });

  it('placement 하나당 fillText 한 번 — 그리고 좌표에 scale 이 곱해진다', () => {
    const { ctx, calls } = makeCtx();
    const texts = [place(), place({ text: '메모', x: 300, y: 400, font: 'body' })];
    paintTexts(ctx as unknown as CanvasRenderingContext2D, texts, metrics);

    expect(calls.map((c) => c.text)).toEqual(['4', '메모']);
    // 좌표가 월드 px 그대로면 2x 출력에서 글자가 왼쪽 위 1/4 에 몰린다.
    expect(calls[0]!.x).toBeCloseTo(textToOutputPx(texts[0]!, metrics.scale).x, 6);
    expect(calls[0]!.y).toBeCloseTo(textToOutputPx(texts[0]!, metrics.scale).y, 6);
    // 대조군: scale 이 실제로 곱해졌다(1 이 아니다 = 좌표를 그대로 흘린 것이 아니다).
    expect(metrics.scale).not.toBe(1);
    expect(calls[0]!.x).not.toBeCloseTo(texts[0]!.x, 6);
  });

  it('대조군: 배치가 0개면 fillText 도 0회 — "무엇을 넣어도 그린다" 가 아니다', () => {
    const { ctx, calls } = makeCtx();
    paintTexts(ctx as unknown as CanvasRenderingContext2D, [], metrics);
    expect(calls).toHaveLength(0);
  });

  it('세로 기준은 언제나 middle — staticSceneLayout 의 계약이다', () => {
    const { ctx, calls } = makeCtx();
    paintTexts(ctx as unknown as CanvasRenderingContext2D, [place()], metrics);
    // 기본값 alphabetic 으로 그리면 등번호가 칩 중심보다 반 줄 위로 뜬다.
    expect(calls[0]!.baseline).toBe('middle');
    expect(calls[0]!.baseline).not.toBe('alphabetic');
  });

  it('글꼴·정렬·색·투명도를 placement 에서 가져온다', () => {
    const { ctx, calls } = makeCtx();
    paintTexts(
      ctx as unknown as CanvasRenderingContext2D,
      [place({ font: 'number', align: 'middle', color: '#111827', opacity: 0.5 }), place({ text: '제목', font: 'body', align: 'start', color: '#4b5563' })],
      metrics,
    );
    // 등번호는 라틴 서브셋으로 충분한 Space Grotesk, 한글이 들어갈 수 있는 것은 Pretendard.
    expect(calls[0]!.font).toContain('Space Grotesk');
    expect(calls[1]!.font).toContain('Pretendard');
    expect(calls[0]!.align).toBe('center');
    expect(calls[1]!.align).toBe('left');
    expect(calls[0]!.fillStyle).toBe('#111827');
    expect(calls[0]!.alpha).toBe(0.5);
    // 반투명 글자를 그린 뒤 알파를 되돌리지 않으면 **다음 글자부터 전부** 흐려진다.
    expect(calls[1]!.alpha).toBe(1);
  });

  it('마지막 글자가 반투명이어도 ctx 알파를 1 로 되돌려 놓는다', () => {
    // ⚠️ 여기서 **마지막** 배치가 반투명인 것이 핵심이다. 반투명을 앞에 두면 뒤 배치가
    //   알파를 1 로 덮어써서, paintTexts 끝의 `ctx.globalAlpha = 1` 을 지워도 통과한다
    //   (2026-08-13 검증에서 실제로 그렇게 헛통과했다). ctx 는 호출부가 계속 쓰는 물건이라
    //   빌려 쓴 상태는 돌려놓아야 한다.
    const { ctx, calls } = makeCtx();
    paintTexts(ctx as unknown as CanvasRenderingContext2D, [place(), place({ text: '흐린 메모', opacity: 0.3 })], metrics);
    expect(calls.at(-1)!.alpha).toBe(0.3); // 대조군: 반투명이 실제로 적용은 됐다
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('svgDataUri', () => {
  it('한글이 들어가도 던지지 않는다 — btoa 로 되돌리면 여기서 죽는다', () => {
    // btoa 는 Latin-1 만 받는다. 지금 SVG 에 글자는 없지만 색 이름·id 로 새어 들어올 수 있다.
    const uri = svgDataUri('<svg><title>왼쪽 전환</title></svg>');
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.slice('data:image/svg+xml;charset=utf-8,'.length))).toContain('왼쪽 전환');
    expect(() => btoa('왼쪽')).toThrow(); // 대조군: 옛 방식이었으면 실제로 던진다
  });
});

// ── rasterizeFrameToPng — jsdom 에 없는 셋을 심고 경로를 실제로 통과시킨다 ──────────────
describe('★ rasterizeFrameToPng 이 장면의 글자를 캔버스에 실제로 그린다', () => {
  let calls: FillCall[];
  let draws: Array<{ w: number; h: number }>;
  let canvases: HTMLCanvasElement[];
  let blobResult: Blob | null;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origImage = globalThis.Image;

  beforeEach(() => {
    const rec = makeCtx();
    calls = rec.calls;
    draws = rec.draws;
    canvases = [];
    blobResult = new Blob(['png'], { type: 'image/png' });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      canvases.push(this);
      return rec.ctx as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(blobResult);
    } as typeof HTMLCanvasElement.prototype.toBlob;
    // jsdom 의 Image 는 src 를 넣어도 디코딩하지 않아 onload 가 영영 안 온다 → await 가 멎는다.
    class StubImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      #src = '';
      get src(): string {
        return this.#src;
      }
      set src(v: string) {
        this.#src = v;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = StubImage as unknown as typeof Image;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
    vi.restoreAllMocks();
  });

  it('등번호 8개 · 메모 · 캡션 두 줄이 전부 fillText 로 나간다 (paintTexts 호출을 지우면 여기가 빨개진다)', async () => {
    const frame = makeFrame();
    const scene = buildStaticScene(frame, OPTS);

    const res = await rasterizeFrameToPng(frame, OPTS);

    // 대조군 ① — 그릴 글자가 애초에 0개면 아래 일치 단언이 공허하다. 픽스처는 칩 8 + 메모 1
    // (빈 메모 1은 제외) + 캡션 2 = 11 이다.
    expect(scene.texts.length).toBe(11);
    // ★ 본 단언 — 장면이 내놓은 글자 전부가, 그 순서 그대로 캔버스로 갔다.
    expect(calls.map((c) => c.text)).toEqual(scene.texts.map((t) => t.text));
    // 사람이 읽는 형태로도 한 번 더 못박는다(순서 배열만 보면 회귀를 놓치기 쉽다).
    expect(calls.map((c) => c.text)).toEqual(expect.arrayContaining(['G', '4', '왼쪽으로 전환', '전환 훈련', '3/7 · 왼쪽 전환']));
    // 빈 메모의 플레이스홀더는 그리지 않는다(staticSceneLayout 의 결정).
    expect(calls.map((c) => c.text)).not.toContain('메모');

    // 대조군 ② — 글자만 그리고 도형을 빠뜨린 반대 사고도 막는다.
    expect(draws).toHaveLength(1);
    expect(draws[0]).toEqual({ w: res.widthPx, h: res.heightPx });
    expect(res.blob).toBe(blobResult);
  });

  it('캔버스 크기 = SceneMetrics — 2x 의 긴 변이 2048 이다 (★A-10)', async () => {
    const res = await rasterizeFrameToPng(makeFrame(), OPTS);
    const m = staticSceneMetrics(OPTS);
    expect(canvases).toHaveLength(1);
    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([m.widthPx, m.heightPx]);
    expect([res.widthPx, res.heightPx]).toEqual([m.widthPx, m.heightPx]);
    expect(Math.max(res.widthPx, res.heightPx)).toBe(2048);
    // 대조군: 1x 는 절반이다 — 해상도 옵션이 실제로 먹는다(상수를 박아 둔 것이 아니다).
    const one = await rasterizeFrameToPng(makeFrame(), { ...OPTS, resolution: 1 });
    expect(Math.max(one.widthPx, one.heightPx)).toBe(1024);
  });

  it('캡션을 끄면 캡션 두 줄만 빠지고 등번호는 남는다', async () => {
    await rasterizeFrameToPng(makeFrame(), { ...OPTS, caption: null });
    expect(calls.map((c) => c.text)).not.toContain('전환 훈련');
    expect(calls.map((c) => c.text)).toContain('G'); // 대조군: 글자 경로 자체는 살아 있다
    expect(calls).toHaveLength(9);
  });

  it('toBlob 이 null 을 주면(iOS 사파리) 던진다 — 조용히 빈 파일을 내려보내지 않는다', async () => {
    blobResult = null;
    await expect(rasterizeFrameToPng(makeFrame(), OPTS)).rejects.toThrow('그림 파일을 만들지 못했습니다.');
    // 대조군: 같은 경로가 blob 이 있을 때는 던지지 않는다(위 it 들이 그것을 이미 보였다).
  });
});
