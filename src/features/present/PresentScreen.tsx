// §6.9 시연 모드 — app-shell 이 마운트하는 얇은 래퍼. `usePresentTarget()`/`useAppNav()` 훅
// 배선만 하고, 실제 로직은 `PresentRunner.tsx` 에 있다(그 파일 헤더 주석 참고 — 여기서만
// `../../app/AppShell.tsx` 를 값으로 import 한다).
import { useAppNav } from '../../app/useAppHistory.ts';
import { usePresentTarget } from '../../app/AppShell.tsx';
import { PresentRunner } from './PresentRunner.tsx';

export function PresentScreen() {
  const target = usePresentTarget();
  const nav = useAppNav();
  return <PresentRunner target={target} nav={nav} />;
}
