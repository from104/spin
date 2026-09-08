// 팀시트 인쇄 뷰 (PLAN-TEAM 결정 18). 팀시트는 Laws 상 **실재하는 문서**다 — 경기 전에 제출하는
// 명단표라, 앱이 그 모양을 그대로 낼 수 있으면 종이 작업 한 단계가 사라진다.
//
// ⚠️ **`PrintDrillSheet` 과 다른 채널이다.** 이 파일은 코트 그림을 그리지 않고 `model/chairLabel.ts`
//    의 이름 헬퍼(`numberedName`·`chairName`)를 **부르지 않는다** — 저쪽은 판 위의 체어 칩 이름이고
//    이쪽은 사람의 명단이다. 두 채널을 섞으면 `src/test/chairNameChannels.test.ts` 가 재는 "이름이
//    어느 출력 채널까지 갔는가" 가 뜻을 잃는다(그 파일 머리말).
//
// 인쇄 CSS 계약(`spin-print-*` 클래스)은 `styles/print.css` 가 정본이고 이름은 `printDom.ts` 에서
// 온다 — 여기서 새 클래스를 지어내면 화면 테스트는 전부 초록인 채로 종이만 빈다.
//
// [등급 정보 제외]는 이 컴포넌트의 `stripClass` prop 이다. 화면에서 토글한 값이 **종이에 그대로**
// 가야 한다 — 종이만 다른 규칙을 두지 않는다(PrintRoot 의 `view` 스위치가 간 길과 같다).
import type { Player } from '../../model/roster.ts';
import type { Team } from '../../model/team.ts';
import { PRINT_PAGE_CLASS } from '../print/printDom.ts';
import { useT } from '../../i18n/useT.ts';
import type { DictKey } from '../../i18n/ko.ts';
import type { StaffRole } from '../../model/team.ts';

const ROLE_KEY: Record<StaffRole, DictKey> = {
  coach: 'team.staff.role.coach',
  assistantCoach: 'team.staff.role.assistantCoach',
  manager: 'team.staff.role.manager',
  doctor: 'team.staff.role.doctor',
  carer: 'team.staff.role.carer',
  mechanic: 'team.staff.role.mechanic',
};

export interface TeamPrintSheetProps {
  team: Team;
  /** 결정 13·18 — 켜면 등급 열이 통째로 사라진다. **빈 칸으로 두지 않는다**: 빈 등급 열은
   *  "아직 심사를 안 받았다" 로 읽혀서, 뺀 것과 없는 것이 종이 위에서 구분되지 않는다. */
  stripClass?: boolean;
}

export function TeamPrintSheet({ team, stripClass }: TeamPrintSheetProps) {
  const t = useT();
  // 비활성 선수는 팀시트에 싣지 않는다 — 제출용 명단이고, 활성/비활성은 그 문서의 어휘가 아니다.
  const players = team.players.filter((p) => p.active !== false);
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const lineup = team.lineup;

  return (
    <section className={PRINT_PAGE_CLASS} data-print-page="team">
      <h1 className="spin-print-h1">
        {team.name}
        {team.shortName ? ` (${team.shortName})` : ''}
      </h1>
      <p className="spin-print-meta">
        {[t('team.print.title'), team.league, team.season].filter(Boolean).join(' · ')}
      </p>
      <p className="spin-print-meta">{t('team.print.colorLine', { color: team.color, gkColor: team.gkColor })}</p>
      {team.note && <p className="spin-print-note">{team.note}</p>}

      <h2 className="spin-print-steptitle">{t('team.print.playersHeading')}</h2>
      {players.length === 0 ? (
        <p className="spin-print-dim">{t('team.print.noPlayers')}</p>
      ) : (
        <table className="spin-print-table">
          <thead>
            <tr>
              <th scope="col">{t('team.print.colNumber')}</th>
              <th scope="col">{t('team.print.colName')}</th>
              {!stripClass && <th scope="col">{t('team.print.colClass')}</th>}
              <th scope="col">{t('team.print.colChair')}</th>
              <th scope="col">{t('team.print.colMark')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} data-player-row={p.id}>
                <td>{p.number ?? ''}</td>
                <td>{p.name}</td>
                {!stripClass && <td>{p.klass ?? ''}</td>}
                <td>{p.chairModel ?? ''}</td>
                <td>{marksOf(p, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {team.staff.length > 0 && (
        <>
          <h2 className="spin-print-steptitle">{t('team.print.staffHeading')}</h2>
          <table className="spin-print-table">
            <thead>
              <tr>
                <th scope="col">{t('team.print.colName')}</th>
                <th scope="col">{t('team.print.colRole')}</th>
              </tr>
            </thead>
            <tbody>
              {team.staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{[...s.roles.map((r) => t(ROLE_KEY[r])), ...(s.isSeniorCoach ? [t('team.print.seniorCoach')] : [])].join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {lineup && (lineup.court.length > 0 || lineup.bench.length > 0) && (
        <>
          <h2 className="spin-print-steptitle">{t('team.print.lineupHeading')}</h2>
          <p className="spin-print-note">
            <b>{t('team.print.court')}</b>{' '}
            {lineup.court
              .map((id) => byId.get(id))
              .filter((p): p is Player => p !== undefined)
              .map((p) => `${p.name}${lineup.gk === p.id ? ` (${t('team.lineup.gkBadge')})` : ''}`)
              .join(', ')}
          </p>
          {lineup.bench.length > 0 && (
            <p className="spin-print-note">
              <b>{t('team.print.bench')}</b>{' '}
              {lineup.bench
                .map((id) => byId.get(id))
                .filter((p): p is Player => p !== undefined)
                .map((p) => p.name)
                .join(', ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** 주장·GK 선호 같은 '표시'. 등급과 달리 [등급 정보 제외]에 걸리지 않는다 — 분류 심사 결과가
 *  아니라 팀 안의 역할이라서다. */
function marksOf(p: Player, t: ReturnType<typeof useT>): string {
  const marks: string[] = [];
  if (p.isCaptain) marks.push(t('team.print.captain'));
  if (p.preferredGk) marks.push(t('team.print.gk'));
  return marks.join(' · ');
}
