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
  /** E_UNSUPPORTED_KIND 등 코드가 보간값을 쓸 때만 채운다 — .message 는 항상 한국어로 굳어
   *  있어(저장소 계층은 i18n 을 모른다) 화면에서 재번역하려면 원재료가 따로 필요하다.
   *  i18n/storageError.ts 가 이 필드로 .code 를 다시 번역한다. */
  readonly detail?: string;
  /** 예외적으로 이미 로케일에 맞게 번역된 .message 를 들고 있는 경우(예:
   *  features/settings/dataExport.ts 가 'library' 종류를 특별대우하며 직접 translate() 한
   *  문구) — true 면 i18n/storageError.ts 가 .code 재번역 대신 .message 를 그대로 믿는다. */
  readonly localized?: boolean;
  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown; detail?: string; localized?: boolean }) {
    super(message, options); // lib ES2023 이라 2번째 인자 사용 가능
    this.name = 'StorageError';
    this.code = code;
    this.detail = options?.detail;
    this.localized = options?.localized;
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
