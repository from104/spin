// 공유 링크의 **삭제 토큰 보관소**(PLAN-SHARE-LINK 결정 11).
//
// 왜 이 파일이 있는가: 서버는 deleteToken 의 sha256 만 갖고 원문은 POST 응답으로 **한 번** 주고
// 잊는다(결정 5). 그 한 번을 화면이 흘리면 그 링크는 180일이 지나기 전엔 아무도 못 지운다 —
// 만든 사람 자신도 못 지운다. 그래서 만들자마자 여기 남긴다. 회수 UI(만든 링크 목록 → [지우기])는
// 후속이고, 이 파일은 그때 읽을 것을 지금 쌓아 두는 자리다.
//
// ⚠️ prefs 가 아니라 **별도 키**다(계획서 §2 "src/storage/prefs.ts 아님"). 세 가지 이유:
//   ① prefs 는 기기 이사 파일(backup 봉투)에 실려 다른 기기로 간다 — 삭제 토큰은 취향이 아니라
//      비밀이고, 옮겨 다닐 이유가 없다.
//   ② prefs 는 스키마·마이그레이션·검증 3종 세트를 지는 문서다. 여기 필드를 하나 더하면
//      prefs 스키마가 올라가고 옛 기기가 새 prefs 를 거절한다 — 링크 하나 만들자고 치를 값이 아니다.
//   ③ 이 표는 지울 수 있는 캐시다. 날아가도 앱은 멀쩡하고, 잃는 것은 "일찍 지울 권리" 뿐이다.
//
// ⚠️ 값은 **비밀**이다. 로그·토스트·오류 문구에 토큰을 싣지 마라(모달도 링크만 보여 준다).
import type { DrillId } from '../core/ids.ts';

/** localStorage 키. 이 앱이 localStorage 에 쓰는 세 번째 키다(spin.prefs · spin.board 다음). */
export const SHARE_LINKS_KEY = 'spin.shareLinks';

/** 오래된 것부터 버리는 상한. 무한히 쌓게 두면 회수 UI 도 없는 표가 조용히 커진다(한 줄 100B
 *  남짓이라 200줄이 20KB — localStorage 5MB 예산에서 무시할 값이고, 넘길 일도 거의 없다).
 *  ⚠️ 넘쳐서 버린 줄은 **그 링크를 만료 전에 못 지운다**는 뜻이다. 그래서 버리는 기준은
 *  createdAt 이 가장 오래된 것 — 남은 수명이 가장 짧은 쪽부터 포기한다. */
export const SHARE_LINKS_MAX = 200;

export interface ShareLinkRecord {
  /** 서버가 sha256 만 갖는 원문 토큰(base64url 43자). DELETE 의 `Authorization: Bearer` 값. */
  deleteToken: string;
  createdAt: number;
  /** 어느 드릴로 만든 링크인가 — 회수 UI 가 "무슨 링크였지" 를 말해 줄 유일한 실마리다.
   *  드릴이 지워져도 이 줄은 남는다(서버의 암호문은 드릴 삭제와 무관하게 살아 있으므로). */
  drillId: DrillId;
}

/** id → 기록. id 는 `[0-9A-Za-z]{10}`(share/link.ts 의 SHARE_ID_RE)이다. */
export type ShareLinkMap = Record<string, ShareLinkRecord>;

function isRecord(v: unknown): v is ShareLinkRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<ShareLinkRecord>;
  return typeof r.deleteToken === 'string' && r.deleteToken.length > 0 && typeof r.createdAt === 'number' && typeof r.drillId === 'string';
}

/** 절대 throw 하지 않는다 — prefs.loadPrefs 와 같은 규율이다. 프라이빗 모드·손상된 JSON·
 *  남이 넣은 쓰레기 값 전부 "빈 표" 로 접는다(줄 단위로 걸러 성한 줄은 살린다). */
export function loadShareLinks(): ShareLinkMap {
  let raw: unknown;
  try {
    const s = localStorage.getItem(SHARE_LINKS_KEY);
    raw = s ? JSON.parse(s) : undefined;
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const out: ShareLinkMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isRecord(v)) out[id] = { deleteToken: v.deleteToken, createdAt: v.createdAt, drillId: v.drillId };
  }
  return out;
}

/** 만든 직후 한 줄 남긴다. 저장 실패(용량·프라이빗 모드)는 **조용히 무시**한다 — 링크는 이미
 *  만들어졌고 화면에 떠 있다. 여기서 던지면 성공한 공유가 실패로 보인다. */
export function rememberShareLink(id: string, rec: ShareLinkRecord): boolean {
  const all = loadShareLinks();
  all[id] = rec;
  const ids = Object.keys(all);
  if (ids.length > SHARE_LINKS_MAX) {
    const doomed = ids.sort((a, b) => all[a]!.createdAt - all[b]!.createdAt).slice(0, ids.length - SHARE_LINKS_MAX);
    for (const d of doomed) delete all[d];
  }
  try {
    localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

// `forgetShareLink(id)`(회수에 성공한 줄을 지우는 짝)는 **일부러 안 넣었다.** 회수 UI 가
// 아직 없어 부를 자리가 없고, 호출자 0 인 export 는 다음 사람에게 "이건 왜 안 쓰이지" 를
// 되묻게 만든다(AGENTS §9). 그 화면을 만드는 커밋에서 같이 넣는다 — 지우는 쪽은 이 파일의
// 다른 두 함수처럼 try/catch 로 삼키면 된다.
