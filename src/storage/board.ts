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
  // ⚠️ 2026-08-28 — `pristine: boolean` 이 여기 있었다. 코트 자유 전환 게이트의 저장본
  //    기준선이었고, 사유는 *"편집된 판을 저장하고 다시 열면 그 판이 새 초기 상태가 되어
  //    past 가 비므로 dirty 인데도 clean 이라고 거짓말한다"* 였다. 게이트가 판 위 개체를
  //    직접 세게 되면서(EditorWorkspace) 그 거짓말이 성립하지 않아 필드째 은퇴했다.
  //    옛 스냅샷에 남아 있어도 그냥 무시된다 — 읽지 않으므로 스키마 도장은 올리지 않는다.
  drill: Drill;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** prefs 와 같은 이유로 절대 throw 하지 않는다 — Safari 프라이빗 모드의 QuotaExceededError 가
 *  드래그 정착 콜백 안에서 터지면 에러 바운더리까지 올라가 판이 통째로 날아간다. */
export function saveBoard(drill: Drill): boolean {
  try {
    const snap: BoardSnapshot = { schemaVersion: CURRENT_BOARD_SCHEMA, drill };
    localStorage.setItem(BOARD_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

/** 되살릴 수 없으면 null — 호출부가 기본 전술판을 새로 만든다. 손상된 판 하나 때문에 대문이
 *  안 뜨는 것이 최악이므로, 애매하면 버리고 새로 시작하는 쪽을 택한다. */
export function loadBoard(): { drill: Drill } | null {
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

  return { drill: res.value };
}

// `clearBoard()`(BOARD_KEY 를 removeItem 하던 것)는 2026-08-31 위생 청소로 뺐다 — 호출자가
// 테스트뿐이었다. 앱에는 이 키를 **지우는** 경로가 아예 없다(전술판은 덮어써서 비운다). 되살릴
// 일이 생기면 removeItem 을 try/catch 로 감싸라 — 프라이빗 모드에서 던진다(savePrefs 와 동일).
