// 공유 링크 **받기** 시트(PLAN-SHARE-LINK 결정 9·10). `/s/:id` 로 착지하면 라이브러리 화면
// 위에 이 시트가 뜬다 — 새 화면을 만들지 않는다(routes.ts 의 `case 's'` 주석).
//
// ⚠️ **저장은 새로 만들지 않는다.** 받은 Drill 은 파일 가져오기와 **같은 관문**을 탄다:
//    exportDrillFile 봉투 → parseSpinFile → prepareDrillImport(= migrate + validate + 충돌 판정)
//    → commitDrills. 링크 전용 저장 경로를 따로 두면 마이그레이션·검증·id 충돌 처리가 두 벌이
//    되고, 그 둘은 반드시 갈라진다(AGENTS §3). 봉투로 되돌리는 한 번의 왕복이 그 값이다.
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
import { buildSummary } from '../../model/summary.ts';
import { courtDefFor } from '../../model/court.ts';
import { openShareLink, shareNoticeFor } from '../../share/index.ts';
import type { ShareNotice } from '../../share/index.ts';
import { exportDrillFile, parseSpinFile, prepareDrillImport } from '../../storage/transfer.ts';
import type { ImportResolution } from '../../storage/transfer.ts';
import { commitDrills } from './transfer.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';
import type { DictKey } from '../../i18n/ko.ts';

const NOTICE_KEY: Record<ShareNotice, DictKey> = {
  'not-found': 'library.share.error.notFound',
  'bad-key': 'library.share.error.badKey',
  'too-new': 'library.share.error.tooNew',
  network: 'library.share.error.network',
};

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; drill: Drill }
  | { phase: 'error'; notice: ShareNotice };

export interface ShareImportSheetProps {
  /** 링크의 id 부분(`/s/<id>`). */
  id: string;
  /** 링크의 `#` 뒤 43자. **없을 수 있다** — 메신저가 프래그먼트를 잘라 먹은 링크가 그 꼴이다. */
  keyB64: string | null;
  onClose(): void;
  /** 저장이 끝났을 때(목록 갱신·토스트는 화면이 한다). */
  onSaved(drill: Drill): void | Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ShareImportSheet({ id, keyB64, onClose, onSaved, returnFocusRef }: ShareImportSheetProps) {
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
        const drill = await openShareLink(`${id}#${keyB64}`);
        if (alive) setState({ phase: 'ready', drill });
      } catch (e) {
        if (alive) setState({ phase: 'error', notice: shareNoticeFor(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, keyB64]);

  const save = async (drill: Drill) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const parsed = parseSpinFile(await exportDrillFile(drill).text());
      const candidates = await prepareDrillImport(parsed);
      // ⚠️ 전부 'copy' 로 못박는다 — `defaultResolution` 을 쓰면 conflict:'identical' 이
      //    'skip' 이라, 같은 링크를 두 번 저장한 사람은 [저장]을 눌러도 **아무 일도 안 일어나는**
      //    화면을 본다. 파일 가져오기는 여러 항목을 한 번에 훑는 일이라 건너뛰기가 옳지만,
      //    여기는 사람이 드릴 하나를 보고 [저장]을 누른 자리다. 충돌 시 새 id 사본은
      //    commitDrillImports 가 만든다(제목에 "(사본)" 이 붙는 것도 그쪽 규칙 그대로다).
      const resolutions = new Map<number, ImportResolution>(candidates.map((_, i) => [i, 'copy' as const]));
      await commitDrills(candidates, resolutions);
      await onSaved(drill);
    } catch (e) {
      setSaveError(storageErrorText(e, locale, t('library.importErrorFallback')));
    } finally {
      // 성공해도 되돌린다. 보통은 화면이 곧바로 시트를 닫지만(LibraryScreen.onSaved), 닫지
      // 않는 호출자에게 **영영 눌리지 않는 버튼**을 남기면 안 된다 — 연타 방지는 위 `if (saving)`
      // 가 이미 하고 있고, 이 플래그는 그 한 번의 왕복 동안만 서 있으면 된다.
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      titleId={titleId}
      title={t('library.import.title')}
      closeLabel={t('library.import.closeLabel')}
      returnFocusRef={returnFocusRef}
    >
      {state.phase === 'loading' && <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{t('library.import.loading')}</p>}

      {state.phase === 'error' && (
        <p role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
          {t(NOTICE_KEY[state.notice])}
        </p>
      )}

      {state.phase === 'ready' && <Preview drill={state.drill} />}

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
          <Button variant="primary" disabled={saving} onClick={() => void save(state.drill)}>
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
