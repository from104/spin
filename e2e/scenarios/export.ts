// S12 PNG 내보내기 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: [내보내기 → 그림(PNG)] 을 눌렀는데 (1) 파일이 안 내려오거나, (2) 내려온 것이 PNG 가 아니거나
// (깨진 Blob·빈 파일), (3) 그림이 비어 있거나(SVG → `<img>` → 캔버스 래스터화가 조용히 실패하면 캡션 글자만 찍힌
// 빈 판이 나간다 — `rasterize.ts` 머리말대로 jsdom 에는 캔버스·이미지 디코딩이 없어 이 길은 단위 테스트가 0이다),
// (4) 판에 놓은 휠체어가 그림에 없거나 엉뚱한 자리에 찍히는 것(내보내기 프레임 배선). 코치가 카톡으로 보내는 바로
// 그 파일이고, WebKit 의 SVG 래스터화는 Chromium 과 다르다.
//
// 판정은 앱 밖에서 한다 — 내려온 바이트를 Node 에서 직접 풀어(e2e/support/png.ts) 화소를 센다. 그림 문구·색 값을
// 베끼지 않는다: 같은 판을 휠체어 없이·있게 두 번 뽑아 **달라진 화소**로 휠체어를 찾는다.
import type { DownloadedFile, SpinApp } from '../drivers/SpinApp.ts';
import { decodePng, isPng, type DecodedPng } from '../support/png.ts';
import { at, check, defineGroup, eventually, expectQuiet } from './kit.ts';

/** 휠체어를 놓을 코트 점 — 왼쪽 5분의 1. 그림에서 왼쪽에 찍혀야 한다(좌우가 뒤집히거나 가운데로 몰리면 빨강) */
const CHAIR_U = 0.2;

/** 내보내기 시트를 열고 [그림(PNG)] 을 눌러 내려온 파일을 받는다. 저장되면 시트는 스스로 닫힌다 */
export async function exportPng(app: SpinApp): Promise<DownloadedFile> {
  await app.pressAnchor('editor-export');
  await eventually('내보내기 시트', () => app.present('export-png'), true);
  const file = await app.download(() => app.press('export-png'));
  await eventually('저장 뒤 시트 닫힘', () => app.present('export-png'), false);
  return file;
}

/** 한 장을 풀고 PNG 로서의 꼴을 본다 */
export function decoded(file: DownloadedFile, label: string): DecodedPng {
  check(/\.png$/i.test(file.name), `${label}: 파일 이름이 .png 가 아니다`, file.name);
  check(isPng(file.bytes), `${label}: 내려온 파일이 PNG 가 아니다(서명)`, Array.from(file.bytes.subarray(0, 8)));
  const img = decodePng(file.bytes);
  // 계획서(PLAN) §6.2 [A-10] — 출력의 긴 변은 2048px(2x). 이용자가 받는 파일의 약속이라 숫자로 본다
  check(Math.max(img.width, img.height) === 2048, `${label}: 긴 변이 2048px 가 아니다`, [img.width, img.height]);
  return img;
}

const rgbaAt = (img: DecodedPng, i: number): number =>
  ((img.rgba[i * 4]! << 24) | (img.rgba[i * 4 + 1]! << 16) | (img.rgba[i * 4 + 2]! << 8) | img.rgba[i * 4 + 3]!) >>> 0;

/** 화소 구성 — 완전 불투명 화소의 비율과 가장 흔한 한 색의 비율. 래스터화가 빠진 그림은 투명 바탕 + 캡션 띠뿐이라
 *  앞의 것이 0 에 가깝고, 판이 한 색으로만 칠해지면 뒤의 것이 1 에 가깝다 */
function coverage(img: DecodedPng): { opaque: number; dominant: number } {
  const counts = new Map<number, number>();
  const n = img.width * img.height;
  let opaque = 0;
  for (let i = 0; i < n; i++) {
    if (img.rgba[i * 4 + 3] === 255) opaque++;
    const c = rgbaAt(img, i);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return { opaque: opaque / n, dominant: Math.max(...counts.values()) / n };
}

/** 두 그림에서 달라진 화소(채널 차 합 > 48)의 수·외접 상자·무게중심(0..1 비율) */
export function difference(a: DecodedPng, b: DecodedPng) {
  let count = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      const d =
        Math.abs(a.rgba[i]! - b.rgba[i]!) +
        Math.abs(a.rgba[i + 1]! - b.rgba[i + 1]!) +
        Math.abs(a.rgba[i + 2]! - b.rgba[i + 2]!) +
        Math.abs(a.rgba[i + 3]! - b.rgba[i + 3]!);
      if (d <= 48) continue;
      count++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return {
    count,
    cx: count ? sx / count / a.width : NaN,
    cy: count ? sy / count / a.height : NaN,
    boxW: count ? (maxX - minX + 1) / a.width : 0,
    boxH: count ? (maxY - minY + 1) / a.height : 0,
  };
}

export default defineGroup('export', [
  {
    title: 'S12 PNG 내보내기',
    needs: ['download'],
    run: async (app) => {
      const empty = decoded(await exportPng(app), '빈 판');
      // 코트가 그려졌다 — 그림 대부분이 불투명하게 칠해졌고(래스터화가 빠지면 투명 바탕 + 캡션 띠뿐이다) 한 색이 아니다
      const { opaque, dominant } = coverage(empty);
      check(opaque > 0.5, '그림 대부분이 투명하다 — 판이 래스터화되지 않았다', opaque.toFixed(3));
      check(dominant < 0.9, '그림이 거의 한 색이다 — 코트 선·구역이 그려지지 않았다', dominant.toFixed(3));

      await app.placeFromTray('chair', at(CHAIR_U, 0.5), { via: 'drag', team: 'home' });
      const withChair = decoded(await exportPng(app), '휠체어 판');
      check(
        withChair.width === empty.width && withChair.height === empty.height,
        '같은 판인데 두 그림의 크기가 다르다',
        [empty.width, empty.height, withChair.width, withChair.height],
      );
      const diff = difference(empty, withChair);
      // 휠체어가 그려졌다 — 놓기 전후 그림이 휠체어 하나만큼 다르다
      check(diff.count > 0.0005 * empty.width * empty.height, '휠체어를 놓았는데 그림이 그대로다', diff.count);
      check(diff.boxW < 0.25 && diff.boxH < 0.25, '달라진 자리가 휠체어 하나가 아니라 그림 전체에 퍼졌다', diff);
      // 놓은 자리에 — 코트 왼쪽 5분의 1에 놓은 휠체어는 그림 왼쪽에 찍힌다
      check(diff.cx < 0.4, '휠체어가 그림에서 놓은 쪽(왼쪽)에 있지 않다', diff);
      await expectQuiet(app, 'S12');
    },
  },
]);
