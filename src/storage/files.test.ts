// 4.3 — revoke 지연 + navigator.share 분기.
//
// jsdom 은 navigator.share/canShare 도 URL.createObjectURL/revokeObjectURL 도 구현하지 않는다
// (no-op 조차 아니고 아예 없다). 그래서 여기서는 넷 다 직접 심어 **두 경로(share / 앵커)를
// 실제로 실행**시킨다 — 이 저장소는 "스텁이 없어 한 경로가 한 줄도 실행 안 된 채 통과"를
// 겪은 적이 있다(setup.ts 의 setPointerCapture 주석). 대조군: 스텁을 안 깐 테스트가
// 폴백(앵커) 경로가 실제로 불리는 것을 단언한다.
// 최종 판정은 실기 iPad 다 — docs/FIELD-TEST.md §3.2 (E-1~E-9).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadBlob, REVOKE_DELAY_MS } from './files.ts';

type ShareFn = (data: { files: File[] }) => Promise<void>;
type CanShareFn = (data: { files: File[] }) => boolean;
// navigator 에 스텁을 얹고 걷기 위한 시야 — jsdom 원본에는 둘 다 없다(아래 대조군이 그 전제를 단언).
// DOM lib 의 Navigator 는 share/canShare 를 필수로 선언하므로(delete 불가) 별도 형태로 본다.
const nav = navigator as unknown as { share?: ShareFn; canShare?: CanShareFn };

// share 의 catch 핸들러는 마이크로태스크에서 돈다 — 거부 → catch 두 홉이면 충분하지만
// 여유로 세 번 비운다. 타이머가 아니므로 fake timers 와 무관하다.
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function jsonBlob(text: string): Blob {
  return new Blob([text], { type: 'application/json' });
}

describe('downloadBlob (4.3)', () => {
  let created: string[];
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    created = [];
    // jsdom 미구현이라 spyOn 이 아니라 직접 심는다. 만든 URL 을 기억해 revoke 대상과 대조한다.
    URL.createObjectURL = vi.fn((_b: Blob | MediaSource): string => {
      const u = `blob:spin-test/${created.length}`;
      created.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn();
    // 앵커 click 은 jsdom 에서 "Not implemented: navigation" 경고를 뿜는다 — 스파이로 막고 횟수만 센다.
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete nav.share;
    delete nav.canShare;
    // jsdom 원상(미구현)으로 되돌린다 — 다음 테스트의 "원본엔 없다" 전제를 지키기 위해.
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it('canShare 가 참이면 share 로 보낸다 — 같은 틱 동기 호출, 앵커 경로 0회', async () => {
    const share = vi.fn<ShareFn>(() => Promise.resolve());
    const canShare = vi.fn<CanShareFn>(() => true);
    nav.share = share;
    nav.canShare = canShare;

    downloadBlob(jsonBlob('{"spin":1}'), 'SPIN_테스트_20260812.spin.json');

    // ⚠️ await 없이 여기서 이미 불려 있어야 한다 — share 는 사용자 제스처 안에서만 허용되고,
    // 틱을 넘기면 iOS 에서 제스처가 만료돼 조용히 실패한다. 이 단언이 그 계약이다.
    expect(share).toHaveBeenCalledTimes(1);
    expect(canShare).toHaveBeenCalledTimes(1);

    // 보낸 File 의 이름·내용이 앵커 다운로드와 같은 산출물인지 (헛통과 방지: 내용까지 대조)
    const sent = share.mock.calls[0]![0].files;
    expect(sent).toHaveLength(1);
    expect(sent[0]!.name).toBe('SPIN_테스트_20260812.spin.json');
    expect(sent[0]!.type).toBe('application/json');
    await expect(sent[0]!.text()).resolves.toBe('{"spin":1}');

    // 대조군: share 경로에서는 blob URL 도 앵커 클릭도 일어나지 않는다
    await flushMicrotasks();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('canShare 가 거짓이면 share 를 부르지 않고 앵커 다운로드로 물러난다', () => {
    const share = vi.fn<ShareFn>(() => Promise.resolve());
    nav.share = share;
    nav.canShare = vi.fn<CanShareFn>(() => false);

    downloadBlob(jsonBlob('x'), 'SPIN_폴백.spin.json');

    expect(share).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(a.download).toBe('SPIN_폴백.spin.json');
    expect(a.href).toBe(created[0]);
    expect(a.isConnected).toBe(false); // click 후 즉시 문서에서 뗀다 — URL 만 유예로 살아 있다
  });

  it('대조군: 스텁을 안 깔면(jsdom 원본 = share 미구현) 폴백 경로가 실제로 불린다', () => {
    // 전제 단언 — jsdom 이 언젠가 share 를 구현하면 이 테스트가 먼저 알려 준다
    expect('share' in navigator).toBe(false);
    expect('canShare' in navigator).toBe(false);

    downloadBlob(jsonBlob('x'), 'SPIN_원본환경.spin.json');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('revoke 는 click 과 같은 틱이 아니다 — REVOKE_DELAY_MS 유예 후에만 죽는다', () => {
    vi.useFakeTimers();

    downloadBlob(jsonBlob('x'), 'SPIN_revoke.spin.json');

    // click 시점: URL 은 아직 살아 있다 (같은 틱 revoke 로의 회귀가 §6.1d 의 빈 파일 사고다)
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // 유예 1ms 전까지도 살아 있다 (setTimeout(0) 으로의 회귀를 잡는 단언 —
    // "저장 위치 묻기" 대화상자가 열려 있는 동안 fetch 가 시작되지 않기 때문)
    vi.advanceTimersByTime(REVOKE_DELAY_MS - 1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // 유예가 차면 정확히 그 URL 을 revoke 한다 (누수 대조군: 횟수 1)
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(created[0]);
  });

  it('REVOKE_DELAY_MS 는 저장 대화상자를 견디는 크기다 (하한 10초)', () => {
    // 값 자체를 30초대 미만으로 줄이는 회귀를 막는 하한 — 근거는 files.ts 의 상수 주석
    // (fetch 는 저장 위치 대화상자를 닫을 때까지 시작되지 않는다. FIELD-TEST E-9 가 실기 대조).
    expect(REVOKE_DELAY_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('share 가 AbortError(사용자 취소)로 거부되면 다운로드로 새지 않는다', async () => {
    const share = vi.fn<ShareFn>(() => Promise.reject(new DOMException('user canceled', 'AbortError')));
    nav.share = share;
    nav.canShare = () => true;

    downloadBlob(jsonBlob('x'), 'SPIN_취소.spin.json');
    await flushMicrotasks();

    // 헛통과 방지: "아무 일도 없었다"가 share 자체가 안 불려서가 아님을 함께 단언
    expect(share).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('share 가 AbortError 외의 이유로 거부되면 앵커 다운로드로 폴백한다', async () => {
    // iOS 가 제스처 만료 시 주는 NotAllowedError 류 — 취소와 달리 사용자는 파일을 원했다
    const share = vi.fn<ShareFn>(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    nav.share = share;
    nav.canShare = () => true;

    downloadBlob(jsonBlob('폴백내용'), 'SPIN_공유실패.spin.json');

    // 폴백은 마이크로태스크에서 돈다 — 같은 틱에는 아직 없다 (취소 테스트와의 대칭 대조군)
    expect(clickSpy).not.toHaveBeenCalled();
    await flushMicrotasks();

    expect(share).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(a.download).toBe('SPIN_공유실패.spin.json');
  });
});
