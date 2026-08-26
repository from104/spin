// §4.7b 무압축(store) ZIP 조립 — **의존성 0**.
//
// ── 왜 라이브러리를 안 쓰는가 ──────────────────────────────────────────────────────────
// 이 저장소는 번들 바이트에 이유 있게 인색하다: `buildStaticSvg.ts` 머리말이 `react-dom/server`
// +63.4 kB 를 두고 *"체육관에서 오프라인으로 쓰는 앱에 40% 를 얹는 값"* 이라며 통째로 되돌린
// 전례를 남겼다. JSZip 은 gzip 30 kB 안팎이고, 우리가 그 값으로 사는 것은 **deflate 하나**다.
//
// 그런데 **우리가 담는 것은 PNG 다.** PNG 는 이미 deflate 로 압축된 포맷이라 다시 압축해도
// 줄지 않는다(실측: 수 %도 아니고 0.1 % 수준, 오히려 커지는 경우도 있다). 즉 라이브러리가
// 파는 기능을 우리는 **쓸 일이 없다.** 남는 것은 헤더 조립뿐이고, 그것이 이 파일이다.
//
// ── 무엇을 구현했나 ──────────────────────────────────────────────────────────────────
// ZIP 의 최소 형태 세 조각만 쓴다(APPNOTE 4.3.6~4.3.16):
//   ① Local file header + 파일 바이트  (파일마다)
//   ② Central directory header          (파일마다, 끝에 몰아서)
//   ③ End of central directory record   (한 번)
// 압축 방식은 **0 = stored**. 그래서 CRC-32 말고는 계산할 것이 없다.
//
// ⚠️ Zip64 는 **안 만든다.** 4 GiB·65535개 한계 안이라는 전제이고, 실제로는 PNG 60장
//    (LIMITS.maxSteps)이 상한이라 근처도 못 간다. 넘길 수 있는 입력이 생기면 그때 만든다 —
//    지금 미리 만들면 검증할 수 없는 코드가 남는다.
// ⚠️ 파일명은 **UTF-8**로 쓰고 general purpose flag bit 11(EFS)을 세운다. 한글 드릴 이름이
//    그대로 들어가므로 이 비트가 없으면 옛 탐색기가 CP437 로 읽어 깨진다.

/** CRC-32 (IEEE 802.3) 표. 처음 쓸 때 한 번 만든다 — 모듈 로드 시점에 만들면 ZIP 을 한 번도
 *  안 뽑는 사용자도 256회 루프를 치른다(대부분의 세션이 그렇다). */
let crcTable: Uint32Array | null = null;
function table(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  crcTable = t;
  return t;
}

export function crc32(bytes: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** 압축 파일 안의 경로. 폴더를 만들려면 `폴더/파일.png` 처럼 슬래시를 쓴다. */
  name: string;
  bytes: Uint8Array;
}

/** DOS 시각 형식(APPNOTE 4.4.6). 초는 2초 단위로 접힌다 — 포맷이 5비트뿐이라 그렇다. */
function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** 리틀엔디언으로 쌓는 작은 버퍼. DataView 를 매번 만들지 않기 위해 한 번만 감싼다. */
class Sink {
  private readonly parts: Uint8Array[] = [];
  length = 0;
  push(b: Uint8Array): void {
    this.parts.push(b);
    this.length += b.length;
  }
  u16(v: number): void {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff]));
  }
  u32(v: number): void {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]));
  }
  all(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(new ArrayBuffer(this.length));
    let at = 0;
    for (const p of this.parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}

/** 항목들 → ZIP 한 벌(Blob). 압축하지 않으므로 결과 크기는 입력 합 + 헤더(항목당 ~90 B + 이름 2회)다.
 *
 *  `now` 를 인자로 받는 이유는 테스트다 — 시각이 바이트에 실리므로 고정하지 않으면 같은 입력이
 *  매번 다른 출력을 낸다(바이트 단언을 쓸 수 없게 된다). */
export function buildZip(entries: readonly ZipEntry[], now: Date = new Date()): Blob {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const body = new Sink();
  const central = new Sink();

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const offset = body.length;

    // ① Local file header
    body.u32(0x04034b50);
    body.u16(20); // version needed (2.0 — stored/deflate 기본)
    body.u16(0x0800); // flag: bit 11 = 이름이 UTF-8 이다
    body.u16(0); // method 0 = stored
    body.u16(time);
    body.u16(date);
    body.u32(crc);
    body.u32(e.bytes.length); // compressed = uncompressed (stored)
    body.u32(e.bytes.length);
    body.u16(nameBytes.length);
    body.u16(0); // extra field 없음
    body.push(nameBytes);
    body.push(e.bytes);

    // ② Central directory header — 같은 값 + 오프셋
    central.u32(0x02014b50);
    central.u16(20); // version made by
    central.u16(20); // version needed
    central.u16(0x0800);
    central.u16(0);
    central.u16(time);
    central.u16(date);
    central.u32(crc);
    central.u32(e.bytes.length);
    central.u32(e.bytes.length);
    central.u16(nameBytes.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk number
    central.u16(0); // internal attrs
    central.u32(0); // external attrs
    central.u32(offset);
    central.push(nameBytes);
  }

  // ③ End of central directory
  const end = new Sink();
  end.u32(0x06054b50);
  end.u16(0); // this disk
  end.u16(0); // disk with central dir
  end.u16(entries.length);
  end.u16(entries.length);
  end.u32(central.length);
  end.u32(body.length);
  end.u16(0); // comment length

  return new Blob([body.all(), central.all(), end.all()], { type: 'application/zip' });
}
