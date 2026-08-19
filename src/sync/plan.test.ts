// 0.6 커밋 2 — planSync 판정 매트릭스 전수. 충돌 의미론의 전부가 이 순수 함수에 있으므로
// (엔진은 실행만 한다) 유실 시나리오는 전부 여기서, 네트워크 없이 표로 못박는다.
import { describe, it, expect } from 'vitest';
import { planSync, type PlanInputs, type SyncAction } from './plan.ts';

const W = 'writer-me';

function plan(partial: Partial<PlanInputs>): SyncAction[] {
  return planSync({ localDocs: [], localTombs: [], syncRows: [], remoteFiles: [], writerId: W, ...partial });
}

describe('한쪽에만 있는 경우', () => {
  it('로컬 산 문서 + 원격 없음 → pushCreate', () => {
    expect(plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 10 }] })).toEqual([
      { kind: 'pushCreate', type: 'drill', id: 'a', updatedAt: 10 },
    ]);
  });

  it('로컬 톰스톤 + 원격 없음 → clearTomb — 전파할 곳이 없다(업로드 전 삭제 또는 GC 뒤)', () => {
    expect(plan({ localTombs: [{ type: 'drill', id: 'a', deletedAt: 10 }] })).toEqual([{ kind: 'clearTomb', type: 'drill', id: 'a' }]);
  });

  it('원격 산 문서 + 로컬 없음 → pullCreate', () => {
    expect(plan({ remoteFiles: [{ fileId: 'f1', type: 'session', id: 's', modifiedAt: 7 }] })).toEqual([
      { kind: 'pullCreate', type: 'session', id: 's', modifiedAt: 7, fileId: 'f1' },
    ]);
  });

  it('원격 톰스톤 + 로컬 없음 → 행이 있으면 clearRow, 없으면 아무것도 안 한다', () => {
    const remoteFiles = [{ fileId: 'f1', type: 'drill' as const, id: 'a', modifiedAt: 5, deletedAt: 9 }];
    expect(plan({ remoteFiles })).toEqual([]);
    expect(plan({ remoteFiles, syncRows: [{ type: 'drill', id: 'a', lastSyncedAt: 5, remoteFileId: 'f1' }] })).toEqual([
      { kind: 'clearRow', type: 'drill', id: 'a' },
    ]);
  });
});

describe('양쪽 산 문서 — 최신 승', () => {
  const rem = { fileId: 'f1', type: 'drill' as const, id: 'a', modifiedAt: 10 };

  it('로컬이 최신 → pushUpdate(원격 파일 조준)', () => {
    expect(plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 20 }], remoteFiles: [rem] })).toEqual([
      { kind: 'pushUpdate', type: 'drill', id: 'a', updatedAt: 20, fileId: 'f1' },
    ]);
  });

  it('원격이 최신 → pullUpdate + CAS 기대값(계획 시점 로컬 updatedAt)', () => {
    expect(plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 5 }], remoteFiles: [rem] })).toEqual([
      { kind: 'pullUpdate', type: 'drill', id: 'a', modifiedAt: 10, fileId: 'f1', expectedLocalUpdatedAt: 5 },
    ]);
  });

  it('같은 시각·행도 일치 → 아무것도 안 한다 (완전 동기 상태의 무소음)', () => {
    expect(
      plan({
        localDocs: [{ type: 'drill', id: 'a', updatedAt: 10 }],
        remoteFiles: [rem],
        syncRows: [{ type: 'drill', id: 'a', lastSyncedAt: 10, remoteFileId: 'f1' }],
      }),
    ).toEqual([]);
  });

  it('같은 시각인데 행이 없거나 낡음 → markSynced 부기만', () => {
    expect(plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 10 }], remoteFiles: [rem] })).toEqual([
      { kind: 'markSynced', type: 'drill', id: 'a', at: 10, fileId: 'f1' },
    ]);
    expect(
      plan({
        localDocs: [{ type: 'drill', id: 'a', updatedAt: 10 }],
        remoteFiles: [rem],
        syncRows: [{ type: 'drill', id: 'a', lastSyncedAt: 3, remoteFileId: 'f1' }],
      }),
    ).toEqual([{ kind: 'markSynced', type: 'drill', id: 'a', at: 10, fileId: 'f1' }]);
  });
});

describe('삭제 전파 — 톰스톤 대 산 문서', () => {
  it('로컬 톰스톤이 더 최신 → pushTomb (원격 파일을 doc:null 로)', () => {
    expect(
      plan({
        localTombs: [{ type: 'drill', id: 'a', deletedAt: 20 }],
        remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 10 }],
      }),
    ).toEqual([{ kind: 'pushTomb', type: 'drill', id: 'a', deletedAt: 20, fileId: 'f1' }]);
  });

  it('원격 문서가 톰스톤보다 최신 → pullUpdate + clearTomb (삭제 후 편집 부활 — 최근 활동 승)', () => {
    expect(
      plan({
        localTombs: [{ type: 'drill', id: 'a', deletedAt: 10 }],
        remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 20 }],
      }),
    ).toEqual([{ kind: 'pullUpdate', type: 'drill', id: 'a', modifiedAt: 20, fileId: 'f1', clearTomb: true }]);
  });

  it('원격 톰스톤이 로컬 문서보다 최신 → deleteLocal (원격 deletedAt 을 그대로 물려받는다)', () => {
    expect(
      plan({
        localDocs: [{ type: 'drill', id: 'a', updatedAt: 10 }],
        remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 5, deletedAt: 20 }],
      }),
    ).toEqual([{ kind: 'deleteLocal', type: 'drill', id: 'a', deletedAt: 20, fileId: 'f1' }]);
  });

  it('로컬 문서가 원격 톰스톤보다 최신 → pushUpdate (원격에서 지웠지만 여기서 더 최근에 고쳤다 — 부활)', () => {
    expect(
      plan({
        localDocs: [{ type: 'drill', id: 'a', updatedAt: 30 }],
        remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 5, deletedAt: 20 }],
      }),
    ).toEqual([{ kind: 'pushUpdate', type: 'drill', id: 'a', updatedAt: 30, fileId: 'f1' }]);
  });

  it('양쪽 다 톰스톤: 최신 쪽 전파, 같은 시각이면 행 정리뿐', () => {
    const tomb = (at: number) => [{ type: 'drill' as const, id: 'a', deletedAt: at }];
    const remTomb = (at: number) => [{ fileId: 'f1', type: 'drill' as const, id: 'a', modifiedAt: 1, deletedAt: at }];
    expect(plan({ localTombs: tomb(20), remoteFiles: remTomb(10) })).toEqual([
      { kind: 'pushTomb', type: 'drill', id: 'a', deletedAt: 20, fileId: 'f1' },
    ]);
    expect(plan({ localTombs: tomb(10), remoteFiles: remTomb(20) })).toEqual([
      { kind: 'deleteLocal', type: 'drill', id: 'a', deletedAt: 20, fileId: 'f1' },
    ]);
    expect(plan({ localTombs: tomb(10), remoteFiles: remTomb(10) })).toEqual([]);
    expect(plan({ localTombs: tomb(10), remoteFiles: remTomb(10), syncRows: [{ type: 'drill', id: 'a', lastSyncedAt: 10 }] })).toEqual([
      { kind: 'clearRow', type: 'drill', id: 'a' },
    ]);
  });
});

describe('동률 tie-break — writerId 사전순, 어느 기기가 계산해도 같은 답', () => {
  const localDoc = [{ type: 'drill' as const, id: 'a', updatedAt: 10 }];
  const remTomb = (writerId?: string) => [{ fileId: 'f1', type: 'drill' as const, id: 'a', modifiedAt: 4, deletedAt: 10, writerId }];

  it('원격 writerId 가 사전순으로 크면 원격 승', () => {
    expect(plan({ localDocs: localDoc, remoteFiles: remTomb('writer-zzz') })).toEqual([
      { kind: 'deleteLocal', type: 'drill', id: 'a', deletedAt: 10, fileId: 'f1' },
    ]);
  });

  it('원격 writerId 가 작거나·없거나·우리 자신이면 로컬 승', () => {
    const expectPush = (actions: SyncAction[]) => expect(actions).toEqual([{ kind: 'pushUpdate', type: 'drill', id: 'a', updatedAt: 10, fileId: 'f1' }]);
    expectPush(plan({ localDocs: localDoc, remoteFiles: remTomb('writer-aaa') }));
    expectPush(plan({ localDocs: localDoc, remoteFiles: remTomb(undefined) }));
    expectPush(plan({ localDocs: localDoc, remoteFiles: remTomb(W) }));
  });
});

describe('원격 중복 파일 — 동시 pushCreate 레이스의 산물', () => {
  it('최신 하나만 R 로 삼고 옛것은 dropRemoteDup, 시각 동률은 fileId 사전순 큰 쪽이 남는다', () => {
    const actions = plan({
      localDocs: [{ type: 'drill', id: 'a', updatedAt: 30 }],
      remoteFiles: [
        { fileId: 'f-old', type: 'drill', id: 'a', modifiedAt: 10 },
        { fileId: 'f-new', type: 'drill', id: 'a', modifiedAt: 20 },
        { fileId: 'g-1', type: 'drill', id: 'b', modifiedAt: 5 },
        { fileId: 'g-2', type: 'drill', id: 'b', modifiedAt: 5 },
      ],
    });
    expect(actions).toEqual([
      { kind: 'pushUpdate', type: 'drill', id: 'a', updatedAt: 30, fileId: 'f-new' },
      { kind: 'pullCreate', type: 'drill', id: 'b', modifiedAt: 5, fileId: 'g-2' },
      { kind: 'dropRemoteDup', type: 'drill', id: 'a', fileId: 'f-old' },
      { kind: 'dropRemoteDup', type: 'drill', id: 'b', fileId: 'g-1' },
    ]);
  });
});

describe('이상 상태 — 문서와 톰스톤이 동시에 있다(부활 pull 과 톰스톤 정리 사이 크래시 창)', () => {
  it('더 최신 쪽이 이 기기의 진의다 — 문서가 새로우면 산 것으로, 톰스톤이 새로우면 지운 것으로', () => {
    const rem = [{ fileId: 'f1', type: 'drill' as const, id: 'a', modifiedAt: 15 }];
    // 문서(20) > 톰스톤(10): 산 문서로 취급 → 로컬 승 push
    expect(
      plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 20 }], localTombs: [{ type: 'drill', id: 'a', deletedAt: 10 }], remoteFiles: rem }),
    ).toEqual([{ kind: 'pushUpdate', type: 'drill', id: 'a', updatedAt: 20, fileId: 'f1' }]);
    // 톰스톤(30) > 문서(20): 지운 것으로 취급 → pushTomb
    expect(
      plan({ localDocs: [{ type: 'drill', id: 'a', updatedAt: 20 }], localTombs: [{ type: 'drill', id: 'a', deletedAt: 30 }], remoteFiles: rem }),
    ).toEqual([{ kind: 'pushTomb', type: 'drill', id: 'a', deletedAt: 30, fileId: 'f1' }]);
  });
});

describe('초기 페어링 = 같은 merge — 별도 모드가 없다', () => {
  it('원격 빈 계정이면 전부 pushCreate, 새 기기면 전부 pullCreate, 양쪽 보유면 문서별 최신 승', () => {
    // 원격 빈 계정
    expect(
      plan({
        localDocs: [
          { type: 'drill', id: 'a', updatedAt: 1 },
          { type: 'session', id: 's', updatedAt: 2 },
          { type: 'roster', id: 'roster', updatedAt: 3 },
        ],
      }).map((a) => a.kind),
    ).toEqual(['pushCreate', 'pushCreate', 'pushCreate']);
    // 새 기기
    expect(
      plan({
        remoteFiles: [
          { fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 1 },
          { fileId: 'f2', type: 'roster', id: 'roster', modifiedAt: 2 },
        ],
      }).map((a) => a.kind),
    ).toEqual(['pullCreate', 'pullCreate']);
    // 양쪽 보유 — 문서별 합집합 + 최신 승 (한 패스 안에 push 와 pull 이 섞인다)
    const actions = plan({
      localDocs: [
        { type: 'drill', id: 'mine', updatedAt: 10 },
        { type: 'drill', id: 'both', updatedAt: 30 },
      ],
      remoteFiles: [
        { fileId: 'f1', type: 'drill', id: 'both', modifiedAt: 20 },
        { fileId: 'f2', type: 'drill', id: 'theirs', modifiedAt: 5 },
      ],
    });
    expect(actions).toEqual([
      { kind: 'pushUpdate', type: 'drill', id: 'both', updatedAt: 30, fileId: 'f1' },
      { kind: 'pushCreate', type: 'drill', id: 'mine', updatedAt: 10 },
      { kind: 'pullCreate', type: 'drill', id: 'theirs', modifiedAt: 5, fileId: 'f2' },
    ]);
  });
});

describe('수렴성 — 액션을 적용한 다음 패스는 조용하다', () => {
  it('push 를 반영한(행 갱신) 뒤의 재계획은 빈 배열이다', () => {
    const localDocs = [{ type: 'drill' as const, id: 'a', updatedAt: 20 }];
    const first = plan({ localDocs, remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 10 }] });
    expect(first[0]!.kind).toBe('pushUpdate');
    // 엔진이 pushUpdate 성공 후 하는 일: 원격이 로컬과 같아지고 행이 기록된다.
    const after = plan({
      localDocs,
      remoteFiles: [{ fileId: 'f1', type: 'drill', id: 'a', modifiedAt: 20, writerId: W }],
      syncRows: [{ type: 'drill', id: 'a', lastSyncedAt: 20, remoteFileId: 'f1' }],
    });
    expect(after).toEqual([]);
  });
});
