// C11(2026-08-19 기현님) — 시연 화면의 **드릴 정보 모달(읽기 전용)**. 편집 화면의
// DrillMetaSheet 와 같은 항목을 보여주되 입력이 없다: 시연은 읽기 전용 화면이고(§6.9),
// 여기서 고치게 하면 자동저장·되돌리기 궤도 밖의 두 번째 쓰기 경로가 생긴다.
// 겉은 CenterModal(헤더 고정 — 닫기 항상 보임)로 편집 쪽과 같다.
import { CenterModal } from '../../ui/CenterModal.tsx';
import { DRILL_TYPE_LABELS, SITUATION_LABELS } from '../../model/drill.ts';
import type { Drill } from '../../model/drill.ts';

export interface DrillInfoModalProps {
  drill: Drill;
  open: boolean;
  onClose(): void;
}

export function DrillInfoModal({ drill, open, onClose }: DrillInfoModalProps) {
  return (
    <CenterModal open={open} onClose={onClose} title={`드릴 정보 — ${drill.title}`}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '10px 16px', margin: 0, fontSize: '0.875rem' }}>
        <Item label="유형">{DRILL_TYPE_LABELS[drill.drillType] ?? '—'}</Item>
        {drill.situation && <Item label="경기 상황">{SITUATION_LABELS[drill.situation]}</Item>}
        <Item label="난이도">{drill.level}</Item>
        <Item label="소요 시간">{drill.durationMin}분</Item>
        {drill.tags.length > 0 && <Item label="태그">{drill.tags.join(' · ')}</Item>}
        {drill.objective && <Item label="목적">{drill.objective}</Item>}
        {drill.description && (
          <Item label="진행 방법">
            <span style={{ whiteSpace: 'pre-line' }}>{drill.description}</span>
          </Item>
        )}
        {drill.variation && <Item label="변형">{drill.variation}</Item>}
        {drill.coachingPoints && drill.coachingPoints.length > 0 && (
          <Item label="코칭 포인트">
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {drill.coachingPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </Item>
        )}
        {(drill.playersNeeded ?? 0) > 0 && <Item label="필요 인원">{drill.playersNeeded}명</Item>}
        {drill.equipment && <Item label="필요 장비">{drill.equipment}</Item>}
      </dl>
    </CenterModal>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ fontWeight: 700, color: 'var(--muted)', fontSize: '0.75rem', paddingTop: 2 }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--text)', lineHeight: 1.55 }}>{children}</dd>
    </>
  );
}
