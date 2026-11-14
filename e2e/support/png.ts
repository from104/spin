// PNG 를 풀어 화소를 읽는 최소 디코더 — S12(PNG 내보내기)가 "내려온 파일이 정말 그림인가" 를 재는 판정자.
// docs/PLAN-TEST-SUITE.md §5 S12.
//
// 왜 직접 푸는가: 앱이 만든 그림을 **앱 밖의 판정자**로 읽어야 한다 — 브라우저(`createImageBitmap`)로 풀면 그림을
// 그린 바로 그 엔진이 자기 산출물을 채점한다. 의존성을 하나 더 들이는 대신 Node 의 zlib 하나로 푼다
// (드라이버 중립: Tauri·Android 어댑터도 Node 에서 돈다).
//
// 받는 것은 캔버스 `toBlob('image/png')` 가 내는 꼴뿐이다 — 8비트 RGB/RGBA, 비월(interlace) 없음. 다른 꼴이면
// 조용히 틀린 화소를 내지 않고 던진다.
import { inflateSync } from 'node:zlib';

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA 8비트, 행 우선(width × height × 4) */
  rgba: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** 첫 8바이트가 PNG 서명인가 */
export const isPng = (bytes: Uint8Array): boolean => SIGNATURE.every((b, i) => bytes[i] === b);

export function decodePng(bytes: Uint8Array): DecodedPng {
  if (!isPng(bytes)) throw new Error('PNG 서명이 아니다');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= bytes.length; ) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
        throw new Error(`지원하지 않는 PNG 꼴 — 비트 ${depth}, 색 유형 ${colorType}, 비월 ${interlace}`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + len;
  }
  if (!width || !height || !channels) throw new Error('IHDR 이 없다');

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length !== height * (stride + 1)) throw new Error(`IDAT 길이가 맞지 않는다 — ${raw.length} ≠ ${height * (stride + 1)}`);

  // 행 필터 되돌리기(PNG 명세 9장): None·Sub·Up·Average·Paeth
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[row + x - channels]! : 0;
      const b = y > 0 ? px[row - stride + x]! : 0;
      const c = x >= channels && y > 0 ? px[row - stride + x - channels]! : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`알 수 없는 행 필터 ${filter}`);
      px[row + x] = (raw[src + x]! + pred) & 0xff;
    }
  }
  if (channels === 4) return { width, height, rgba: px };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
    rgba[j] = px[i]!;
    rgba[j + 1] = px[i + 1]!;
    rgba[j + 2] = px[i + 2]!;
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}
