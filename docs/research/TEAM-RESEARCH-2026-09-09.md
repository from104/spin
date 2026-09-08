# 팀 메뉴 조사 정본 — 2026-09-09

> **지위**: `PLAN-TEAM.md` 의 **조사 정본**. 상위 정본은 `AGENTS.md`.
> 규정·관례·코드 사실을 여기서 한 번만 확정하고, 계획서는 여기를 인용한다.
>
> **만든 방법**: 조사 8갈래(R1~R8) → 갈래마다 반박자 1명이 원문 PDF·코드 줄을 직접 재대조.
> 반박에서 **[반박]된 주장은 이 문서에 싣지 않았다**. 원문을 못 본 것만 **[확인 못함]** 으로 남겼다.
> 원자료: `scratchpad/team-research/*.verified.md`(세션 스크래치패드, 휘발성).
>
> **줄 번호 기준**: 저장소 `devel` @ `0c69f2f`. 문서 인용은 그 시점 값이다.

---

## 1. 지시 원문

> 「fipfa 룰북, 기술보충문서, 등급관리규정, 일반적인 장애인 단체구기종목 관례, 일반 단체 구기종목 관례
> 등을 종합하여 세션 다음에 "팀" 메뉴 신설 — 1개 팀 이상 관리, 드릴·세션에 종속되지 않음,
> 기기 저장·구글 드라이브 동기화·파일 내보내기만 허용(공유 링크 없음), 필요한 정보를 충분히 담고
> 다루기 쉬워야 하며 인터랙티브해야 함」
> — 기현님, 2026-09-09

읽는 법 네 갈래:

1. **"세션 다음에"** = 레일(주 메뉴) 여섯 번째 칸이 아니라 `sessions` 와 `rules` **사이**. 옛 결정
   "왼쪽 레일이 아니라 [설정] 위의 팀 전환기"(ROADMAP.md:354-355)를 명시적으로 뒤집는다(§6).
2. **"1개 팀 이상"** = 단일 팀 전제(`src/model/roster.ts:1-9`)의 폐기. 저장 구조가 바뀐다(§5).
3. **"드릴·세션에 종속되지 않음"** = 팀은 독립 문서. 단 **세션→선수 참조는 이미 있다**
   (`src/model/session.ts:61` `participantIds?: PlayerId[]`) — 이 방향의 결합은 남는다(§7 Q3).
4. **"공유 링크 없음"** = `src/share/codec.ts` 를 **안 건드리는 것 자체가 울타리**다(§5.4).

---

## 2. 규정 사실표

### 2.1 FIPFA Laws of the Game 2025 — 경기·명단·장비

| 출처 | 조항 | 사실 | 팀 화면 함의 |
|---|---|---|---|
| Laws 2025 PDF L315-316 · `docs/RULES-FIPFA-2025.md:91` · `en.md:111-112` | Law 3 | 한 팀 최대 **4명**, 그중 1명은 반드시 골키퍼. 어느 팀이든 **2명 미만**이면 경기 시작·속행 불가 | 라인업 슬롯 4칸(GK 1). 하한 경고는 **2명**이지 4명이 아니다 |
| Laws PDF L321-330 · `en.md:117` | Law 3 Official Competitions | 선수 4 + 교체 **최대 4**. 대회 규정이 더 허용할 수 있으나 ①팀 간 합의 ②주심 사전 통보 둘 다 필요, 없으면 4명 상한. **팀시트를 경기 전 주심에게 제출**하고 **명단에 없는 선수·교체는 출전 불가** | 기본 엔트리 = **4 + 4 = 8명**. 상한을 8로 **잠그면 안 된다**(대회 규정이 늘릴 수 있음). 산출물로 "팀시트(출전명부)"가 규정상 실재 |
| Laws PDF L354 | Law 3 | 페널티킥을 위한 GK 교체 불가(부상·장비고장 예외) | 라인업 검증 밖 — 경기 운영 규칙 |
| Laws PDF L358 · `en.md:126-127` | Law 3 | **아무 선수나 경기 중 GK 와 자리를 바꿀 수 있다** | GK 는 사람의 고정 속성이 **아니다**. 선수 필드는 "주 포지션(선호) = GK" 같은 **소프트 속성**, 실제 GK 지정은 라인업 단계 |
| Laws p.36-37 = `fipfa-laws-2025.txt:1786-1790` | 분류 | PF1 = "highly significant levels of physical difficulty" / PF2 = "moderate to mild … but who still meets the minimal eligibility criteria" | `PF_CLASSES = ['PF1','PF2']` 그대로. 툴팁 본문의 출처는 **Laws** 이지 Classification Rules 가 아니다 |
| Laws p.36 = `:1791-1792` · PDF L1392-1398 | 분류 | "Each team cannot **field more than two PF2** sport class players **during a match**" | 라인업 검증의 유일한 등급 규칙. 문구는 **"이 경기 PF2 2명까지"** — "동시 출전"이 아니다(§4) |
| Laws p.36 = `:1793` | 분류 | "There is **no restriction** in the combination of sport classes **within the playing squad**" | **명단 등록 화면에서 PF2 수를 막으면 안 된다.** 제약은 경기 단위에만 |
| Laws p.36 = `:1796-1800` · PDF L1401-1405 | 제재 | 위반 시 ①즉시 중단 ②해당 선수 제외 ③**선수와 코치 양쪽 옐로카드** ④상대 간접프리킥으로 재개 ⑤시정 불가 시 **1명 적게** 속행 | 경고 문구의 정확한 결과. `roster.ts:6` 주석의 "위반 시 페널티"는 **부정확**(간접FK + 경고 2장) — 같은 커밋에서 고칠 것 |
| Laws PDF L1370 · `ko:340` · `en:501` | 분류 | "Levels of fitness, age, cognition, gender or skill are **not factors** in classification" | 등급 필드 옆에 나이·성별을 근거로 붙이지 않는다 |
| Laws PDF L422-433 | Law 4 필수장비 | ①저지 ②팀 내 동일색·상대와 대비 ③팀 통일 하의 ④전동휠체어 ⑤랩 시트벨트 ⑥프런트가드 ⑦**뒤는 체어에, 앞은 체어 또는 선수에** 붙인 명확한 번호 | 팀 필드 = **팀 색** 필수. 선수 필드 = **등번호** 하나면 충분(앞뒤 구분 불필요) |
| Laws PDF L490-491 · `en.md:160` | Law 4 | "Each goalkeeper wears colours that **distinguish him from the other players** … 'Bibs' should be avoided" | 팀 색은 **필드플레이어 색 + GK 색 2개**여야 한다. ⚠️ 이 조항은 **한글 정본 `docs/RULES-FIPFA-2025.md` 에 빠져 있다**(rg 0건) — 별건으로 보강 필요 |
| Laws `:561-562` · PDF L442 | Law 4 | 최고속도 **10 kph (6.2 mph)**, "forward and reverse" | 장비 섹션의 속도검사 필드 근거 |
| Laws PDF L449-450 | Law 4 | 배낭·가방 부착 금지(산소·영양·인공호흡기 등 필수 의료장비는 예외) | 장비 메모에 "의료장비 부착 있음"을 적을 실무 근거 |
| Laws `:559-560` | Law 4 | 4륜 이상, 스쿠터 불허 | 장비 필드의 값 검증이 아니라 안내문 소재 |
| Laws PDF L1540-1548 · `en.md:555-559` · `ko:64` | 기술구역 | 점유 인원 수는 **대회 규정이 정한다**(Laws 에 숫자 없음). 점유자는 **경기 전에 확인**된다. 전술 지시는 한 번에 한 사람만 | 스태프 목록에 **인원 상한을 강제하지 말 것**. "경기 전 확정 명단"이라는 개념은 실재 |
| Laws `:1985` · PDF L1554 · `en.md:561-562` | 코치 | "Coaches may also play but must be **listed on the team sheet in both roles**" | 한 사람이 **선수 + 코치 두 역할**을 동시에 가질 수 있게 모델링. 역할은 enum 단일값이 아니라 집합 |
| Laws PDF L987 · `ko:258` | 제재 | 반칙자를 특정 못 하면 기술구역의 **선임 코치(senior coach)** 가 제재를 승계 | 스태프 목록에 **순서 또는 [대표 코치] 플래그**가 필요 |
| Laws `:1896`, `:1907-1910` · PDF L1481, L1494 | 주장 | 코인토스는 **주장(captain)** 이 하고, 승부차기 인원 조정 시 제외 선수 통보 책임도 주장에게 있다 | 팀당 **주장 1명 지정** 필드의 규정 근거 |
| Laws 전문 검색 | — | **팀시트의 서식(어떤 칸이 들어가는지)을 정한 조항이 없다.** team sheet 언급은 교체 상한·제출 의무·코치 이중역할 3곳뿐 | 인쇄 서식은 **추론된 집합**이다. "실제 대회 서식과 일치"라고 주장하면 안 된다. **[확인 못함]** — 대회 규정 문서 미확보 |
| Laws 전문 검색 | — | **등번호 중복 금지 조항 0건**, 출전 자격으로서의 **성별·연령 조항 0건** | 등번호 유일성은 규칙이 아니라 **UX 편의 경고**. 성별·연령 필드를 규정 근거로 요구하지 않는다 |
| Laws 2021판·WFA 2021판이 아직 유통 중 | — | 앱이 규정 수치를 보여줄 때 **"FIPFA Laws of the Game 2025 기준"** 표기 필요 | 도움말 문구 |

### 2.2 FIPFA Technical Supplement 2020 — 기술구역·속도검사

> ⚠️ 이 문서는 아직 **2020판**이라 Laws 2025 와 어긋나는 곳이 있다(예: bibs 허용 여부가 서로 반대).
> 인용할 때 판 차이를 밝힐 것.

| 출처 | 조항 | 사실 | 팀 화면 함의 |
|---|---|---|---|
| Tech Supp `:248-261` | 기술구역 | 권장 인원: **선수 8 · 코치 1 · 보조코치 1 · 닥터 1 · 팀 케어러/물리치료사/간호사 1 · 팀 미캐닉 1**. 권장 장비: 예비 파워체어 2 · 충전기 8 · 공구/부품용 1m² 공간 | **스태프 역할 목록의 1차 근거**. 엔트리 8명(4+4)과도 맞물린다. "suggested" 이고 최종 인원은 대회 규정 소관이라는 단서 유지 |
| Tech Supp `:526-616` | 속도검사 | 사전검사: **킥오프 15분 전**까지 가드 장착·경기 준비 상태로 집합, 팀당 1명이 기록 담당관 옆에 입회. 예비 체어도 검사 대상. **재검은 1회만** — 실패 시 **전반 결장**, 하프타임 재검 통과 시 후반 복귀, 거기서도 실패면 **전 경기 결장**. 통과 후 프로그램 조정 금지(컨트롤러는 기록석 보관). 사후검사는 모터 가열 감안 **+10% 허용**, 초기 실패 시 **15분 냉각 후 재검** | 장비 섹션에 "속도검사" 상태를 둔다면 이것이 정본. 다만 **기록 서식(폼)은 규정에 없다** |

### 2.3 FIPFA Classification Rules 2025 — 등급

| 출처 | 조항 | 사실 | 팀 화면 함의 |
|---|---|---|---|
| Art.18.1 (p.22) | 다중 클래스 | "Athletes may only be allocated **one** Sport Class" | 등급은 단일값 필드 |
| Art.6.1 (p.8) | 절차 | 4단계: ①UHC Assessment(**서류심사**) ②Eligible Impairment ③MIC ④Sport Class/Status 배정. **②③④는 한 번의 대면 Evaluation Session** | "Evaluation Session 을 받았는가"가 룰북 전반의 출전 가부 판정 단위 |
| Art.19.2 (p.23) | 상태 | **C(Confirmed) / R-NAO(Review at Next Available Opportunity) / R-FRD(Review with Fixed Review Date) / E(Expired)** 4종 | 상태 드롭다운 후보 A |
| Laws 2025 p.36-37 | 상태 | Laws 는 **N(New) / R(Review) / C(Confirmed)** 3종만 쓴다 | 상태 드롭다운 후보 B. **같은 연맹의 두 공식 문서가 다른 어휘를 쓴다** → 어느 쪽을 쓸지가 설계 결정(§7 Q7) |
| Art.20.1.3.3 (p.23-24) | R-FRD | "Fixed Review Date will **typically be no more than four years** after the previous Evaluation Session" | 날짜 필드의 현실적 범위 |
| Art.21.1~21.3 | 상태→출전 | C = 재분류 불요(단 제소·항소·의료재검토·규정변경 시 변동 가능) / R-NAO = 다음 대회 전 필수 / **R-FRD = 그 날짜까지만 출전 가능** / E = 새 Evaluation Session 전까지 불가 | **"지금 뛸 수 있나" 배지의 로직이 이 4행 그대로**. R-FRD 를 상태값으로 제공하면 날짜는 선택이 아니라 **그 상태의 필수 동반 필드** |
| Art.11.5.3-11.5.4 | New(N) | N 은 designation. NOTE: "N 인 선수는 Covered Competition 전에 Evaluation Session 참석을 권고" | 미분류 선수도 명단에 들어간다 |
| Art.31.1 (p.30) | CNC | "Classification Not Completed (CNC)" 는 Evaluation Session 완료 전까지 출전 불가(OA 목적 예외) | 배지 로직 |
| Art.12.1.1(p.13) · Art.14.1.1(p.16) · Art.16(p.18) | Not Eligible | Not Eligible 은 **세 갈래**: UHC / Eligible Impairment / MIC | designation enum 값 |
| Art.35.1.1~35.1.7 (p.31-32) | Master List | 최소 필드 **7종**: ①이름 ②성별 ③**출생연도**(생년월일 아님) ④국적 ⑤Sport Class·Status ⑥designations·추적코드 ⑦IM designation + 기간·개시일 | 선수 필드 설계의 **국제 표준 최소집합**. 판정일·등급카드번호·사진은 여기 **없다** |
| Art.35.1.6 = `fipfa-classification-2025.txt:2287-2299` | enum | `New (N)` / `Not Eligible – Underlying Health Condition` / `Not Eligible – Eligible Impairment` / `Not Eligible – Minimum Impairment Criteria` / `Classification Not Completed (CNC)` / 추적코드 `OA` / `IM`(+기간·개시일) | **드롭다운 값을 지어낼 필요가 없다** |
| Art.35.2, 35.3 | Master List | 웹에 공개되며 변경 시 즉시 갱신 | 앱은 이 목록의 사본이 아니다 — 코치의 작업 메모다 |
| Art.3.1 | 적용 범위 | Covered Competition = 패럴림픽 / 월드컵 / Zone Qualifying / **OA 가 이뤄질 수 있는** FIPFA 승인 행사 | **국내 클럽 훈련은 이 규정의 적용 밖.** 앱이 등급 규칙을 강제하면 안 되는 이유 |
| Art.37.1 | — | "FIPFA does not offer **combined class events**" | 팀을 클래스별로 나누는 축을 만들 이유 없음 |
| Appendix 7.1.1 | OA | Observation Assessment 는 **조별예선(Pool Play) 중**에 이뤄지고, 8강 이상 진출의 요건 | '잠정 등급' 표시가 실전에서 의미를 갖는 지점 |
| 정의절 · Art.60.8.1.1 · Art.60.5.5 | 국내 등급 | **National Classifier** 가 정의어로 실재. 국내 등급판정의 존재를 룰북이 인정하되 **절차는 각국 연맹에 위임**. 국내 자격만으로 국제 판정은 불가 | 국내/국제 구분 **자체는** 근거가 있다. 다만 **국내 등급이 FIPFA 등급으로 인정되는지는 [확인 못함]** → 강제 구분 필드를 만들지 않는다 |
| Ch.73 · 정의절 (Art.73.1.1) | 개인정보 | FIPFA 는 Classification Data 를 개인정보로 다루고, **Sensitive Personal Information = 건강 관련 정보** | 등급·진단·의료 메모를 **구글 드라이브로 내보내는 순간 건강 민감정보의 클라우드 전송**이 된다 → 고지·선택적 제외(§3.6) |
| 전문 검색(본문 61쪽 + Appendix, 99쪽) | — | `MDF` · `Medical Diagnostics Form` · `classification card` **0건**. 이름 붙은 서식은 Protest form / evaluation consent form / control form 뿐 | **등급카드 번호 필드를 만들지 않는다** |
| Appendix 6 (p.99) | PF3 | Primary Assessment Algorithm 표에 **`PF3` 열이 있으나 룰북 어디에도 정의가 없다**. 문맥상 MIC 미충족 구간으로 **추정** — **[확인 못함]** | 등급 값 목록에 **PF3 를 넣지 않는다** |
| — | 국내 규정 | KPC·KPSA 의 등급판정 절차·서식·국제등급 인정 관계 — **[확인 못함]**(원문 미열람). 국내 대회가 어느 상태 어휘를 쓰는지도 **[확인 못함]** | 상태 어휘 결정 시 실무 확인 필요(§7 Q7) |

### 2.4 타 장애인 단체구기 — 등급 검증의 두 모델

| 출처 | 조항 | 사실 | 팀 화면 함의 |
|---|---|---|---|
| ActiveSG · VIS(휠체어농구) | IWBF | 코트 위 5인의 등급 **합이 14.0 초과 불가**, "**at any given time**"(교체마다 재검증). 초과 시 테크니컬 파울 | **점수 합산형**. SPIN 은 이 모델이 아니다 — 합계 계산기를 이식하면 룰 오적용 |
| Wikipedia · NCHPAD(휠체어럭비) | IWRF | 7클래스(0.5~3.5). 코트 위 4인 합 **8.0 초과 불가**. 여성 선수에 대한 완화가 있으나 **기전이 두 소스에서 다르다** — Wikipedia: 팀 상한 +0.5 / NCHPAD: 개인 등급 −0.5. 순효과는 같음 | 점수 합산형. 인용 시 어느 쪽인지 밝힐 것 |
| lexi.global(좌식배구) | — | 온코트 6인 중 **VS1 5 + VS2 1**, 그리고 **"스쿼드 전체 VS2 최대 2명"** | **2층 상한 구조**가 SPIN 에 그대로 대응(§4.3): 「경기 단위 상한」과 「명단 단위 표시」는 **별개 위젯** |
| — | 골볼·보치아 | 등급 합산 규칙·인원 구성 — **[확인 못함]**(URL 미검증) | 인용 금지 |

### 2.5 일반 팀 관리 앱·국가연맹 관례

| 출처 | 조항 | 사실 | 팀 화면 함의 |
|---|---|---|---|
| TeamSnap Help 109 | 명단 | **필드 단위 비공개** 지정 가능 — 비공개 필드는 다른 멤버에게 숨고 관리자와 해당 프로필의 연락처에게만 보인다 | 민감 필드를 "숨김 토글"로 다루는 관례. SPIN 은 단일 사용자 앱이라 **애초에 안 만드는 쪽**이 더 단순(§3.6) |
| Spond Help(하위그룹·출결·라인업) | 명단·출결 | 다중 팀 + **하위 그룹**, 출결(RSVP) 기록과 **엑셀 내보내기**(이벤트별·기간별, 하위그룹 소속 포함), 매치 이벤트 안의 **라인업 섹션**(포메이션 지정·포지션 배치·과거 라인업 재열람) | 시즌/연령대 스쿼드를 **하위그룹**으로 푸는 선례(§7 Q9). 출결 내보내기 관례 |
| USPSA 등록 페이지 | 등록 | 등록 범주 **Team / Athlete / Staff / Referee 4종**. 팀 등급 **Conference / Non-Conference / Recreation**. 스태프 역할 **head coach / assistant coach / team manager / equipment manager / team representative**. 스태프는 **SafeSport 인증(2년 유효)** 필수. **팀이 먼저 등록돼야 스태프 등록 가능** | 팀이 **상위 개체**라는 데이터 모델 근거. 소속 리그/등급 필드의 실무 근거. 스태프 역할 목록의 2차 근거 |
| USPSA PowerHub | 선수 프로필 | 선수 속성: **등번호 / 이름 / 소속팀 / USPSA ID**(예 `USPSA-00062`). 통계 헤더: `GAMES GOALS ASSISTS POINTS G/GP A/GP Pts/GP` **`Yellow` `Red` `Post speed fail`** `POM`. 매치로그: 날짜/상대/스코어/G/A/승패 | **등번호·소속연맹 ID·경기별 로그**가 실무 표준. `Post speed fail` 은 Tech Supp 의 사후 속도검사(§2.2)와 대응 |
| SquadGod | 라인업 | "drag-and-drop lineup builder", 포지션·등번호 설정, 7v7/9v9/11v11 포메이션. 사진·메모도 담는다 | 드래그 라인업 + 등번호의 관례 근거 |
| Coach Joel's | 인쇄 | 등번호 입력 → 수비 포지션 지정 → **인쇄용 PDF 라인업 카드 즉시 내보내기**. 드래그는 **타순 재정렬**이지 필드 배치가 아니다. 데이터는 메모리에만 두고 이탈 시 소실 | **인쇄용 팀시트**의 관례 근거. 저장 전제가 SPIN 과 다름 |
| Usercentrics · GDPRLocal(COPPA) | 아동 | 13세 미만 개인정보 수집 전 **검증 가능한 보호자 동의** 필요. 지속식별자를 개인정보로 보되 조건이 "**여러 사이트·서비스에 걸쳐 이용자를 추적**"일 때 — 열거 예시는 cookies·IP·device ID 이고 **local storage 는 없다** | 실제 리스크는 저장 방식이 아니라 **입력되는 아동의 이름·연락처·의료정보 그 자체**. 미성년 선수를 다루면 최소 수집이 답(§7 Q10) |
| BuildLineup · Heja/Hudl/SportsEngine | — | **[확인 못함]** — SPA 라 본문 미확인 / 문서 미열람. "업계 공통"이라는 일반화의 근거로 쓰지 말 것 | 근거로 채택 금지 |

---

## 3. 필드 후보

민감도 4단: **공개**(경기장에서 누구나 봄) · **내부**(팀 운영용) · **민감**(개인식별·연락처) · **특수**(의료·미성년).
동기화/내보내기 열은 **제안**이다 — 최종 결정은 §7 Q8.

> **최소 수집 원칙**: 의료·보호자 정보는 SPIN 의 목적(드릴·세션 계획)에 **직접 필요하지 않다.**
> 아래에서 「특수」로 분류된 것은 전부 **넣지 않기**를 기본안으로 한다. 코치가 굳이 적어야 한다면
> 구조화 필드가 아니라 **자유 메모 하나**로 받아 앱이 그 성격을 모르게 두는 편이 안전하다.

### 3.1 팀 정보

| 필드 | 등급 | 근거 | 민감도 | 동기화·내보내기 |
|---|---|---|---|---|
| `id` (`tm_…`) | 필수 | `src/core/ids.ts:2,18` 패턴 | 내부 | 둘 다 O |
| `name` (팀 이름) | 필수 | ROADMAP.md:353 "팀 = 이름·색·명단·(선택)소속 리그" | 공개 | 둘 다 O |
| `color` (필드플레이어 색) | 필수 | Laws L422-433 "팀 내 동일색·상대와 대비" | 공개 | 둘 다 O |
| `gkColor` (GK 색) | 필수 | Laws L490-491 "GK 는 다른 선수와 구별되는 색" | 공개 | 둘 다 O. **현재 이 값을 만들 UI 가 0곳**(PLAN-2026-08.md:636 감사 B6 미배송) — [팀] 메뉴가 이 빚을 물려받는다 |
| `shortName` (약칭 2~4자) | 권장 | PowerHub·팀시트 관례. 좁은 화면 칩·인쇄 헤더 | 공개 | 둘 다 O |
| `league` (소속 리그·대회) | 선택 | ROADMAP.md:353 · USPSA 팀 등급(Conference/Non-Conference/Recreation) | 공개 | 둘 다 O |
| `region` / `country` | 선택 | Master List Art.35.1.4 국적(선수 단위지만 팀 맥락에도 유효) | 공개 | 둘 다 O |
| `season` (시즌·연령대 라벨) | 선택 | Spond 하위그룹 관례 | 내부 | 둘 다 O |
| `note` (자유 메모) | 선택 | 세션 메모 선례(0.5 배송분) | 내부 | 둘 다 O |
| `logo` (로고·배지 이미지) | **넣지 않음** | ROADMAP·FIPFA 어디에도 근거 없음. 이미지 바이트가 Drive 문서·백업 봉투 크기를 키운다 | 공개 | — |
| `createdAt` / `updatedAt` | 필수 | `drillRepo`/`sessionRepo` 공통 계약 | 내부 | 둘 다 O |
| `schemaVersion` | 필수 | `migrate.ts:370-372` 관행(빈 체인도 처음부터 등록) | 내부 | 둘 다 O |

### 3.2 선수

| 필드 | 등급 | 근거 | 민감도 | 동기화·내보내기 |
|---|---|---|---|---|
| `id` (`pl_…`) | 필수 | `src/core/ids.ts:18` 기존 값 | 내부 | 둘 다 O |
| `name` | 필수 | Master List Art.35.1.1 · 현행 `roster.ts:19` | 민감(실명) | 동기화 O(사용자 소유 Drive) / 내보내기 O / **공유 링크 X**(`codec.ts:56` 이 이미 실명을 strip) |
| `number` (등번호) | 권장 | Laws L422-433 등번호 의무 · PowerHub `Jersey number` · SquadGod | 공개 | 둘 다 O |
| `klass` (PF1/PF2, 없음=미분류) | 권장 | 현행 `roster.ts:21` · Laws p.36 · Art.11.5.3 New(N) | 특수(건강 파생) | 둘 다 O, 단 **내보내기에서 등급 제외 옵션**을 제공(Classification Rules Ch.73) |
| `classStatus` (등급 상태) | 선택 | Art.19.2 4종 또는 Laws N/R/C 3종 — **어휘 선택이 선결**(§7 Q7) | 특수 | 등급과 동일 취급 |
| `reviewDate` (R-FRD 날짜) | **조건부 필수** | Art.21.2.2 — R-FRD 는 그 날짜까지만 출전 가능. **상태가 R-FRD 면 날짜 없이는 상태값이 무의미** | 특수 | 등급과 동일 취급 |
| `isCaptain` | 권장 | Laws L1481·L1494 주장의 규정상 역할. 팀당 1명 | 공개 | 둘 다 O |
| `preferredGk` (주 포지션 GK 선호) | 선택 | Laws L358 — GK 는 고정 속성이 아니라 경기 중 바뀌는 지정. **소프트 속성으로만** | 공개 | 둘 다 O |
| `note` (운영 메모) | 선택 | Laws L318-319(체어 통제력은 주심이 출전을 제지할 수 있는 사유) → 코치가 운영 메모를 남길 자리 | 내부 | 둘 다 O |
| `active` (현재 명단 포함 여부) | 선택 | 시즌 이탈 선수를 지우지 않고 감출 수단. 삭제 안전망 부담을 줄인다 | 내부 | 둘 다 O |
| `birthYear` (출생**연도**) | 선택 | Master List Art.35.1.3 은 연도까지만 요구 | 민감 | 넣는다면 **연도만**. 정확한 생년월일은 넣지 않음 |
| `gender` | **넣지 않음(기본)** | Master List 에는 있으나 Laws L1370 이 "성별은 분류 요소가 아니다"라고 못박고, 출전 자격으로서의 성별 조항도 0건 | 민감 | — |
| `nationality` | 선택 | Master List Art.35.1.4 | 공개 | 국제 활동 팀만 의미 있음 |
| `federationId` (연맹 등록번호) | 선택 | PowerHub `USPSA-00062` 관례 | 민감 | 둘 다 O |
| 정확한 생년월일 · 사진 · 연락처 · 주소 | **넣지 않음** | 규정 근거 0. COPPA 리스크는 저장 방식이 아니라 **수집 자체**에서 온다 | 민감 | — |
| 진단명·장애유형·복약·알레르기 | **넣지 않음** | Classification Rules Ch.73 이 건강정보를 Sensitive Personal Information 으로 다룬다. 드릴 계획에 불필요 | 특수 | — |
| 보호자·비상연락처 | **넣지 않음** | 미성년 보호자 정보는 COPPA 사정거리의 핵심. 앱 목적 밖 | 특수 | — |

### 3.3 스태프

| 필드 | 등급 | 근거 | 민감도 | 동기화·내보내기 |
|---|---|---|---|---|
| `id` · `name` | 필수 | Tech Supp `:252-258` 가 기술구역 인원을 역할별로 열거 | 민감(실명) | 선수와 동일 |
| `role` (역할, **복수 선택**) | 필수 | Tech Supp: `coach` / `assistantCoach` / `doctor` / `carer`(물리치료사·간호사 포함) / `mechanic`. USPSA 보탬: `manager` / `equipmentManager` / `representative` | 공개 | 둘 다 O |
| `isSeniorCoach` (대표 코치) | 권장 | Laws L987 — 반칙자 미특정 시 **선임 코치**가 제재 승계 | 공개 | 둘 다 O. 팀당 1명 |
| `alsoPlayer` (선수 겸직 · `playerId` 연결) | 권장 | Laws L1554 "코치도 뛸 수 있으나 팀시트에 두 역할 모두 기재" | 공개 | 둘 다 O |
| `note` | 선택 | — | 내부 | 둘 다 O |
| 자격증·SafeSport 유효기간 | **넣지 않음(기본)** | USPSA 관례는 실재하나 **FIPFA 규정 근거는 없고**, 국가연맹마다 다르다. 필요하면 `note` 로 | 내부 | — |

### 3.4 장비

> 팀 화면의 장비 섹션은 **경기 준비 점검용**이다. 규정 근거가 있는 것만 둔다.

| 필드 | 등급 | 근거 | 민감도 | 동기화·내보내기 |
|---|---|---|---|---|
| `chairModel` (선수별 체어 기종) | 선택 | Laws `:559-560` 4륜 이상·스쿠터 불허 | 내부 | 둘 다 O |
| `speedCheck` (사전검사 통과/재검/실패) | 선택 | Tech Supp `:526-616` 상태기계 · PowerHub `Post speed fail` | 내부 | 둘 다 O |
| `speedCheckNote` | 선택 | 같은 곳. 서식은 규정에 없으므로 자유 텍스트 | 내부 | 둘 다 O |
| `hasMedicalDevice` (필수 의료장비 부착) | 선택 | Laws L449-450 배낭 금지의 **예외** — 심판 확인 사항 | **특수** | 기본 **끔**. 켜면 "의료장비 부착 있음" **불리언만**, 기종·용도는 받지 않는다 |
| 팀 예비 체어 수 · 충전기 수 | 선택 | Tech Supp `:252-258` 권장 장비 | 내부 | 둘 다 O |
| 프런트가드·랩시트벨트 점검 | **넣지 않음** | 매 경기 심판이 검사하는 항목. 앱이 대신 기록할 이유 없음 | — | — |

### 3.5 출결·시즌

> **가장 과설계하기 쉬운 영역이다.** 세션에 이미 `participantIds` 가 있고(§5.1),
> Spond 급 출결 시스템을 SPIN 이 지을 이유는 없다. 아래는 **최소안**이다.

| 필드 | 등급 | 근거 | 민감도 | 동기화·내보내기 |
|---|---|---|---|---|
| (세션 쪽) `session.teamId` | 권장 | ROADMAP.md:354 "드릴·세션은 teamId 를 **선택적으로** 갖는다" | 내부 | 둘 다 O |
| (세션 쪽) `participantIds` | **이미 있음** | `src/model/session.ts:61` | 내부 | 현행 유지 |
| 팀 단위 출석 집계(선수별 참가 세션 수) | 권장 | Spond 출결 관례. **저장하지 말고 세션에서 계산** | 내부 | 파생값 — 저장 X |
| 시즌·스쿼드 구분 | 선택 | Spond 하위그룹. **별도 엔티티 말고 `team.season` 라벨 + 팀 복제**로 푼다(§7 Q9) | 내부 | 둘 다 O |
| 경기 결과·득점·경고 누적 | **넣지 않음** | PowerHub 에는 있으나 SPIN 은 **드릴 플래너**다. 경기 기록 앱으로 번지면 범위가 무너진다 | — | — |

### 3.6 내보내기·동기화의 경계 (§3 전체에 걸친 규칙)

1. **공유 링크에는 팀이 절대 안 나간다.** `src/share/codec.ts` 를 안 건드리는 것이 곧 울타리(§5.4).
   이미 `codec.ts:56` 이 세션 공유 시 실명·팀 라벨·`participantIds` 를 strip 한다 — 이 규칙을 유지·확장.
2. **구글 드라이브는 "사용자 소유 저장소"** 다. 제3자 서버가 아니므로 실명·등급을 실어도 지시와 어긋나지 않는다.
   다만 등급은 건강 파생 정보이므로(Classification Rules Ch.73) **내보내기 시 "등급 정보 제외" 체크박스**를 둔다.
3. **특수 등급 필드는 기본적으로 만들지 않는다.** 만들었다면 그 항목만 내보내기에서 뺄 수 있어야 한다.

---

## 4. 등급 합계·동시 출전 검증 규칙

### 4.1 SPIN 은 「인원 상한형」이지 「점수 합산형」이 아니다

| 모델 | 종목 | 규칙 |
|---|---|---|
| 점수 합산형 | 휠체어농구 | 코트 위 5인 등급 **합 ≤ 14.0**, at any given time |
| 점수 합산형 | 휠체어럭비 | 코트 위 4인 등급 **합 ≤ 8.0**(여성 완화 있음, 기전 2설) |
| **인원 상한형** | **파워체어풋볼** | **한 경기에 PF2 2명 초과 출전 불가** |
| 인원 상한형(2층) | 좌식배구 | 온코트 VS2 1명 · **스쿼드 VS2 최대 2명** |

→ **등급 합계 계산기를 만들지 않는다.** 그건 다른 종목의 규칙이다.

### 4.2 라인업 검증에 쓸 정확한 규칙 (파워체어풋볼)

확인된 것만, 문구 그대로:

| # | 규칙 | 원문 근거 | UI 처리 |
|---|---|---|---|
| R1 | 코트 위 최대 4명, 그중 **1명은 반드시 골키퍼** | Laws L315-316 | 슬롯 4칸, GK 지정 1개 필수 |
| R2 | **2명 미만이면 경기 시작·속행 불가** | Laws L315-316 · `:386` | 하한 경고는 2명. ⚠️ "4명 미만이면 경기 불가"는 **틀린 문구** |
| R3 | 선발 4 + 교체 **최대 4**(합의+주심 통보 시 증원 가능) | Laws L321-330 | 기본 8칸, **상한을 잠그지 않는다** |
| R4 | 팀시트에 없는 선수·교체는 **출전 불가** | Laws L329-330 | 라인업은 팀 명단의 부분집합이어야 함 |
| R5 | **한 경기에 PF2 를 2명 넘게 낼 수 없다** | Laws p.36 = `:1791-1792`, 정본 `ruleContent.ts:231`·`ruleTopics.ts:261` | **경기 단위 카운트.** 교체로 들어오는 3번째 PF2 도 위반 |
| R6 | **스쿼드(명단) 편성에는 등급 조합 제한이 전혀 없다** | Laws `:1793` | **명단 화면에서 PF2 수를 막지 않는다.** 명단 쪽은 "셈만 보여준다" |
| R7 | 위반 시 즉시 중단 · 해당 선수 제외 · **선수와 코치 옐로카드** · 상대 간접프리킥 · 시정 불가 시 1명 적게 | Laws `:1796-1800` | 경고 툴팁 본문 |
| R8 | 미분류(klass 없음) 선수는 이 계산에서 **PF2 로도 PF1 로도 세지 않는다** | Art.11.5.3 New(N) · Art.31.1 CNC 는 국제대회 한정, 국내 훈련은 Art.3.1 적용 밖 | 미분류는 별도 칩으로 셈만 표시 |
| — | ~~코트 위 PF1 최소 2명~~ | **규정 근거 없음** — Laws 본문에 그런 조항이 **없다**. 4인제·PF2≤2 의 산술 귀결일 뿐이고 미분류가 섞이면 성립하지 않는다 | **경고로 만들지 말 것** |

### 4.3 두 층을 서로 다른 위젯으로 (좌식배구 선례)

| 층 | 무엇을 세나 | 성격 | UI |
|---|---|---|---|
| **명단 층** | 팀 전체의 PF1·PF2·미분류 인원 | **정보** — 규정 제약 없음(R6) | 팀 헤더의 회색 칩. 경고색 금지 |
| **경기 층** | 이 세션·라인업에 낸 PF2 인원 | **규정** — 2명 초과 시 위반(R5) | 3명째에 노란 경고 + R7 툴팁. **입력을 막지는 않는다** |

**막지 않는 이유** — 기존 선례가 그렇다. `SessionEditorScreen.tsx:350-355` 는 PF2 인원을 세어
보여주되 "**참가는 제한하지 않고 셈만 보여준다**"고 코드가 명시한다. 강제 차단으로 바꾸는 것은
**기존 결정의 명시적 전복**이므로 계획서에서 따로 판단해야 한다(§7 Q6).

### 4.4 상태 배지 (등급 상태를 도입할 경우)

Art.21 이 그대로 로직이다: `C` → 뛸 수 있음 / `R-NAO` → 다음 대회 전 재분류 필요 / `R-FRD` →
**날짜까지만** / `E` → 새 Evaluation Session 전까지 불가 / `CNC` → 불가 / `New(N)` → 권고 사항.
**단** Art.3.1 상 이 전부가 **Covered Competition 한정**이므로, 국내 훈련용 앱에서는
**차단이 아니라 안내**여야 한다.

---

## 5. 코드 지도

### 5.1 명단 소비자 표

| 파일:줄 | 지금 하는 일 | 팀 도입 시 바꿔야 하나 |
|---|---|---|
| `src/model/roster.ts:1-9` | 머리말이 "팀은 하나(질문 ⑰)"라는 결정과 단일 문서 근거를 적어 둠 | **예** — 근거를 지우지 말고 각주로 뒤집는다(§6) |
| `src/model/roster.ts:15-16` | `PF_CLASSES = ['PF1','PF2']`, `PFClass` | 아니오 — 그대로 재사용 |
| `src/model/roster.ts:18-24` | `Player = {id, name, klass?, createdAt, updatedAt}` | **예** — number·isCaptain 등 추가(§3.2) |
| `src/model/roster.ts:26-30` | `Roster = {schemaVersion, players[], updatedAt}` | **예** — `Team` 이 흡수할지 병존할지 결정(§7 Q1) |
| `src/model/roster.ts:6-8` | 주석 "PF2 는 동시 출전 최대 2명 … 위반 시 페널티" | **예** — 문구 정정: "한 경기에 2명 초과 불가", 제재는 간접FK + 경고 2장(§4.2 R5·R7) |
| `src/model/roster.ts:38-55` | `addPlayer`/`updatePlayer`/`removePlayer` 순수 헬퍼 | 예 — 팀 스코프로 이동 |
| `src/storage/rosterRepo.ts:1-6,16,24,44-45,54` | meta 스토어 레코드 하나(`key:'roster'`), `postSyncEvent` | **예** — 다중 문서는 `teamRepo` 로. 손상 폴백 입도도 팀별로(§5.2) |
| `src/model/validate.ts:139-140` | `LIMITS.rosterMax = 30`, `playerNameLen = 40` | **예** — 팀당인지 전체인지 재정의(§7 Q5) |
| `src/model/validate.ts:1134-1164` | `validateRoster` — 중복 id 재발급·이름 절단·미지 klass 폐기·30명 초과분 절단 | 예 — `validateTeam` 이 같은 repair 계약을 따른다 |
| `src/model/session.ts:60-61` | `participantIds?: PlayerId[]` — 세션이 선수 id 를 **직접** 가리킴 | **예(결정 필요)** — 어느 팀 명단에서 푸나(§7 Q3) |
| `src/features/sessions/SessionEditorScreen.tsx:316-390` | `ParticipantChecklist` — 마운트 시 `loadRoster()` 1회, 전역 명단 렌더 | **예** — 팀 스코프로 |
| `SessionEditorScreen.tsx:345-348` | "지워진 선수의 id 는 participantIds 에 남을 수 있다(정상, 과거 기록)" | 아니오 — 이 교리는 유지 |
| `SessionEditorScreen.tsx:350-355` | PF2 인원을 세어 표시하되 **제한하지 않는다** | **결정 필요**(§7 Q6) |
| `src/features/settings/RosterSection.tsx:24-27,50-56,102` | 전역 명단 편집 UI + 삭제 undo 토스트(화면 단위 스냅샷 패턴) | **예** — [팀] 화면으로 이사. ⚠️ `DELETE_UNDO_TOAST_MS`(8000, `ui/Toast.tsx:26`)를 **안 쓴다** — 드릴·세션 undo 보다 짧게 사라진다. 이사하면서 통일할 것 |
| `src/model/chairLabel.ts:22-47` (`namedRosterOf` `:45`) | `cast.chairs[].name` 만 읽는다. `model/roster.ts` 를 **import 하지 않음** | **아니오** — 전역 명단과 무관(rg 로 0건 확인). 드릴 안의 "자리 이름"이지 사람이 아니다 |
| `src/features/export/ExportSheet.tsx:241` · `print/PrintDrillSheet.tsx:44` · `present/PresentRunner.tsx:328` | `namedRosterOf(...)` 소비 | 아니오 |
| `src/render/ruleOverlay.ts:122-125` | `RuleRosterEntry {id, team: TeamSide, isGk}` | 아니오 — 규칙 장면 전용 |
| `src/model/drill.ts:12,305-309,502` | `TeamSide='home'\|'away'`, `TeamStyle{label,color,gkColor}`, `teams: Record<TeamSide,TeamStyle>` — **생성 시 prefs 에서 structuredClone 복사** | **이름 충돌 주의**(§7 Q2). 팀 이름을 [팀] 메뉴에서 바꿔도 **기존 드릴에 소급되지 않는다** |
| `src/features/editor/DrillMetaSheet.tsx:132-161` | 팀 이름 편집의 **현재 유일한 자리**(판마다 따로) | **결정 필요** — [팀] 메뉴와 어느 쪽이 정본인가(§7 Q2) |
| `src/features/settings/SettingsScreen.tsx:229-237` | [팀] 섹션 은퇴 주석(2026-08-21) | 예 — 새 [팀] 메뉴는 이 옛 이름과 겹친다. 주석에 각주 추가 |
| `src/model/migrate.ts:370-373` | `ROSTER_MIGRATIONS: DocMigration[] = []` — 빈 체인도 처음부터 등록 | 예 — `TEAM_MIGRATIONS` 를 같은 방식으로 |
| `docs/PLAN-DELETE-SAFETY.md:246` | "선수 제거 — 확인도 undo 도 없다. 별건" | **문서가 낡았다** — undo 토스트는 이미 있고, 인용한 `RosterSection.tsx:80-81` 좌표도 표류(실제 삭제 버튼 `:102`, 핸들러 `:50`) |

### 5.2 저장·동기화·전송에 `team` 을 더할 때 — 파일별 변경 목록

| 파일 | 변경 | 안 하면 |
|---|---|---|
| `src/core/ids.ts:2,18` | `IdPrefix` 에 `'tm'`, `TeamId = Id<'tm'>` | 파일명 규칙(`<id>.json`)이 안 맞음 |
| `src/model/team.ts` (신규) | `Team`·`CURRENT_TEAM_SCHEMA=1`·순수 편집 헬퍼(`roster.ts` 패턴) | — |
| `src/model/migrate.ts` (373행 근처) | `TEAM_MIGRATIONS: DocMigration[] = []` | 나중에 필드가 생길 때 관문을 새로 뚫어야 함 |
| `src/model/validate.ts` (139-140 근처) | `validateTeam()`, `LIMITS.teamMax`·`teamNameLen` | 손상본이 그대로 들어옴 |
| `src/storage/db.ts:13,20-29,64` | `DB_VERSION 1→2`, `SpinDB.teams` 스토어, `if (oldVersion < 2)` 자리표시자를 채움 | — . ⚠️ **멀티탭 강제 새로고침**(`db.ts:69-78`, 3초 유예)이 따라온다 — 배포 타이밍 고려 |
| `src/storage/teamRepo.ts` (신규) | `drillRepo`/`sessionRepo` 패턴: 유일 쓰기 경로 `putTeam` · `updatedAt` 강제(`opts.touch===false` 예외) · **CAS(`expectedUpdatedAt`)** · 삭제=put+톰스톤 **같은 트랜잭션** · restore 도 한 트랜잭션 · `postSyncEvent` 는 트랜잭션 밖 1회 · `resolveTeamRepo()` 메모리 폴백 | 동기화 에코·크래시 시 삭제 사실 소실·사파리 프라이빗에서 앱 사망 |
| `src/storage/syncMeta.ts:20` | `SyncDocType` 에 `'team'` | 타입이 안 통과 |
| `src/storage/syncMeta.ts:68` | `parseKey()` 3-way 가드에 `'team'` | `sync/d/team/…` 메타 키를 **영구히 못 읽음** |
| `src/sync/drive.ts:47` | `parseSyncContainer()` 가드에 `'team'` | 원격 team 컨테이너를 전부 `invalid` 로 버림 |
| `src/sync/drive.ts:113` | `parseListed()` 가드에 `'team'` | team 파일이 `files` 에 안 잡히고 `unrecognized` 로 빠져 **원격에 방치** |
| `src/sync/store.ts:64-77` | `listLocalDocs()` — `db.getAll('teams')` 순회 추가 | 로컬 팀이 계획에 안 들어감 |
| `src/sync/store.ts:90-95` | `readDocForPush()` — `if (type==='team')` 분기 | push 불가 |
| `src/sync/store.ts:96-129` | `applyPull()` — `TEAM_MIGRATIONS`+`validateTeam` 관문 + **CAS 적용**(로스터만 단일문서라 CAS 없음) | 편집 중 pull 이 덮어씀 |
| `src/sync/store.ts:130-154` | `deleteLocalForSync()` — `else if (type==='team')` 분기(teams+meta 트랜잭션에 delete + `tombstoneRecord` + docRow 삭제) | 삭제가 전파되지 않음 |
| `src/sync/plan.ts` · `src/sync/engine.ts` | **수정 불필요** — 완전 제네릭(두 파일에 `drill`/`session`/`roster` 라는 낱말이 0건). 충돌 규칙 "최신 승(동률은 writerId 사전순)"을 자동 상속 | — |
| `src/storage/transfer.ts:32-33` | `SpinFileKind`·`KNOWN_KINDS` 에 `'team'` | 개별 내보내기 불가 |
| `src/storage/transfer.ts:47-56` | `BackupPayload.teams?: Team[]` | **백업에 팀이 안 실린다** — "백업했는데 팀이 빠졌다"는 §6.1b 가 경계한 거짓말 재발 |
| `src/storage/transfer.ts:41-45` (머리말) | "이 앱이 영구 저장하는 **네 곳**" → **다섯 곳** | 문서가 거짓말 |
| `src/storage/transfer.ts:58-64` | `SpinFile` 유니온에 team 봉투 추가(`payload: Team` 또는 `Team[]`) | — |
| `src/storage/transfer.ts:306-320` 패턴 | `exportTeamFile()`/`exportTeamsFile()` — `exportDrillFile`/`exportLibraryFile` 과 같은 꼴 | 지시의 "파일 내보내기" 미충족 |
| `src/storage/transfer.ts:330-345` | `collectBackup()` 에 teams 수집. 로스터의 "빈 배열=키 생략" 관행을 따를지는 결정(team 은 처음부터 없던 필드라 구분이 불필요) | — |
| `src/storage/transfer.ts:373-397, 464-479, 496-` | 복원. ⚠️ 로스터의 `auto/skip/replace` 3지선다는 **team 에 안 맞는다** — 다중 문서이므로 drill 식 **개별 충돌 처리**(`ImportCandidate<T>`/`ImportResolution`, `:66-73`)로 팀마다 overwrite/copy/skip | 팀 하나를 덮으려다 전부 날림 |
| `src/storage/transfer.ts:384-397` + `dataExport.ts:87-96` | `BackupRestoreReport` 에 team 필드, `backupReportLine()` 에 team 문구. ⚠️ roster 분기는 **3항이 아니라 4항**(`restored`/`unreadable`/`kept-local`/`skipped`) | 상태 하나가 말없이 사라짐 |
| `src/storage/files.ts:37-44` | `SPIN_EXT.team = '.spin.team.json'` — `Record<SpinFileKind,string>` 이라 **타입이 강제**한다(좋은 신호). 필요하면 `ACCEPT_TEAM`(`:49-50` 옆) | 컴파일 에러로 잡힘 |
| `src/features/settings/dataExport.ts:34-38` | **`OPENS_ON_LIBRARY_SCREEN` 에 team 추가는 필수**(검토 아님) — 주석 `:30-33` 에 2026-08-26 실제 사고 기록: 빠진 kind 는 "이 버전에서 지원하지 않는 파일 종류"로 흘러가 **사용자가 파일이 깨졌다고 믿는다** | 사용자 신고 재발 |
| `src/features/team/transfer.ts` (신규) | `library/transfer.ts` 패턴의 export/import 오케스트레이션 | — |
| `src/model/migrate.ts:392-393` | too-new 판정은 자동 적용(`{ok:false, reason:'too-new'}`) | — |

**세 축을 섞지 않는다**(`db.ts:1-2`, `migrate.ts:1-2`, `transfer.ts:1-10`):
스토어 신설 = `DB_VERSION`(1→2) / `Team` 필드 진화 = `CURRENT_TEAM_SCHEMA`(1→2…) /
봉투 = `ENVELOPE_VERSION`(=1 그대로, backup kind 선례).

**옛 기기가 team 파일을 만나면**: `parseListed` 가 `null` → `driveListAll` 이 `unrecognized` 에 담고
(`drive.ts:138-139`), `engine.ts:194` 는 `const { files } = …` 로 **`unrecognized` 를 아예 구조분해하지
않는다** → 계획에 안 들어간다. **삭제·덮어쓰기 없음, 그냥 무시.** 유일한 예외는 `[Drive 데이터 삭제]`
(`driveWipeAll`, `drive.ts:217-222`)로, 이건 `unrecognized` 까지 **전부 실삭제**한다(프라이버시 청소가
목적). 이 성질이 로스터 도입 당시부터였는지는 **[확인 못함]**(git blame 미조회).

### 5.3 내비·화면·도움말·튜토리얼에 더할 것

| 파일:줄 | 더할 것 | 안 하면 |
|---|---|---|
| `src/app/screens.ts:20` | `Screen` 유니온에 `'team'` | — |
| `src/app/screens.ts:30` | `RailKey` 에 `'team'` → 레일 **5칸 → 6칸** | — |
| `src/app/screens.ts:32` | `RAIL_ITEMS` 에 `sessions` 와 `rules` **사이**로 삽입 | 지시의 "세션 다음에" 불이행 |
| `src/app/screens.ts:38` | `SCREEN_TO_RAIL` 에 매핑 | `screens.test.ts:62-73` 전수 대조 실패 |
| `src/app/screens.ts` (SCREEN_TITLES / SCREEN_NAV_LABELS / **SCREEN_SUBTITLES**) | **3언어 전부**. `team` 은 board 가 아니므로 **부제도 필수**(`screens.test.ts:33-43`) | 테스트 실패 |
| `src/app/navChrome.ts:20-26` | `RAIL_ICONS`·`RAIL_NAV_TARGETS` — 둘 다 `Record<RailKey,…>` 라 **컴파일러가 강제**한다 | 컴파일 에러로 잡힘 |
| `src/app/navChrome.ts:1` (머리말) | 이미 "레일 3항목"으로 **2항목 낡음**(실제 5). team 추가로 3항목 차 | AGENTS.md 관행 위반 |
| `src/app/AppNavSegment.tsx:1,9` | 주석 "3칸"·"같은 세 항목"이 이미 낡음. `RAIL_ITEMS.map` 은 `:54` — 좁은 창 헤더 세그먼트가 같은 목록을 그린다 | 좁은 창에서 6칸의 가로 예산 미검토 |
| `src/ui/icons.tsx` | `IconTeam` **신규**(`{size = 19}` — 레일 아이콘 관례). ⚠️ `IconToolPlayer`(`:177`)가 이미 있으나 그건 편집기 [선수 추가] 툴 의미를 점유(기본 18) — 모양만 재활용해 "여럿"으로 | 두 뜻 충돌 |
| `src/app/routes.ts:53-84` `pathFor` | `case 'team'` — `Screen` 유니온 + `default` 없음이라 **컴파일러가 강제** | 컴파일 에러로 잡힘 |
| `src/app/routes.ts:88-150` `parsePath` | ⚠️ **컴파일러가 강제하지 않는다** — `switch (seg[0])` 대상이 `string` 이고 `:149-150` 에 `default: → board` 가 있다. **잊으면 새로고침·북마크·딥링크가 조용히 전술판으로 떨어진다** | 조용한 버그 |
| `src/test/routes.*` (신규 단언) | `parsePath('/team')` 왕복 단언 — **유일한 방어선** | 위 함정 무방비 |
| `src/app/App.tsx:136` | **수정 불필요** — `[{ path:'*', element:<AppShell/> }]` catch-all 하나뿐, 해시(파일 프로토콜)·브라우저 두 갈래가 같은 배열 사용 | — |
| `src/core/prefs.ts:130` | `TUTORIAL_SCREEN_KEYS` 에 `'team'` | ⚠️ `prefs.ts:206-208` sanitize 가 **배열에 없는 키를 로드 때 버린다** → 투어 시청 기록이 매 새로고침마다 증발해 **투어가 매번 다시 뜬다**(리셋 버튼 문제가 아니라 실질 버그) |
| `public/robots.txt:17-28` | `Disallow: /team`·`/en/team`·`/ja/team` 3줄 | 빈 페이지가 크롤됨. ⚠️ 근거는 "**빈 페이지 색인 방지**"이지 개인정보 보호가 아니다(Disallow 는 색인 차단이 아님) |
| `src/seo/prerenderData.ts` · `scripts/prerender.mjs:117-133` | **수정 불필요** — team 은 프리렌더·sitemap.xml 에서 자동 제외 | — |
| `src/i18n/{ko,en,ja}.ts` | 팀 화면 문구 **3벌**(현행 `settings.roster.*` 가 16/16/17개) | — |
| `src/features/help/helpContent.{ko,en,ja}.ts` | 팀 절 **3벌** + `HelpCenter` `initialSection` 키(호출 선례 `SessionEditorScreen.tsx:310`) | 도움말 공백 |
| `docs/REQUIREMENTS.md:229,236,237` | §7.1 표: 화면 키 6→7, 레일 5→6, 제목 문구 "6개 화면 키 + 5단 레일" | `docsMatchCode.test.ts:219-244` 가 `— **N개**` 문자열과 백틱 키 목록(**한글 라벨 표기까지**, 예 `` `team`(팀) ``)을 코드와 대조 → 실패 |
| `src/test/screens.test.ts:15,17-18,32,47,49,89` | `EXPECTED` 배열·"재편 후 6화면"·`toHaveLength(6)`·`RAIL_ITEMS` 단언·"레일 5단" 제목·하드코딩 루프 | 반드시 깨짐(의도된 안전망) |
| `src/test/AppShell.wiring.test.tsx` + `chromeBudget.ts:54-68` | 레일 폭은 **84 고정, 항목 수와 무관**(`AppRail.tsx:50`, `axis:'width'`) — 폭을 안 건드리면 안전. 좁은 창은 `narrow:0` | 폭을 건드리면 테스트가 잡아준다 |

### 5.4 공유 링크 울타리 — **손대지 않는 것이 곧 방어**

| 파일:줄 | 현재 | 조치 |
|---|---|---|
| `src/share/codec.ts:50-52` | `SharedDoc` 유니온이 `{kind:'drill'} \| {kind:'session'}` **둘로 닫힘** | **추가하지 않는다** — 컴파일 타임에 team 이 존재할 수 없다 |
| `src/share/codec.ts:178` | `encodeSharePayload()` 가 drill/session 삼항 | 손대지 않는다 |
| `src/share/codec.ts:247-249` | `decodeSharePayload()` 가 두 kind 만 받고 마지막 줄 `throw new ShareError('invalid')` | 손대지 않는다 — **team kind 를 `transfer.ts` 에 만들어도 링크로 들어온 team 봉투는 자동 거절**(default-deny) |
| `src/share/codec.ts:53-56, 91, 100` | 이미 공유 시 실명(`chair.name`)·팀 라벨(`teams.*.label`)·`participantIds` 를 strip. "**명단은 키째로 지운다**" | 유지·확장 — 세션에 `teamId` 가 붙으면 그것도 strip 대상인지 결정(§7 Q3) |
| `src/share/link.ts` | URL 의 id+key 만 다룸, 내용을 모름 | 손댈 지점 없음 |
| `src/features/sessions/SessionsScreen.tsx:18-20,106-109,164,169-197` | `ShareLinkModal`·`ShareLinkImportModal`·`ShareImportSheet` + `requestShareLink` 배선 | 팀 화면은 **이 콜백 자체를 만들지 않는다**. 세션 카드를 본뜰 때 케밥의 [공유 링크] 항목 제거 |
| `server/share` | 서버가 team 요청을 어떻게 다루는지 — **[확인 못함]**(조사 범위 밖). 서버는 opaque blob 만 저장하므로 클라이언트 울타리가 유일한 방어선 | — |

→ **PLAN-TEAM.md 와 구현 커밋 메시지에 "왜 team 은 `share/codec.ts` 를 안 건드리는가"를 명시할 것.**
안 그러면 나중에 "왜 팀은 공유 안 돼?"라는 질문에 코드가 스스로 답을 못 한다.

---

## 6. 뒤집히는 옛 결정

> `spin-reverse-old-decisions.md` 원칙: **근거는 지우지 말고 남긴 채 뒤집는다.** 전제가 언제 죽었는지 적는다.

| 문서:줄 | 옛 결정 | 원문 인용 | 이번 지시가 바꾸는 것 |
|---|---|---|---|
| `ROADMAP.md:354-355` | UI 위치는 설정 안 | "**왼쪽 레일이 아니라** [설정] 위의 팀 전환기 하나로 시작하고, 명단·팀색은 설정에서 그리로 옮긴다." | **왼쪽 레일 [팀] 메뉴로 프로모션.** 옛 글이 명시적으로 배제한 바로 그 자리 |
| `src/model/roster.ts:1` | 팀은 하나 | "로스터 — 팀 선수 명단 (2026-08-18 구조 개편, 질문 20문 ⑬·⑰: **단일 팀**)." | **1개 팀 이상.** 각주로 뒤집되 원문 보존 |
| `src/model/roster.ts:3-5` | 단일 문서 저장 | "**왜 단일 문서인가**: 팀은 하나(질문 ⑰)라 목록 쿼리·인덱스가 필요 없다. 그래서 저장도 새 IDB 스토어가 아니라 meta 스토어의 레코드 하나다 — 스토어를 파면 DB_VERSION 상승 + onupgradeneeded + 멀티탭 blocked 처리가 따라오는데 **문서 하나에 과하다**." | **전제가 죽는다.** 그 비용이 이제 청구된다(§5.2) |
| `src/storage/rosterRepo.ts:1-6` | meta 레코드 하나 | 같은 근거를 반복 | `teamRepo` 신설. 손상 폴백 입도도 팀별로 |
| `src/storage/syncMeta.ts:19` | 동기화 id 고정 | "roster 는 단일 문서라 id 를 'roster' 하나로 고정해 쓴다" | team 은 `tm_…` 다건 |
| `src/sync/store.ts:70-71` | 빈 명단 특례 | "저장된 적이 있을 때만 목록에 넣는다. `emptyRoster()` 폴백(updatedAt 0)을 문서로 취급하면 **빈 명단이 원격의 진짜 명단과 겨루게 된다**" | 팀별 문서에서는 **"빈 팀"이 정당한 상태**가 되므로 이 특례의 근거가 흔들린다 — 재설계 대상 |
| `src/sync/store.ts:121-123, 131` | 로스터는 CAS 없음 / 삭제 없음 | "명단에는 삭제 경로가 없다(비우기도 put) — 올 수 없는 액션" | team 은 **삭제가 있는 다중 문서** → CAS + 톰스톤 필요 |
| `src/features/settings/SettingsScreen.tsx:229-237` | [팀] 섹션 은퇴 | "[팀] 섹션은 2026-08-21 통째로 은퇴했다 … 팀 **이름**은 드릴 편집 ⓘ [드릴 정보] 시트에서 **판마다** 고친다(§0.5)" | 새 [팀] 메뉴가 **옛 이름과 겹친다.** 팀 이름의 정본이 어디인지 재결정(§7 Q2) |
| `docs/PLAN-2026-08.md:636` | 감사 B6 미배송 | "⬜ 7.2 **팀 이름·골키퍼 색 입력**" | 그 완료 판정이 지목한 자리(설정 [팀])가 **사라졌다.** [팀] 메뉴가 이 빚을 물려받는다 |
| `docs/PLAN-DELETE-SAFETY.md:246` | 선수 제거는 별건 | "**선수 명단에서 선수 제거**(`features/settings/RosterSection.tsx:80-81`) — 확인도 undo 도 없다. 같은 부류지만 이번 신고 범위 밖. **별건**." | **문서가 낡았다** — undo 토스트는 이미 있고(`RosterSection.tsx:50,102`) 인용 좌표도 표류. 팀 삭제 설계 시 좌표부터 갱신 |
| `docs/DESIGN.md:834` | 스키마 도장 8 | "`CURRENT_DRILL_SCHEMA = 8`" — 같은 문서 `:906` 이 "**v1 시점 값**"이라 자백, 실제는 **11**(`DESIGN.md:60`) | 스키마 계획의 기준을 8 로 잡으면 안 됨 |
| `ROADMAP.md:358-361` | 모바일 유료화 | "…모바일 앱(0.7 이후)에서만 일부 유료로 전환… **데스크톱·웹은 계속 무료다**" | **변경 아님.** 이번 지시에 유료화 언급이 없고, 웹 무료는 이미 옛 글의 결정이다 |
| — | 공유 링크 제외 | ROADMAP 340-361 에 **팀 공유 링크 언급 자체가 없다** — 침묵을 일치로 읽을 수 없음 | 이번 지시가 **새로 못박은 것**. 근거는 ROADMAP 이 아니라 `share/codec.ts:56`(이미 팀 이름을 strip) |

---

## 7. 계획자가 결정해야 할 질문

각 질문에 **추천안 하나**와 근거를 붙인다. 반박에서 「빠진 것(missing)」으로 올라온 항목을 모두 반영했다.

### Q1. 기존 단일 명단(`Roster`)을 어떻게 이주시키나
- **추천**: `Team` 을 새로 만들고 `Team.players: Player[]` 로 명단을 **흡수**한다. 앱 첫 실행 시
  기존 `Roster` 를 **"내 팀"(로케일 기본 이름) 한 개**로 이주시키고, `rosterRepo`/`SyncDocType='roster'`
  는 **한 릴리스 동안 읽기 전용으로 남긴다**(백업 봉투의 `roster?` 키 하위호환).
- **근거**: `Player` 타입·`PF_CLASSES`·`validateRoster` repair 계약을 전부 재사용한다.
  `ROSTER_MIGRATIONS` 는 **필드 진화용**이지 "문서 하나 → 컬렉션" 재편용이 아니다
  (그 해석 자체는 코드 주석에 없는 **추정**이므로 계획서에서 명시적으로 판단할 것).
  즉시 폐기하면 옛 기기·옛 백업이 명단을 잃는다.

### Q2. 이름 충돌 — 새 엔티티를 뭐라 부르나, 팀 이름의 정본은 어디인가
- **추천**: 코드 식별자는 **`Team`/`teams`** 를 쓰되, 드릴 내부의 `TeamStyle`/`TeamSide` 는
  주석으로 "코트 진영"임을 재확인하고 필요하면 `SideStyle` 로 개명 검토. **UI 라벨은 [팀] 하나**로 통일.
  팀 이름의 정본은 **[팀] 메뉴**로 하되, `drill.teams[side].label` 은 **생성 시점 스냅샷 그대로 유지**
  하고 "이 판의 팀 이름은 만들 때 복사된 값"이라는 안내를 `DrillMetaSheet` 에 남긴다.
- **근거**: `drill.ts:502` 가 `structuredClone` 복사라 **소급이 구조적으로 불가**하다
  (`PLAN-2026-08.md:652`: "생성 시점 스냅샷이라 이미 만든 드릴에는 안 닿는다").
  2026-08-21 에 "소급 대신 기능 제거"로 닫은 전례가 있으므로 같은 판단을 반복한다.

### Q3. 세션 참가자 체크는 어느 팀 명단을 읽나
- **추천**: `session.teamId?: TeamId`(선택)를 추가하고, `ParticipantChecklist` 는
  ①`teamId` 가 있으면 그 팀 명단 ②없으면 **"팀 선택" 드롭다운을 먼저 띄운다**.
  `participantIds` 는 **id 그대로 유지**(팀 접두사 도입 없음).
- **근거**: ROADMAP.md:354 가 이미 "teamId 를 **선택적으로**"라고 정했다. 지시의
  "드릴·세션에 종속되지 않음"은 **팀→세션 방향의 독립성**이지, 이미 존재하는
  세션→선수 참조(`session.ts:61`)를 없애라는 뜻이 아니다.
  "지워진 선수 id 가 남는 건 정상"(`SessionEditorScreen.tsx:345-348`) 교리도 그대로 유지된다.
  ⚠️ 곁가지 결정: **`teamId` 도 공유 링크에서 strip 할 것인가** — 추천은 **예**(팀 이름·명단을 이미 지우므로).

### Q4. 팀 전환 UI 는 어떻게 두나
- **추천**: [팀] 화면은 **목록 + 상세** 2단(드릴 라이브러리 패턴). 화면 간 "현재 팀" 전역 상태는
  **만들지 않고**, 세션 편집·라인업처럼 팀이 필요한 자리에서만 드롭다운으로 고른다.
- **근거**: 전역 "현재 팀"은 모든 화면의 상태가 되어 드릴·전술판까지 오염시킨다.
  ROADMAP 의 "팀 전환기 하나로 시작"은 **설정 안에 팀 화면이 없던 시절**의 절충안이고,
  독립 메뉴가 생기면 필요가 사라진다.

### Q5. 상한(LIMITS)을 어떻게 재정의하나
- **추천**: `rosterMax: 30` 은 **팀당 30명**으로 못박고, `teamMax` 를 **10개**로 새로 둔다
  (`teamNameLen: 40`, `shortNameLen: 6`).
- **근거**: `validate.ts:139` 의 근거 주석("playersNeededMax 와 같은 근거 — 코트 8 + 교체·피더")이
  **이미 팀당을 전제**한 수다. 최악 300명 × 선수 레코드는 Drive 문서·백업 봉투에 무리 없는 크기.
  팀 개수 상한은 UI(목록 스크롤)와 동기화 파일 수를 위한 안전판.

### Q6. 라인업 검증을 강제하나, 셈만 보여주나
- **추천**: **셈 + 경고만. 입력을 막지 않는다.**
- **근거**: ①`SessionEditorScreen.tsx:350-355` 가 이미 "참가는 제한하지 않고 셈만 보여준다"는
  선례를 세웠다 — 뒤집으려면 명시적 판단이 필요하다. ②Classification Rules Art.3.1 상
  등급 규정은 **Covered Competition 한정**이라 국내 훈련에는 적용되지 않는다.
  ③Laws `:1793` 이 **명단 단계의 등급 제한을 명시적으로 부정**한다 — 명단 화면에서 막으면 규정 왜곡.

### Q7. 등급 상태 어휘를 쓸 것인가, 쓴다면 어느 쪽인가
- **추천**: **0.7 첫 배송에서는 등급 상태를 넣지 않는다.** `klass`(PF1/PF2/미분류)만 유지.
  넣게 되면 **Laws 어휘(N/R/C)** 를 쓰고, R 을 고르면 날짜 입력을 **같이 요구**한다.
- **근거**: 같은 연맹의 두 공식 문서가 다른 어휘를 쓰고(Classification Rules C/R-NAO/R-FRD/E vs
  Laws N/R/C), **국내(KPSA/KPC)가 어느 쪽을 쓰는지는 [확인 못함]** 이다.
  코치가 매일 쓰는 앱에 국제 심사 상태를 넣는 것은 과설계 위험이 크고,
  Master List 최소 필드에도 판정일·카드번호는 없다. R-FRD 를 쓸 거면 날짜는 **선택이 아니라 필수**
  (Art.21.2.2 — 날짜가 곧 출전 만료일)라는 점만 계획서에 남긴다.

### Q8. 색·약칭·인쇄를 어디까지
- **추천**: `color` + `gkColor` + `shortName` 셋 다 팀 필드로 두고, **팀시트 인쇄를 첫 배송에 포함**한다
  (이름 + 등번호 + 등급 칩, 등급은 **인쇄에서 제외 가능**).
- **근거**: `gkColor` 는 규정 필수(Laws L490-491)인데 **지금 그 값을 만들 UI 가 0곳**이다 —
  [팀] 메뉴가 `PLAN-2026-08.md:636`(감사 B6)의 빚을 물려받는다. 팀시트는 Laws L329-330 상
  **규정으로 실재하는 문서**이고, Coach Joel's 등 실무 도구의 공통 산출물이다.
  ⚠️ 선수 실명이 종이·PNG 에 나가는 것은 **현재 막혀 있고 그 사실을 지키는 테스트가 산다**
  (`src/test/chairNameChannels.test.ts:69,78`) — 팀시트는 **드릴 인쇄와 다른 채널**임을 명확히 하고
  그 테스트를 건드리지 않도록 설계할 것.

### Q9. 시즌·연령대 스쿼드를 어떻게 푸나
- **추천**: 별도 엔티티를 만들지 말고 **`team.season` 라벨 + 팀 복제(Duplicate)** 로 푼다.
- **근거**: Spond 는 하위그룹으로 풀지만 그건 다중 사용자 초대 시스템이 있어서다.
  단일 사용자 앱에서 계층을 하나 더 파면 목록·동기화·삭제 안전망이 전부 두 배가 된다.
  팀 10개 상한(Q5) 안에서 "2026 U18" 같은 이름으로 충분하다.

### Q10. 의료 정보·미성년자를 어떻게 다루나
- **추천**: **구조화된 의료·보호자 필드를 만들지 않는다.** 선수 `note` 자유 텍스트 하나만 두고,
  그 입력칸 아래 "의료·개인정보는 적지 마세요" 안내를 붙인다. 생년월일은 **연도만**(선택).
  내보내기 대화상자에 **"등급 정보 제외"** 체크박스를 둔다.
- **근거**: ①Classification Rules Ch.73 이 건강정보를 Sensitive Personal Information 으로 다룬다.
  ②COPPA 리스크는 저장 방식(local storage)이 아니라 **수집 자체**에서 온다 —
  "지속식별자" 조항은 "여러 사이트에 걸친 추적"이 조건이라 SPIN 의 로컬 저장은 사정거리 밖.
  ③TeamSnap 의 "필드 단위 비공개"는 다중 사용자 앱의 해법이고, 단일 사용자 앱에서는
  **애초에 안 만드는 것**이 더 강한 보호다. ④Master List 조차 출생**연도**까지만 요구한다.

### Q11. 팀 삭제의 안전망은
- **추천**: **드릴·세션 삭제와 같은 표준**(확인 모달 + `DELETE_UNDO_TOAST_MS` 8초 undo + 톰스톤).
  같은 커밋에서 `RosterSection` 의 선수 삭제 토스트도 8초 상수를 쓰도록 통일한다.
- **근거**: `RosterSection.tsx:52-54` 는 `durationMs` 를 안 넘겨 기본값으로 뜬다 —
  드릴·세션 undo(8000, `ui/Toast.tsx:26`)보다 **짧게 사라진다.** 팀 삭제는 선수 전원이 딸려 가므로
  선수 하나 삭제보다 무겁다. `PLAN-DELETE-SAFETY.md:246` 의 좌표는 이미 표류했으니 같이 고친다.
  ⚠️ **참조 무결성**: 팀을 지우면 그 선수를 `participantIds` 에 담은 세션이 남는다 —
  "과거 기록이라 정상"(`SessionEditorScreen.tsx:345-348`) 교리를 팀 단위로도 확장할지 판단.

### Q12. 손상 폴백의 입도
- **추천**: **팀별 문서**(문서 하나 = 팀 하나). 한 팀이 손상돼도 나머지는 산다.
- **근거**: `rosterRepo.ts:17-19` 는 손상 시 빈 명단을 돌려주되 **되쓰지 않는다**.
  단일 문서에 여러 팀을 담으면 한 팀의 손상 = **전 팀 소실**로 보인다.
  요약(summary) 스토어는 만들지 않는다 — `drillSummaries` 는 200건 규모를 전제한 것이고,
  팀은 수 개~수십 개라 `sessions` 패턴(`db.ts:23-27`, store 자체를 `getAllFromIndex`)이 맞다.

### Q13. 스태프를 첫 배송에 넣나
- **추천**: **넣는다. 단 최소로** — 이름 + 역할(복수) + 대표 코치 플래그 + 선수 겸직 연결.
- **근거**: Tech Supp `:252-258` 이 역할 목록의 1차 근거를 준다(coach/assistant/doctor/carer/mechanic).
  Laws L987(선임 코치 제재 승계)·L1554(코치 겸 선수)는 **플래그와 겸직 연결이 없으면 표현 불가**한
  규정 사실이다. 자격증·유효기간은 국가연맹 관례일 뿐이라 넣지 않는다.

### Q14. 아직 못 확인한 것 (계획 전 확인할지 판단)
- FIPFA **Competition Regulations** / 월드컵 entry form — **[확인 못함]**. 팀시트 서식의 실제 칸을 알려면 필요.
- KPSA·KPC **국내 등급판정 절차·서식·국제등급 인정 관계** — **[확인 못함]**. Q7 의 어휘 결정에 직결.
- `PF3` 의 정의 — **[확인 못함]**. 값 목록에서 제외하는 것으로 회피.
- Tauri 셸에서 `<a download>` 의 실제 저장 동작 — **[확인 못함]**(코드 분기 없음만 확인). 실기 검증 필요.
- `server/share` 가 team 요청을 어떻게 다루는지 — **[확인 못함]**(범위 밖).
- 테스트 파일이 `'drill'|'session'|'roster'` 3-way 를 하드코딩해 새 타입 추가 시 깨지는지 — **[확인 못함]**.
- 도움말·튜토리얼 문구 3벌의 분량 — 설계 시 산정.

---

## 8. 출처

### 1차 규정 문서 (PDF, 전문 추출 후 대조)
- FIPFA Laws of the Game 2025 — https://fipfa.org/wp-content/uploads/2025/06/FIPFA-Laws-of-the-Game-2025.pdf
- FIPFA 2025 Classification Rules — https://fipfa.org/wp-content/uploads/2026/04/FIPFA-2025-Classification-Rules.pdf
- FIPFA Technical Supplement 2020 — https://fipfa.org/wp-content/uploads/2021/11/FIPFA-Technical-Supplement-2020.pdf
- (참고, 아직 유통 중) FIPFA Laws of The Game 2021 — https://fipfa.org/wp-content/uploads/2021/11/FIPFA-Laws-of-The-Game-2021.pdf
- 목록 페이지 — https://fipfa.org/laws-of-the-game/

### 타 종목·관례
- ActiveSG 휠체어농구 — https://www.activesgcircle.gov.sg/learn/basketball/what-is-wheelchair-basketball
- VIS 휠체어농구 해설 — https://vis.org.au/explainer-wheelchair-basketball/
- Wikipedia 휠체어럭비 분류 — https://en.wikipedia.org/wiki/Wheelchair_rugby_classification
- NCHPAD 휠체어럭비 — https://www.nchpad.org/resources/wheelchair-rugby/
- lexi.global 좌식배구 — https://lexi.global/sports/sitting-volleyball
- USPSA 등록 — https://www.powersoccerusa.org/members/registration
- USPSA PowerHub(선수 프로필·통계 필드)
- TeamSnap Help 109(필드 단위 비공개) — https://helpme.teamsnap.com/article/109-making-roster-information-private
- Spond Help — 하위그룹 초대 https://help.spond.com/app/en/articles/131166-invite-and-add-members-to-main-groups-and-subgroups · 출결·다운로드 https://help.spond.com/app/en/articles/131887-register-attendance-and-download-attendance-history-in-the-spond-app · 라인업 https://help.spond.com/app/en/articles/203931-line-up-feature-for-football-matches
- SquadGod(드래그 라인업·등번호·포메이션)
- Coach Joel's(등번호 → 포지션 → PDF 라인업 카드)
- Usercentrics COPPA · GDPRLocal COPPA

### 로컬 정본 문서
- `docs/RULES-FIPFA-2025.md`(한글 요약본) — ⚠️ GK 식별색 조항 누락(§2.1)
- `docs/RULES-FIPFA-2025.en.md`(영문)
- `README.md:155` — **"PF1·PF2 등급 이름, 「코트 위 PF2 최대 2명」… 은 원문 PDF 확보 후 정본 보강이 선행돼야 한다(역순 금지)"** → 설계 전에 반드시 읽을 프로젝트 정책
- `ROADMAP.md:349-361` · `docs/DESIGN.md:833,851,867,1110` · `docs/PLAN-2026-08.md:636,639,652`
  · `docs/PLAN-DELETE-SAFETY.md:246` · `docs/REQUIREMENTS.md:229,236,237` · `CHANGELOG.md:190`

### 코드 (devel @ 0c69f2f)
`src/model/roster.ts` · `src/model/session.ts:61` · `src/model/drill.ts:12,305-309,502` ·
`src/model/validate.ts:139-140,1134-1164` · `src/model/migrate.ts:370-373,392-393` ·
`src/model/chairLabel.ts` · `src/core/ids.ts:2,18` · `src/core/prefs.ts:130,206-208` ·
`src/storage/rosterRepo.ts` · `src/storage/db.ts:13,20-29,53-65,69-78` · `src/storage/syncMeta.ts:19-20,68` ·
`src/storage/transfer.ts:32-33,41-56,58-64,306-320,330-345,373-397,464-479,496-` · `src/storage/files.ts:37-50` ·
`src/sync/drive.ts:9,47,109-120,113,138-139,217-222` · `src/sync/store.ts:64-77,90-95,96-129,130-154` ·
`src/sync/plan.ts` · `src/sync/engine.ts:194` · `src/share/codec.ts:50-52,53-56,91,100,178,247-249` ·
`src/share/link.ts` · `src/app/screens.ts:20,30,32,38` · `src/app/routes.ts:53-84,88-150` ·
`src/app/App.tsx:136` · `src/app/navChrome.ts:20-26` · `src/app/AppNavSegment.tsx:1,9,54` ·
`src/app/chromeBudget.ts:54-68` · `src/app/AppRail.tsx:50` · `src/ui/icons.tsx:177` · `src/ui/Toast.tsx:26,32` ·
`src/features/settings/RosterSection.tsx:24-27,50-56,102` · `src/features/settings/SettingsScreen.tsx:229-239` ·
`src/features/settings/dataExport.ts:30-38,87-96` · `src/features/sessions/SessionsScreen.tsx:18-20,106-109,164,169-197` ·
`src/features/sessions/SessionEditorScreen.tsx:310,316-390,345-355` · `src/features/editor/DrillMetaSheet.tsx:132-161` ·
`src/features/rules/ruleContent.ts:86,231` · `src/features/rules/ruleTopics.ts:261` ·
`src/seo/prerenderData.ts` · `scripts/prerender.mjs:117-133` · `public/robots.txt:17-28` ·
`src/test/screens.test.ts:15,17-18,32,47,49,62-73,89` · `src/test/docsMatchCode.test.ts:219-244` ·
`src/test/chairNameChannels.test.ts:69,78` · `src/test/AppShell.wiring.test.tsx`
