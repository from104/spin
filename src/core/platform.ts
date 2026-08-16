// 플랫폼 판별. **키보드에는 쓰지 않는다** — `core/keymap.ts` 는 `ctrlKey || metaKey` 로
// 둘 다 받으므로 Ctrl+Z 도 ⌘+Z 도 그냥 먹는다. 여기가 필요한 곳은 **포인터**뿐이다:
// 애플에서 Ctrl+클릭은 수식키가 아니라 **보조 클릭(우클릭)** 이라, 다른 곳과 달리 Ctrl 과
// ⌘ 를 같게 볼 수 없다. 같게 보면 맥에서 개체 메뉴를 여는 손짓이 선택까지 토글한다.

/** 애플 계열(macOS·iPadOS·iOS)인가. 판별 못 하면 **false** — 아닌 쪽으로 틀리면 맥에서
 *  Ctrl+클릭이 선택을 건드리는 정도지만, 맞는 쪽으로 틀리면 윈도우·리눅스에서 Ctrl+클릭
 *  가산 선택이 통째로 사라진다(그게 원래 있던 고장이다). */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = ua.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(p);
}
