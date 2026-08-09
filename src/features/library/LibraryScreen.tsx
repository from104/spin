// §6.11: 목록 화면 = 드릴 그리드(부록A 마크업 이식) + "목록 화면의 탭"으로 얹은 세션 탭.
//
// 내비게이션·헤더: §8 "screen-home-library 의존은 store, render-court, ui-kit, model, storage
// 뿐" — app-shell 을 import 하지 않는다(HomeScreen.tsx 상단 주석과 같은 이유). 화면 전환은
// app-shell 이 내려주는 `HomeNav` prop 으로, 검색창·주 액션 라벨은 app-shell 이 정적으로 계산해
// 헤더에 꽂는다(§ AppHeader.tsx) — 이 화면은 헤더를 선언하지 않는다. 대문에서 "세션 탭으로 진입
// + 드로어 열기" 처럼 화면 전환과 함께 실어야 하는 초기 상태는 `initialTab`/`initialOpenSessionId`
// prop 으로 받는다(라우팅 파라미터가 없는 앱이라 app-shell 이 이 값을 기억했다가 넘겨준다).
// `<main id="main" tabIndex={-1}>` 는 §7.5a 대로 이 화면이 직접 렌더한다.
//
// 이탈(계약과 다른 점): 프로토타입 헤더의 "시연" 버튼은 `(isEditor && courtMode) || isLibrary` 로
// 목록 화면에서 항상 뜨지만, 목록 화면에는 "지금 무엇을 시연할지"를 가리키는 단일 대상이 없다
// (드릴 카드에는 애초에 시연 개념이 없고, 세션은 여러 개가 동시에 존재할 수 있다). 세션 탭의
// 행마다 있는 [시연] 44×44 버튼이 그 자리를 대신한다. 같은 이유로 헤더 주 액션도 세션 탭에서
// "새 세션"으로 바뀌지 않는다(app-shell 의 정적 헤더 계산은 탭 상태를 모른다) — 대신 세션 탭
// 본문에 자체 "새 세션" 진입점(빈 상태 CTA)을 둔다.
import { useEffect, useRef, useState } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { KNOWN_CATEGORIES } from '../../core/colors.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { deleteSession as repoDeleteSession, getSession } from '../../storage/sessionRepo.ts';
import type { SessionId } from '../../core/ids.ts';
import type { DrillSummary } from '../../model/summary.ts';
import { DrillCard } from './DrillCard.tsx';
import { SessionTab } from './SessionTab.tsx';
import { SessionDrawer } from './SessionDrawer.tsx';
import { ImportDialog } from './ImportDialog.tsx';
import type { HomeNav, LibraryTab } from '../home/nav.ts';
import { HomeDashboard } from '../home/HomeDashboard.tsx';
import { commitDrills, commitSession, exportAllDrills, exportOneDrill, exportOneSession, readImportFile } from './transfer.ts';
import type { ImportPreview } from './transfer.ts';
import type { ImportResolution } from '../../storage/transfer.ts';

const CATEGORY_OPTIONS = [{ value: '', label: '전체' }, ...KNOWN_CATEGORIES.map((c) => ({ value: c, label: c }))];

export interface LibraryScreenProps {
  nav: HomeNav;
  initialTab?: LibraryTab;
  initialOpenSessionId?: SessionId;
}

export function LibraryScreen({ nav, initialTab, initialOpenSessionId }: LibraryScreenProps) {
  const { drills, sessions, category, search, setCategory, duplicateDrill, deleteDrill, createSession, refresh } = useLibrary();
  const toast = useToast();

  const [tab, setTab] = useState<LibraryTab>(initialTab ?? 'drills');
  const [drawerSessionId, setDrawerSessionId] = useState<SessionId | null>(initialOpenSessionId ?? null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  // initialTab/initialOpenSessionId 는 화면이 다시 마운트될 때(예: 홈 → 목록 재진입)마다
  // app-shell 이 새 값을 내려줄 수 있다 — 첫 렌더 이후 값이 바뀌면 반영한다.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (initialOpenSessionId) setDrawerSessionId(initialOpenSessionId);
  }, [initialOpenSessionId]);

  const openDrill = (id: DrillSummary['id']) => nav.openDrill(id);
  const goNewDrill = () => nav.newDrill();
  const handleCreateSession = async () => {
    const s = await createSession({ title: '새 세션' });
    setDrawerSessionId(s.id);
  };
  const presentSession = (id: SessionId) => nav.presentSession(id);

  // ── 드릴 카드 액션 ──────────────────────────────────────────────────────────────────────
  const handleDuplicate = async (d: DrillSummary) => {
    const copy = await duplicateDrill(d.id);
    toast.show(`"${d.title}" 을(를) 복제했습니다.`, {
      action: { label: '열기', onAction: () => openDrill(copy.id) },
    });
  };
  const handleDelete = async (d: DrillSummary) => {
    const { repo } = await resolveDrillRepo();
    const full = await repo.getDrill(d.id); // 되돌리기용 원본 보관(§6.10 삭제 토스트 원칙을 목록에도 적용)
    await deleteDrill(d.id);
    toast.show(`"${d.title}" 을(를) 삭제했습니다.`, {
      action: full
        ? {
            label: '되돌리기',
            onAction: async () => {
              const { repo: r2 } = await resolveDrillRepo();
              await r2.putDrill(full, { touch: false });
              await refresh();
            },
          }
        : undefined,
    });
  };
  const handleExport = async (d: DrillSummary) => {
    await exportOneDrill(d.id);
    toast.show(`"${d.title}" 을(를) 내보냈습니다.`);
  };

  // ── 세션 액션 ───────────────────────────────────────────────────────────────────────────
  const handleDeleteSession = async (id: SessionId) => {
    await repoDeleteSession(id);
    await refresh();
    toast.show('세션을 삭제했습니다.');
  };
  const handleExportSession = async (id: SessionId) => {
    const resolved = await getSession(id);
    if (!resolved) return;
    await exportOneSession(resolved.session);
    toast.show(`"${resolved.session.title}" 을(를) 내보냈습니다.`);
  };

  // ── 가져오기 ────────────────────────────────────────────────────────────────────────────
  const commitPreview = async (preview: Exclude<ImportPreview, { kind: 'unsupported' }>, resolutions: Map<number, ImportResolution>) => {
    const outcome = await commitDrills(preview.drills, resolutions);
    if (preview.kind === 'session') await commitSession(preview.session.doc, outcome);
    await refresh();
    const parts = [`${outcome.written.length}개 가져옴`];
    if (outcome.skipped.length) parts.push(`${outcome.skipped.length}개 건너뜀`);
    if (outcome.failed.length) parts.push(`${outcome.failed.length}개 실패`);
    toast.show(parts.join(' · '));
    setImportPreview(null);
  };

  const handleFile = async (file: File) => {
    try {
      const preview = await readImportFile(file);
      if (preview.kind === 'unsupported') {
        toast.show(preview.reason);
        return;
      }
      const hasConflict = preview.drills.some((d) => d.conflict === 'exists');
      if (hasConflict) {
        setImportPreview(preview);
        return;
      }
      await commitPreview(preview, new Map());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '가져오기에 실패했습니다.');
    }
  };

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '22px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* 2026-08-09 재편: 대문이 자유 전술판이 되면서 훈련 현황 대시보드가 여기로 왔다. */}
        <HomeDashboard nav={nav} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div role="tablist" aria-label="라이브러리" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid var(--border)', borderRadius: 10 }}>
            <TabButton active={tab === 'drills'} onClick={() => setTab('drills')} controls="library-panel-drills">
              드릴
            </TabButton>
            <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')} controls="library-panel-sessions">
              세션
            </TabButton>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) await handleFile(f);
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              가져오기
            </Button>
            {tab === 'drills' && drills.length > 0 && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await exportAllDrills(drills.map((d) => d.id));
                  toast.show('전체 드릴을 내보냈습니다.');
                }}
              >
                전체 내보내기
              </Button>
            )}
          </div>
        </div>

        {tab === 'drills' ? (
          <div id="library-panel-drills" role="tabpanel">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <Segmented ariaLabel="카테고리" value={category ?? ''} onChange={(v) => setCategory(v || null)} options={CATEGORY_OPTIONS} dense />
            </div>
            {drills.length === 0 ? (
              <EmptyDrills hasFilter={!!category || !!search} onCreate={goNewDrill} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 18 }}>
                {drills.map((d) => (
                  <DrillCard
                    key={d.id}
                    drill={d}
                    onOpen={() => openDrill(d.id)}
                    onDuplicate={() => void handleDuplicate(d)}
                    onDelete={() => void handleDelete(d)}
                    onExport={() => void handleExport(d)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div id="library-panel-sessions" role="tabpanel">
            <SessionTab
              sessions={sessions}
              onOpen={(id) => {
                // §7.6 "세션 드로어 닫기 → 트리거로 포커스 복귀" — 클릭 시점의 포커스(방금 누른
                // 행 버튼)를 트리거로 기록해 둔다. `initialOpenSessionId` 로 열린 자동 오픈은
                // activeElement 가 body 라 Drawer 의 openedByRef 폴백이 대신 처리한다.
                drawerTriggerRef.current = document.activeElement as HTMLElement | null;
                setDrawerSessionId(id);
              }}
              onPresent={presentSession}
              onDelete={(id) => void handleDeleteSession(id)}
              onExport={(id) => void handleExportSession(id)}
              onCreate={() => void handleCreateSession()}
            />
          </div>
        )}
      </div>

      <SessionDrawer
        sessionId={drawerSessionId}
        open={drawerSessionId !== null}
        onClose={() => setDrawerSessionId(null)}
        returnFocusRef={drawerTriggerRef}
        onPresent={presentSession}
      />

      {importPreview && importPreview.kind !== 'unsupported' && (
        <ImportDialog
          open
          drills={importPreview.drills}
          onCancel={() => setImportPreview(null)}
          onConfirm={(resolutions) => void commitPreview(importPreview, resolutions)}
        />
      )}
    </main>
  );
}

function TabButton({ active, onClick, children, controls }: { active: boolean; onClick(): void; children: string; controls: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '8px 18px',
        borderRadius: 7,
        fontSize: '0.8125rem',
        fontWeight: active ? 700 : 500,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent-ink-strong)' : 'var(--muted)',
      }}
      className={active ? 'on-accent' : undefined}
    >
      {children}
    </button>
  );
}

function EmptyDrills({ hasFilter, onCreate }: { hasFilter: boolean; onCreate(): void }) {
  return (
    <div
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 16,
        padding: '56px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)' }}>
        {hasFilter ? '조건에 맞는 드릴이 없습니다.' : '아직 만든 드릴이 없습니다. 첫 드릴을 만들어 보세요.'}
      </p>
      {!hasFilter && (
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={onCreate}>
          새 드릴 만들기
        </Button>
      )}
    </div>
  );
}
