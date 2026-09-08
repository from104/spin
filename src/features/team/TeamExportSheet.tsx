// 팀을 **밖으로 내는 두 길**(파일·종이) 앞의 확인 시트 (PLAN-TEAM 결정 13·18). 체크박스 하나
// — **[등급 정보 제외]**.
//
// ── ⚠️ 2026-09-09: 파일 전용이던 이 시트가 인쇄와 공용이 됐다(`mode`) ──────────────────
// 결정 18 은 «인쇄 대화상자 전에 [등급 정보 제외] 토글» 인데, 첫 배송에서 인쇄 경로만 그 시트
// 없이 곧장 종이로 갔다 — 도움말 세 벌이 «내보내기와 인쇄에는 [등급 정보 제외]가 있습니다» 라
// 약속하는데 코드는 안 물었다(검수 2026-09-09). 체크박스를 한 벌 더 만들지 않고 이 시트를
// `mode` 로 재사용한다: 같은 뜻의 토글이 두 컴포넌트로 갈리면 한쪽만 고쳐지는 날이 온다.
//
// 왜 시트를 한 겹 두는가: 등급(PF1/PF2)은 분류 심사 결과라 민감할 수 있는데, 파일은 한 번
// 나가면 회수할 수 없다. 설정의 [복원] 이 체크박스 하나짜리 모달을 세우는 것과 같은 판단이다
// (되돌릴 수 없는 일 앞에서는 한 번 묻는다). 기본값은 **꺼짐** — 대부분의 내보내기는 자기
// 기기 백업이고, 등급이 빠진 파일은 되가져올 때 정보가 준 채로 돌아온다.
//
// ⚠️ 이 시트에 **[링크로 공유] 를 만들지 않는다**(결정 12). 세션 내보내기 옆에는 링크 항목이
//    있으므로 이 파일이 그 자리를 흉내 내기 쉽다 — 팀은 파일과 내 드라이브 동기화로만 나간다.
//    그 사실을 사용자에게도 한 줄로 알린다(아래 noLinkNote).
//
// 실제 파일 쓰기는 여기서 하지 않는다 — `onConfirm(stripClass)` 로 올려보내고 화면(TeamScreen·
// TeamDetail)이 `features/team/transfer.ts` 의 `exportOneTeam` 을 부른다. 이 컴포넌트가 저장소를
// 모르면 테스트가 파일 시스템 없이 체크박스 계약만 잴 수 있다.
import { useEffect, useId, useState } from 'react';
import type { RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { useT } from '../../i18n/useT.ts';

/** 어느 길로 나가는가. 문구만 갈린다 — 체크박스의 뜻도, `onConfirm(stripClass)` 계약도 같다. */
export type TeamExportSheetMode = 'export' | 'print';

export interface TeamExportSheetProps {
  open: boolean;
  teamName: string;
  /** 생략하면 'export' — 옛 호출부는 그대로 산다. */
  mode?: TeamExportSheetMode;
  onCancel(): void;
  onConfirm(stripClass: boolean): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function TeamExportSheet({ open, teamName, mode = 'export', onCancel, onConfirm, returnFocusRef }: TeamExportSheetProps) {
  const t = useT();
  const titleId = useId();
  const bodyId = useId();
  const [stripClass, setStripClass] = useState(false);
  const print = mode === 'print';

  // ⚠️ **열 때마다 기본값(꺼짐)으로 되돌린다**(결정 13). 이 컴포넌트는 화면에 항상 마운트돼
  // 있고 `open` 만 껐다 켜지므로(TeamScreen 머리말의 그 이유), 되돌리지 않으면 팀 A 를 «등급
  // 제외» 로 내보낸 체크가 팀 B 의 시트에 그대로 켜진 채 뜬다 — 기본값 계약이 두 번째 팀부터
  // 깨진다. 유출 방향은 아니지만 «기본은 꺼짐» 이 참말이 아니게 되는 것은 같다.
  useEffect(() => {
    if (open) setStripClass(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      titleId={titleId}
      descriptionId={bodyId}
      title={print ? t('team.print.sheetTitle') : t('team.export.title')}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      <div id={bodyId} style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>{print ? t('team.print.sheetBody', { name: teamName }) : t('team.export.body', { name: teamName })}</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, minHeight: 'var(--hit)', color: 'var(--text)' }}>
          <input type="checkbox" checked={stripClass} onChange={(e) => setStripClass(e.target.checked)} style={{ width: 18, height: 18 }} />
          {t('team.export.stripClass')}
        </label>
        <p style={{ margin: '0 0 0 26px', fontSize: '0.75rem', color: 'var(--faint-text)' }}>
          {print ? t('team.print.sheetStripClassHint') : t('team.export.stripClassHint')}
        </p>
        {/* 링크 없음 안내는 **파일 쪽에만** 붙인다 — 종이는 애초에 링크와 견줄 물건이 아니다. */}
        {!print && <p style={{ marginTop: 14, fontSize: '0.75rem', color: 'var(--faint-text)' }}>{t('team.export.noLinkNote')}</p>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="secondary" onClick={onCancel}>
          {t('team.export.cancel')}
        </Button>
        <Button variant="primary" onClick={() => onConfirm(stripClass)}>
          {print ? t('team.print.sheetConfirm') : t('team.export.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
