// §7.5f "Shift+? 도움말 오버레이(role=dialog, 포커스 트랩, Esc)" — ui-kit 의 Modal 을 그대로 쓴다.
import { Fragment } from 'react';
import type { RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';

export interface HelpModalProps {
  open: boolean;
  onClose(): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['1–8 / V R P B C A T E', '도구 선택'],
  ['Ctrl/⌘+Z, Shift+Z', '실행 취소 / 다시 실행(Ctrl+Y)'],
  ['Ctrl/⌘+S', '저장'],
  ['Ctrl/⌘+D', '현재 스텝 복제'],
  ['← →', '이전/다음 스텝(개체 미선택 시)'],
  ['Space', '재생 / 일시정지'],
  ['G / Z', '격자 / 골 지역 가이드 토글'],
  ['Ctrl/⌘ +, −, 0', '스테이지 줌 인 / 아웃 / 초기화'],
  ['방향키(개체 포커스)', '2.5px 이동, Shift = 25px'],
  ['[ / ]', '휠체어 5° 회전, Shift = 15°'],
  ['방향키(화살표)', '화살표 전체를 2.5px 이동'],
  ['Shift+방향키(화살표)', '조준점만 2.5px 이동(기본 = 끝점)'],
  ['[ / ] (화살표)', '조준점 전환 — 끝점 · 시작점 · 굽힘점'],
  ['Alt+Delete', '선택 삭제(파괴적 동작은 항상 수식키 필요)'],
  ['Alt+←/→', '개체 순회'],
  ['Esc', '코트로 포커스 복귀'],
];

export function HelpModal({ open, onClose, returnFocusRef }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} titleId="editor-help-title" title="키보드 단축키" returnFocusRef={returnFocusRef}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, fontSize: '0.8125rem' }}>
        {SHORTCUTS.map(([key, desc]) => (
          <Fragment key={key}>
            <dt style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{key}</dt>
            <dd style={{ color: 'var(--muted)' }}>{desc}</dd>
          </Fragment>
        ))}
      </dl>
    </Modal>
  );
}
