// 공유 코덱의 회귀선. 지우면 새는 실기 버그를 하나씩 짚는다:
//  ① 접었다 편 드릴이 달라지면 링크로 받은 드릴이 조용히 다른 드릴이 된다(왕복 항등).
//  ② 이름 제거가 이름 말고 다른 것까지 지우면 받는 쪽 드릴이 망가진다 — 그리고 **보내는 쪽
//     원본이 바뀌면** 코치가 자기 드릴에서 선수 이름을 잃는다(결정 8의 진짜 위험).
//  ③ 표식 바이트를 안 보면 아무 바이트나 JSON 으로 펴려 든다.
//  ④ 압축 폭탄 상한이 없으면 8 KB 링크 하나가 탭을 죽인다(결정 5).
//  ⑤ too-new 를 'invalid' 로 뭉치면 "앱을 업데이트하세요" 대신 "링크가 손상됐습니다" 가 뜬다.
//  ⑥ (2026-09-08 세션 공유) 세션 봉투가 드릴 자리에서 'invalid' 로 떨어지면 세션 링크가 통째로
//     안 열린다 — 종류를 봉투가 말한다는 S5 가 이 파일의 단언으로만 지켜진다.
//  ⑦ 참가자 명단이 안 빠지면 링크 하나에 우리 팀 명단이 실려 나가고 회수가 안 된다(S2).
import { describe, expect, it } from 'vitest';
import { createDrill } from '../model/defaults.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import type { Drill } from '../model/drill.ts';
import type { TrainingSession } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA } from '../model/session.ts';
import type { ItemId, PhaseId, PlayerId, SessionId } from '../core/ids.ts';
import { encodeSharePayload, decodeSharePayload, SHARE_CODEC_DEFLATE_RAW } from './codec.ts';
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

/** 실명·팀 이름이 든 드릴 두 개를 데리고 다니는 세션. 참가자 명단(S2 가 빼는 것)과 장소·메모
 *  (S2 가 **남기는** 것)를 둘 다 담아 둔다 — 이 둘이 갈리는 것이 결정의 전부다. */
function sessionOf(drills: Drill[]): TrainingSession {
  return {
    schemaVersion: CURRENT_SESSION_SCHEMA,
    id: 'se_share01' as SessionId,
    title: '수요일 훈련',
    note: '공 4개 준비',
    location: '가치이룸 체육관',
    phases: [
      {
        id: 'ph_share01' as PhaseId,
        kind: 'technical',
        items: drills.map((d, i) => ({
          id: `it_share0${i}` as ItemId,
          drillId: d.id,
          titleCache: d.title,
          durationMinCache: 10,
          categoryCache: 'technical',
        })),
      },
    ],
    participantIds: ['pl_hong01', 'pl_kim002'] as PlayerId[],
    drillIds: drills.map((d) => d.id),
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_500,
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
    // 종류까지 함께 본다 — 세션이 붙은 뒤에도 드릴 링크는 `kind:'drill'` 로 나와야 한다(S5).
    expect(await decodeSharePayload(await encodeSharePayload({ kind: 'drill', drill }))).toEqual({ kind: 'drill', drill });
  });

  it('strip 은 선수 실명과 팀 이름만 지운다 — 나머지는 한 글자도 안 바뀐다', async () => {
    const drill = named();
    const opened = await decodeSharePayload(await encodeSharePayload({ kind: 'drill', drill }, { strip: true }));
    expect(opened.kind).toBe('drill');
    const decoded = (opened as { kind: 'drill'; drill: Drill }).drill;

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

  it('strip 이 보내는 쪽 원본을 건드리지 않는다 — 공유했다고 내 드릴에서 이름이 사라지면 안 된다', async () => {
    const drill = named();
    await encodeSharePayload({ kind: 'drill', drill }, { strip: true });
    expect(drill.cast.chairs[0]!.name).toBe('홍길동');
    expect(drill.teams.home.label).toBe('노란들판');
  });

  it('첫 바이트가 코덱 표식이 아니면 펴지 않는다', async () => {
    const bytes = await encodeSharePayload({ kind: 'drill', drill: named() });
    bytes[0] = 0x02;
    expect(await kindOf(decodeSharePayload(bytes))).toBe('invalid');
    expect(await kindOf(decodeSharePayload(new Uint8Array([SHARE_CODEC_DEFLATE_RAW])))).toBe('invalid');
  });

  it('펴는 중 4 MiB 를 넘으면 끊는다 — 압축 폭탄이 탭을 죽이기 전에', async () => {
    // 8 MiB 의 0 은 deflate 가 수 KB 로 접는다. 상한이 없으면 이것이 통째로 펴진다.
    const bomb = await fold('0'.repeat(8 * 1024 * 1024));
    expect(bomb.byteLength).toBeLessThan(16 * 1024); // 링크에 실릴 만한 크기라는 것이 이 사고의 전제
    expect(await kindOf(decodeSharePayload(bomb))).toBe('too-large');
  });

  it('더 새로운 봉투는 손상이 아니라 too-new 다 — 사용자가 할 일이 다르다', async () => {
    const tooNew = await fold(JSON.stringify({ spin: 'drill', envelope: 99, app: 'SPIN', exportedAt: 0, payload: {} }));
    expect(await kindOf(decodeSharePayload(tooNew))).toBe('too-new');
  });

  it('드릴이 아닌 봉투와 검증 탈락은 invalid — 조용히 통과하지 않는다', async () => {
    const library = await fold(JSON.stringify({ spin: 'library', envelope: 1, app: 'SPIN', exportedAt: 0, payload: [] }));
    expect(await kindOf(decodeSharePayload(library))).toBe('invalid');
    const broken = await fold(JSON.stringify({ spin: 'drill', envelope: 1, app: 'SPIN', exportedAt: 0, payload: { id: 'nope' } }));
    expect(await kindOf(decodeSharePayload(broken))).toBe('invalid');
  });
});

// ── 세션 링크 (2026-09-08, PLAN-SHARE-LINK §6 S1·S2·S5) ─────────────────────────────────
describe('codec — 세션 봉투', () => {
  it('세션 왕복은 항등이다 — 세션 1개 + 드릴 2개가 그대로 나온다', async () => {
    const drills = [named(), createDrill({ courtMode: 'full', title: '두 번째' })];
    const session = sessionOf(drills);
    const opened = await decodeSharePayload(await encodeSharePayload({ kind: 'session', session, drills }));
    expect(opened).toEqual({ kind: 'session', session, drills });
  });

  it('세션 봉투는 드릴 자리에서 거절되지 않고 kind:session 으로 나온다 — 종류는 봉투가 말한다', async () => {
    const drills = [named()];
    const opened = await decodeSharePayload(await encodeSharePayload({ kind: 'session', session: sessionOf(drills), drills }));
    // ⚠️ 2026-09-08 이전에는 이 자리가 'invalid' 였다(PLAN-URL-SHARE 결정 11). 그 시절로
    //    되돌아가면 세션 링크는 "링크가 손상됐습니다" 로만 보인다.
    expect(opened.kind).toBe('session');
  });

  it('strip 은 참가자 명단과 드릴들의 실명·팀 이름을 뺀다 — 장소·메모는 남긴다', async () => {
    const drills = [named(), createDrill({ courtMode: 'full', title: '두 번째' })];
    const session = sessionOf(drills);
    const opened = await decodeSharePayload(await encodeSharePayload({ kind: 'session', session, drills }, { strip: true }));
    expect(opened.kind).toBe('session');
    const got = opened as { kind: 'session'; session: TrainingSession; drills: Drill[] };

    expect(got.session.participantIds).toBeUndefined();
    // 남기기로 한 것(S2) — 여기가 undefined 가 되면 받는 코치가 세션의 알맹이를 잃는다.
    expect(got.session.location).toBe('가치이룸 체육관');
    expect(got.session.note).toBe('공 4개 준비');
    // 데리고 온 드릴에도 지우개가 돌았는지 — 세션 경로에서 이것을 빠뜨리는 것이 가장 쉬운 실수다.
    expect(got.drills[0]!.cast.chairs.some((c) => c.name !== undefined)).toBe(false);
    expect(got.drills[0]!.teams.home.label).toBe(DEFAULT_TEAMS.home.label);
    expect(got.drills[0]!.teams.away.label).toBe(DEFAULT_TEAMS.away.label);
    // 뺀 셋 말고는 한 글자도 안 바뀐다 — 기대값을 손으로 적지 않고 원본에서 그 셋만 뺀 것과 맞춘다.
    const { participantIds, ...withoutParticipants } = session;
    void participantIds;
    expect(got.session).toEqual(withoutParticipants);
  });

  it('strip 이 보내는 쪽 세션·드릴 원본을 건드리지 않는다 — 공유했다고 내 명단이 사라지면 안 된다', async () => {
    const drills = [named()];
    const session = sessionOf(drills);
    await encodeSharePayload({ kind: 'session', session, drills }, { strip: true });
    expect(session.participantIds).toEqual(['pl_hong01', 'pl_kim002']);
    expect(drills[0]!.cast.chairs[0]!.name).toBe('홍길동');
  });

  it('데리고 온 드릴 하나가 손상이면 세션을 통째로 거절한다 — 조용히 빠지면 누락 항목의 이유가 사라진다', async () => {
    const drills = [named()];
    const session = sessionOf(drills);
    // 봉투를 손으로 짓는다 — 정상 세션에 «드릴 흉내를 내는 객체» 하나만 더한 모양이다.
    const envelope = {
      spin: 'session',
      envelope: 1,
      app: 'SPIN',
      exportedAt: 0,
      payload: { session, drills: [...drills, { id: 'nope' }] },
    };
    expect(await kindOf(decodeSharePayload(await fold(JSON.stringify(envelope))))).toBe('invalid');
  });
});
