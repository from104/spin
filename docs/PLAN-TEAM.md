# PLAN — [팀] 메뉴 신설 (2026-09-09)

> **정본 지위**: 팀 기능의 설계 정본. 상위 정본은 `AGENTS.md`(관행) · `docs/DESIGN.md`(계약).
> 조사 정본은 `docs/research/TEAM-RESEARCH-2026-09-09.md`(이하 «조사») — 규정 원문·코드 좌표는 그쪽을 본다.
> 여기서는 조사 §7 의 질문 14개에 **답을 확정**하고 손대는 곳을 못박는다.

기현님 지시(2026-09-09, 원문):

> fipfa 룰북, 기술보충문서, 등급관리규정, 일반적인 장애인 단체구기종목 관례, 일반 단체 구기종목 관례 등을
> 종합(검색,분석)하여 세션 다음에 "팀" 메뉴 신설
> - 기본적으로 1개 팀 이상 관리 가능
> - 드릴,세션에 종속되지 않음
> - 기기 저장, 구글 드라이브 동기화, 파일 내보내기만 허용, 공유 링크 없음.
> - 필요한 정보를 충분히 담고 다루기 쉬워야하며 인터렉티브해야함

## 0. 한 줄 원칙

**팀은 드릴·세션과 같은 급의 독립 문서다 — 명단은 팀 안으로 들어가고, 링크로는 절대 안 나간다.**
파워체어풋볼은 「인원 상한형」(한 경기 PF2 ≤ 2명)이지 점수 합산형이 아니다(조사 §4.1). 그래서 팀 화면은
**명단 층(정보·회색 칩)** 과 **라인업 층(규정·노란 경고)** 을 다른 위젯으로 갖되 **입력을 막지 않는다**.
의료·보호자·연락처는 **필드를 만들지 않는 것**이 가장 강한 보호다(조사 §3.2·Q10).

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 새 문서 `Team`(`model/team.ts`, id 접두 `tm`) 이 **선수 명단을 흡수**한다: `Team.players: Player[]`. 기존 `Player`·`PF_CLASSES`·`validateRoster` 의 repair 계약을 재사용 | 조사 Q1. `Player` 타입·id(`pl_`)를 그대로 써야 세션의 `participantIds` 가 끊기지 않는다 |
| 2 | 저장은 **팀별 문서** — 새 IDB 스토어 `teams`(`DB_VERSION 1→2`, 인덱스 `updatedAt`). 요약 스토어 없음(`sessions` 패턴) | 조사 Q12. 한 팀 손상 = 한 팀만 손실. ⚠️ 멀티탭 강제 새로고침(`db.ts:69-78`) 이 따라온다 — §4 실기 |
| 3 | **기존 단일 명단 이주**: 앱 기동 시 `teams` 가 비어 있고 meta `roster` 에 선수가 1명 이상이면 로케일 기본 이름(ko «내 팀»/en «My Team»/ja «マイチーム»)의 팀 하나를 만들고 meta `rosterMigratedAt` 도장을 찍는다(한 번만). 이주한 `roster` 는 **지우지 않는다**(읽기 전용 잔류, 동기화 타입 `'roster'` 도 그대로) | 조사 Q1. 옛 버전 기기·옛 백업이 명단을 잃지 않게. 새 UI 는 roster 에 **쓰지 않는다** — 다음 릴리스에서 철거 후보(ROADMAP 에 적는다) |
| 4 | 스키마 도장: `CURRENT_TEAM_SCHEMA = 1`, `TEAM_MIGRATIONS = []`(빈 체인도 등록), 봉투 `ENVELOPE_VERSION` 은 1 그대로, `Session` 에 `teamId?: TeamId` 를 **선택 필드로 추가하되 세션 스키마는 올리지 않는다** | 세 축 분리(`migrate.ts:1-2`). 옛 앱이 `teamId` 를 모르고 저장하면 그 값만 사라지는데, 이는 "팀 미지정" 상태로 자연 복귀라 데이터 손실이 아니다(드릴 v9→v10 때의 «획 소실»과 다른 부류) |
| 5 | **팀 필드**: `name`(≤40) · `shortName?`(≤6) · `color` · `gkColor` · `league?` · `season?` · `note?` · `players` · `staff` · `lineup?` · `createdAt/updatedAt/schemaVersion`. **로고·지역·국가는 넣지 않는다** | 조사 §3.1. `gkColor` 는 규정 필수(Laws L490-491)인데 지금 값을 만드는 UI 가 0곳 — 감사 B6(`PLAN-2026-08.md:636`) 빚을 여기서 갚는다 |
| 6 | **선수 필드**(기존 `Player` 확장, 전부 선택): `number?`(0~99) · `isCaptain?` · `preferredGk?` · `active?`(기본 true, false = 명단에서 감춤) · `birthYear?`(연도만) · `chairModel?`(≤40) · `note?`(≤200). **성별·정확한 생년월일·사진·연락처·진단명·보호자는 만들지 않는다** | 조사 §3.2·Q10. GK 는 경기 중 바뀌는 지정이라 `preferredGk` 는 **선호**일 뿐(Laws L358). `note` 입력칸 아래에 «의료·연락처 등 개인정보는 적지 마세요» 안내 |
| 7 | **스태프**(`Staff`, id 접두 `st`): `name` · `roles: StaffRole[]`(복수: `coach`·`assistantCoach`·`manager`·`doctor`·`carer`·`mechanic`) · `isSeniorCoach?`(팀당 1명) · `playerId?`(선수 겸직) · `note?`. 자격증·유효기간은 안 넣는다 | 조사 Q13·§3.3. Tech Supp `:252-258` 역할 목록, Laws L987(선임 코치 제재 승계)·L1554(코치 겸 선수). ⚠️ 2026-09-09 정정: 접두는 `st` 가 아니라 **`sf`** — `st` 는 `StepId` 가 이미 쓴다(근거 `src/core/ids.ts:26`, `DESIGN.md §3.12c`) |
| 8 | **라인업 위젯**(팀 상세의 한 절, 팀당 하나 저장 `lineup?: { court: PlayerId[]; gk?: PlayerId; bench: PlayerId[] }`): 코트 4칸(그중 GK 1) + 벤치, 활성 선수를 탭/드래그로 넣고 뺀다. PF2 가 3명째 들어오면 **노란 경고 + R7 툴팁**, 하한 경고는 **2명 미만**, 벤치 상한은 잠그지 않는다. **미분류는 PF1 로도 PF2 로도 세지 않는다** | 조사 §4.2 R1~R8·Q6. 셈+경고만, 차단 없음 — `SessionEditorScreen.tsx:350-355` 선례. 「코트 위 PF1 최소 2명」 경고는 **만들지 않는다**(규정 근거 없음) |
| 9 | 명단 헤더의 PF1·PF2·미분류 칩은 **회색 정보 칩** — 경고색 금지 | Laws `:1793` 스쿼드 등급 조합 무제한(R6) |
| 10 | **등급 상태(N/R/C 등)·장비 속도검사·경기 기록·출결 시스템은 첫 배송에서 뺀다.** 출석은 세션 `participantIds` 에서 **계산**해 선수 행에 «참가 세션 n회» 로만 보여준다(저장 안 함) | 조사 Q7(어휘 미확정·국내 미확인)·§3.4·§3.5. SPIN 은 드릴 플래너다 |
| 11 | 세션 편집의 참가자 체크: `session.teamId` 가 있으면 그 팀 명단, 없으면 체크리스트 위에 **팀 선택 드롭다운**(팀이 1개면 자동 선택·저장). `participantIds` 는 그대로. 「지워진 선수 id 가 남는 건 정상」 교리 유지, 팀이 지워진 세션도 같은 교리(참가자 이름 대신 «(지워진 선수)») | 조사 Q3. 지시의 «종속되지 않음»은 팀→세션 방향의 독립이지 세션→선수 참조를 없애라는 뜻이 아니다 |
| 12 | **공유 링크 울타리**: `share/codec.ts` 의 `SharedDoc` 유니온에 team 을 **추가하지 않는다**. 세션 공유 시 `teamId` 도 strip 목록에 넣는다. 팀 화면·카드 메뉴에 공유 콜백을 **만들지 않는다** | 지시 «공유 링크 없음». 조사 §5.4 — 닫힌 유니온이 컴파일 타임 방어. 커밋 메시지에 이 이유를 적는다 |
| 13 | **파일 내보내기**: `.spin.team.json`(팀 하나) — 카드 메뉴 [내보내기] 는 시트를 띄워 **[등급 정보 제외]** 체크박스(기본 꺼짐)를 준다. 백업 봉투 `BackupPayload.teams?` 에 팀 전량, 복원은 드릴식 **개별 충돌 처리**(updatedAt 비교, `ImportCandidate`). 가져오기는 [팀] 툴바 [가져오기] + 설정 [데이터] 의 파일 열기(team kind 는 팀 화면으로 착지) | 지시 «파일 내보내기만». 조사 §3.6·§5.2. `OPENS_ON_LIBRARY_SCREEN` 누락 사고(2026-08-26) 재발 금지 — team kind 착지를 명시 |
| 14 | **드라이브 동기화**: `SyncDocType` 에 `'team'`, 파일명 `<tm_id>.json`, CAS(`expectedUpdatedAt`)·톰스톤·삭제 전파 전부 드릴과 동일. `plan.ts`/`engine.ts` 는 손대지 않는다 | 조사 §5.2. 옛 기기는 team 파일을 `unrecognized` 로 무시(삭제·덮어쓰기 없음) — 안전 |
| 15 | **삭제 안전망**: 팀 삭제 = 확인 모달(선수 n명·스태프 m명이 함께 지워짐 명시) + `DELETE_UNDO_TOAST_MS` 8초 undo + 톰스톤. 선수·스태프 삭제 = undo 토스트(같은 8초 상수) | 조사 Q11. `RosterSection` 의 기본값 토스트보다 짧게 사라지던 것을 이 기회에 통일 |
| 16 | **내비**: `Screen`/`RailKey` 에 `'team'`, `RAIL_ITEMS` 는 `sessions` 와 `rules` **사이**, 경로 `/team`(목록)·`/team/<tm_id>`(상세), `pathFor`/`parsePath` 왕복 테스트, `TUTORIAL_SCREEN_KEYS` 에 `'team'`, `robots.txt` Disallow 3줄, 아이콘 `IconTeam` 신규 | 지시 «세션 다음에». 조사 §5.3 — `parsePath` 는 컴파일러가 안 잡으니 테스트가 유일한 방어선. `prefs.ts:206-208` sanitize 가 미등록 키를 버려 투어가 매번 뜨는 함정 |
| 17 | **화면 구조**: 목록(카드: 색 견본·이름·약칭·선수 수·PF 칩·스태프 수, 메뉴 열기/복제/내보내기/인쇄/삭제, 빈 상태 [새 팀]·[가져오기]) → 상세(헤더 인라인 이름·약칭·색 2종, 절: 선수 / 스태프 / 라인업 / 정보). 선수 절은 **인라인 추가 행 + 행 클릭 편집 + 검색 + 정렬(등번호/이름/등급) + 비활성 보기 토글**. 전역 «현재 팀» 상태는 만들지 않는다 | 지시 «다루기 쉽고 인터랙티브». 조사 Q4·§2.5(SquadGod 드래그·TeamSnap 필드) |
| 18 | **팀시트 인쇄**: 상세 [인쇄] → 인쇄 전용 뷰(팀명·색·등번호·이름·주장·GK 선호·등급 칩, 스태프 역할, 라인업 있으면 코트/벤치). 인쇄 대화상자 전에 [등급 정보 제외] 토글. `PrintDrillSheet` 과 **다른 채널** — `chairNameChannels.test.ts` 를 건드리지 않는다 | 조사 Q8. 팀시트는 Laws L329-330 상 실재하는 문서 |
| 19 | 상한 `LIMITS`: `rosterMax 30` 은 **팀당**, `teamMax 20`, `staffMax 15`, `teamNameLen 40`, `shortNameLen 6`, `playerNoteLen 200` | 조사 Q5(10 제안 → 20: 클럽·연령대·연도별 복제를 감안, 동기화 파일 수 20은 무리 없음). ⚠️ 2026-09-09 보탬: 구현이 넷을 더했다 — `chairModelLen 40`·`teamLeagueLen 40`·`teamSeasonLen 24`·`teamNoteLen 400`(근거 `src/model/validate.ts:158`) |
| 20 | 시즌·연령대는 **`season` 라벨 + [복제]** 로 푼다(별도 계층 없음). 복제는 선수·스태프 id 를 **새로 발급**한다 | 조사 Q9. 같은 `pl_` id 가 두 팀에 있으면 `participantIds` 가 어느 팀인지 모호해진다. ⚠️ 2026-09-09 좁힘: **[복제] 만** 재발급한다 — 백업 복원·파일 가져오기의 'copy' 는 `pl_` 를 **보존**한다(근거 `src/storage/transfer.ts:420`: 같은 파일 안의 세션 `participantIds` 가 끊긴다) |
| 21 | 설정 화면의 [선수 명단] 섹션은 **철거**하고 그 자리에 «명단은 [팀] 메뉴로 옮겼습니다 → [팀 열기]» 한 줄을 남긴다. `RosterSection.tsx` 는 삭제(참조 0 확인 후) | 정본 한 벌(AGENTS §3). 두 곳에서 같은 명단을 고치면 이주(결정 3) 규칙이 깨진다 |
| 22 | 드릴 안의 `TeamStyle`/`TeamSide`(`drill.teams`) 는 **코트 진영**이며 이번에 손대지 않는다. `DrillMetaSheet` 팀 이름 입력은 유지하되 «이 판에만 적용» 안내 문구를 붙인다 | 조사 Q2. `structuredClone` 스냅샷이라 소급 불가(2026-08-21 판단 반복). 개명(`SideStyle`)은 범위 밖 |
| 23 | 도움말 섹션 `team`(주제: 팀 만들기 / 선수 명단 / 스태프 / 라인업과 PF2 규칙 / 내보내기·동기화·인쇄 / 왜 공유 링크가 없나) 3벌 + 팀 화면 투어(목록 → 새 팀 → 선수 추가 ★실습 → 라인업 → 내보내기) | 도움말 개편 관행(`spin-help-overhaul-2026-09-08`): 새 기능 = 주제 3벌 |
| 24 | 옛 결정은 지우지 않고 ⚠️ 2026-09-09 로 뒤집는다: `ROADMAP.md:349-357`(설정 안 전환기 → 레일 메뉴), `model/roster.ts:1-9` 머리말, `rosterRepo.ts:1-6`, `syncMeta.ts:19`, `SettingsScreen.tsx:229-237`, `PLAN-DELETE-SAFETY.md:246`(좌표 표류·undo 이미 있음), `transfer.ts:41-45`(«네 곳»→«다섯 곳»), `navChrome.ts:1`·`AppNavSegment.tsx:1,9`(«3칸» 낡음) | AGENTS §2. 조사 §6 표 |

**뒤집지 않는 것**: 모바일 부분 유료화(ROADMAP 358-361)는 이번 지시와 무관 — 웹은 무료 그대로.

## 2. 손대는 곳 (소유권 — 병렬 에이전트가 같은 파일을 두 명이 쓰지 않게)

### A. 모델·저장 (먼저, 단독)
- `src/core/ids.ts` — `IdPrefix` 에 `'tm'`·`'st'`, `TeamId`·`StaffId`. ⚠️ 2026-09-09 정정: 스태프 접두는 `'sf'`(결정 7 각주).
- `src/model/team.ts`(신규) — 타입(§2.3)·`emptyTeam(locale?)`·순수 헬퍼(`addPlayer/updatePlayer/removePlayer/addStaff/updateStaff/removeStaff/setLineup/duplicateTeam`)·`lineupWarnings(team)`(R2·R5·R8 판정, 순수 함수)·`playerSessionCounts(team, sessions)`.
- `src/model/roster.ts` — 머리말 각주(⚠️ 2026-09-09), `Player` 확장 필드, 주석 «위반 시 페널티» → «한 경기 2명 초과 불가, 제재는 간접 FK + 경고 2장».
- `src/model/validate.ts` — `LIMITS` 추가, `validateTeam()`(repair: 중복 id 재발급·길이 절단·미지 role/klass 폐기·상한 절단·라인업 부분집합 강제·주장·선임코치 1명 강제).
- `src/model/migrate.ts` — `TEAM_MIGRATIONS = []`.
- `src/storage/db.ts` — `DB_VERSION 2`, `teams` 스토어(+`updatedAt` 인덱스), `if (oldVersion < 2)`.
- `src/storage/teamRepo.ts`(신규) — `listTeams/getTeam/putTeam(CAS)/deleteTeam(톰스톤 같은 트랜잭션)/duplicateTeam`, `postSyncEvent`.
- `src/storage/rosterMigration.ts`(신규) — 결정 3. 호출은 `AppShell`/앱 부팅 훅(`App.seed` 근처)에서 시드 다음.
- 테스트: `team.test.ts`(헬퍼·라인업 경고·복제 id 재발급), `validate` 팀 repair, `teamRepo.test.ts`(CAS·톰스톤), `rosterMigration.test.ts`(한 번만·빈 명단은 안 만듦), `db.test.ts` 버전.

### B. 동기화·전송 (A 뒤, C·E 와 병렬)
- `src/storage/syncMeta.ts` — `SyncDocType` `'team'`, `parseKey` 가드.
- `src/sync/drive.ts` — `parseSyncContainer`·`parseListed` 가드.
- `src/sync/store.ts` — `listLocalDocs`·`readDocForPush`·`applyPull`(관문 + CAS)·`deleteLocalForSync`.
- `src/storage/transfer.ts` — kind `'team'`, `SpinFile` 유니온, `exportTeamFile(team, {stripClass})`, `BackupPayload.teams?`, `collectBackup`, 복원 개별 충돌, `BackupRestoreReport.teams`, 머리말 «다섯 곳».
- `src/storage/files.ts` — `SPIN_EXT.team`, `ACCEPT_TEAM`.
- `src/features/settings/dataExport.ts` — team kind 착지(팀 화면), `backupReportLine` 문구.
- `src/features/team/transfer.ts`(신규) — `exportOneTeam(id, {stripClass})`, `importTeamFile(file)` → `ImportReport`.
- `src/share/codec.ts` — 세션 strip 목록에 `teamId`. **그 외 손대지 않는다.**
- 테스트: `store.test.ts` 팀 왕복·삭제 전파, `transfer.test.ts` 팀 봉투·등급 제외·백업 왕복, `syncMeta`/`drive` 가드, codec strip.

### C. 내비·화면 (A 뒤, B·E 와 병렬)
- `src/app/screens.ts`·`navChrome.ts`·`routes.ts`(`/team`, `/team/:id`)·`AppShell.tsx`(case `'team'`)·`AppNavSegment.tsx` 주석·`src/storage/prefs.ts`(`TUTORIAL_SCREEN_KEYS`)·`src/ui/icons.tsx`(`IconTeam`)·`public/robots.txt`.
- `src/features/team/TeamScreen.tsx`(목록)·`TeamDetail.tsx`·`PlayerTable.tsx`·`StaffList.tsx`·`LineupBoard.tsx`·`TeamExportSheet.tsx`·`TeamPrintSheet.tsx`·`TeamCard.tsx`. 부품은 `SessionsScreen`/`SessionTab`/`ui/*` 재사용. `data-tut` 앵커: `team-list`, `team-new`, `team-import`, `team-card-menu`, `team-players`, `team-player-add`, `team-staff`, `team-lineup`, `team-export`, `team-print`.
- `src/i18n/{ko,en,ja}.ts` — `team.*` 문구(화면 제목·부제·레일 라벨 포함). **Edit 로 좁게 삽입, Write 금지**(E 도 같은 파일을 만진다).
- `src/features/settings/SettingsScreen.tsx` — [선수 명단] 철거 + 안내 행, `RosterSection.tsx` 삭제, 주석 각주.
- `docs/REQUIREMENTS.md` §7.1 표(화면 7·레일 6) — `docsMatchCode.test.ts` 가 문자열을 대조한다.
- 테스트: `screens.test.ts`·routes 왕복·`AppRail.test.tsx` 갱신, `TeamScreen.test.tsx`(빈 상태→새 팀→선수 추가→PF 칩, 삭제 undo), `LineupBoard.test.tsx`(PF2 3명째 경고·미분류 미집계·2명 미만 경고 — 돌연변이로 증명).

### D. 세션 편집 (C 뒤)
- `src/model/session.ts` — `teamId?`. `src/features/sessions/SessionEditorScreen.tsx` `ParticipantChecklist` — 팀 드롭다운·자동 선택·`teams` 읽기. `SessionsScreen` 카드에 팀 약칭 칩(있을 때).
- `src/i18n/*` — `sessionEditor.team.*`.
- 테스트: 참가자 체크가 팀별 명단을 읽는다, 팀 1개면 자동 저장.

### E. 도움말·투어·문서 (A 뒤, B·C 와 병렬)
- `src/ui/help/helpSections.ts`(섹션 `team`, `sessions` 다음) · `helpContent.{ko,en,ja}.ts`(주제 6개, 결정 23) · `src/features/team/tutorialSteps.ts` + `src/i18n/*` 의 `tutorial.team.*`.
- `ROADMAP.md`(⚠️ 뒤집기 + roster 철거 후보 항목), `docs/DESIGN.md`(Team 계약 절), `docs/PLAN-DELETE-SAFETY.md:246`, `CHANGELOG{,.en,.ja}.md` Unreleased, `docs/FALSIFICATION-BASELINE.md`(팀은 링크로 안 나간다 반증선).

### 2.3 타입 계약 (B·C·D·E 가 A 를 기다리지 않고 코딩할 수 있게 — A 는 이 그대로 구현한다)

```ts
// src/model/team.ts
export const CURRENT_TEAM_SCHEMA = 1;
export const STAFF_ROLES = ['coach', 'assistantCoach', 'manager', 'doctor', 'carer', 'mechanic'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
// ⚠️ 2026-09-09 정정: `StaffId = Id<'sf'>` 다(결정 7 각주 — `st` 는 StepId 가 이미 쓴다).
export interface Staff { id: StaffId; name: string; roles: StaffRole[]; isSeniorCoach?: boolean; playerId?: PlayerId; note?: string; createdAt: number; updatedAt: number; }
export interface Lineup { court: PlayerId[]; gk?: PlayerId; bench: PlayerId[]; }   // court ≤ 4, gk ∈ court
export interface Team {
  schemaVersion: number; id: TeamId; name: string; shortName?: string;
  color: string; gkColor: string;            // hex, 기본은 drill teams.home 의 로케일 기본값과 같은 출처
  league?: string; season?: string; note?: string;
  players: Player[]; staff: Staff[]; lineup?: Lineup;
  createdAt: number; updatedAt: number;
}
// src/model/roster.ts — Player 확장(전부 선택)
//   number?: number; isCaptain?: boolean; preferredGk?: boolean; active?: boolean;
//   birthYear?: number; chairModel?: string; note?: string;
export type LineupWarning = { kind: 'pf2-over'; count: number } | { kind: 'under-min'; count: number } | { kind: 'no-gk' };
export function lineupWarnings(team: Team): LineupWarning[];
```

## 3. 착수 순서

1. A(모델·저장·이주) — 단독. 관문: `npm run typecheck`, 관련 `test:rel` 초록.
2. B ∥ C ∥ E — 파일 소유권 §2 대로. i18n 세 파일은 Edit 로만.
3. D — C 의 i18n 뒤.
4. 관문 3종(`npm run typecheck` · `npm run lint`(경고 48 = HEAD 유지) · `npx vitest run`) + 헤드리스 크롬 화면 확인(목록·상세·라인업 경고·인쇄 뷰·설정 안내 행).
5. 검수 워크플로우(반박·실증·돌연변이) → 고침 → 커밋 1건(커밋 메시지에 결정 12 의 이유).

## 4. 실기 확인 (jsdom 이 못 재는 것)

- **DB 업그레이드**: 탭 두 개 띄운 채 새 버전 열기 → 다른 탭이 3초 뒤 강제 새로고침되고 데이터가 남는가.
- **이주**: 0.6.6 에서 만든 명단이 첫 기동 때 «내 팀» 으로 보이는가, 두 번째 기동 때 중복되지 않는가, 설정에 [선수 명단] 이 없고 안내 행이 있는가.
- **동기화**: 기기 A 에서 팀 만들기 → 기기 B 에 도착, B 에서 삭제 → A 에서 사라짐(톰스톤). **0.6.6 기기**가 같은 Drive 를 볼 때 오류 없이 무시하는가. [Drive 데이터 삭제] 가 팀 파일도 지우는가.
- **파일**: `.spin.team.json` 저장·열기(브라우저·Android·iOS·Tauri — Tauri 의 `<a download>` 는 조사 Q14 미확인), [등급 정보 제외] 가 실제로 `klass` 를 뺐는가(파일 열어 확인), 백업 → 복원에 팀이 실리는가.
- **터치**: 라인업 드래그(폰), 선수 행 인라인 편집의 IME(한글 이름 조합 중 Enter), 등번호 숫자 키패드.
- **인쇄**: 팀시트가 A4 한 장에 들어가는가, 등급 제외 토글이 인쇄물에 반영되는가, 다크 테마에서 흰 배경인가.
- **접근성**: 레일 6칸의 스크린리더 순서·`aria-current`, 라인업 경고가 `role=status` 로 읽히는가, 좁은 창 헤더 세그먼트 6칸 가로 예산.
- **공유 없음**: 팀 카드 메뉴에 공유가 없고, 세션 공유 링크를 받은 쪽에 `teamId`·참가자가 없는가.

## 5. 랜딩 뒤 — 검수가 잡은 것 · 계획에서 벗어난 것 (2026-09-09)

표본은 `PLAN-RULES-9CARDS.md §11.5`. 위 결정 표의 원문은 **지우지 않았고**, 어긋난 행에 ⚠️ 각주만 덧댔다(AGENTS §2).

### 5.1 계획과 코드가 갈린 곳 — 코드가 맞았다

| 곳 | 계획서 | 코드 | 왜 코드가 맞나 |
|---|---|---|---|
| 결정 7 · §2 A · §2.3 | 스태프 id 접두 `st` | `sf` | `st` 는 `StepId` 가 이미 쓴다 — 같은 접두를 두 종류에 주면 `Id<'st'>` 두 별칭이 **구조적으로 같은 타입**이 되어 컴파일러가 스텝 id 를 스태프 자리에 넣는 것을 못 잡는다(`src/core/ids.ts:26`) |
| 결정 19 | 상한 6개 | +4 (`chairModelLen 40`·`teamLeagueLen 40`·`teamSeasonLen 24`·`teamNoteLen 400`) | 계획서가 세지 않은 필드에도 자유 입력칸이 생겼다 — 상한 없는 문자열은 IDB·동기화 파일 크기의 유일한 구멍이다(`validate.ts:158`) |
| 결정 20 | «복제는 id 재발급» | [복제]만 재발급, 백업 복원·파일 가져오기의 'copy' 는 `pl_` 보존 | 한 파일 안에 팀과 세션이 함께 들어오는 경우, id 를 갈면 그 파일의 세션 `participantIds` 가 통째로 끊긴다(`transfer.ts:420`) |

### 5.2 계획서 §2 어느 담당에도 없던 파일을 고쳤다

`src/ui/tutorial/useTutorial.ts` (+82줄, 상수 `LATE_STEP_MAX_FRAMES = 60`, `markSeen()` 즉시 호출). 결정 23 의 팀 투어는 **목록과 상세를 가로지르는 첫 투어**라, 시작 시점에 앵커가 없어 걸러진 뒤 단계를 나중에 붙이는 장치가 공용 훅에 없으면 성립하지 않는다(투어가 «2/2» 로 끝났다 — 2026-09-09 헤드리스 관문 실측). 계획서 §2 는 화면·모델·동기화만 나눠 놓아 «공용 훅을 고친다» 는 칸이 없었다.

### 5.3 검수가 잡아 같은 날 고친 것

| 등급 | 무엇 | 고침 |
|---|---|---|
| must | 인쇄 경로에 [등급 정보 제외]가 **없었다**(결정 18 미이행) — `printDoc.stripClass` 는 선언만 되고 값을 넣는 호출자가 0곳이라 팀시트가 늘 등급을 찍었는데, 도움말 3벌·CHANGELOG 3벌은 «인쇄에도 있다» 고 약속하고 있었다 | `TeamExportSheet` 에 `mode:'export'|'print'` 를 더해 두 길이 같은 시트를 지나게 했다. 테스트: «켜고 인쇄하면 등급 열이 없다» + «시트를 다시 열면 기본값(꺼짐)» |
| must | 레일 6칸째로 좁은 창 헤더가 넘쳤는데 **가로 스크롤이 없어 손이 닿지 않았다**(ko/360 [설정], en/412 [Rules]·[Settings], ja/360 세 칸) | nav 를 가로 스크롤 컨테이너로(칸은 `--hit` 유지). `navChrome.ts` 에 가로 예산 함수 둘(`navSegmentMinWidthPx`·`navSegmentWidthBudgetPx`)을 두고 테스트가 지킨다 |
| must | 팀 목록↔상세 전환에 §7.6(main 포커스 + 라이브리전)이 안 돌아, [열기] 를 누르면 초점이 `<body>` 로 떨어지고 아무것도 안 읽혔다 | `announceFor` 에 `teamDetail` 인자(맨 뒤, legalDoc 과 같은 규율) + `AppShell` 발표 방아쇠에 `teamKey`. `app.announce.teamDetail` 3언어 |
| must | `rosterRepo.ts` 머리말이 «새 스토어를 파지 않았다» 를 현재형으로 말하고 있었다(결정 24 의 9곳 중 유일한 미이행) | 원문 아래에 ⚠️ 2026-09-09 각주 — 전제가 죽은 이유·치른 대가(DB_VERSION 2)·읽기 전용 잔류 |
| should | 이주 팀 id 가 기기마다 달라, 두 기기가 각자 이주하면 «내 팀» 이 두 벌 생기고 둘이 같은 `pl_` id 를 공유했다 | 고정 id `MIGRATED_TEAM_ID = 'tm_migrated_roster'` — 동기화가 같은 문서로 보고 LWW 로 수렴한다 |
| should | DB v1→v2 업그레이드가 **옛 데이터 위에서** 도는 경로에 테스트가 없었다 | `db.test.ts` 에 v1 을 손으로 세워 올리는 케이스(레코드 4개·옛 인덱스 생존) |
| should | 팀 색·GK 색만 `onChange` 에서 곧장 저장해, 드래그 한 번에 IDB 쓰기 + `postSyncEvent` 가 수십~수백 건 나갔다 | 초안 state + `onBlur` 저장(같은 파일의 다른 칸과 같은 규율) + `save()` 에 요청 순번 |
| should | 라인업의 유일한 조작 표적 `SlotButton` 이 32×32 라 [큰 터치] 가 이 화면에서만 무효였다 | `--hit` 로 |
| should | 철거한 `RosterSection.tsx` 전용 i18n 키 14개가 세 언어에 남아 «설정 안에 명단이 있다» 를 계속 말했다 | 세 파일에서 함께 삭제. `sectionTitle`·`addButton` 만 남기고 «세션 편집이 빌려 쓴다» 를 주석에 못박음 |
| should | «뒤늦게 오는 단계» 가 꼬리의 **부분 도착**을 못 견뎠다 — 뒤엣것 하나가 먼저 서면 그 사이 단계가 영영 안 붙는다 | 앞에서부터 이어지는 만큼만 붙이고 남으면 계속 기다린다 |

### 5.4 안 고치기로 한 것

- **삭제 버튼의 `#e0554a` 리터럴**(AGENTS §1.4 «색은 토큰만»). 이 빨강은 팀 파일 3개가 새로 쓴 것이 아니라 `DrillCard.tsx`·`SessionTab.tsx` 가 이전부터 쓰던 값이다 — 토큰을 새로 파면 5개 파일을 함께 옮겨야 하고 그중 둘은 이 작업의 소유권 밖이다. 라이트 테마 대비 3.7:1 문제와 함께 **저장소 전역 과제**로 남긴다.
