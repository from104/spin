// §6.11 "세션 편집 = 우측 드로어 380px". 기본 정보 / 드릴 목록(포인터 DnD + 키보드 Alt+↑/↓) /
// [+ 드릴 추가] / [세션 시연 시작]. Drawer 자체(role=dialog aria-modal=false, 포커스 이동)는
// ui-kit 소유 컴포넌트를 그대로 쓴다 — 여기서는 내용만 채운다.
//
// 이탈(계약과 다른 점): §6.11 은 기본 정보에 "계획 시간"을 포함하고 총 시간이 계획을 넘으면
// #e08a12 로 표시하라고 적었지만, 실제 model/session.ts(TrainingSession, Wave2 완성본)에는
// 계획 시간 필드가 없다(§0 규칙 6: 코드가 계약과 다르면 코드가 맞다). 필드가 없어 비교 대상이
// 없으므로 그 입력·경고색 로직은 구현하지 않았다 — model 에 필드가 추가되면 이 드로어에서
// 그대로 이어 붙일 수 있다.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { Drawer } from '../../ui/Drawer.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconGripDots, IconPlus, IconClose } from '../../ui/icons.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { categoryColor } from '../../core/colors.ts';
import { getSession, putSession, addDrillToSession } from '../../storage/sessionRepo.ts';
import { resolveSession } from '../../model/session.ts';
import type { ResolvedItem, TrainingSession } from '../../model/session.ts';
import type { DrillSummary } from '../../model/summary.ts';
import type { ItemId, SessionId } from '../../core/ids.ts';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { toLocalInputValue, fromLocalInputValue } from './time.ts';
import { exportOneSession } from './transfer.ts';

export interface SessionDrawerProps {
  sessionId: SessionId | null;
  open: boolean;
  onClose(): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onPresent(sessionId: SessionId): void;
}

export function SessionDrawer({ sessionId, open, onClose, returnFocusRef, onPresent }: SessionDrawerProps) {
  const { drills, refresh } = useLibrary();
  const [session, setSession] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    let cancelled = false;
    setSession(null);
    void getSession(sessionId).then((r) => {
      if (!cancelled) setSession(r?.session ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const existing = useMemo(() => new Set(drills.map((d) => d.id)), [drills]);
  const resolved = useMemo(() => (session ? resolveSession(session, existing) : null), [session, existing]);

  async function save(next: TrainingSession): Promise<void> {
    setSession(next); // 낙관적 반영 — 입력 필드가 왕복 지연 없이 즉시 갱신된다
    const saved = await putSession(next);
    setSession(saved);
    await refresh();
  }

  return (
    <Drawer open={open} onClose={onClose} title={session?.title ?? '세션'} returnFocusRef={returnFocusRef}>
      {!session || !resolved ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>불러오는 중…</p>
      ) : (
        <SessionDrawerBody session={session} resolved={resolved.items} totalMin={resolved.totalMin} drills={drills} onSave={save} onPresent={() => onPresent(session.id)} />
      )}
    </Drawer>
  );
}

function SessionDrawerBody({
  session,
  resolved,
  totalMin,
  drills,
  onSave,
  onPresent,
}: {
  session: TrainingSession;
  resolved: ResolvedItem[];
  totalMin: number;
  drills: DrillSummary[];
  onSave(next: TrainingSession): Promise<void>;
  onPresent(): void;
}) {
  const [addDrillId, setAddDrillId] = useState('');
  const addSelectId = useId();
  const notInSession = drills.filter((d) => !session.drillIds.includes(d.id));

  const handleAdd = async () => {
    if (!addDrillId) return;
    const next = await addDrillToSession(session.id, addDrillId as DrillSummary['id']);
    await onSave(next);
    setAddDrillId('');
  };

  const handleRemove = async (itemId: string) => {
    const items = session.items.filter((it) => it.id !== itemId);
    await onSave({ ...session, items });
  };

  const handleDurationChange = async (itemId: string, minutes: number) => {
    const items = session.items.map((it) => (it.id === itemId ? { ...it, durationOverrideMin: minutes } : it));
    await onSave({ ...session, items });
  };

  const handleReorder = async (from: number, to: number) => {
    if (from === to) return;
    const items = session.items.slice();
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved!);
    await onSave({ ...session, items });
    liveRegion.say(`${moved!.titleCache} — ${to + 1}번째로 이동`);
  };

  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="세션명">
          <input
            type="text"
            defaultValue={session.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== session.title && onSave({ ...session, title: e.target.value.trim() })}
            style={inputStyle}
          />
        </Field>
        <Field label="일시">
          <input
            type="datetime-local"
            defaultValue={session.scheduledAt !== undefined ? toLocalInputValue(session.scheduledAt) : ''}
            onBlur={(e) => {
              const ms = fromLocalInputValue(e.target.value);
              onSave(ms === undefined ? { ...session, scheduledAt: undefined } : { ...session, scheduledAt: ms });
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="장소">
          <input
            type="text"
            defaultValue={session.location ?? ''}
            onBlur={(e) => e.target.value !== (session.location ?? '') && onSave({ ...session, location: e.target.value || undefined })}
            style={inputStyle}
          />
        </Field>
      </section>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint-text)' }}>드릴 목록</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>총 {totalMin}분</span>
        </div>

        <ItemList items={resolved} onReorder={handleReorder} onRemove={handleRemove} onDurationChange={handleDurationChange} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="sr-only" htmlFor={addSelectId}>
            추가할 드릴
          </label>
          <select
            id={addSelectId}
            value={addDrillId}
            onChange={(e) => setAddDrillId(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="">드릴 선택…</option>
            {notInSession.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <Button variant="secondary" icon={<IconPlus size={14} />} onClick={handleAdd} disabled={!addDrillId}>
            추가
          </Button>
        </div>
      </section>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => void exportOneSession(session)}>
          내보내기
        </Button>
        <Button variant="primary" fullWidth onClick={onPresent} style={{ height: 48 }}>
          세션 시연 시작
        </Button>
      </div>
    </>
  );
}

/** 암묵적 라벨 연결(중첩) — input 이 label 의 자손이면 htmlFor/id 없이도 접근 가능한 이름이 붙는다. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  width: '100%',
};

// ── 드릴 목록: 포인터 DnD(핸들 44×44) + 키보드 Alt+↑/↓ ──────────────────────────────────────
function ItemList({
  items,
  onReorder,
  onRemove,
  onDurationChange,
}: {
  items: ResolvedItem[];
  onReorder(from: number, to: number): void;
  onRemove(itemId: string): void;
  onDurationChange(itemId: string, minutes: number): void;
}) {
  const [order, setOrder] = useState<ItemId[]>(() => items.map((it) => it.id));
  const dragId = useRef<ItemId | null>(null);
  const rowRefs = useRef<Map<ItemId, HTMLDivElement>>(new Map());
  const committedRef = useRef<ItemId[]>(order);

  useEffect(() => {
    const next = items.map((it) => it.id);
    setOrder(next);
    committedRef.current = next;
  }, [items]);

  const byId = new Map(items.map((it) => [it.id, it]));
  const ordered = order.map((id) => byId.get(id)).filter((it): it is ResolvedItem => it !== undefined);

  const onHandlePointerDown = (id: ItemId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragId.current = id;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragId.current) return;
    let hoveredId: ItemId | null = null;
    for (const [id, el] of rowRefs.current) {
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        hoveredId = id;
        break;
      }
    }
    if (!hoveredId || hoveredId === dragId.current) return;
    setOrder((cur) => {
      const from = cur.indexOf(dragId.current!);
      const to = cur.indexOf(hoveredId!);
      if (from === -1 || to === -1) return cur;
      const next = cur.slice();
      next.splice(from, 1);
      next.splice(to, 0, dragId.current!);
      return next;
    });
  };
  const onHandlePointerUp = () => {
    if (!dragId.current) return;
    dragId.current = null;
    const from = committedRef.current;
    const to = order;
    if (from.length === to.length && from.some((id, i) => id !== to[i])) {
      // 최종 위치 하나로 커밋 — from/to 는 committed 배열 기준 원래 인덱스와 최종 인덱스.
      const movedId = from.find((id, i) => id !== to[i] && to.includes(id)) ?? to[0]!;
      onReorder(from.indexOf(movedId), to.indexOf(movedId));
    }
  };

  const onHandleKeyDown = (id: ItemId, index: number) => (e: ReactKeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = e.key === 'ArrowUp' ? index - 1 : index + 1;
    if (to < 0 || to >= order.length) return;
    onReorder(index, to);
    void id;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ordered.length === 0 && <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>아직 드릴이 없습니다.</p>}
      {ordered.map((it, index) => (
        <div
          key={it.id}
          ref={(el) => {
            if (el) rowRefs.current.set(it.id, el);
            else rowRefs.current.delete(it.id);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--panel-2)',
            opacity: it.missing ? 0.55 : 1,
          }}
        >
          <button
            type="button"
            aria-label={`${it.titleCache} 순서 변경 — Alt+화살표로도 이동`}
            onPointerDown={onHandlePointerDown(it.id)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onKeyDown={onHandleKeyDown(it.id, index)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--faint-text)', touchAction: 'none' }}
          >
            <IconGripDots />
          </button>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor(it.categoryCache), flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.titleCache}
            {it.missing ? ' (삭제됨)' : ''}
          </span>
          <label>
            <span className="sr-only">{it.titleCache} 소요 시간(분)</span>
            {/* 기본 정보 필드(세션명·일시·장소)와 같은 패턴 — 키 입력마다 IDB 왕복을 걸면
                (uncontrolled 대신 controlled+onChange 저장) 두 자리 숫자를 입력하는 사이에도
                왕복이 값보다 늦게 도착해 중간값이 붙어버린다. onBlur 커밋으로 통일한다. */}
            <input
              type="number"
              min={1}
              max={180}
              defaultValue={it.durationOverrideMin ?? it.durationMinCache}
              key={`${it.id}:${it.durationOverrideMin ?? it.durationMinCache}`}
              onBlur={(e) => onDurationChange(it.id, Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 56, minHeight: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--elev)', color: 'var(--text)', textAlign: 'center', fontSize: '0.8125rem' }}
            />
          </label>
          <button
            type="button"
            aria-label={`${it.titleCache} 세션에서 제거`}
            onClick={() => onRemove(it.id)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--faint-text)' }}
          >
            <IconClose size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
