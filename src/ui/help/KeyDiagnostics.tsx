// [키 진단] — 방금 누른 키를 앱이 **어떻게 받았는지** 그대로 보여주는 관측 창
// (PLAN-HELP-OVERHAUL 결정 5, 기현 지시 2026-09-08: *"단축키가 작동 안할때가 있었다."*).
//
// 왜 존재하나. 단축키가 안 먹는 원인은 코드로 확정할 수 없는 자리에 있다 — 입력기가 조합
// 중인지, 그 키보드가 `code` 를 싣는지, 수식키를 OS 가 먼저 가져갔는지는 **그 기기에서만**
// 참이다. jsdom 은 이 셋을 하나도 못 잰다. 그래서 판정을 사람 손에 넘긴다: 실기에서 눌러
// 보고 표를 읽으면 "안 먹는다" 가 네 갈래(조합 중 · code 가 빔 · 설정이 막음 · 애초에 정의가
// 없음) 중 어느 것인지 그 자리에서 갈린다.
//
// 무엇을 하면 안 되나.
//  · **preventDefault·stopPropagation 을 걸지 않는다.** 이것은 진단이지 가로채기가 아니다 —
//    막는 순간 재는 대상(정상 경로가 그 키로 무엇을 하는가)이 바뀌어 관측이 거짓말이 된다.
//    같은 이유로 capture 단계에서 듣기만 한다(누가 먼저 먹든 기록은 남는다).
//  · **입력칸 포커스를 이유로 거르지 않는다.** 조합 중 키야말로 여기서 봐야 할 것이고,
//    디스패처의 `isEditableTarget` 관문은 그 사건을 **되돌려보내므로** 여기서도 걸러 버리면
//    사용자가 겪는 바로 그 경우가 화면에 영영 안 뜬다.
//  · 걸린 동작은 세 층을 **다 보여준다**. 한 층만 보이면 "개체에 포커스가 있을 때만 사는 키"
//    (WCAG 2.1.4 예외 구간, keymap.ts 머리말)를 죽은 키로 오해한다.
//  · **전역 층은 설정 게이트를 통과시켜 본다**(`gatedLookup`). keymap 원본을 그대로 보이면
//    [편집기 단축키] 가 `끔`·`수식키 필요` 일 때 죽어 있는 키를 "정의 있음" 으로 그려, 원인을
//    찾으러 온 사람에게 정반대 답을 준다. 대신 게이트 값을 한 행으로 함께 보여 준다 — 층이
//    비었을 때 그것이 "설정이 막음" 인지 "정의가 없음" 인지는 그 행에서만 갈린다.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { lookupDef } from '../../core/keymap.ts';
import type { KeyScope } from '../../core/keymap.ts';
import { gatedLookup } from '../../features/editor/useEditorKeyboard.ts';
import type { SingleKeyMode } from '../../features/editor/useEditorKeyboard.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { isImeKeyEvent } from '../keyboard.ts';
import { useT } from '../../i18n/useT.ts';

const SCOPES: readonly KeyScope[] = ['global', 'object', 'present'];

interface KeySnapshot {
  code: string;
  key: string;
  mods: string;
  composing: string;
  /** 층 → 동작 id. 그 층에 걸린 것이 없으면 undefined. */
  actions: Readonly<Record<KeyScope, string | undefined>>;
}

function snapshot(e: KeyboardEvent, mode: SingleKeyMode): KeySnapshot {
  const mods = [e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean).join(' + ');
  // 조합 신호는 **판정 결과와 원자료를 함께** 싣는다 — 어느 신호가 섰는지가 곧 그 입력기가
  // 어느 경로를 타는지이고(`isImeKeyEvent` 머리말의 셋), 원인 보고에 필요한 것은 그쪽이다.
  const composing = `${isImeKeyEvent(e) ? '✓' : '—'} (isComposing=${String(e.isComposing)}, keyCode=${e.keyCode})`;
  return {
    code: e.code || '(empty)',
    key: e.key,
    mods,
    composing,
    actions: {
      // 전역 층만 게이트를 탄다 — 개체·시연 층은 설정과 무관하다(개체 키는 포커스가 있을 때만
      // 살아 WCAG 2.1.4 예외 구간이고, 게이트를 태우면 키보드 조작이 통째로 사라진다).
      global: gatedLookup(e, mode)?.id,
      object: lookupDef('object', e)?.id,
      present: lookupDef('present', e)?.id,
    },
  };
}

const ROW_LABEL: CSSProperties = { fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', paddingRight: 16 };
const ROW_VALUE: CSSProperties = { color: 'var(--muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' };

/** 마운트되어 있는 동안만 듣는다 — 도움말이 닫히면 리스너도 사라진다. props 가 없다:
 *  어느 층에 걸렸는지를 **고르는 것이 아니라 다 보여주는 것**이 이 창의 일이라 고를 것이 없다. */
export function KeyDiagnostics() {
  const t = useT();
  const { prefs } = useSettingsState();
  const mode = prefs.a11y.singleKeyShortcuts;
  const [last, setLast] = useState<KeySnapshot | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => setLast(snapshot(e, mode));
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [mode]);

  const none = t('help.keys.diag.none');
  const gateLabel = mode === 'on' ? 'settings.a11y.shortcutsSingle' : mode === 'modifier' ? 'settings.a11y.shortcutsModifier' : 'settings.a11y.shortcutsOff';
  const rows: ReadonlyArray<[string, string]> = [
    [t('help.keys.diag.code'), last?.code ?? none],
    [t('help.keys.diag.key'), last?.key ?? none],
    [t('help.keys.diag.mods'), last && last.mods !== '' ? last.mods : none],
    [t('help.keys.diag.composing'), last?.composing ?? none],
    // 게이트 값은 마지막 키와 무관하게 **늘** 보인다 — 아무 키도 안 눌러 본 사람이 먼저 보고
    // "아, 내가 꺼 뒀구나" 로 끝낼 수 있는 행이다(설정 라벨과 같은 문자열을 쓴다).
    [t('help.keys.diag.gate'), t(gateLabel)],
    [
      t('help.keys.diag.action'),
      last === null
        ? none
        : (SCOPES.filter((s) => last.actions[s] !== undefined)
            .map((s) => `${s}: ${last.actions[s] ?? ''}`)
            .join('  ·  ') || none),
    ],
  ];

  return (
    <section aria-label={t('help.keys.diag.title')} style={{ border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12, background: 'var(--panel-2)' }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0 }}>{t('help.keys.diag.title')}</h4>
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '6px 0 10px' }}>{t('help.keys.diag.hint')}</p>
      {/* 눌린 키의 결과를 낭독으로도 준다 — 키가 안 먹는지 보려는 사람이 화면을 못 볼 수 있다.
          polite 라 조합 중 연속 입력이 낭독을 끊지 않는다. */}
      <dl aria-live="polite" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 6, fontSize: '0.75rem', margin: 0 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt style={ROW_LABEL}>{label}</dt>
            <dd style={{ ...ROW_VALUE, margin: 0 }}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
