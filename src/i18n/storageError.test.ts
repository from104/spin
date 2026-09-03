import { describe, it, expect } from 'vitest';
import { storageErrorText } from './storageError.ts';
import { StorageError } from '../storage/errors.ts';

describe('storageErrorText', () => {
  it('굳은 한국어 .message 를 갖는 StorageError 는 .code 로 로케일에 맞게 다시 번역한다', () => {
    const e = new StorageError('E_NOT_FOUND', '드릴을 찾을 수 없습니다.');
    expect(storageErrorText(e, 'ko', 'fallback')).toBe('드릴을 찾을 수 없습니다.');
    expect(storageErrorText(e, 'en', 'fallback')).toBe("Couldn't find the drill.");
    expect(storageErrorText(e, 'ja', 'fallback')).toBe('ドリルが見つかりません。');
  });

  it('detail 이 있으면 괄호로 덧붙인다', () => {
    const e = new StorageError('E_UNSUPPORTED_KIND', '이 버전에서 지원하지 않는 파일 종류입니다 (drillSet).', { detail: 'drillSet' });
    expect(storageErrorText(e, 'ko', 'fallback')).toBe('이 버전에서 지원하지 않는 파일 종류입니다 (drillSet).');
    expect(storageErrorText(e, 'en', 'fallback')).toBe("This file type isn't supported in this version (drillSet).");

    const withoutDetail = new StorageError('E_UNSUPPORTED_KIND', '이 버전에서 지원하지 않는 파일 종류입니다.');
    expect(storageErrorText(withoutDetail, 'ko', 'fallback')).toBe('이 버전에서 지원하지 않는 파일 종류입니다.');
  });

  it('localized:true 인 StorageError 는 재번역하지 않고 .message 를 그대로 믿는다', () => {
    // dataExport.ts 가 'library' 종류를 특별대우하며 이미 translate() 해서 던지는 경우와 같다 —
    // 코드로 재번역하면 그 특별 문구(가져오기 화면으로 안내)가 통째로 사라진다.
    const e = new StorageError('E_UNSUPPORTED_KIND', 'Drill-collection files open from [Import] on the [Drills] screen.', { localized: true });
    expect(storageErrorText(e, 'en', 'fallback')).toBe('Drill-collection files open from [Import] on the [Drills] screen.');
  });

  it('message 가 빈 문자열이거나 Error 가 아니면 fallback 을 쓴다', () => {
    expect(storageErrorText(new Error('원인 불명 오류'), 'ko', 'fallback')).toBe('원인 불명 오류');
    expect(storageErrorText(new Error(''), 'ko', 'fallback')).toBe('fallback');
    expect(storageErrorText('그냥 문자열', 'ko', 'fallback')).toBe('fallback');
    expect(storageErrorText(undefined, 'ko', 'fallback')).toBe('fallback');
  });
});
