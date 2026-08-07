// §4.4 저장소 에러. 파라미터 프로퍼티 금지(erasableSyntaxOnly 위반 시 TS1294) — 필드를 명시
// 선언하고 생성자에서 대입한다.
export type StorageErrorCode =
  | 'E_DB_UNAVAILABLE'
  | 'E_QUOTA'
  | 'E_NOT_FOUND'
  | 'E_CONFLICT'
  | 'E_SCHEMA_TOO_NEW'
  | 'E_INVALID_FILE'
  | 'E_UNSUPPORTED_KIND';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options); // lib ES2023 이라 2번째 인자 사용 가능
    this.name = 'StorageError';
    this.code = code;
  }
}

/** 보간 자리가 필요하므로 문자열 상수가 아니라 함수다. */
export const STORAGE_ERROR_MESSAGES: Record<StorageErrorCode, (d?: string) => string> = {
  E_DB_UNAVAILABLE: () => '저장소를 열 수 없습니다. 이번 세션 동안만 유지됩니다.',
  E_QUOTA: () => '저장 공간이 부족합니다. 드릴을 정리하거나 내보낸 뒤 삭제하세요.',
  E_NOT_FOUND: () => '드릴을 찾을 수 없습니다.',
  E_CONFLICT: () => '다른 탭에서 이 드릴이 수정되었습니다. 덮어쓰기 / 사본으로 저장 중 선택하세요.',
  E_SCHEMA_TOO_NEW: () => '더 새로운 버전의 SPIN에서 만든 파일입니다. 앱을 업데이트하세요.',
  E_INVALID_FILE: () => 'SPIN 파일이 아니거나 손상되었습니다.',
  E_UNSUPPORTED_KIND: (d) => `이 버전에서 지원하지 않는 파일 종류입니다${d ? ` (${d})` : ''}.`,
};
