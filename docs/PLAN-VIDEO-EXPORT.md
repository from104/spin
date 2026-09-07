# PLAN — 드릴 영상(MP4) 내보내기 (2026-09-08)

기현님 지시(2026-09-08, 원문): *"gif 움짤. mp4 중 뭐가 영상 내보내기로 자원이 덜 들거나 구현이 간단할까? 그리고 영상 용량도
고려사항"* → 판단 보고 후 *"mp4쪽으로 가자 workflows"*.

이 문서가 정본 계획서다. 상위 정본은 `AGENTS.md`(특히 §2 뒤집기 절차·§5 장면은 편집기로·§6 검증) 와 `docs/RENDER-PARITY-2026-09-06.md`
(네 경로 일치). 조사(sonnet 3 + opus 검증 1, 2026-09-08) 의 확인 사항은 §0.

## 0. 뒤집는 옛 결정 둘 (AGENTS §2)

| 옛 결정 | 어디 | 전제가 죽은 때 | 이번 결정 |
|---|---|---|---|
| "WebM/MP4 는 하지 않는다 — 인코더 크기와 재생 호환이 GIF 의 몫을 못 한다" | `ROADMAP.md:308` (2026-09-07) | 같은 날 저녁 재검토. 전제 ①인코더 크기: ffmpeg.wasm(30 MB) 기준이었다. 브라우저 내장 WebCodecs + 트리셰이킹 muxer 는 수십 KB 이고 **동적 import 로 메인 번들에 0 바이트**. ②재생 호환: H.264 MP4 는 카톡·인스타·X·iOS 전부 그대로 올라간다 — 자동 재생만 GIF 의 몫. ③용량: 같은 10초에 GIF 4~7 MB vs MP4 0.5~1.5 MB | MP4(H.264) 먼저. GIF 는 같은 프레임 파이프라인 위에 2차(로드맵 잔류) |
| "런타임 deps 는 idb/matter-js/react(+react-dom) 뿐" — jspdf 류 배척 | `docs/PLAN-2026-08.md:667` (2026-08) | 배척 사유는 dist 4.2 MB 중 폰트 3.9 MB 라는 용량이었다. `mediabunny` 는 zero-dep·MPL-2.0·트리셰이킹이고 **내보내기 청크에만** 실린다(§1 결정 3). 메인 번들 크기는 검수 §5 에서 증명 | 예외 하나 더: `mediabunny` (react-router 선례 C4 와 같은 결) |

옛 문장은 지우지 않고 ⚠️ 2026-09-08 표식으로 남긴다(문서 담당 §2-C).

## 0.1 조사로 확인된 사실 (근거는 조사 저널, 요지만)

- `buildStaticScene(frame: RenderFrame, opts, order)` 는 **이미 트윈 중간 프레임을 받는다** — `sampleDrill(drill, t, {baseMs, transitionMs, loop})` 의 반환을 그대로 넣으면 된다. PNG 경로만 `interpolateSteps(step, step, 1)` 로 항등 프레임을 굽고 있었을 뿐이다.
- 프레임에 **없는** 것 셋은 도착 스텝(`frame.stepIndex`) 에서 따로 가져온다: 작도 도형 `steps[i].shapes`, 표시순서 `sceneOrder(steps[i], cast)`, 캡션 글(스텝 이름·n/N). 시연(PresentStage)도 정확히 이렇게 한다.
- 트윈 구간은 세 갈래(보통 `transitionMs` / `seamless` 는 스텝 전체 / `cut` 은 계단) — **손으로 재계산하지 않는다**, `sampleDrill` 이 전부 안다.
- `renderPaths.ts` 의 present·png 행은 17요소 전부 동일. 영상은 png 행을 그대로 쓴다 — 새 행 없음(집행 테스트는 `<CourtSurface` 를 가진 파일만 본다).
- 크기: `staticSceneMetrics` 는 긴 변 = 1024×resolution, `resolution?: 1|2` 로 잠겨 있고 12조합 중 10조합이 **홀수 높이**. H.264(yuv420p)는 짝수 치수가 필요하다.
- 캡션 유무·실명 유무가 `captionH`(0/46/66) → 전체 높이를 바꾼다. 영상은 전 프레임 해상도가 같아야 한다.
- 저장: `storage/files.ts downloadBlob` = `navigator.share` 가능하면 공유 시트, 아니면 앵커. 웹/Tauri 분기 없음. `isDesktop()` 은 `sync/authDesktop.ts` 에 있다.
- `rasterize.ts` 의 출구는 `canvas.toBlob(png)` 하나 — 영상용 캔버스 출구가 없다. 글자는 SVG 밖에서 `paintTexts` 가 캔버스에 직접 그리고, 폰트 대기는 최대 1.5초.
- TS 6.0.3 `lib.dom` 에 `VideoEncoder` 있음. 워커·OffscreenCanvas·WebCodecs 선례 0건. vitest 는 jsdom 뿐 — 인코딩은 CI 에서 못 잰다.
- 진행률 UI 없음. 로더 계약이 진행 막대를 금한 사유는 "재지 않는 진행 표시는 거짓" — 인코딩은 프레임 수를 정확히 알므로 해당 없음.
- 데스크톱 CSP: `media-src blob:` 허용(미리보기 가능), 워커 `blob:` 은 불가(워커 안 씀). `ExportSheet` 항목 3개(PNG·인쇄·링크), 시트 안에서 옵션 늘리기는 허가된 자리.
- 브라우저: WebCodecs = Chrome·Edge 94+, Firefox 130+, Safari 16.4+(영상만), **Android Firefox 미지원**(caniuse 2026-09). H.264 인코딩 가능 여부는 런타임에 `canEncode('avc')` 로 묻는다.

## 1. 결정 (기본값 — 뒤집기 쉽게 근거와 함께)

| # | 결정 | 근거 |
|---|---|---|
| 1 | **파이프라인**: `sampleDrill(t)` → `buildStaticScene(frame, opts, order)` → `svgDataUri` → `Image` → 캔버스 하나에 `drawImage` + `paintTexts` → `CanvasSource.add(t, 1/fps)`. 캔버스 1장 재사용, 순차(await), 워커 없음 | SVG 디코드는 DOM `Image` 가 필요해 워커에서 못 한다. PNG 경로의 "순차로 굽는다" 원칙(ExportSheet.tsx:201) 그대로 |
| 2 | **인코딩**: WebCodecs + `mediabunny`(`Output` + `BufferTarget` + `Mp4OutputFormat({fastStart:'in-memory'})` + `CanvasSource(canvas, {codec:'avc', quality: new Quality({bitrate})})`). 코덱은 `avc` 하나. `canEncode('avc')` 가 false 이거나 `VideoEncoder` 가 없으면 항목을 **비활성 + 사유 문구**(i18n `export.video.unsupported`) | H.264 가 카톡·iOS·인스타의 공통분모. VP9-in-MP4 는 iOS 가 못 열어 대안이 못 된다. `fastStart` 는 모바일 스트리밍 재생용(moov 앞) |
| 3 | `mediabunny` 는 **동적 `import()`** 로만 불러 별도 청크에 둔다. 정적 import 금지. 메인 청크 크기 변화 0 을 검수가 증명 | §0 둘째 뒤집기의 전제. 내보내기 안 하는 사용자는 1바이트도 안 받는다 |
| 4 | **타이밍**: fps 30 고정. `baseMs = PLAYBACK.stepIntervalMs[1]`(1500), `transitionMs = PLAYBACK.transitionMsFor(baseMs)`(600), `loop:false`, `reduceMotion` 무시. 총 길이 `drillTotalMs`. 프레임 i 의 시각 `t_i = i·1000/fps`, 프레임 수 `N = ceil(total·fps/1000) + 1`(마지막 프레임 = t=total 의 정지 포즈), 각 프레임 길이 `1/fps` 초 | 배속·루프는 파일에 의미 없다. 마지막 스텝의 정지가 이미 `durationMs` 에 들어 있어 별도 꼬리 유지 안 둔다. 30fps 는 seamless 체인이 매끄러운 최저선 |
| 5 | **크기**: 시트에서 `720p`(기본)·`1080p` 둘 중 하나. 정의는 **긴 변** 1280 / 1920. `StaticSceneOpts.resolution` 타입을 `1 \| 2` → `number`(긴 변 = 1024×resolution 배수, 주석 갱신) 로 넓혀 `1280/1024`·`1920/1024` 를 넣는다. 캔버스는 `metrics.widthPx/heightPx` 를 **짝수로 올림**, `drawImage` 는 metrics 크기 그대로, 남는 1px 줄은 배경색(캡션 띠/여백 색, `staticSceneLayout` 의 것)으로 채운다 | 코트가 가로형이라 긴 변 기준이 자연스럽다. 축척을 흔들어 짝수를 만드는 것보다 1px 여백이 정직하다. 옵션은 저장 안 한다(prefs 스키마 불변) — 매번 720p 로 시작 |
| 6 | **비트레이트**: `bitrate = round(w·h·fps·0.07)` (720p ≈ 1.9 Mbps, 1080p ≈ 4.4 Mbps), 가변. 키프레임 간격은 mediabunny 기본값 | 단색 그래픽은 이 정도면 블록 노이즈 없이 10초 ≈ 2 MB. 실기에서 흐리면 계수만 올린다 |
| 7 | **캡션**: PNG 와 같은 옵션(제목·실명 roster 여부)을 시트의 기존 캡션 설정에서 그대로 읽되, **인코딩 시작 전에 한 번 확정**해 모든 프레임에 같은 `caption` 형태(→ 같은 `captionH`)를 넘긴다. 글은 도착 스텝 기준 "제목 · n/N · 스텝 이름" 으로 프레임마다 바뀐다 | 높이 고정이 곧 해상도 고정. 실명은 PNG §6 규칙과 동일(파일에 실린다는 안내 재사용) |
| 8 | **범위**: 영상은 항상 **드릴 전체**. 시트의 범위 fieldset 은 영상 항목에 적용되지 않음을 문구로 밝힌다 | 스텝 일부만의 영상은 트윈 시작점이 애매하다. 필요해지면 그때 |
| 9 | **진행·취소**: 시트 안 인라인 상태 3단 — 진행 중(`n/N` + 퍼센트 + [취소]) → 완료(`SPIN_{slug}_{YYYYMMDD}.mp4 · 12.3 MB` + [저장]) → 오류(문구 + [다시]). **저장은 완료 뒤 버튼 클릭에서** `downloadBlob` 호출 | iOS `navigator.share` 는 사용자 제스처 안에서만 되고, 인코딩 수 초 뒤엔 활성화가 끝나 있다. 클릭 → 저장이 유일하게 안전한 순서. 취소는 `AbortSignal` → 루프 중단 + `output.cancel()` |
| 10 | **API**(UI·엔진 병렬 구현의 계약): `src/features/export/video/encodeDrillVideo.ts` 가 `export async function encodeDrillVideo(drill: Drill, opts: VideoExportOpts, hooks: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal }): Promise<VideoExportResult>`; `VideoExportOpts = { size: 720 \| 1080; locale: Locale; caption: StaticSceneOpts['caption'] \| undefined /* roster 포함, 글은 엔진이 프레임마다 채움 */ }`; `VideoExportResult = { blob: Blob; bytes: number; frames: number; durationMs: number; width: number; height: number }`; `export async function isVideoExportSupported(): Promise<boolean>`(VideoEncoder 존재 + `canEncode('avc')`); 취소 시 `DOMException('AbortError')` 로 reject. 파일명 `exportNames.ts` 의 `videoFileName(drill, date) → SPIN_{slug}_{YYYYMMDD}.mp4` | 두 구현자가 이 시그니처만 보고 각자 간다 |
| 11 | **순수 로직 분리**(테스트 가능한 것): `video/videoTiming.ts` — `videoFrameTimes(totalMs, fps): number[]`, `videoBitrate(w,h,fps)`; `video/videoMetrics.ts` — `videoCanvasSize(metrics) → {w,h 짝수, padColor}`, `videoResolution(size) → number`. 인코더·캔버스는 테스트 안 붙인다(rasterize.ts 와 같은 선언) | AGENTS 테스트 규칙: jsdom 이 못 재는 것은 실기로. 단언은 돌연변이로 실효 확인 |
| 12 | `rasterize.ts` 에 새 출구 `paintSceneToCanvas(scene: StaticScene, canvas, locale): Promise<void>`(Image 로드 + drawImage + paintTexts, PNG 왕복 없음)를 만들고 `rasterizeFrameToPng` 가 그것을 쓰도록 접는다. 폰트 대기는 영상 루프 **앞에서 한 번** | 프레임마다 PNG 인코딩·폰트 대기를 하면 순수 낭비 |
| 13 | 데스크톱(Tauri): 웹과 같은 경로(앵커 다운로드). 실제 저장 대화상자 동작은 **실기 항목**. Android Firefox 는 결정 2 의 비활성 문구가 받는다 | fs/dialog 플러그인·capability 확장은 데스크톱 회차 몫(로드맵 0.6) |
| 14 | 개인정보 안내: 실명 캡션을 켜면 PNG 와 같은 문구를 재사용, `privacy.html` 은 손대지 않는다(파일 내보내기 조항이 이미 포괄) | 새 데이터 흐름이 없다 — 서버에 가지 않는다 |

## 2. 손대는 곳 (구현자별 — 파일 집합이 겹치지 않는다)

**A. 엔진(opus)** — `package.json`/`package-lock.json`(`npm i mediabunny`, dependencies), `src/features/export/video/{encodeDrillVideo,videoTiming,videoMetrics}.ts` + `videoTiming.test.ts`·`videoMetrics.test.ts`, `src/features/export/rasterize.ts`(결정 12), `src/features/export/staticSceneLayout.ts`(결정 5 의 `resolution: number` + 주석, `padColor` 노출), `src/features/export/exportNames.ts`(`videoFileName`) + 기존 테스트 보강.

**B. UI(opus)** — `src/features/export/ExportSheet.tsx`(항목 [영상 MP4]·크기 선택·진행/완료/오류 3단·취소·저장·미지원 비활성, 결정 8 문구), `src/i18n/{ko,en,ja}.ts`(키는 §2.1 — 세 파일 동시, 타입이 강제한다), `src/ui/icons.tsx`(`IconVideo`, 필요 시). B 는 A 의 모듈을 `import('./video/encodeDrillVideo')` 로 동적 로드한다 — A 가 끝나기 전엔 결정 10 의 시그니처를 보고 코딩한다.

**C. 문서(sonnet)** — `CHANGELOG.md`·`CHANGELOG.en.md`·`CHANGELOG.ja.md` [Unreleased] 한 항목씩, `ROADMAP.md:300-308`(⚠️ 뒤집기 + 항목 제목 "영상(MP4) 내보내기 — 완료, GIF 는 잔류"), `docs/PLAN-2026-08.md:667`(⚠️ 예외 mediabunny), `docs/DESIGN.md` 내보내기 절에 영상 한 문단, `src/render/renderPaths.ts` 머리 주석에 "영상은 png 행을 그대로 쓴다(buildStaticScene 재사용, 새 행 없음)" 한 줄, `README.md` 기능 목록 한 줄.

### 2.1 i18n 키 (B 가 넣고 A·C 는 안 건드린다)

`export.video.title`(영상 MP4) · `export.video.desc`(드릴 전체를 30fps 영상으로) · `export.video.size720` · `export.video.size1080` · `export.video.wholeDrill`(범위 선택은 영상에 적용되지 않습니다) · `export.video.progress`(`{{done}}/{{total}} 프레임 · {{pct}}%`) · `export.video.cancel` · `export.video.done`(`{{name}} · {{size}}`) · `export.video.save` · `export.video.retry` · `export.video.failed` · `export.video.unsupported`(이 브라우저는 영상 인코딩(H.264)을 지원하지 않습니다 — Chrome·Safari 에서 내보내세요) · `export.video.cancelled`.

## 3. 착수 순서

A·B·C 병렬 → 검수(fable, 헤드리스 Chrome 실제 인코딩) → 커밋 하나.

## 4. 검수 (§5 로 옮겨 적는 것)

1. `npm run typecheck` 0, `npm run lint` 경고 48(=HEAD) 유지, `npx vitest run` 전부 초록.
2. 새 단언마다 돌연변이 1건 이상 빨강(프레임 수 `+1` 제거, 짝수 올림 제거, 비트레이트 계수 변경, 파일명 확장자).
3. **헤드리스 Chrome(CDP) 실제 내보내기**: 5173 이 아닌 포트로 dev 서버 → 시드 드릴 하나 → 시트 [영상 MP4] → 진행 표시 관찰 → 완료 → blob 을 페이지 안에서 `mediabunny` `Input` 으로 다시 읽어 **트랙 치수 짝수·길이 = drillTotalMs ± 1프레임·프레임 수 = N** 확인, 파일 크기 기록. `ffprobe` 가 있으면 파일로도 교차 확인.
4. 취소가 실제로 멈추는지(진행 중 [취소] → 상태 복귀, 콘솔 에러 0).
5. 미지원 분기: `VideoEncoder` 를 `undefined` 로 덮은 뒤 시트를 열어 비활성 + 문구.
6. `npm run build` 전후 메인 청크 크기 동일, `mediabunny` 가 별도 청크. 빌드 뒤 `dist/` 삭제(AGENTS 배포 규칙).
7. seamless 체인 드릴에서 스텝 경계 프레임이 연속인지(인접 프레임 좌표 diff 가 튀지 않는지) — CDP 로 두 프레임 캔버스 픽셀 비교 또는 `sampleDrill` 수치 확인.

## 5. 검수 결과 · 남은 실기 (2026-09-08, fable 검수 — 구현 A·B opus, C sonnet)

### 5.1 게이트

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run lint` | 경고 48(= HEAD `35e0d67`), 오류 0. 새 파일 9개 `lint:rel` 경고 0 |
| `npx vitest run` | 302 파일 3878 통과. unhandled 1건은 `EditorWorkspace.playback.test.tsx` 의 `useAutosave` setState-after-teardown — 영상 파일과 무관하고 단독 재실행 초록(AGENTS §6 부하 경쟁) |
| 정적 `import 'mediabunny'` | `src/` 0건. 값 import 는 `encodeDrillVideo.ts` 안 `await import` 2곳뿐(지원 물음·인코딩) |
| 이중 구현·스텁 | 없음 — `videoFileName` 1벌(`exportNames.ts`), `not implemented` 0건, 세 집합 밖 변경은 `package*.json`(mediabunny 추가)뿐 |

### 5.2 돌연변이 (검수자가 직접 재현 — 깨서 빨강, 되돌려 초록)

| # | 돌연변이 | 결과 |
|---|---|---|
| M-A | `videoFrameTimes` 의 `+ 1` 제거 | `videoTiming.test` 3 빨강 |
| M-B | `videoCanvasSize` 짝수 올림 제거 | `videoMetrics.test` 2 빨강 |
| M-C | 시트 머리 버튼 `aria-disabled` → `disabled` | `ExportSheet.test` 4 빨강(미지원 a11y + 연쇄 3) |
| M-D | `VIDEO_LONG_EDGE_PX` 720 → 1300 | `videoMetrics.test` 2 빨강 — **구현자 원본 단언으로는 초록이었을 돌연변이**. 검사표가 그 상수를 import 해 대조하고 있었다(자기증명). 검수가 결정 5 의 숫자를 고정값 `{720:1280, 1080:1920}` 으로 박아 잡히게 했다(§5.5) |
| M-E | 엔진 `throwIfAborted` 무력화(취소 무시) | 단위 테스트 전부 초록 — 취소 계약은 단위 테스트가 **안 본다**(결정 11 대로 인코더 쪽은 테스트 없음). 잡는 것은 §5.3 의 헤드리스 취소 회차뿐이다. 회귀가 걱정되면 실기 항목에 취소를 넣는다 |

### 5.3 헤드리스 Chrome 152 실제 인코딩 (CDP · vite 5197 · 시드 드릴)

| 드릴 | 크기 | 스텝(seamless/cut) | `drillTotalMs` | N 기대 | codec / profile / pix_fmt | 치수(ffprobe) | nb_frames | duration | 파일(실측 비트레이트) | 인코딩 |
|---|---|---|---|---|---|---|---|---|---|---|
| 제1조 필드 규격 (28×15 full) | 720p | 1 (0/0) | 1500 | 46 | h264 / High / yuv420p | 1280×820 | 46 | 1.5333 s | 41 KB | 0.5 s |
| 3-2 득점 (30×18 half) | 1080p | 6 (0/0) | 9000 | 271 | 같음 | 1920×1814 | 271 | 9.0333 s | 1.4 MB (1.29 Mbps) | 4.9 s |
| 2-3 코너킥 (30×18 half) | 720p | 5 (0/1) | 7500 | 226 | 같음 | 1280×**1210** (metrics 1209 → 짝수 올림) | 226 | 7.5333 s | 550 KB (0.60 Mbps) | 1.8 s |

- N = `ceil(total·30/1000)+1` 이 세 벌 다 맞다. 파일 길이 = N/30 = `drillTotalMs` + 33 ms(마지막 정지 포즈 1장 — A 가 `durationMs` 를 파일 기준으로 둔 것과 같은 값). 페이지 안에서 `mediabunny` `Input` 으로 되읽은 것(패킷 수 = N, 마지막 타임스탬프 = `drillTotalMs`, 키프레임 5장/4장 ≈ 2초 간격)과 ffprobe 가 일치한다.
- 짝수 올림 경로는 코너킥(1209 → 1210)에서 **실제로 돌았다**. 남는 1px 줄이 `padColor` 인지는 픽셀로 못 봤다(검정 배경이라 눈에 안 띈다 — 미확인).
- 비트레이트 목표는 1.9/4.4 Mbps 인데 실측 0.6/1.3 Mbps — VBR 이 단색 그래픽에서 알아서 낮춘 것. 화질 판정은 실기.
- 진행 표시: `0/… · 0%` → `1/N · 0%` → 5% 눈금 → `N/N · 100%` → 완료 줄(파일명 · 크기). 콘솔 오류·예외 0.
- 취소(§4-4): 5%·63% 지점에서 [취소] → 6~212 ms 뒤 '영상 내보내기를 취소했습니다', 머리 버튼 재활성(`aria-disabled=false`), 2초 뒤에도 늦게 오는 오류 0.
- 미지원(§4-5): `window.VideoEncoder = undefined` 뒤 시트 재오픈 → `aria-disabled=true` + 사유 문구, 라디오 0개, 초점 받음, 클릭해도 무반응. 지원 물음은 헤드리스에서도 `canEncode('avc')` true 였다(별도 플래그 없이).
- seamless 연속성(§4-7): 시드 22벌에 seamless 드릴이 없어 4스텝(1·2 seamless) 드릴을 `sampleDrill` 로 30fps 수치 확인. 체인 **안** 경계(t=3000) 프레임당 이동 0.1442 → 0.1442 → 0.1405, 체인 시작(t=1500) 0 → 0.004 → 0.012 — 연속. 전체 최대 이동 0.60 은 스텝 3 의 보통 전환(600 ms) 정점(t=4700)이지 경계 튐이 아니다.
- 스크린샷(스크래치 `/tmp/claude-1000/-home-from104-work-spin/606eb144-ebb2-4520-acf3-9a8887686f8b/scratchpad/`): `video-01-sheet.png`(시트) · `video-a-2-progress.png`(82/271 · 30% + [취소]) · `video-a-3-done.png`(완료 줄 + [저장]) · `video-04-cancelled.png` · `video-05-unsupported.png`. 결과 파일 `video-out/*.mp4` 3개, 보고 `video-e2e-report*.json`. 스크립트 `video-e2e.mjs`·`video-e2e2.mjs`(cdp.mjs 위).

### 5.4 빌드 청크 (`npm run build` · HEAD 는 `git worktree` 로 따로 빌드)

| 청크 | HEAD `35e0d67` | 지금 |
|---|---|---|
| `index-*.js`(메인) | 1,522,095 B | 1,529,582 B (**+7,487 B** = 시트 UI·i18n 13키. `Mp4OutputFormat`/`mediabunny` 문자열 0건) |
| `src-*.js`(mediabunny) | 없음 | 176,429 B — 동적 import 청크 |
| `encodeDrillVideo-*.js` | 없음 | 2,603 B |
| `rolldown-runtime-*.js` | 없음 | 589 B |

결정 3 의 "메인 청크 변화 0" 은 **mediabunny 기준으로 참**(0 바이트)이고 UI 코드 기준으로는 +7.5 KB 다. `dist/`·`.seo-build/` 는 지웠다.

### 5.5 검수가 고친 것

- `video/videoMetrics.test.ts` — `VIDEO_LONG_EDGE_PX`·`EXPORT_LAYOUT.baseLongEdgePx` 를 import 해 대조하던 단언을 고정값(1280/1920, 1024×배율)으로. M-D 가 그 전엔 초록이었다.
- `video/videoTiming.test.ts` — `Math.ceil((2033·30)/1000)+1` 로 공식을 다시 적던 단언을 `62` 로. 공식을 베끼면 구현과 같이 틀려도 초록이다.

### 5.6 안 한 것 · 판단 (뒤집기 쉽게 적는다)

- `buildStaticSvg.ts` 의 배경 `'#000000'` 과 `sceneBackdropFill` 두 벌 — 접지 않았다. 갈려도 1px 여백 색뿐이고 `staticSceneLayout` 의 ⚠️ 가 서로를 가리킨다.
- 완료 뒤 머리 버튼은 시트를 닫았다 열어야 다시 눌린다(같은 드릴을 1080p 로 다시 뽑으려면 재오픈) — B 의 설계("완료 단계는 [저장]이 다음 행동"). 실기에서 불편하면 완료 줄에 [다시 만들기] 를 더한다.
- mediabunny 청크 이름이 `src-*.js`(패키지 진입 경로 `dist/modules/src/index.js` 에서 딴 것) — 기능 무관. 이름을 붙이려면 vite `build.rolldownOptions.output.chunkFileNames`/manualChunks.
- 시트를 열 때 지원 물음이 곧 176 KB 청크 다운로드다(B 보고) — 결정 2("항목을 비활성으로 보여야 한다")의 대가. 뒤집으려면 시트에서는 `typeof VideoEncoder` 만 보고 `canEncode` 는 [영상] 을 누를 때 묻는다(디코딩만 되는 기기는 그때 오류 줄로).
- `VideoExportResult.durationMs` = N/fps(파일 실제 길이) — A 의 선택을 그대로 둔다. 시트는 이 값을 안 쓴다.
- `VideoExportOpts.scene`(결정 10 에 없던 필드) — A 가 더한 것이 맞다. PNG `sceneBase` 와 같은 객체를 넘기고 테스트가 `toMatchObject` 로 드리프트를 잡는다.

### 5.7 남은 실기

- 태블릿 Safari 에서 [저장] → 공유 시트 → 카톡 전송 · 안드로이드 Chrome 저장 위치 · 데스크톱(Tauri) 앵커 다운로드가 저장 대화상자를 여는지 · 1080p 60스텝 드릴의 소요 시간(헤드리스 6스텝 1080p 4.9초 기준 추정 50초) · 화질(계수 0.07 — VBR 실측이 목표의 1/3) · 캡션 실명 켰을 때 띠 높이 · 좁은 창에서 라디오·[취소] 표적 44px · 진행 중 [취소] 가 실기에서도 멈추는지(M-E — 단위 테스트가 없다).
