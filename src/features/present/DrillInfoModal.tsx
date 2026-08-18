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

/** 빈 값 표기. 줄을 숨기는 대신 자리를 지킨다(아래 컴포넌트 주석 참고). */
const EMPTY = <span style={{ color: 'var(--faint-text)' }}>—</span>;

export function DrillInfoModal({ drill, open, onClose }: DrillInfoModalProps) {
  return (
    <CenterModal open={open} onClose={onClose} title={`드릴 정보 — ${drill.title}`}>
      {/* 2026-08-19 기현님 2차 — **전 항목을 항상 보여준다**(빈 필드는 — 로). 처음에는 빈
          줄을 숨겼는데, 그러면 "이 드릴엔 장비 항목이 원래 없나, 안 적었나" 를 시연 중에
          가릴 수 없다. 편집 시트와 같은 항목 목록·같은 순서 — 입력만 없다(읽기 전용). */}
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '10px 16px', margin: 0, fontSize: '0.875rem' }}>
        <Item label="유형">{DRILL_TYPE_LABELS[drill.drillType] ?? '—'}</Item>
        <Item label="경기 상황">{drill.situation ? SITUATION_LABELS[drill.situation] : <span style={{ color: 'var(--faint-text)' }}>미지정</span>}</Item>
        <Item label="난이도">{drill.level}</Item>
        <Item label="소요 시간">{drill.durationMin}분</Item>
        <Item label="태그">{drill.tags.length > 0 ? drill.tags.join(' · ') : EMPTY}</Item>
        <Item label="목적">{drill.objective ? drill.objective : EMPTY}</Item>
        <Item label="진행 방법">{drill.description ? <span style={{ whiteSpace: 'pre-line' }}>{drill.description}</span> : EMPTY}</Item>
        <Item label="변형">{drill.variation ? drill.variation : EMPTY}</Item>
        <Item label="코칭 포인트">
          {drill.coachingPoints && drill.coachingPoints.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {drill.coachingPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            EMPTY
          )}
        </Item>
        <Item label="필요 인원">{(drill.playersNeeded ?? 0) > 0 ? `${drill.playersNeeded}명` : <span style={{ color: 'var(--faint-text)' }}>미지정</span>}</Item>
        <Item label="필요 장비">{drill.equipment ? drill.equipment : EMPTY}</Item>
        <Item label="코트">{`${drill.courtMode === 'full' ? '풀' : drill.courtMode === 'half' ? '하프' : '플랫'} 코트${drill.courtSize ? ` · ${drill.courtSize.replace('x', '×')}m` : ''}`}</Item>
        <Item label="스텝">{drill.steps.length}개</Item>
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
