// 문서형 도움말(HelpCenter) — docs/PLAN-HELP-TUTORIAL.md §B.
//
// CenterModal(왼쪽 목차 고정 + 오른쪽 본문 스크롤, position:sticky 로 두 번째 스크롤 컨테이너
// 없이 구현) 위에 화면별 섹션을 얹는다. "단축키" 섹션은 손으로 안 적는다 — editorHelpRows.ts·
// presentHelpRows.ts(각각 HelpModal·HelpOverlay 와 공유하는 keymap.ts 파생 표)를 그대로
// 불러 쓴다: 표가 두 곳에 따로 있으면 한쪽만 고치고 잊는 사고가 난다(그 두 파일 머리말의 경고).
//
// 이 컴포넌트는 **레일 [도움말] 버튼에 아직 안 물렸다** — 그 배선(현재 화면 섹션 자동 선택,
// 기능바·세로바의 옛 [도움말] 칸 제거, HelpModal/HelpOverlay 은퇴)은 계획서 §E Phase 5 몫이다.
// 여기서는 컴포넌트 자체의 정확성(섹션 전환·복원·투어 재시작 콜백)만 잡는다.
import { Fragment, useEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { CenterModal } from '../CenterModal.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import { editorBasicsRows, editorShortcutRows, editorToolRows } from '../../features/editor/editorHelpRows.ts';
import { presentHelpRows } from '../../features/present/presentHelpRows.ts';
import { HELP_NARRATIVE_SECTIONS, HELP_SECTION_LABEL_KEY, HELP_SECTION_ORDER } from './helpSections.ts';
import type { HelpSectionKey } from './helpSections.ts';

export interface HelpCenterProps {
  open: boolean;
  onClose(): void;
  /** "현재 화면에 맞는 섹션이 열린 채로 뜬다"(§B) — 열 때마다 이 값으로 되돌린다. */
  initialSection: HelpSectionKey;
  /** [이 화면 투어 다시 보기] 콜백 — 화면 쪽이 그 화면의 useTutorial().start() 를 물린다.
   *  여기서 모달을 먼저 닫은 뒤 부른다(스포트라이트가 이 모달 위에 겹치지 않도록). */
  onRestartTutorial(screen: TutorialScreenKey): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const NAV_BUTTON_STYLE = (active: boolean): CSSProperties => ({
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
  color: active ? 'var(--accent-text)' : 'var(--text)',
  fontSize: '0.8125rem',
  fontWeight: active ? 700 : 600,
  minHeight: 'var(--hit)',
  cursor: 'pointer',
});

function DlItems({ items }: { items: ReadonlyArray<{ term: string; desc: string }> }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, fontSize: '0.8125rem' }}>
      {items.map((it) => (
        <Fragment key={it.term}>
          <dt style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{it.term}</dt>
          <dd style={{ color: 'var(--muted)' }}>{it.desc}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function RestartButtons({
  targets,
  onRestartTutorial,
  onClose,
}: {
  targets: ReadonlyArray<{ screen: TutorialScreenKey; label: string }>;
  onRestartTutorial(screen: TutorialScreenKey): void;
  onClose(): void;
}) {
  if (targets.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
      {targets.map((tgt) => (
        <button
          key={tgt.screen}
          type="button"
          onClick={() => {
            onClose();
            onRestartTutorial(tgt.screen);
          }}
          style={{
            minHeight: 'var(--hit)',
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid var(--border-strong)',
            background: 'var(--elev)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {tgt.label}
        </button>
      ))}
    </div>
  );
}

function ShortcutsSection({ t, locale }: { t: ReturnType<typeof useT>; locale: ReturnType<typeof useLocale> }) {
  const editorBasics = editorBasicsRows(t).map(([term, desc]) => ({ term, desc }));
  const editorTools = editorToolRows(locale).map(([term, desc]) => ({ term, desc }));
  const drillRows = editorShortcutRows('drill', t, locale).map(([term, desc]) => ({ term, desc }));
  const boardRows = editorShortcutRows('board', t, locale).map(([term, desc]) => ({ term, desc }));
  const presentRows = presentHelpRows(t, locale).map(([term, desc]) => ({ term, desc }));
  return (
    <div>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{t('help.shortcuts.editorHeading')}</h3>
      <DlItems items={editorBasics} />
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: '0.875rem 0 0.5rem', color: 'var(--accent-text)' }}>{t('help.shortcuts.toolsHeading')}</h4>
      <DlItems items={editorTools} />
      <DlItems items={drillRows} />

      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '1.25rem 0 0.5rem' }}>{t('help.shortcuts.boardHeading')}</h3>
      <DlItems items={boardRows} />

      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '1.25rem 0 0.5rem' }}>{t('help.shortcuts.presentHeading')}</h3>
      <DlItems items={presentRows} />
    </div>
  );
}

export function HelpCenter({ open, onClose, initialSection, onRestartTutorial, returnFocusRef }: HelpCenterProps) {
  const t = useT();
  const locale = useLocale();
  const [active, setActive] = useState<HelpSectionKey>(initialSection);

  // 열 때마다 "지금 있던 화면" 섹션으로 되돌린다 — 전에 다른 섹션을 보다 닫았어도 다음에
  // 열면 다시 현재 화면부터다(§B).
  useEffect(() => {
    if (open) setActive(initialSection);
  }, [open, initialSection]);

  return (
    <CenterModal open={open} onClose={onClose} title={t('help.center.title')} closeLabel={t('common.close')} returnFocusRef={returnFocusRef}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <nav aria-label={t('help.center.navAriaLabel')} style={{ flex: '0 0 132px', display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 0 }}>
          {HELP_SECTION_ORDER.map((key) => (
            <button key={key} type="button" aria-current={active === key ? 'true' : undefined} onClick={() => setActive(key)} style={NAV_BUTTON_STYLE(active === key)}>
              {t(HELP_SECTION_LABEL_KEY[key])}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>
          {active === 'shortcuts' ? (
            <ShortcutsSection t={t} locale={locale} />
          ) : (
            (() => {
              const section = HELP_NARRATIVE_SECTIONS[active];
              return (
                <>
                  <DlItems items={section.items.map((it) => ({ term: t(it.term), desc: t(it.desc) }))} />
                  <RestartButtons
                    targets={section.restartTargets.map((tgt) => ({ screen: tgt.screen, label: t(tgt.labelKey) }))}
                    onRestartTutorial={onRestartTutorial}
                    onClose={onClose}
                  />
                </>
              );
            })()
          )}
        </div>
      </div>
    </CenterModal>
  );
}
