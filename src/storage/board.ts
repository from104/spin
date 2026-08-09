// §6.8 자유 전술판 스냅샷 1장. 대문에 상시 떠 있는 전술판의 상태를 그대로 들고 있다가 다음
// 방문에 되살린다. 정식 드릴(IDB `drillRepo`)과는 완전히 별개다 — 목록에 뜨지 않고, 세션이
// 참조하지 않으며, 자동저장 충돌 검사(baselineUpdatedAt)도 타지 않는다. 전술판을 정식 드릴로
// 남기고 싶으면 `[드릴로 저장]` 이 drillRepo 로 승격시킨다.
//
// localStorage 를 쓰는 이유는 prefs(§4.6)와 같다: 대문은 앱의 첫 화면이라 판을 그리기 전에
// 동기로 읽혀야 한다. IDB 로 읽으면 기본 배치가 한 번 그려졌다가 저장본으로 교체돼 깜빡인다.
//
// 저장 단위가 `Drill` 인 것은 의도된 재사용이다 — 새 스키마를 만들면 validate·migrate 를
// 통째로 다시 써야 한다. 전술판은 1스텝짜리 드릴로 직렬화해 `validateDrill` 의 보정
// 파이프라인(§3.11)을 그대로 얻는다.
import type { Drill } from '../model/drill.ts';
import { validateDrill } from '../model/validate.ts';
import { migrateDoc, DRILL_MIGRATIONS } from '../model/migrate.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';

export const BOARD_KEY = 'spin.board';
export const CURRENT_BOARD_SCHEMA = 1;

export interface BoardSnapshot {
  schemaVersion: number;
  /** 기본 배치에서 아무것도 안 건드린 상태인가. **코트 자유 전환의 게이트**다(§6.8).
   *
   *  런타임에는 리듀서의 `past.length === 0` 로도 같은 판정이 되지만 그것만으로는 부족하다 —
   *  편집된 판을 저장하고 다시 열면 그 판이 새 "초기 상태" 가 되어 past 가 비게 되므로,
   *  dirty 인데도 clean 이라고 거짓말한다. 그래서 판정을 저장본까지 끌고 간다. */
  pristine: boolean;
  drill: Drill;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** prefs 와 같은 이유로 절대 throw 하지 않는다 — Safari 프라이빗 모드의 QuotaExceededError 가
 *  드래그 정착 콜백 안에서 터지면 에러 바운더리까지 올라가 판이 통째로 날아간다. */
export function saveBoard(drill: Drill, pristine: boolean): boolean {
  try {
    const snap: BoardSnapshot = { schemaVersion: CURRENT_BOARD_SCHEMA, pristine, drill };
    localStorage.setItem(BOARD_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

/** 되살릴 수 없으면 null — 호출부가 기본 전술판을 새로 만든다. 손상된 판 하나 때문에 대문이
 *  안 뜨는 것이 최악이므로, 애매하면 버리고 새로 시작하는 쪽을 택한다. */
export function loadBoard(): { drill: Drill; pristine: boolean } | null {
  let raw: unknown;
  try {
    const s = localStorage.getItem(BOARD_KEY);
    raw = s ? JSON.parse(s) : undefined;
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;

  const mig = migrateDoc(raw.drill, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  // too-new = 더 최신 앱이 저장한 판. 구조를 신뢰할 수 없으니 되살리지 않는다.
  if (!mig.ok && mig.reason === 'too-new') return null;
  const res = validateDrill(mig.ok ? mig.doc : raw.drill);
  if (!res.ok) return null;

  // pristine 이 아예 없으면(구버전·수기 편집) 안전한 쪽인 false 로 본다 — 잘못 true 로 보면
  // 편집된 판에서 코트 전환이 열려 배치가 소리 없이 날아간다.
  return { drill: res.value, pristine: raw.pristine === true };
}

export function clearBoard(): void {
  try {
    localStorage.removeItem(BOARD_KEY);
  } catch {
    // savePrefs 와 동일 — 프라이빗 모드에서 removeItem 도 던질 수 있다.
  }
}
