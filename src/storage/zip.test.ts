// §4.7b ZIP 조립기. **직접 만든 포맷 코드라 바이트 단위로 잰다** — 라이브러리를 안 쓴 대가는
// "우리가 옳다는 것을 우리가 증명해야 한다" 이고, 그 증명이 이 파일이다.
//
// 검증 전략 셋:
//   ① **알려진 정답과 대조**: CRC-32 는 표준 테스트 벡터("123456789" → 0xCBF43926)가 있다.
//      우리 구현이 그걸 못 맞히면 나머지는 볼 것도 없다.
//   ② **구조 파싱**: 만든 바이트를 도로 읽어 시그니처·개수·이름·오프셋이 맞는지 본다.
//      실제 압축 해제기가 하는 일의 축소판이다.
//   ③ **왕복**: stored 라 파일 바이트가 그대로 들어 있어야 한다 — 오프셋으로 잘라내 원본과 비교.
import { describe, expect, it } from 'vitest';
import { buildZip, crc32, type ZipEntry } from './zip.ts';

const FIXED = new Date(2026, 7, 27, 13, 45, 30);
const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());
const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number): number => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

describe('crc32 — 알려진 정답', () => {
  it('★ 표준 테스트 벡터 "123456789" → 0xCBF43926', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('빈 입력은 0 이다', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('한 바이트만 달라도 값이 달라진다 — 대조군', () => {
    const a = crc32(new TextEncoder().encode('spin'));
    const b = crc32(new TextEncoder().encode('spio'));
    expect(a).not.toBe(b);
  });
});

describe('buildZip — 구조', () => {
  const entries: ZipEntry[] = [
    { name: 'SPIN_드릴_1.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) },
    { name: 'SPIN_드릴_2.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]) },
  ];

  it('MIME 이 application/zip 이다', () => {
    expect(buildZip(entries, FIXED).type).toBe('application/zip');
  });

  it('★ 첫 4바이트가 PK\\x03\\x04 다 — 압축 해제기가 제일 먼저 보는 것', async () => {
    const b = await bytesOf(buildZip(entries, FIXED));
    expect([b[0], b[1], b[2], b[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('★ 끝에 EOCD 가 있고 항목 수가 정확하다', async () => {
    const b = await bytesOf(buildZip(entries, FIXED));
    const at = b.length - 22; // 코멘트가 없으므로 EOCD 는 정확히 마지막 22바이트다
    expect(u32(b, at), 'EOCD 시그니처').toBe(0x06054b50);
    expect(u16(b, at + 8), '이 디스크의 항목 수').toBe(2);
    expect(u16(b, at + 10), '전체 항목 수').toBe(2);
  });

  it('★ 파일 바이트가 그대로 들어 있다 — stored 라 변형이 없어야 한다', async () => {
    const b = await bytesOf(buildZip([entries[0]!], FIXED));
    const nameLen = u16(b, 26);
    const extraLen = u16(b, 28);
    const dataAt = 30 + nameLen + extraLen;
    expect(Array.from(b.slice(dataAt, dataAt + entries[0]!.bytes.length))).toEqual(Array.from(entries[0]!.bytes));
  });

  it('★ 압축 크기 == 원본 크기 (method 0)', async () => {
    const b = await bytesOf(buildZip([entries[0]!], FIXED));
    expect(u16(b, 8), 'method').toBe(0);
    expect(u32(b, 18), 'compressed size').toBe(entries[0]!.bytes.length);
    expect(u32(b, 22), 'uncompressed size').toBe(entries[0]!.bytes.length);
  });

  it('★ CRC 가 헤더에 실린다 — 압축 해제기가 무결성을 이걸로 본다', async () => {
    const b = await bytesOf(buildZip([entries[0]!], FIXED));
    expect(u32(b, 14)).toBe(crc32(entries[0]!.bytes));
  });

  it('★ 한글 이름을 위해 UTF-8 플래그(bit 11)를 세운다', async () => {
    const b = await bytesOf(buildZip(entries, FIXED));
    expect(u16(b, 6) & 0x0800, '이 비트가 없으면 옛 탐색기가 한글을 깨뜨린다').toBe(0x0800);
    // 이름이 실제로 UTF-8 바이트로 들어갔는가(한글은 글자당 3바이트다).
    const nameLen = u16(b, 26);
    expect(nameLen).toBe(new TextEncoder().encode(entries[0]!.name).length);
    expect(nameLen).toBeGreaterThan(entries[0]!.name.length); // ASCII 였다면 같았을 것
  });

  it('중앙 디렉터리의 오프셋이 각 로컬 헤더를 정확히 가리킨다', async () => {
    const b = await bytesOf(buildZip(entries, FIXED));
    const eocd = b.length - 22;
    let at = u32(b, eocd + 16); // central directory 시작
    for (const e of entries) {
      expect(u32(b, at), 'central 시그니처').toBe(0x02014b50);
      const nameLen = u16(b, at + 28);
      const localAt = u32(b, at + 42);
      expect(u32(b, localAt), `${e.name} 의 로컬 헤더`).toBe(0x04034b50);
      at += 46 + nameLen;
    }
  });

  it('빈 목록도 유효한 ZIP 이다 — EOCD 만 있는 22바이트', async () => {
    const b = await bytesOf(buildZip([], FIXED));
    expect(b.length).toBe(22);
    expect(u32(b, 0)).toBe(0x06054b50);
    expect(u16(b, 8)).toBe(0);
  });

  it('같은 입력 + 같은 시각이면 바이트가 동일하다 — 시각을 인자로 받는 이유', async () => {
    const a = await bytesOf(buildZip(entries, FIXED));
    const b = await bytesOf(buildZip(entries, FIXED));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
