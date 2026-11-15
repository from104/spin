// XWD(X Window Dump) 를 풀어 화소를 읽는 최소 디코더 — 실제 앱 층이 "디스플레이에 정말 그려졌는가" 를 X 서버의 눈으로 잰다.
// docs/PLAN-TEST-SUITE.md §12.
//
// 왜 WebDriver 스크린샷이 아닌가: 그것은 웹뷰가 **스스로** 찍은 그림(WebKit 스냅숏)이다 — 화면에 안 나간 판도 그려 낸다. 게다가
// 배송 AppImage 의 번들 WebKit 은 한 번 이동한 뒤 WebDriver 스크린샷이 영영 안 돌아온다(gofu 실측 2026-11-15, 첫 문서에서는 0.5초).
// `xwd -root` 는 Xvfb 의 프레임버퍼를 그대로 준다. 받는 꼴은 ZPixmap·TrueColor/DirectColor·24/32bpp 뿐(Xvfb 의 깊이 24 루트는
// DirectColor 다 — 채널 값을 색표로 한 번 더 푼다) — 다른 꼴이면 조용히 틀린 화소를 내지 않고 던진다.
import { spawnSync } from 'node:child_process';

import type { DecodedPng } from '../support/png.ts';

/** 마스크의 가장 낮은 켜진 비트 자리 */
const shiftOf = (mask: number): number => {
  let s = 0;
  while (s < 32 && ((mask >>> s) & 1) === 0) s++;
  return s;
};

export function decodeXwd(buf: Buffer): DecodedPng {
  const h = (i: number) => buf.readUInt32BE(i * 4);
  const headerSize = h(0);
  const [version, format, width, height, byteOrder, bpp, bytesPerLine, visualClass] = [h(1), h(2), h(4), h(5), h(7), h(11), h(12), h(13)];
  const [redMask, greenMask, blueMask, ncolors] = [h(14), h(15), h(16), h(19)];
  if (version !== 7 || format !== 2 || (visualClass !== 4 && visualClass !== 5) || (bpp !== 32 && bpp !== 24)) {
    throw new Error(`XWD 꼴이 아니다(판 ${version}, 형식 ${format}, 시각 ${visualClass}, ${bpp}bpp) — ZPixmap TrueColor/DirectColor 24/32bpp 만 푼다`);
  }
  const data = headerSize + ncolors * 12;
  // DirectColor: 채널 값 = 색표의 자리. 색표 항목(XWDColor 12바이트) = 화소 4 · 빨강 2 · 초록 2 · 파랑 2 · 깃발 1 · 채움 1
  const lut = (channel: number): Uint8Array => {
    const out = new Uint8Array(256).map((_, i) => i);
    if (visualClass !== 5) return out;
    for (let k = 0; k < Math.min(ncolors, 256); k++) out[k] = buf.readUInt16BE(headerSize + k * 12 + 4 + channel * 2) >>> 8;
    return out;
  };
  const [rl, gl, bl] = [lut(0), lut(1), lut(2)];
  if (buf.length < data + bytesPerLine * height) throw new Error('XWD 화소가 모자란다');
  const [rs, gs, bs] = [shiftOf(redMask), shiftOf(greenMask), shiftOf(blueMask)];
  const step = bpp / 8;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = data + y * bytesPerLine + x * step;
      const p = step === 4 ? (byteOrder === 0 ? buf.readUInt32LE(o) : buf.readUInt32BE(o)) : byteOrder === 0 ? buf.readUIntLE(o, 3) : buf.readUIntBE(o, 3);
      const i = (y * width + x) * 4;
      rgba[i] = rl[(p & redMask) >>> rs]!;
      rgba[i + 1] = gl[(p & greenMask) >>> gs]!;
      rgba[i + 2] = bl[(p & blueMask) >>> bs]!;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/** 지금 X 화면(루트 창) 전체 — env 는 격리 세션의 DISPLAY 를 가진 환경 */
export function captureRoot(env: NodeJS.ProcessEnv): DecodedPng {
  const r = spawnSync('xwd', ['-root', '-silent'], { env, maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
  if (r.status !== 0) throw new Error(`xwd 실패(exit ${r.status}): ${String(r.stderr).slice(0, 120)}`);
  return decodeXwd(r.stdout);
}
