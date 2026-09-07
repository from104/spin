// exportNames — 영상 파일 이름(2026-09-08, PLAN-VIDEO-EXPORT 결정 10).
//
// 왜 새 파일인가: `backupFileName`·`sceneFileName` 의 기존 단언은 `ExportSheet.test.tsx` 안에
// 시트 테스트와 함께 산다. 그 파일은 영상 UI 회차가 같이 고치는 자리라 이름 규약만 보는 단언을
// 거기 더 얹지 않는다 — 대상과 같은 이름의 테스트 파일이 이 저장소의 기본 배치다(AGENTS §1.6).
//
// 지우면 새는 버그: 확장자가 어긋나면 카톡·사진첩이 파일을 영상으로 알아보지 못하고 첨부로
// 떨어진다. 인코딩은 성공하므로 앱 안에서는 아무 신호도 없다.
import { describe, it, expect } from 'vitest';
import { videoFileName } from './exportNames.ts';

describe('videoFileName', () => {
  const at = new Date(2026, 8, 8, 21, 30).getTime(); // 지역시 2026-09-08

  it('SPIN_{제목}_{YYYYMMDD}.mp4 — 스텝 번호가 없다(영상은 언제나 드릴 전체다)', () => {
    expect(videoFileName({ title: '측면 돌파' }, at)).toBe('SPIN_측면 돌파_20260908.mp4');
  });

  it('파일 이름에 못 쓰는 글자는 낱장 PNG 와 같은 규칙으로 접는다', () => {
    expect(videoFileName({ title: 'a/b:c' }, at)).toBe('SPIN_a-b-c_20260908.mp4');
  });
});
