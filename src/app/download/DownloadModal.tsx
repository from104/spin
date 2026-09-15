// 데스크톱 앱 받기 — 안내 한 단락과 단추 하나 (2026-09-16 기현 지시:
// *"모달로 간단한 안내와 다운로드 링크 버튼. 그거 누르면 모달 닫히고 다운 시작"*).
//
// **간단한 안내**가 무엇인지는 지시가 정했다. 그래서 여기 안 담는 것들이 계약이다:
//  - 플랫폼 고르는 칸 0개. 기계가 이미 안다(`currentDesktopPlatform`). 고르라고 물으면
//    «내 컴퓨터가 뭐였더라» 를 코치에게 떠넘기는 것이다.
//  - 설치 방법 설명 0줄. 그건 받은 뒤의 일이고, 여기서 읽히면 받기 전에 지친다.
//    ⚠️ 예외 하나만 둔다 — **서명이 없어 경고가 뜬다**는 것. 그것만은 누르기 **전에** 알아야
//    한다. 모르고 받으면 "바이러스" 경고를 보고 지우고 다시 안 온다.
//
// ⚠️ 닫고 나서 받는다(지시 그대로). 순서를 뒤집으면 — 받기를 먼저 걸면 — 브라우저가 내려받기
// 표시줄을 띄우는 동안 모달이 남아 화면을 덮는다.
import { useRef } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { useT } from '../../i18n/useT.ts';
import { desktopAsset, releasePageUrl, type DesktopPlatform } from './desktopDownload.ts';

export interface DownloadModalProps {
  open: boolean;
  onClose(): void;
  platform: DesktopPlatform;
  version: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const TITLE_ID = 'desktop-download-title';
const BODY_ID = 'desktop-download-body';

const PLATFORM_NAME: Record<DesktopPlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

export function DownloadModal({ open, onClose, platform, version, returnFocusRef }: DownloadModalProps) {
  const t = useT();
  const asset = desktopAsset(platform, version);
  const startRef = useRef<HTMLAnchorElement | null>(null);

  // 닫고 → 받는다. `onClose()` 가 먼저이므로 React 가 모달을 걷는 커밋을 먼저 잡고, 그다음
  // 프레임에 내려받기가 시작된다. 앵커의 기본 동작(이동)을 막지 않는 것이 요점이다 —
  // 깃허브가 `Content-Disposition: attachment` 를 주므로 페이지가 바뀌지 않고 파일만 떨어진다.
  const startDownload = (): void => onClose();

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={TITLE_ID}
      title={t('download.title')}
      descriptionId={BODY_ID}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
      initialFocusRef={startRef}
    >
      <p id={BODY_ID} style={{ margin: 0, color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.7 }}>
        {t('download.body', { platform: PLATFORM_NAME[platform] })}
      </p>
      <p style={{ margin: '0.75rem 0 0', color: 'var(--muted)', fontSize: '0.8125rem', lineHeight: 1.7 }}>
        {t('download.unsigned')}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {/* 파일 이름을 보여 준다 — 무엇이 떨어지는지 누르기 전에 알리려는 것이다. */}
        <span style={{ flex: 1, minWidth: 0, color: 'var(--muted)', fontSize: '0.75rem', overflowWrap: 'anywhere' }}>
          {asset.fileName}
        </span>
        {/* 릴리스 페이지 — 다른 형식(deb·rpm·exe·snap)이 필요하거나, 이 판에 데스크톱
            릴리스가 없어 위 링크가 404 일 때의 도피처다. 그쪽은 항상 산다. */}
        <a
          href={releasePageUrl(version)}
          target="_blank"
          rel="noreferrer"
          style={{ minHeight: 'var(--hit)', display: 'flex', alignItems: 'center', padding: '0 0.75rem', color: 'var(--muted)', fontSize: '0.8125rem' }}
        >
          {t('download.allFiles')}
        </a>
        <a
          ref={startRef}
          href={asset.url}
          download={asset.fileName}
          onClick={startDownload}
          style={{
            minHeight: 'var(--hit)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1rem',
            borderRadius: 8,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            fontSize: '0.875rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {t('download.start')}
        </a>
      </div>
    </Modal>
  );
}
