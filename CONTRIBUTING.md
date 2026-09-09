# 기여 안내

SPIN 에 기여해 주셔서 고맙습니다. **기여자는 언제든 환영합니다** — 코드, 번역, 규칙 고증,
버그 제보, 접근성 지적, 어느 쪽이든 좋습니다.

한국어·영어·일본어 아무 언어로나 이슈와 PR 을 여셔도 됩니다.
([English section below](#english))

## 먼저 이슈를 열어 주세요

작은 오타 수정이 아니라면 **PR 보다 이슈가 먼저입니다.** 무엇을 왜 고치려는지 한 문단이면
충분합니다. 이 저장소는 "왜 이렇게 만들었는가"를 문서에 길게 적어 두는 편이라, 코드만 보고
판단하면 이미 검토하고 버린 길을 다시 걷게 되는 일이 있습니다.

- 버그 제보에는 **재현 절차·기대한 동작·실제 동작**을 적어 주십시오. 브라우저와 OS, 그리고
  터치·키보드 중 어느 입력으로 만졌는지가 특히 중요합니다.
- 기능 제안은 [ROADMAP.md](ROADMAP.md) 를 먼저 보십시오. 이미 "하지 않기로 한 것" 목록에
  들어 있을 수 있고, 그 경우 거기 이유가 적혀 있습니다.

## 브랜치와 커밋

- 기준 브랜치는 **`devel`** 입니다. `main` 이 아니라 `devel` 에서 갈라 `devel` 로 PR 하십시오.
- 커밋 제목은 `type(scope): 설명` 꼴입니다.
  type 은 `feat fix docs content refactor chore test style build` 중 하나,
  scope 는 기능 폴더 이름(`rules editor app sync settings present library sessions board ui
  physics render export i18n seo` 등)이고 저장소 전체에 걸치면 생략합니다.
- 커밋 하나는 **기능 하나 + 그 기능이 건드린 문서·테스트 전부**입니다. 문서만 따로, 테스트만
  따로 커밋하지 않습니다.
- 본문에는 무엇을 왜 바꿨는지와 밟은 함정을 남겨 주십시오. 나중에 그 커밋을 읽는 사람이
  결정을 되짚을 수 있어야 합니다.

## PR 을 열기 전에 통과시켜야 하는 것

```bash
npm run typecheck    # 타입 오류 0
npm run lint         # 새 경고 0 (기존 경고는 그대로 둡니다)
npx vitest run       # 전체 초록
```

린트는 오래된 경고가 남아 있습니다. **내가 새로 만든 경고가 없으면 통과**이고, 바꾼 파일만
빠르게 보려면 `npm run lint:rel`, 관련 테스트만 돌리려면 `npm run test:rel <파일>` 을 쓰십시오.

## 이 저장소의 규율

자세한 관행은 [AGENTS.md](AGENTS.md) 가 정본입니다. PR 을 낼 계획이라면 한 번 읽어 주십시오.
특히 자주 걸리는 것 넷:

1. **접근성은 출시 조건입니다.** 키보드만으로 닿지 않는 기능, 초점이 보이지 않는 컨트롤,
   스크린리더가 읽지 못하는 상태 변화는 미완성으로 봅니다. 대비비와 터치 목표 크기도
   마찬가지입니다. 배경은 [docs/OVERVIEW.md](docs/OVERVIEW.md) §3 에 있습니다.
2. **세 언어를 함께 넣습니다.** 화면에 보이는 문구를 추가하면 한국어·영어·일본어 세 벌을
   같은 커밋에 넣습니다. 한 언어만 있는 문구는 머지하지 않습니다.
3. **시연 콘텐츠는 편집기로 만듭니다.** 체어·공 위치, 스텝 이동, 타이밍 같은 연출 값은
   **손으로 적지 않습니다.** 앱의 드릴 편집기로 만들어 내보낸 JSON 을 파이프라인
   (`scripts/import-rule-scene.mjs`)으로 앉힙니다. 찍힌 `.scene.ts` 는 손으로 고치지 않습니다 —
   드리프트 검사가 영구 불일치로 죽습니다. (AGENTS.md §5)
4. **정본은 한 벌만 둡니다.** 같은 사실을 두 파일에 적지 않습니다. 문서를 고칠 때 어느 쪽이
   정본인지 [AGENTS.md §0](AGENTS.md) 의 지도를 보고 정하십시오.

## 비밀값

`.env.local` 과 `.env.deploy` 는 커밋되지 않습니다. 키 이름은 각각 `.env.example` ·
`.env.deploy.example` 에 있고, **값은 어떤 파일에도 적지 마십시오.** 구글 OAuth 클라이언트는
기여자가 각자 Google Cloud Console 에서 발급합니다.

취약점을 발견하셨다면 이슈가 아니라 [SECURITY.md](SECURITY.md) 의 절차를 따라 주십시오.

## 행동 규범

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 를 따릅니다. 이 앱은 장애인 스포츠를 위한
도구입니다 — 그 자리에 어울리는 태도로 이야기해 주십시오.

---

<a name="english"></a>

## English

Contributions are welcome, always. Issues and pull requests in Korean, English, or Japanese
are all fine.

- **Open an issue first** unless it is a trivial typo fix. This repository records *why*
  decisions were made at length; reading the code alone can lead you down a path that was
  already considered and rejected. Check [ROADMAP.md](ROADMAP.md) before proposing a feature.
- **Branch from `devel`**, not `main`, and target `devel` in your PR.
- **Commit titles** follow `type(scope): description`, where type is one of
  `feat fix docs content refactor chore test style build`. One commit is one change plus
  every doc and test it touches.
- **Before opening a PR**, `npm run typecheck` must report zero errors, `npm run lint` must
  add no new warnings (pre-existing ones are expected), and `npx vitest run` must be green.
- **Accessibility is a release condition.** Anything unreachable by keyboard, without a
  visible focus ring, or invisible to a screen reader is considered unfinished.
- **Three languages ship together.** Any user-visible string needs Korean, English, and
  Japanese in the same commit.
- **Demonstration content is authored in the app**, not hand-coded. Chair and ball positions,
  step motion, and timing come from the drill editor via
  `scripts/import-rule-scene.mjs`; do not hand-edit the generated `.scene.ts` files.
- **Never commit secrets.** `.env.local` and `.env.deploy` are ignored; only the key names
  live in `.env.example` and `.env.deploy.example`. Bring your own Google OAuth client.

The full working conventions live in [AGENTS.md](AGENTS.md) (Korean). Security reports go
through [SECURITY.md](SECURITY.md), and everyone here follows the
[Code of Conduct](CODE_OF_CONDUCT.md).
