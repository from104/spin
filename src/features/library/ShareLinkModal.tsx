// 공유 링크 **만들기** 모달(PLAN-SHARE-LINK 결정 10·11). 진입점 둘이 같은 모달을 연다:
// 라이브러리 카드 ⋯ [링크로 공유] 와 [보드] 하단 [내보내기] 시트의 [링크로 공유].
//
// 이 파일이 지는 것은 **화면뿐**이다. 접기·잠그기·올리기의 순서는 `src/share/index.ts` 의
// `createShareLink` 하나가 쥔다(그 파일 머리말) — 여기서 codec·crypto·api 를 따로 부르지 마라.
//
// ⚠️ deleteToken 은 서버가 sha256 만 갖고 원문을 **한 번만** 준다(결정 5). 만들자마자
//    `spin.shareLinks` 에 남기지 않으면 그 링크는 만료 전까지 아무도 못 지운다 — 만든 사람도.
//    그래서 저장은 성공 화면을 그리기 **전에** 한다(그려 놓고 저장하면 그 사이 언마운트에
//    토큰이 증발한다). 값 자체는 화면 어디에도 안 띄운다.
//    2026-09-08: 세션 링크(S1)도 같은 규율이다 — `ShareLinkRecord` 가 `drillId?`/`sessionId?`
//    둘 중 하나를 받으므로(storage/shareLinks.ts) 종류에 맞는 칸에 남긴다. 세션 id 를 드릴 칸에
//    밀어 넣지 마라 — 회수 UI 가 생기는 날 "무슨 링크였지" 에 없는 드릴을 답하게 된다.
//
// ⚠️ 오류 문구는 **kind 로 고른다**(결정 10). 서버 문구를 그대로 보여 주지 않는다 — 사용자가
//    할 일이 넷으로 갈리고(다시 받기 / 링크 전체 받기 / 새로고침 / 잠시 뒤), 그 넷을 가르는
//    것이 이 화면의 유일한 지능이다. 만들기 경로의 `too-large` 만 그 넷 밖이다: 링크가 잘못된
//    것이 아니라 **이 문서가 상한(256 KiB)을 넘는다**는 뜻이라 처방이 "파일로 내보내기" 다
//    (share/index.ts 의 SHARE_NOTICE_BY_KIND 주석이 이 경로를 표 밖으로 빼 둔 이유).
import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { createShareLink, isShareError, shareNoticeFor } from '../../share/index.ts';
import type { SharedDoc } from '../../share/index.ts';
import { rememberShareLink } from '../../storage/shareLinks.ts';
import { useT } from '../../i18n/useT.ts';
import type { DictKey } from '../../i18n/ko.ts';

/** 화면이 고를 문구 종류. 결정 10 의 넷 + 만들기 경로에만 있는 둘. */
type CreateNotice = 'not-found' | 'bad-key' | 'too-new' | 'network' | 'too-large' | 'rate-limited';

const NOTICE_KEY: Record<CreateNotice, DictKey> = {
  'not-found': 'library.share.error.notFound',
  'bad-key': 'library.share.error.badKey',
  'too-new': 'library.share.error.tooNew',
  network: 'library.share.error.network',
  'too-large': 'library.share.error.tooLarge',
  'rate-limited': 'library.share.error.rateLimited',
};

/** 만들기 경로의 예외 → 문구 종류. `too-large`·`rate-limited` 는 여기서 **직접** 가른다 —
 *  `shareNoticeFor` 는 가져오기 경로용 접기표라 그 둘을 bad-key·network 로 뭉갠다. */
function createNoticeFor(e: unknown): CreateNotice {
  if (isShareError(e) && (e.kind === 'too-large' || e.kind === 'rate-limited')) return e.kind;
  return shareNoticeFor(e);
}

type State =
  | { phase: 'creating' }
  | { phase: 'done'; link: string }
  | { phase: 'error'; notice: CreateNotice };

export interface ShareLinkModalProps {
  open: boolean;
  /** 링크로 만들 **문서**(S1). 드릴이면 카드 진입이 요약이 아니라 본문을 읽어 넘기고, 세션이면
   *  세션과 그 세션이 편성한 드릴 전부를 함께 넘긴다 — 봉투가 그 둘을 같이 싣기 때문이다
   *  (`exportSessionFile(session, drills)`). 종류를 화면이 정하지 않고 **부르는 쪽이 말한다.**
   *
   *  ⚠️ 호출자는 이 객체를 **state 에 들고 있어야 한다.** 렌더마다 `{ kind, drill }` 을 새로 지어
   *  넘기면 아래 effect 의 의존이 매번 바뀌어 링크를 **무한히 새로 만든다**(서버에 암호문이
   *  계속 쌓인다). 옛 `drill` prop(드릴 전용, 2026-09-07)은 마지막 호출자가 옮기면서 지웠다. */
  doc: SharedDoc | null;
  onClose(): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ShareLinkModal({ open, doc, onClose, returnFocusRef }: ShareLinkModalProps) {
  const titleId = useId();
  const t = useT();
  const [state, setState] = useState<State>({ phase: 'creating' });
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const target = doc;

  useEffect(() => {
    if (!open || !target) return;
    // 닫혔다 다시 열리면 **새 링크**다(새 키·새 id). 옛 링크를 재사용하지 않는 이유: 키가
    // 링크 자체이므로, 한 번 흘린 링크를 회수하려면 새로 만드는 것 말고 길이 없다.
    setState({ phase: 'creating' });
    setCopied('idle');
    let alive = true;
    void (async () => {
      try {
        const made = await createShareLink(target, window.location.origin);
        // ⚠️ 화면보다 토큰이 먼저다(머리말). alive 여부와 무관하게 남긴다 — 모달이 닫혀도
        //    링크는 이미 서버에 만들어져 있고, 토큰이 없으면 그것을 영영 못 지운다.
        rememberShareLink(made.id, {
          deleteToken: made.deleteToken,
          createdAt: Date.now(),
          ...(target.kind === 'drill' ? { drillId: target.drill.id } : { sessionId: target.session.id }),
        });
        if (alive) setState({ phase: 'done', link: made.link });
      } catch (e) {
        if (alive) setState({ phase: 'error', notice: createNoticeFor(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, target]);

  if (!open || !target) return null;

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      // 클립보드는 권한·보안 컨텍스트·사용자 제스처 셋 중 하나만 어긋나도 거절한다. 실패를
      // 삼키면 사람은 붙여넣기가 안 되는 이유를 모른 채 다시 누른다 — 직접 고를 길을 안내하고
      // 입력칸의 글자를 통째로 선택해 준다(길게 누르기 한 번이면 복사가 된다).
      setCopied('failed');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      title={t('library.share.link')}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      {state.phase === 'creating' && <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{t('library.share.creating')}</p>}

      {state.phase === 'error' && (
        <p role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
          {t(NOTICE_KEY[state.notice])}
        </p>
      )}

      {state.phase === 'done' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={state.link}
              aria-label={t('library.share.linkAriaLabel')}
              // 눌러서 고르는 것이 기본 행위다 — 클립보드가 막힌 환경(구형 WebView·권한 거절)
              // 에서도 [복사] 없이 손으로 복사할 수 있어야 한다.
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 'var(--hit)',
                padding: '0 0.75rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border)',
                background: 'var(--elev)',
                color: 'var(--text)',
                fontSize: '0.8125rem',
              }}
            />
            <Button variant="primary" onClick={() => void copy(state.link)}>
              {t('library.share.copy')}
            </Button>
          </div>
          {/* 복사 결과는 토스트가 아니라 모달 안에 남긴다 — 토스트는 모달 뒤로 깔리고, 여기가
              사람이 지금 보고 있는 자리다. 라이브 리전으로 읽어 준다. */}
          <p aria-live="polite" style={{ minHeight: '1.2em', marginTop: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>
            {copied === 'ok' ? t('library.share.copied') : copied === 'failed' ? t('library.share.copyFailed') : ''}
          </p>
          {/* 결정 11 의 한 줄 안내 — 무엇이 서버에 남고 언제 사라지는지. 법 문서(개인정보처리
              방침 「공유 링크」 조)와 **같은 사실**을 말한다. */}
          <p style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6 }}>{t('library.share.note')}</p>
          {/* S2 — 세션에만 붙는 한 줄. 세션 봉투는 드릴과 달리 **코치가 쓴 글**(장소·메모)을 싣고
              가므로, 보내기 전에 그 사실을 말한다(참가자 명단은 codec 이 지운다). 드릴 링크에는
              이 줄이 뜨지 않는다 — 드릴 봉투에는 장소도 메모도 없다. */}
          {target.kind === 'session' && (
            <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6 }}>{t('library.share.noteSession')}</p>
          )}
        </>
      )}
    </Modal>
  );
}
