// 재개 7종 비교표 블록 — docs/PLAN-RULES-REDESIGN.md §3 "비교표(넓은/좁은 화면)".
//
// 열(재개 종류) 하나를 고르면 표 아래(좁은 화면은 그 카드 바로 아래) 단일 플레이어가 그 장면
// 으로 교체된다. 재생 자체는 `RuleSceneBlock` 이 이미 포스터+재생 버튼을 갖고 있으므로 여기서
// 따로 "재생" 버튼을 만들지 않는다 — 열을 고르면 포스터가 바뀌고, 재생은 그 포스터를 눌러
// 시작한다(수동 재생만, 계획 §결정 11).
//
// 좁은 화면은 표를 가로 스크롤시키지 않는다(설치된 ui-ux-pro-max 스킬이 표 가로 스크롤을
// anti-pattern 으로 지목하고, 이 앱에도 그 선례가 없다) — 대신 재개별 카드로 세로 접는다.
// 접기는 앱의 기존 관례(진짜 `<button>` + `aria-expanded` + 형제 `<div>`)를 따른다 —
// `<details>/<summary>` 는 이 저장소에 선례가 없다.
import { useState } from 'react';
import { restartColumnsFor, restartRowLabelsFor } from './restartTable.ts';
import type { RestartColumn } from './restartTable.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { RestartCells } from './restartTable.ts';
import { RuleSceneBlock } from './RuleSceneBlock.tsx';
import type { RuleSceneId } from './ruleScenes.ts';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';
import { IconCheck } from '../../ui/icons.tsx';
import { useT } from '../../i18n/useT.ts';

export interface RestartTableBlockProps {
  activeSceneId: RuleSceneId | null;
  onActivateScene: (id: RuleSceneId) => void;
}

function DirectGoalMark({ ok, label }: { ok: boolean; label: string }) {
  const color = ok ? 'var(--accent)' : 'var(--muted)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: 999,
          flex: 'none',
          background: `color-mix(in srgb, ${color} 20%, transparent)`,
          color,
        }}
      >
        {ok ? <IconCheck size={11} /> : <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>}
      </span>
      {label}
    </span>
  );
}

const CELL_KEYS: readonly (keyof RestartCells)[] = ['when', 'ball', 'distance', 'directGoal', 'notes'];

function cellText(col: RestartColumn, key: keyof RestartCells) {
  const v = col.cells[key];
  return typeof v === 'string' ? v : <DirectGoalMark ok={v.ok} label={v.label} />;
}

export function RestartTableBlock({ activeSceneId, onActivateScene }: RestartTableBlockProps) {
  const narrow = useIsNarrow();
  const locale = useLocale();
  const t = useT();
  const columns = restartColumnsFor(locale);
  const rowLabels = restartRowLabelsFor(locale);
  const [selectedKey, setSelectedKey] = useState(columns[0]!.key);
  const selected = columns.find((c) => c.key === selectedKey) ?? columns[0]!;

  if (narrow) {
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {columns.map((col) => {
          const open = col.key === selectedKey;
          return (
            <div key={col.key} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--panel)' }}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setSelectedKey(col.key)}
                style={{
                  width: '100%',
                  minHeight: 44,
                  textAlign: 'left',
                  padding: '11px 14px',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: open ? 'var(--text)' : 'var(--muted)',
                  transition: 'color 150ms ease',
                }}
              >
                {col.label}
              </button>
              {open && (
                <div style={{ padding: '2px 14px 16px' }}>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0 }}>
                    {CELL_KEYS.map((key, i) => (
                      <div key={key} style={{ display: 'contents' }}>
                        <dt style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--faint-text)' }}>{rowLabels[i]}</dt>
                        <dd style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)' }}>{cellText(col, key)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div key={col.sceneId} className="rules-fade-in">
                    <RuleSceneBlock sceneId={col.sceneId} active={activeSceneId === col.sceneId} onActivate={() => onActivateScene(col.sceneId)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <caption style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--faint-text)', marginBottom: 8 }}>
            {t('rules.table.caption')}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: '9em' }} />
              {columns.map((col) => {
                const active = col.key === selectedKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{
                      padding: 0,
                      borderBottom: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedKey(col.key)}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        padding: '10px 8px',
                        fontWeight: 700,
                        color: active ? 'var(--text)' : 'var(--muted)',
                        background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                        transition: 'background-color 150ms ease, color 150ms ease',
                      }}
                    >
                      {col.label}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel, i) => {
              const key = CELL_KEYS[i]!;
              return (
                <tr key={key}>
                  <th
                    scope="row"
                    style={{
                      textAlign: 'left',
                      padding: '9px 10px',
                      fontWeight: 600,
                      color: 'var(--faint-text)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {rowLabel}
                  </th>
                  {columns.map((col) => {
                    const active = col.key === selectedKey;
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '9px 10px',
                          textAlign: key === 'distance' || key === 'when' || key === 'notes' ? 'left' : 'center',
                          color: 'var(--text)',
                          borderBottom: '1px solid var(--border)',
                          background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                          transition: 'background-color 150ms ease',
                        }}
                      >
                        {cellText(col, key)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div key={selected.sceneId} className="rules-fade-in">
        <RuleSceneBlock sceneId={selected.sceneId} active={activeSceneId === selected.sceneId} onActivate={() => onActivateScene(selected.sceneId)} />
      </div>
    </div>
  );
}
