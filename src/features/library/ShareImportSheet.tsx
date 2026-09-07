// 공유 링크 **받기** 시트(PLAN-SHARE-LINK 결정 9·10). `/s/:id` 로 착지하면 라이브러리 화면
// 위에 이 시트가 뜬다 — 새 화면을 만들지 않는다(routes.ts 의 `case 's'` 주석).
//
// ⚠️ **저장은 새로 만들지 않는다.** 받은 문서는 파일 가져오기와 **같은 관문**을 탄다:
//    exportDrillFile 봉투 → parseSpinFile → prepareDrillImport(= migrate + validate + 충돌 판정)
//    → commitDrills. 링크 전용 저장 경로를 따로 두면 마이그레이션·검증·id 충돌 처리가 두 벌이
//    되고, 그 둘은 반드시 갈라진다(AGENTS §3). 봉투로 되돌리는 한 번의 왕복이 그 값이다.
//
// ── 세션 갈래 (2026-09-08, PLAN-SHARE-LINK §6 S1·S4·S5) ────────────────────────────────
// 링크 꼴은 하나이고 **종류는 봉투가 말한다**(S5) — 그래서 이 시트는 `openShareLink` 가 돌려준
// `kind` 로 갈린다. 세션 갈래의 저장도 새 사슬이 아니다: exportSessionFile 봉투 → parseSpinFile
// → prepareSessionImport → commitDrills(드릴 먼저) → commitSession(참조를 그 결과로 잇는다).
// ⚠️ **드릴을 먼저 심고 세션을 나중에** 심는 순서가 계약이다 — 뒤집으면 세션이 아직 없는 드릴
//    id 를 가리켜 편성이 통째로 '삭제됨' 이 된다. 사본으로 들어온 드릴의 새 id 로 참조를 옮기는
//    것은 commitSessionImport 의 remapRefs 이고, 그 재료가 commitDrills 가 낸 idMap 이다.
//
// ⚠️ **열쇠는 이 시트가 만들지 않는다.** 링크의 `#` 뒤 43자는 AppShell 이 `location.hash` 에서
//    한 번 읽어 주소에서 지운 뒤 prop 으로 내려준다(routes.ts·useAppHistory.ts 의 "열쇠는
//    라우터에 없다"). 여기서 다시 `location.hash` 를 읽으면 이미 지워진 뒤라 늘 빈손이다.
//
// 열쇠가 없으면(잘린 링크) **서버를 부르지 않는다** — 어차피 못 여는 암호문을 받아 오는 것은
// 남의 서버에 지우는 헛짐이고, 사용자가 할 일(링크 전체를 다시 받는다)은 이미 정해져 있다.
import { useEffect, useId, useState } from 'react';
import type { RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { CourtThumbnail } from '../../render/CourtThumbnail.tsx';
import type { Drill } from '../../model/drill.ts';
import type { TrainingSession } from '../../model/session.ts';
import { buildSummary } from '../../model/summary.ts';
import { courtDefFor } from '../../model/court.ts';
import { openShareLink, shareNoticeFor } from '../../share/index.ts';
import type { ShareNotice, SharedDoc } from '../../share/index.ts';
import { exportDrillFile, exportSessionFile, parseSpinFile, prepareDrillImport, prepareSessionImport } from '../../storage/transfer.ts';
import type { ImportResolution } from '../../storage/transfer.ts';
import { commitDrills, commitSession } from './transfer.ts';
import { getSession } from '../../storage/sessionRepo.ts';
import { newId } from '../../core/ids.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';
import type { DictKey } from '../../i18n/ko.ts';

/** ⚠️ 전부 'copy' 로 못박는다 — `defaultResolution` 을 쓰면 conflict:'identical' 이 'skip' 이라,
 *  같은 링크를 두 번 저장한 사람은 [저장]을 눌러도 **아무 일도 안 일어나는** 화면을 본다. 파일
 *  가져오기는 여러 항목을 한 번에 훑는 일이라 건너뛰기가 옳지만, 여기는 사람이 눈앞의 것 하나를
 *  보고 [저장]을 누른 자리다. 충돌 시 새 id 사본은 commitDrillImports 가 만든다(제목에 "(사본)"
 *  이 붙는 것도 그쪽 규칙 그대로다). 세션 갈래도 같다 — 세션이 데려온 드릴이 내 것과 같은 id 를
 *  가졌더라도 내 드릴을 덮지 않고, 세션의 참조만 그 사본으로 옮겨 붙는다. */
function allCopy(count: number): Map<number, ImportResolution> {
  return new Map(Array.from({ length: count }, (_, i) => [i, 'copy' as const]));
}

const NOTICE_KEY: Record<ShareNotice, DictKey> = {
  'not-found': 'library.share.error.notFound',
  'bad-key': 'library.share.error.badKey',
  'too-new': 'library.share.error.tooNew',
  network: 'library.share.error.network',
};

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; doc: SharedDoc }
  | { phase: 'error'; notice: ShareNotice };

/** 세션 갈래가 저장을 마치고 화면에 넘기는 보고(S4). 드릴 수는 **실제로 심은 수**다(파일
 *  가져오기의 `ImportReport.imported` 와 같은 것) — 봉투에 든 수가 아니다. */
export interface SavedSessionReport {
  session: TrainingSession;
  drills: number;
}

export interface ShareImportSheetProps {
  /** 링크의 id 부분(`/s/<id>`). */
  id: string;
  /** 링크의 `#` 뒤 43자. **없을 수 있다** — 메신저가 프래그먼트를 잘라 먹은 링크가 그 꼴이다. */
  keyB64: string | null;
  onClose(): void;
  /** 드릴을 저장했을 때(목록 갱신·토스트는 화면이 한다). */
  onSaved(drill: Drill): void | Promise<void>;
  /** 세션을 저장했을 때(S4 — "드릴 N개 + 세션 1개" 보고와 세션 화면으로의 이동은 화면 몫이다).
   *  ⚠️ **옵셔널이다.** 안 넘긴 화면에서는 세션 링크가 저장까지는 되지만 아무 보고도 못 한다 —
   *  세션 링크를 받을 수 있는 화면(공유 착지)이 이 콜백을 반드시 넘겨야 하는 이유다. */
  onSavedSession?(report: SavedSessionReport): void | Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ShareImportSheet({ id, keyB64, onClose, onSaved, onSavedSession, returnFocusRef }: ShareImportSheetProps) {
  const titleId = useId();
  const t = useT();
  const locale = useLocale();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!keyB64) {
      setState({ phase: 'error', notice: 'bad-key' });
      return;
    }
    let alive = true;
    setState({ phase: 'loading' });
    void (async () => {
      try {
        const doc = await openShareLink(`${id}#${keyB64}`);
        if (alive) setState({ phase: 'ready', doc });
      } catch (e) {
        if (alive) setState({ phase: 'error', notice: shareNoticeFor(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, keyB64]);

  const save = async (doc: SharedDoc) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (doc.kind === 'session') {
        const parsed = parseSpinFile(await exportSessionFile(doc.session, doc.drills).text());
        const prepared = await prepareSessionImport(parsed);
        const outcome = await commitDrills(prepared.drills, allCopy(prepared.drills.length));
        // 세션도 드릴과 같은 «사본» 규율이다(위 allCopy 주석). 파일 가져오기는 세션을 «항상 새
        // 문서» 로 보고 id 를 그대로 put 하지만(prepareSessionImport), 링크는 같은 것을 두 번
        // 저장하는 일이 흔하다 — 보낸 쪽이 고쳐서 다시 보내거나, 받은 쪽이 다시 누르거나. 그때
        // 첫 저장 뒤 내가 손본 세션(참가자·메모)을 두 번째 저장이 말없이 덮으면 안 된다.
        // 같은 id 가 이미 있을 때만 새 id 다 — 처음 받는 세션은 보낸 쪽 id 를 그대로 가져
        // 파일 가져오기와 같은 결과를 낸다(2026-09-08 검수).
        const incoming = prepared.session.doc;
        const sessionDoc = (await getSession(incoming.id)) ? { ...incoming, id: newId('se') } : incoming;
        // 순서가 계약이다(머리말) — 드릴이 다 심긴 뒤의 idMap 이 세션 참조를 옮긴다.
        const session = await commitSession(sessionDoc, outcome);
        await onSavedSession?.({ session, drills: outcome.written.length });
      } else {
        const parsed = parseSpinFile(await exportDrillFile(doc.drill).text());
        const candidates = await prepareDrillImport(parsed);
        await commitDrills(candidates, allCopy(candidates.length));
        await onSaved(doc.drill);
      }
    } catch (e) {
      setSaveError(storageErrorText(e, locale, t('library.importErrorFallback')));
    } finally {
      // 성공해도 되돌린다. 보통은 화면이 곧바로 시트를 닫지만(LibraryScreen.onSaved), 닫지
      // 않는 호출자에게 **영영 눌리지 않는 버튼**을 남기면 안 된다 — 연타 방지는 위 `if (saving)`
      // 가 이미 하고 있고, 이 플래그는 그 한 번의 왕복 동안만 서 있으면 된다.
      setSaving(false);
    }
  };

  // 제목은 **연 뒤에야** 종류를 안다(S5 — 링크 꼴이 하나다). 여는 동안에는 드릴 문구를 쓴다:
  // 무색 제목("공유받은 항목")을 세 언어에 하나 더 만드는 값보다, 흔한 쪽의 이름을 먼저 보이고
  // 봉투가 답하면 바꿔 다는 편이 싸다. 드릴 경로의 문구는 이 분기로 **한 글자도 안 바뀐다.**
  const isSession = state.phase === 'ready' && state.doc.kind === 'session';

  return (
    <Modal
      open
      onClose={onClose}
      titleId={titleId}
      title={isSession ? t('library.import.session.title') : t('library.import.title')}
      closeLabel={isSession ? t('library.import.session.closeLabel') : t('library.import.closeLabel')}
      returnFocusRef={returnFocusRef}
    >
      {state.phase === 'loading' && <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{t('library.import.loading')}</p>}

      {state.phase === 'error' && (
        <p role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
          {t(NOTICE_KEY[state.notice])}
        </p>
      )}

      {state.phase === 'ready' &&
        (state.doc.kind === 'session' ? <SessionPreview session={state.doc.session} drills={state.doc.drills} /> : <Preview drill={state.doc.drill} />)}

      {saveError && (
        <p role="alert" style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text)' }}>
          {saveError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>
          {t('library.import.close')}
        </Button>
        {state.phase === 'ready' && (
          <Button variant="primary" disabled={saving} onClick={() => void save(state.doc)}>
            {t('library.import.save')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** 미리보기 — 제목 · 스텝 수 · 썸네일. 요약을 **여기서 만든다**: 이 드릴은 아직 저장소에
 *  없어 DrillSummary 가 없고, 카드가 쓰는 것과 같은 `buildSummary` 를 거쳐야 썸네일이 목록의
 *  카드와 같은 그림이 된다(두 벌 두지 않는다). */
function Preview({ drill }: { drill: Drill }) {
  const t = useT();
  const summary = buildSummary(drill);
  const courtDef = courtDefFor(summary.courtMode, summary.courtSize);
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 132, flex: 'none', aspectRatio: `${courtDef.vbW} / ${courtDef.vbH}`, position: 'relative' }}>
        <CourtThumbnail
          fill
          mode={summary.courtMode}
          size={summary.courtSize}
          thumb={summary.thumb}
          teamColors={{
            home: summary.teams.home.color,
            away: summary.teams.away.color,
            homeGk: summary.teams.home.gkColor,
            awayGk: summary.teams.away.gkColor,
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: -0.2 }}>{summary.title}</div>
        <div style={{ marginTop: 4, fontSize: '0.78125rem', color: 'var(--muted)' }}>{t('library.import.steps', { count: summary.stepCount })}</div>
      </div>
    </div>
  );
}

/** 세션 미리보기(S4) — 제목 · 구간 수 · 드릴 수 + **드릴 제목 목록**. 드릴 갈래의 썸네일 자리를
 *  이 목록이 대신한다: 세션에는 그릴 판이 없고, 받는 코치가 저장 전에 알고 싶은 것은 "무엇이 몇
 *  개 들어오는가" 다. 숫자는 봉투에서 **직접 센다** — 세션의 `drillIds` 는 편성에서 파생된 캐시라
 *  손상된 봉투에서 실물 드릴 수와 어긋날 수 있고, 받는 쪽이 믿을 것은 실제로 실려 온 문서다. */
function SessionPreview({ session, drills }: { session: TrainingSession; drills: Drill[] }) {
  const t = useT();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: -0.2 }}>{session.title}</div>
      <div style={{ marginTop: 4, fontSize: '0.78125rem', color: 'var(--muted)' }}>
        {t('library.import.session.phases', { count: session.phases.length })} · {t('library.import.session.drills', { count: drills.length })}
      </div>
      {drills.length > 0 && (
        <ul style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78125rem' }}>
          {drills.map((d) => (
            <li key={d.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
