// §6.8 드릴 편집 — 대문(home) 자리에 자유 전술판 대신 뜨는 쪽. 무엇을 열지는
// `useStageTarget()`(app-shell 계약 밖 확장, AppShell.tsx 헤더 주석 참고)이 정한다.
//
// 2026-08-09 재편 전에는 이 화면이 "새 드릴이면 코트부터 고른다"(CourtPicker)도 겸했다. 지금은
// 새 드릴이 전술판에서 그린 뒤 [드릴로 저장] 으로 태어나므로 그 분기가 없다 — 이 화면은
// **이미 있는 드릴을 여는 일**만 한다. `prefs.defaultCourtMode` 는 전술판의 시작 코트로
// 옮겨갔다(BoardScreen.makeBoardDrill).
//
// 이탈(그대로 남아 있음): §6.8 은 편집기 헤더의 시연 버튼을 요구하지만 app-shell 이 내려주는
// 통로는 읽기 전용 getter 뿐이라, `nav.go('present')` 만 호출하면 PresentScreen 이
// `usePresentTarget() === null` 로 빈 상태를 그린다. app-shell 쪽에 setter 추가가 필요하다.
import { useEffect, useMemo, useState } from 'react';
import type { Drill } from '../../model/drill.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { useStageTarget } from '../../app/AppShell.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { EditorProvider } from '../../store/editor/EditorProvider.tsx';
import { PlaybackProvider } from '../../store/playback/PlaybackProvider.tsx';
import { EditorWorkspace } from './EditorWorkspace.tsx';

type LoadState = { status: 'loading' } | { status: 'ready'; drill: Drill } | { status: 'error'; message: string };

export function EditorScreen() {
  const target = useStageTarget();
  const nav = useAppNav();
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (target.kind !== 'drill') return;
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

  const providerKey = useMemo(() => (state.status === 'ready' ? state.drill.id : null), [state]);

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
        <EditorWorkspace mode="drill" />
      </PlaybackProvider>
    </EditorProvider>
  );
}
