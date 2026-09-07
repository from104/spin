// 공유 코덱의 회귀선. 지우면 새는 실기 버그를 하나씩 짚는다:
//  ① 접었다 편 드릴이 달라지면 링크로 받은 드릴이 조용히 다른 드릴이 된다(왕복 항등).
//  ② 이름 제거가 이름 말고 다른 것까지 지우면 받는 쪽 드릴이 망가진다 — 그리고 **보내는 쪽
//     원본이 바뀌면** 코치가 자기 드릴에서 선수 이름을 잃는다(결정 8의 진짜 위험).
//  ③ 표식 바이트를 안 보면 아무 바이트나 JSON 으로 펴려 든다.
//  ④ 압축 폭탄 상한이 없으면 8 KB 링크 하나가 탭을 죽인다(결정 5).
//  ⑤ too-new 를 'invalid' 로 뭉치면 "앱을 업데이트하세요" 대신 "링크가 손상됐습니다" 가 뜬다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../model/defaults.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import type { Drill } from '../model/drill.ts';
import { encodeDrillPayload, decodeDrillPayload, SHARE_CODEC_DEFLATE_RAW } from './codec.ts';
import { ShareError, type ShareBytes } from './api.ts';

function named(): Drill {
  const d = createDrill({ courtMode: 'full', title: '공유 왕복' });
  return {
    ...d,
    teams: {
      home: { ...d.teams.home, label: '노란들판' },
      away: { ...d.teams.away, label: '가치이룸' },
    },
    cast: {
      ...d.cast,
      chairs: d.cast.chairs.map((c, i) => (i === 0 ? { ...c, name: '홍길동' } : c)),
    },
  };
}

/** 임의의 텍스트를 이 코덱의 바이트로 접는다 — 봉투를 손으로 지어야 하는 케이스(⑤)용. */
async function fold(text: string): Promise<ShareBytes> {
  const src = new ReadableStream<ShareBytes>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
  const reader = src.pipeThrough(new CompressionStream('deflate-raw')).getReader();
  const chunks: ShareBytes[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total + 1);
  out[0] = SHARE_CODEC_DEFLATE_RAW;
  let at = 1;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function kindOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return 'no-throw';
  } catch (e) {
    return e instanceof ShareError ? e.kind : `other:${String(e)}`;
  }
}

describe('codec — 봉투를 접고 편다', () => {
  it('이름을 그대로 둔 왕복은 항등이다 — 링크로 받은 드릴이 보낸 드릴과 같다', async () => {
    const drill = named();
    const decoded = await decodeDrillPayload(await encodeDrillPayload(drill));
    expect(decoded).toEqual(drill);
  });

  it('stripNames 는 선수 실명과 팀 이름만 지운다 — 나머지는 한 글자도 안 바뀐다', async () => {
    const drill = named();
    const decoded = await decodeDrillPayload(await encodeDrillPayload(drill, { stripNames: true }));

    expect(decoded.cast.chairs.some((c) => c.name !== undefined)).toBe(false);
    // 키가 지워졌으므로 받는 쪽 validate 가 기본 팀 이름으로 채운다(빈 문자열이 아니다).
    expect(decoded.teams.home.label).toBe(DEFAULT_TEAMS.home.label);
    expect(decoded.teams.away.label).toBe(DEFAULT_TEAMS.away.label);
    // 지운 둘 말고는 전부 동일 — 기대값을 손으로 적지 않고 원본에서 그 둘만 뺀 것과 맞춘다.
    expect(decoded).toEqual({
      ...drill,
      teams: {
        home: { ...drill.teams.home, label: DEFAULT_TEAMS.home.label },
        away: { ...drill.teams.away, label: DEFAULT_TEAMS.away.label },
      },
      cast: {
        ...drill.cast,
        chairs: drill.cast.chairs.map(({ name, ...rest }) => {
          void name;
          return rest;
        }),
      },
    });
  });

  it('stripNames 가 보내는 쪽 원본을 건드리지 않는다 — 공유했다고 내 드릴에서 이름이 사라지면 안 된다', async () => {
    const drill = named();
    await encodeDrillPayload(drill, { stripNames: true });
    expect(drill.cast.chairs[0]!.name).toBe('홍길동');
    expect(drill.teams.home.label).toBe('노란들판');
  });

  it('첫 바이트가 코덱 표식이 아니면 펴지 않는다', async () => {
    const bytes = await encodeDrillPayload(named());
    bytes[0] = 0x02;
    expect(await kindOf(decodeDrillPayload(bytes))).toBe('invalid');
    expect(await kindOf(decodeDrillPayload(new Uint8Array([SHARE_CODEC_DEFLATE_RAW])))).toBe('invalid');
  });

  it('펴는 중 1 MiB 를 넘으면 끊는다 — 압축 폭탄이 탭을 죽이기 전에', async () => {
    // 2 MiB 의 0 은 deflate 가 수 KB 로 접는다. 상한이 없으면 이것이 통째로 펴진다.
    const bomb = await fold('0'.repeat(2 * 1024 * 1024));
    expect(bomb.byteLength).toBeLessThan(16 * 1024); // 링크에 실릴 만한 크기라는 것이 이 사고의 전제
    expect(await kindOf(decodeDrillPayload(bomb))).toBe('too-large');
  });

  it('더 새로운 봉투는 손상이 아니라 too-new 다 — 사용자가 할 일이 다르다', async () => {
    const tooNew = await fold(JSON.stringify({ spin: 'drill', envelope: 99, app: 'SPIN', exportedAt: 0, payload: {} }));
    expect(await kindOf(decodeDrillPayload(tooNew))).toBe('too-new');
  });

  it('드릴이 아닌 봉투와 검증 탈락은 invalid — 조용히 통과하지 않는다', async () => {
    const library = await fold(JSON.stringify({ spin: 'library', envelope: 1, app: 'SPIN', exportedAt: 0, payload: [] }));
    expect(await kindOf(decodeDrillPayload(library))).toBe('invalid');
    const broken = await fold(JSON.stringify({ spin: 'drill', envelope: 1, app: 'SPIN', exportedAt: 0, payload: { id: 'nope' } }));
    expect(await kindOf(decodeDrillPayload(broken))).toBe('invalid');
  });
});
