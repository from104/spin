// §7.5f 가드 함수 2종. Space/Enter 는 브라우저가 활성화 키로 쓰므로 별도 가드가 필요하다.
// 방향키·문자키는 isEditableTarget 만, Space/Enter 는 isInteractiveTarget 도 검사한다.
// 안 그러면 트랜스포트 '재생' 버튼에 포커스한 채 Space 를 누르면 네이티브 클릭 + 전역 핸들러가
// 이중 발화해 아무 일도 일어나지 않고, 시연에서는 스텝이 2칸 건너뛴다.
// 우선순위: 개체 포커스 > 인터랙티브 요소 포커스(네이티브 위임) > 전역.
export const isEditableTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export const isInteractiveTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  t.closest(
    'button, a[href], select, textarea, input, summary, [role="button"], [role="radio"], [role="tab"], [contenteditable="true"]',
  ) !== null;
