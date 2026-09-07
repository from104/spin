// 문서형 도움말(HelpCenter) — docs/PLAN-HELP-TUTORIAL.md §B + PLAN-HELP-OVERHAUL 결정 1·2·4·5.
//
// CenterModal(왼쪽 목차 고정 + 오른쪽 본문 스크롤, position:sticky 로 두 번째 스크롤 컨테이너
// 없이 구현) 위에 섹션 → 주제(topic) → 블록을 그린다. 이 파일은 **렌더러**다: 문장은 한 줄도
// 여기 없고 `helpContent.ko/en/ja.ts` 에서 온다.
//
// ── ⚠️ 2026-09-08: 머리말의 옛 마지막 문단("레일 [도움말] 버튼에 아직 안 물렸다") 을 지운다 ──
// 그 배선은 2026-08-28 에 끝났다(`HelpTriggerProvider` + 각 화면의 `helpOpen`). 주석만 남아
// 있어서 조사가 "미배선" 으로 읽는 사고가 있었다(PLAN-HELP-OVERHAUL 결정 15).
//
// 지키는 것 셋.
//  · **단축키 표를 손으로 안 적는다.** `keys` 블록은 `scope` 만 싣고, 표는 keymap 파생 함수
//    (editorHelpRows.ts · presentHelpRows.ts · core/keymap.ts)에서 만든다. 표가 두 곳에 있으면
//    한쪽만 고치고 잊는 사고가 난다(그 파일들 머리말의 경고).
//  · **인라인 서식은 문자열 split 이다.** `dangerouslySetInnerHTML` 을 쓰지 않는다 — 본문은
//    앞으로 번역자·기여자가 쓰는 자리라 HTML 주입 경로를 아예 만들지 않는다.
//  · 열 때마다 `initialSection` 으로 되돌린다(§B). `initialTopic` 이 있으면 그 주제까지 민다.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { CenterModal } from '../CenterModal.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { Locale } from '../../i18n/locale.ts';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import { editorBasicsRows, editorShortcutRows, editorToolRows } from '../../features/editor/editorHelpRows.ts';
import type { HelpRow } from '../../features/editor/editorHelpRows.ts';
import { presentHelpRows } from '../../features/present/presentHelpRows.ts';
import { helpRows } from '../../core/keymap.ts';
import { keymapLabel, translateKeymapDesc } from '../../i18n/keymapDesc.ts';
import { HELP_RESTART_TARGETS, HELP_SECTION_LABEL_KEY, HELP_SECTION_ORDER } from './helpSections.ts';
import type { HelpSectionKey } from './helpSections.ts';
import { helpContentFor } from './helpContent.ts';
import type { HelpBlock, HelpKeyScope, HelpSectionContent, HelpTopic } from './helpContent.ts';
import { KeyDiagnostics } from './KeyDiagnostics.tsx';

/** 이 주제 자리에 [키 진단] 관측 창이 선다(결정 5). 주제 id 로 매다는 이유는, 콘텐츠 쪽이
 *  "무엇을 위한 도구인가" 를 글로 쓰고 도구 자체는 코드가 붙이기 때문이다 — 로케일 셋이 각자
 *  진단 창을 붙일 방법이 없어야 한다. */
const DIAGNOSTICS_TOPIC_ID = 'shortcuts.diagnose';

export interface HelpCenterProps {
  open: boolean;
  onClose(): void;
  /** "현재 화면에 맞는 섹션이 열린 채로 뜬다"(§B) — 열 때마다 이 값으로 되돌린다. */
  initialSection: HelpSectionKey;
  /** 특정 주제로 바로 미는 값(`섹션.주제`). 없는 id 면 조용히 무시한다 — 여는 쪽이 화면 사정에
   *  따라 넘기므로, 그 주제가 아직 없다고 도움말이 안 열리면 안 된다. */
  initialTopic?: string;
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

const TOPIC_BUTTON_STYLE: CSSProperties = {
  textAlign: 'left',
  padding: '4px 10px 4px 20px',
  border: 'none',
  background: 'transparent',
  color: 'var(--muted)',
  fontSize: '0.75rem',
  fontWeight: 500,
  minHeight: 28,
  cursor: 'pointer',
};

// ── 인라인 서식 ────────────────────────────────────────────────────────────────
// `**굵게**` 와 `` `키` `` 둘만 푼다. split 의 캡처 그룹이 구분자까지 배열에 남기므로 조각을
// 훑으며 그대로 React 노드로 바꾼다 — 중간 산물이 문자열이 아니라 노드라 주입될 자리가 없다.
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

const KBD_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.75rem',
  padding: '1px 6px',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--elev)',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
};

function Inline({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split(INLINE_RE).map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
          return (
            <kbd key={i} style={KBD_STYLE}>
              {part.slice(1, -1)}
            </kbd>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

// ── keys 블록 — keymap 파생 ────────────────────────────────────────────────────
/** `scope` → 표. 'editor'/'object' 는 층을 갈라 보여준다(합치면 개체 포커스에서만 사는 키가
 *  전역 키처럼 보인다), 'board' 는 스텝 키를 뺀 전술판 표 그대로다. */
function rowsForScope(scope: HelpKeyScope, t: ReturnType<typeof useT>, locale: Locale): readonly HelpRow[] {
  switch (scope) {
    case 'editor':
      // 놓기·옮기기 같은 포인터 조작은 keymap 에 없다(키가 아니다) — 그 줄은 editorBasicsRows 가 낸다.
      return [...editorBasicsRows(t), ...helpRows('global', { steps: true }).map(([key, desc]): HelpRow => [keymapLabel(key), translateKeymapDesc(desc, locale)])];
    case 'object':
      return helpRows('object', { steps: true }).map(([key, desc]): HelpRow => [keymapLabel(key), translateKeymapDesc(desc, locale)]);
    case 'board':
      return editorShortcutRows('board', t, locale);
    case 'present':
      return presentHelpRows(t, locale);
    case 'tools':
      return editorToolRows(locale);
  }
}

function KeysTable({ rows }: { rows: readonly HelpRow[] }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 8, columnGap: 16, fontSize: '0.8125rem', margin: '0 0 12px' }}>
      {rows.map(([key, desc]) => (
        <Fragment key={`${key} ${desc}`}>
          <dt style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            <kbd style={KBD_STYLE}>{key}</kbd>
          </dt>
          <dd style={{ color: 'var(--muted)', margin: 0 }}>{desc}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

// ── 블록 ──────────────────────────────────────────────────────────────────────
const TIP_TONE: Record<'tip' | 'warn', { border: string; bg: string }> = {
  tip: { border: 'var(--border-strong)', bg: 'var(--panel-2)' },
  // 주의는 색만으로 구분하지 않는다 — 콘텐츠 쪽 문장이 "주의:" 로 시작하므로 여기서는 테두리만 세운다.
  warn: { border: 'var(--accent)', bg: 'var(--panel-2)' },
};

function Block({ block, t, locale }: { block: HelpBlock; t: ReturnType<typeof useT>; locale: Locale }) {
  switch (block.kind) {
    case 'p':
      return (
        <p style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--text)', margin: '0 0 10px' }}>
          <Inline text={block.text} />
        </p>
      );
    case 'h':
      return <h5 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-text)', margin: '14px 0 6px' }}>{block.text}</h5>;
    case 'steps':
      return (
        <ol style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--text)', margin: '0 0 10px', paddingLeft: '1.4em' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--text)', margin: '0 0 10px', paddingLeft: '1.2em' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case 'tip':
      return (
        <p
          style={{
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            color: 'var(--text)',
            margin: '0 0 10px',
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${TIP_TONE[block.tone].border}`,
            background: TIP_TONE[block.tone].bg,
          }}
        >
          <Inline text={block.text} />
        </p>
      );
    case 'keys':
      return <KeysTable rows={rowsForScope(block.scope, t, locale)} />;
  }
}

function TopicArticle({ topic, t, locale }: { topic: HelpTopic; t: ReturnType<typeof useT>; locale: Locale }) {
  return (
    <article id={topic.id} style={{ marginBottom: 22, scrollMarginTop: 8 }}>
      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 8px' }}>{topic.title}</h4>
      {topic.blocks.map((block, i) => (
        <Block key={i} block={block} t={t} locale={locale} />
      ))}
      {topic.id === DIAGNOSTICS_TOPIC_ID ? <KeyDiagnostics /> : null}
    </article>
  );
}

function RestartButtons({ section, t, onRestartTutorial, onClose }: { section: HelpSectionKey; t: ReturnType<typeof useT>; onRestartTutorial(screen: TutorialScreenKey): void; onClose(): void }) {
  const targets = HELP_RESTART_TARGETS[section];
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
          {t(tgt.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ── 찾기 ──────────────────────────────────────────────────────────────────────
/** 주제 하나의 검색 대상 문자열. `keys` 블록은 빼는데, 그 표는 keymap 에서 파생되므로 여기
 *  문자열이 없고(파생 시점에 생긴다) 키 이름으로 찾는 길은 단축키 섹션 자체가 이미 낸다. */
function topicHaystack(topic: HelpTopic): string {
  const parts: string[] = [topic.title];
  for (const b of topic.blocks) {
    if (b.kind === 'p' || b.kind === 'h' || b.kind === 'tip') parts.push(b.text);
    else if (b.kind === 'steps' || b.kind === 'list') parts.push(...b.items);
  }
  return parts.join('\n').toLowerCase();
}

interface SearchHit {
  section: HelpSectionKey;
  topic: HelpTopic;
}

export function HelpCenter({ open, onClose, initialSection, initialTopic, onRestartTutorial, returnFocusRef }: HelpCenterProps) {
  const t = useT();
  const locale = useLocale();
  const content = helpContentFor(locale);
  const [active, setActive] = useState<HelpSectionKey>(initialSection);
  const [query, setQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const sectionOf = useCallback(
    (topicId: string): HelpSectionKey | undefined => HELP_SECTION_ORDER.find((key) => content[key].topics.some((tp) => tp.id === topicId)),
    [content],
  );

  /** 목차·검색 결과에서 주제를 고르면 그 자리로 민다. jsdom 에는 scrollIntoView 가 없으므로
   *  optional call 이다 — 없다고 선택 자체가 죽으면 안 된다. */
  const scrollToTopic = useCallback((topicId: string) => {
    // 렌더가 끝난 뒤라야 <article id> 가 선다.
    requestAnimationFrame(() => {
      document.getElementById(topicId)?.scrollIntoView?.({ block: 'nearest' });
    });
  }, []);

  // 열 때마다 "지금 있던 화면" 섹션으로 되돌린다 — 전에 다른 섹션을 보다 닫았어도 다음에
  // 열면 다시 현재 화면부터다(§B). 찾기 입력도 같이 비운다: 남아 있으면 다음에 열었을 때
  // 현재 화면 섹션이 아니라 옛 검색 결과가 뜬다.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const target = initialTopic === undefined ? undefined : sectionOf(initialTopic);
    setActive(target ?? initialSection);
    if (target !== undefined && initialTopic !== undefined) scrollToTopic(initialTopic);
  }, [open, initialSection, initialTopic, sectionOf, scrollToTopic]);

  const hits: readonly SearchHit[] = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];
    const found: SearchHit[] = [];
    for (const key of HELP_SECTION_ORDER) {
      for (const topic of content[key].topics) {
        if (topicHaystack(topic).includes(needle)) found.push({ section: key, topic });
      }
    }
    return found;
  }, [query, content]);

  const searching = query.trim() !== '';
  const section: HelpSectionContent = content[active];

  return (
    <CenterModal open={open} onClose={onClose} title={t('help.center.title')} closeLabel={t('common.close')} returnFocusRef={returnFocusRef}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <nav aria-label={t('help.center.navAriaLabel')} style={{ flex: '0 0 168px', display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 0 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('help.search.label')}
            title={t('help.search.label')}
            placeholder={t('help.search.placeholder')}
            style={{
              minHeight: 'var(--hit)',
              marginBottom: 6,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: 'var(--elev)',
              color: 'var(--text)',
              fontSize: '0.8125rem',
            }}
          />
          {HELP_SECTION_ORDER.map((key) => (
            <Fragment key={key}>
              <button
                type="button"
                aria-current={!searching && active === key ? 'true' : undefined}
                aria-expanded={!searching && active === key}
                onClick={() => {
                  setQuery('');
                  setActive(key);
                }}
                style={NAV_BUTTON_STYLE(!searching && active === key)}
              >
                {t(HELP_SECTION_LABEL_KEY[key])}
              </button>
              {/* 주제 목록은 **열린 섹션에서만** 편다(결정 4 "섹션 → 접힌 주제 목록") — 주제가
                  70여 개라 다 펴면 목차가 본문보다 길어진다. */}
              {!searching && active === key
                ? content[key].topics.map((topic) => (
                    <button key={topic.id} type="button" onClick={() => scrollToTopic(topic.id)} style={TOPIC_BUTTON_STYLE}>
                      {topic.title}
                    </button>
                  ))
                : null}
            </Fragment>
          ))}
        </nav>
        <div ref={bodyRef} style={{ flex: 1, minWidth: 0 }}>
          {searching ? (
            hits.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{t('help.search.empty')}</p>
            ) : (
              hits.map((hit) => (
                <div key={hit.topic.id}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', margin: '0 0 2px' }}>{t(HELP_SECTION_LABEL_KEY[hit.section])}</p>
                  <TopicArticle topic={hit.topic} t={t} locale={locale} />
                </div>
              ))
            )
          ) : (
            <>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px' }}>{t(HELP_SECTION_LABEL_KEY[active])}</h3>
              {section.intro === undefined ? null : (
                <p style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 14px' }}>
                  <Inline text={section.intro} />
                </p>
              )}
              {section.topics.map((topic) => (
                <TopicArticle key={topic.id} topic={topic} t={t} locale={locale} />
              ))}
              <RestartButtons section={active} t={t} onRestartTutorial={onRestartTutorial} onClose={onClose} />
            </>
          )}
        </div>
      </div>
    </CenterModal>
  );
}
