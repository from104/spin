// §6.2 PNG — 래스터 **어댑터**. SVG 문자열 → `<img>` → 캔버스 → 글자 → PNG Blob.
//
// ⚠️ **여기는 jsdom 이 못 본다 — 실기 확인 항목이다.**
//    jsdom 에는 캔버스가 없고(`getContext('2d')` → null), `Image` 는 디코딩을 하지 않아
//    `onload` 가 영원히 오지 않으며, `URL.createObjectURL`·`canvas.toBlob` 도 없다.
//    그래서 이 파일에는 **단위 테스트를 붙이지 않는다.** 대신 순수 파트를 전부 바깥으로
//    빼 두었다 — SVG 문자열은 `buildStaticSvg.ts`, 글자 배치·크기·폰트 문자열은
//    `staticSceneLayout.ts` 가 만들고 그쪽에 가드 테스트가 몰려 있다.
//    이 파일에 남은 것은 "그 값들을 캔버스 API 에 옮겨 붓는 일" 뿐이다.
//
//    실기(태블릿·데스크톱 브라우저)에서 확인할 항목 — 0.5 실기 검증 경로에 태운다:
//      ① 등번호·골키퍼 'G' 가 칩 한가운데 찍히는가 (안 찍히면 폰트 로드 전에 그린 것이다)
//      ② 한글 제목·스텝 이름·메모가 **네모(tofu)로 깨지지 않는가**
//      ③ 배경 '투명' 으로 뽑은 PNG 를 어두운 채팅방에 붙였을 때 캡션이 읽히는가
//      ④ 2x 로 뽑은 PNG 의 긴 변이 2048 인가 (계획서 §6.2 [A-10])
//      ⑤ iOS 사파리에서 `toBlob` 이 null 을 주지 않는가 (주면 아래 폴백이 도는지)
//
// 왜 `XMLSerializer`(살아 있는 DOM 직렬화)가 아닌가 · 왜 `<text>` 를 안 쓰는가 —
// 근거는 `buildStaticSvg.ts` · `staticSceneLayout.ts` 머리말에 있다.
import type { RenderFrame } from '../../model/playback.ts';
import { buildStaticScene, type StaticSceneOpts } from './buildStaticSvg.ts';
import type { SceneRef } from '../../model/zOrder.ts';
import { canvasAlignFor, fontCssFor, textToOutputPx, type SceneMetrics, type TextPlacement } from './staticSceneLayout.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';

/** 폰트가 로드되기 전에 그리면 등번호가 폴백 글꼴로 찍히거나 아예 빠진다(★[A-9]).
 *  `document.fonts.ready` 를 기다리되, 폰트가 영영 안 오는 환경(구형 브라우저·차단된 로컬
 *  폰트)에서 내보내기가 통째로 멈추면 안 되므로 상한을 둔다 — 늦어도 그리기는 그린다. */
const FONT_WAIT_MS = 1500;

/** SVG 를 data URI 로. base64(`btoa`)를 쓰지 않는 이유: `btoa` 는 Latin-1 만 받아
 *  U+00FF 를 넘는 글자가 하나라도 있으면 던진다. 지금 SVG 에는 글자가 없지만(★[A-9]),
 *  나중에 색 이름이나 id 로 비라틴 문자가 새어 들어와도 조용히 죽지 않게 encodeURIComponent 를 쓴다. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string, locale: Locale): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(translate(locale, 'export.imageLoadFailed')));
    img.src = src;
  });
}

async function waitForFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.race([fonts.ready, new Promise<void>((r) => setTimeout(r, FONT_WAIT_MS))]);
}

/** 글자를 캔버스에 얹는다. 세로 기준은 **언제나 중심**이다(staticSceneLayout 의 계약). */
export function paintTexts(ctx: CanvasRenderingContext2D, texts: readonly TextPlacement[], metrics: SceneMetrics): void {
  ctx.textBaseline = 'middle';
  for (const t of texts) {
    const p = textToOutputPx(t, metrics.scale);
    ctx.font = fontCssFor(t, metrics.scale);
    ctx.textAlign = canvasAlignFor(t.align);
    ctx.fillStyle = t.color;
    ctx.globalAlpha = t.opacity;
    ctx.fillText(t.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

export interface RasterResult {
  blob: Blob;
  widthPx: number;
  heightPx: number;
}

/** 한 장면 → PNG Blob. 실패는 예외로 던진다(호출부가 토스트로 옮긴다). */
export async function rasterizeFrameToPng(
  frame: RenderFrame,
  opts: StaticSceneOpts,
  locale: Locale,
  // 개체 표시 순서(2026-09-06, PLAN-Z-ORDER 결정 12) — `buildStaticScene` 의 3번째 인자로 그대로
  // 나른다. 여기서 안 나르면 판에서 도형을 맨 앞으로 올린 스텝이 PNG 에서만 옛 순서로 구워진다.
  order?: readonly SceneRef[],
): Promise<RasterResult> {
  const scene = buildStaticScene(frame, opts, order);
  const { metrics } = scene;

  const canvas = document.createElement('canvas');
  canvas.width = metrics.widthPx;
  canvas.height = metrics.heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(translate(locale, 'export.canvasUnsupported'));

  // 순서가 중요하다: 폰트 대기 → 도형 → 글자. 도형을 먼저 그려야 글자가 칩 위에 얹힌다.
  await waitForFonts();
  const img = await loadImage(svgDataUri(scene.svg), locale);
  ctx.drawImage(img, 0, 0, metrics.widthPx, metrics.heightPx);
  paintTexts(ctx, scene.texts, metrics);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(translate(locale, 'export.blobFailed'));
  return { blob, widthPx: metrics.widthPx, heightPx: metrics.heightPx };
}
