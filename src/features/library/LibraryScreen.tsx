// §6.11: 목록 화면 = 드릴 그리드(부록A 마크업 이식).
// C5(2026-08-18 구조 개편) — **세션 탭이 1급 화면으로 승격해 나갔다**(features/sessions/
// SessionsScreen.tsx, 질문 20문 ①). 이 화면은 이제 드릴 전용이고 탭 UI 도 은퇴했다.
//
// 내비게이션·헤더: §8 "screen-home-library 의존은 store, render-court, ui-kit, model, storage
// 뿐" — app-shell 을 import 하지 않는다. **이동은 통로가 하나다**: 화면 전환도 탭 전환도 전부
// `HomeNav` prop 으로만 나간다(계획서 2.8). `useAppNav()` 를 여기서 직접 부르면 같은 이동이 두
// 경로로 일어나 히스토리가 어긋난다 — 탭은 로컬 state 로만 바뀌고 주소만 따로 쌓이거나, 반대로
// 두 번 쌓인다. 그 계약은 `features/home/nav.test.ts` 가 소스 정적 검사로 못박는다. 화면 전환은
// app-shell 이 내려주는 `HomeNav` prop 으로, 검색창·주 액션 라벨은 app-shell 이 정적으로 계산해
// 헤더에 꽂는다(§ AppHeader.tsx) — 이 화면은 헤더를 선언하지 않는다. 대문에서 "세션 탭으로 진입
// + 드로어 열기" 처럼 화면 전환과 함께 실어야 하는 초기 상태는 `initialTab`/`initialOpenSessionId`
// prop 으로 받는다(라우팅 파라미터가 없는 앱이라 app-shell 이 이 값을 기억했다가 넘겨준다).
// `<main id="main" tabIndex={-1}>` 는 §7.5a 대로 이 화면이 직접 렌더한다.
//
// 이탈(계약과 다른 점): 프로토타입 헤더의 "시연" 버튼은 `(isEditor && courtMode) || isLibrary` 로
// 목록 화면에서 항상 뜨지만, **화면 단위**로는 "지금 무엇을 시연할지"를 가리키는 단일 대상이
// 없어서(드릴도 세션도 여러 개가 동시에 보인다) 헤더 전역 [시연] 은 두지 않는다. 대신 시연은
// **행/카드 단위**다 — 세션 행의 [시연] 44×44 에 더해, 2026-08-12 판 걸이(로드맵 2.7)로 드릴
// 카드에도 상시 노출 [시연] 이 생겨 단일 드릴 시연이 1클릭이 됐다(nav.presentDrill 직행).
// 옛 주석의 "드릴 카드에는 애초에 시연 개념이 없다" 는 문장은 이 시점부터 무효다. 같은 이유로
// 헤더 주 액션도 세션 탭에서 "새 세션"으로 바뀌지 않는다(app-shell 의 정적 헤더 계산은 탭
// 상태를 모른다) — 대신 세션 탭 본문에 자체 "새 세션" 진입점(빈 상태 CTA)을 둔다.
import { useRef, useState } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { DRILL_TYPES, DRILL_TYPE_LABELS, DRILL_SITUATIONS, SITUATION_LABELS } from '../../model/drill.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { DRILL_LEVELS } from '../../model/drill.ts';
import type { DrillSummary } from '../../model/summary.ts';
import { DrillCard, DrillRow } from './DrillCard.tsx';
import { ImportDialog } from './ImportDialog.tsx';
import type { HomeNav } from '../home/nav.ts';
import { buildImportReport, commitDrills, commitSession, exportOneDrill, importReportLine, readImportFile } from './transfer.ts';
import type { ImportPreview } from './transfer.ts';
import type { ImportResolution } from '../../storage/transfer.ts';

const TYPE_OPTIONS = [{ value: '', label: '전체' }, ...DRILL_TYPES.map((t) => ({ value: t, label: DRILL_TYPE_LABELS[t] }))];

export interface LibraryScreenProps {
  nav: HomeNav;
}

export function LibraryScreen({ nav }: LibraryScreenProps) {
  const { drills, drillType, situation, sort, view, search, setDrillType, setSituation, setSort, setView, duplicateDrill, deleteDrill, refresh } = useLibrary();
  const toast = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const openDrill = (id: DrillSummary['id']) => nav.openDrill(id);
  const goNewDrill = () => nav.newDrill();
  // 판 걸이(2.7): 카드 [시연] 1클릭 → app-shell 어댑터가 presentTarget 을 세우고 시연으로 간다.
  const presentDrill = (id: DrillSummary['id']) => nav.presentDrill(id);

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

  // ── 가져오기 ────────────────────────────────────────────────────────────────────────────
  const commitPreview = async (preview: Exclude<ImportPreview, { kind: 'unsupported' }>, resolutions: Map<number, ImportResolution>) => {
    const outcome = await commitDrills(preview.drills, resolutions);
    if (preview.kind === 'session') await commitSession(preview.session.doc, outcome);
    await refresh();
    // §6.1c/로드맵 4.2 — 보고는 이 토스트 한 줄이 전부다(컨트롤 예산 §3: 보고용 버튼·다이얼로그
    // 항목을 더하지 않는다. 토스트는 자동으로 사라지므로 예산 밖이다). ⚠️ outcome 만 세면 안 된다:
    // 검증에서 탈락한 손상 항목은 후보조차 못 돼 outcome 어디에도 없다 — drillsInFile 과의 차로
    // 만 드러난다(buildImportReport 참고).
    toast.show(importReportLine(buildImportReport(preview.drillsInFile, outcome)));
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
        {/* 2026-08-12(계획서 2.8): 여기 얹혀 있던 HomeDashboard 를 **지웠다**. 히어로·통계 4칸이
            목록 맨 위 한 화면을 통째로 먹어 정작 드릴 그리드가 늘 접힘 아래에 있었다. 살아남은
            것은 '다음 세션' 스트립 하나뿐이고, 그건 SessionTab 머리로 옮겼다. */}
        {/* C5 — 탭(드릴/세션)이 있던 자리. 세션이 레일의 1급 화면으로 나가면서 이 행에는
            유형 필터와 가져오기만 남았다. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Segmented ariaLabel="드릴 유형" value={drillType ?? ''} onChange={(v) => setDrillType(v || null)} options={TYPE_OPTIONS} dense />
            {/* C10 — 경기 상황 필터(v8 두 번째 축)와 정렬. 정렬은 저장소(DrillQuery.sort)에
                이미 있던 것을 UI 로 노출만 했다. */}
            <select aria-label="경기 상황 필터" value={situation ?? ''} onChange={(e) => setSituation(e.target.value || null)} style={selectStyle}>
              <option value="">모든 상황</option>
              {DRILL_SITUATIONS.map((s) => (
                <option key={s} value={s}>
                  {SITUATION_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'updatedAt' | 'createdAt' | 'title')}
              style={selectStyle}
            >
              <option value="updatedAt">최근 수정순</option>
              <option value="createdAt">만든 순</option>
              <option value="title">이름순</option>
            </select>
            {/* C11 — 보기 모드(카드/목록). 2026-08-19 기현님 지시. */}
            <Segmented
              ariaLabel="보기 모드"
              value={view}
              onChange={(v) => setView(v as 'cards' | 'list')}
              options={[
                { value: 'cards', label: '카드' },
                { value: 'list', label: '목록' },
              ]}
              dense
            />
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
            {/* §6.1b — 2026-08-12(4.7) 에 [전체 내보내기]가 여기서 사라졌다. 설정 화면에도 **같은
                버튼**이 있던 중복이었고(계획서 §6.1b "둘 다 제거"), 담기는 것이 드릴뿐이라
                세션·설정·자유 전술판이 어떤 파일에도 안 들어갔다 — 백업했다고 믿게 만드는
                거짓말이었다. 통째로 담는 파일은 [보드] 하단 [내보내기] → [기기 이사 파일] 하나뿐이고,
                여기 카드마다 있는 [파일로 내보내기](드릴 1개)는 공유용으로 그대로 남는다. */}
          </div>
        </div>

        <div>
            {drills.length === 0 ? (
              <EmptyDrills hasFilter={!!drillType || !!situation || !!search} onCreate={goNewDrill} />
            ) : (
              // 판 걸이(계획서 2.2)로 들어와 로드맵 3.6 으로 확정: 난이도 그룹 헤더(초급 → 중급
              // → 고급)로 **정렬**한다 — 난이도 필터를 하나 더 얹는 대신 0클릭으로 나눠 보여준다
              // (빈 그룹은 헤더도 없다). 그룹 안 순서는 store 가 주는 순서(수정 최신순) 그대로다.
              // 성능 계약(3.6 완료 판정): 비교 대상은 **요약(DrillSummary.level)뿐**이다 — 본문을
              // 열지 않고, SUMMARY_BUILD 를 올리지 않고, 호출자 0 인 rebuildAllSummaries 를 신설
              // 하지 않는다. 요약은 putDrill 이 본문과 같은 트랜잭션에서 다시 쓰므로 전역 재구축
              // 없이도 낡지 않는다(validateDrill 이 level 을 DRILL_LEVELS 로 보정해 저장하므로 세
              // 그룹 어디에도 안 걸리는 요약은 존재하지 않는다 — 카드가 조용히 증발할 구멍 없음).
              DRILL_LEVELS.map((level) => {
                const group = drills.filter((d) => d.level === level);
                if (group.length === 0) return null;
                return (
                  <section key={level} aria-label={`${level} 드릴`} style={{ marginBottom: 28 }}>
                    <h2
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        letterSpacing: 0.3,
                        marginBottom: 12,
                      }}
                    >
                      {level}
                    </h2>
                    <div
                      style={
                        view === 'cards'
                          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 18 }
                          : { display: 'flex', flexDirection: 'column', gap: 8 }
                      }
                    >
                      {group.map((d) => {
                        const Item = view === 'cards' ? DrillCard : DrillRow;
                        return (
                          <Item
                            key={d.id}
                            drill={d}
                            onOpen={() => openDrill(d.id)}
                            onPresent={() => presentDrill(d.id)}
                            onDuplicate={() => void handleDuplicate(d)}
                            onDelete={() => void handleDelete(d)}
                            onExport={() => void handleExport(d)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
        </div>
      </div>

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

const selectStyle = {
  minHeight: 44,
  padding: '0 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
} as const;

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
