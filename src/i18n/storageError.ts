// C8b — StorageError 는 storage/errors.ts 의 STORAGE_ERROR_MESSAGES 로 .message 를 굳히는데,
// 그 사전은 항상 한국어다(저장소 계층은 ~20개 호출부에 흩어져 있어 i18n 을 끌어들일 수 없다).
// 그래서 화면에 보여줄 때는 .message 를 그대로 쓰지 않고 .code 로 다시 번역한다.
import { StorageError, type StorageErrorCode } from '../storage/errors.ts';
import type { Locale } from './locale.ts';
import type { DictKey } from './ko.ts';
import { translate } from './useT.ts';

const CODE_KEY: Record<StorageErrorCode, DictKey> = {
  E_DB_UNAVAILABLE: 'storage.error.E_DB_UNAVAILABLE',
  E_QUOTA: 'storage.error.E_QUOTA',
  E_NOT_FOUND: 'storage.error.E_NOT_FOUND',
  E_CONFLICT: 'storage.error.E_CONFLICT',
  E_SCHEMA_TOO_NEW: 'storage.error.E_SCHEMA_TOO_NEW',
  E_INVALID_FILE: 'storage.error.E_INVALID_FILE',
  E_UNSUPPORTED_KIND: 'storage.error.E_UNSUPPORTED_KIND',
};

/** 화면 catch(e) 자리의 `e instanceof Error && e.message.length > 0 ? e.message : fallback`
 *  대신 쓴다 — 그 패턴 그대로 동작하되, 굳은 한국어 .message 를 갖는(= localized 되지 않은)
 *  StorageError 만 코드로 다시 번역해 가로챈다. .localized 인 StorageError(예:
 *  dataExport.ts 가 이미 translate() 해서 던진 것)는 일반 Error 분기로 흘러 .message 를
 *  그대로 믿는다 — 이미 맞는 로케일이기 때문이다. */
export function storageErrorText(e: unknown, locale: Locale, fallback: string): string {
  if (e instanceof StorageError && !e.localized) {
    const detail = e.detail ? ` (${e.detail})` : '';
    return translate(locale, CODE_KEY[e.code], { detail });
  }
  return e instanceof Error && e.message.length > 0 ? e.message : fallback;
}
