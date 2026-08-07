// §6.8/§6.10 편집기 화면 진입점. `useEditorTarget()`(app-shell 계약 밖 확장, AppShell.tsx 헤더
// 주석 참고)로 "새 드릴이면 코트부터 고른다"/"기존 드릴이면 불러온다"를 가른다.
//
// 이탈(다른 모듈에 필요한 것 — 보고에도 남긴다): §6.8 은 편집기 헤더에 "(editor && courtMode)"
// 조건으로 시연 버튼을 요구하지만, app-shell(AppShell.tsx)이 내려주는 통로는
// `useEditorTarget()`/`usePresentTarget()` **읽기 전용** getter 뿐이다 — editor 화면이 자기
// drillId 로 PresentTargetContext 값을 채울 setter 가 없다(home/library 는 `HomeNav.presentDrill`
// 를 받지만 그 prop 은 editor 화면에는 내려오지 않는다). 현재는 `nav.go('present')` 만 호출해
// 화면은 전환되지만 PresentScreen 이 `usePresentTarget() === null` 로 빈 상태를 그린다 —
// app-shell 쪽에 `useSetPresentTarget()` 같은 통로 추가를 요청한다(§8 파일 소유권상 이 파일은
// src/app/AppShell.tsx 를 고칠 수 없다).
import { useEffect, useMemo, useState } from 'react';
import type { Drill } from '../../model/drill.ts';
import type { CourtMode } from '../../model/court.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { useEditorTarget } from '../../app/AppShell.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { EditorProvider } from '../../store/editor/EditorProvider.tsx';
import { PlaybackProvider } from '../../store/playback/PlaybackProvider.tsx';
import { CourtPicker } from './CourtPicker.tsx';
import { EditorWorkspace } from './EditorWorkspace.tsx';

type LoadState = { status: 'loading' } | { status: 'picking' } | { status: 'ready'; drill: Drill } | { status: 'error'; message: string };

export function EditorScreen() {
  const target = useEditorTarget();
  const nav = useAppNav();
  const { prefs } = useSettingsState();
  const toast = useToast();
  const [state, setState] = useState<LoadState>(target.kind === 'new' ? { status: 'picking' } : { status: 'loading' });

  useEffect(() => {
    if (target.kind !== 'existing') return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      const { repo } = await resolveDrillRepo();
      repo.markOpen(target.drillId, true);
      const res = await repo.loadDrill(target.drillId);
      if (cancelled) return;
      if (res.status === 'ok') {
        if (res.repairs.length > 0) toast.show('일부 데이터를 자동으로 보정했습니다.');
        setState({ status: 'ready', drill: res.drill });
      } else if (res.status === 'missing') {
        setState({ status: 'error', message: '드릴을 찾을 수 없습니다. 삭제되었을 수 있습니다.' });
      } else if (res.status === 'too-new') {
        setState({ status: 'error', message: '이 드릴은 더 최신 버전의 앱에서 만들어졌습니다.' });
      } else {
        setState({ status: 'error', message: '드릴 파일이 손상되어 열 수 없습니다.' });
      }
    })();
    return () => {
      cancelled = true;
      void resolveDrillRepo().then(({ repo }) => repo.markOpen(target.drillId, false));
    };
  }, [target, toast]);

  const handlePick = async (mode: CourtMode) => {
    const { repo } = await resolveDrillRepo();
    const created = await repo.createDrill({ courtMode: mode, formation: prefs.defaultFormation, teams: prefs.teams });
    repo.markOpen(created.id, true);
    setState({ status: 'ready', drill: created });
  };

  const providerKey = useMemo(() => (state.status === 'ready' ? state.drill.id : null), [state]);

  if (state.status === 'picking') return <CourtPicker onPick={(mode) => void handlePick(mode)} />;

  if (state.status === 'loading') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint-text)', outline: 'none' }}>
        불러오는 중…
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, outline: 'none' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)' }}>{state.message}</p>
        <button
          type="button"
          onClick={() => nav.back('library')}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          목록으로
        </button>
      </main>
    );
  }

  return (
    <EditorProvider key={providerKey} drill={state.drill}>
      <PlaybackProvider>
        <EditorWorkspace />
      </PlaybackProvider>
    </EditorProvider>
  );
}
