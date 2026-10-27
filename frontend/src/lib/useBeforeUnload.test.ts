import { renderHook } from "@testing-library/react";
import { useBeforeUnload } from "./useBeforeUnload";

// the browser sends this event when the tab is about to be closed or reloaded, and a listener can ask it to confirm
function closeTab() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useBeforeUnload", () => {
  it("lets the tab close when it is not active", () => {
    renderHook(() => useBeforeUnload(false));

    expect(closeTab()).toBe(false);
  });

  it("asks the browser to confirm when it is active", () => {
    renderHook(() => useBeforeUnload(true));

    expect(closeTab()).toBe(true);
  });

  it("follows the value as it changes", () => {
    const { rerender } = renderHook(({ active }) => useBeforeUnload(active), { initialProps: { active: false } });
    expect(closeTab()).toBe(false);

    rerender({ active: true });
    expect(closeTab()).toBe(true);

    rerender({ active: false });
    expect(closeTab()).toBe(false);
  });

  it("stops asking when the page is left", () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));

    unmount();

    expect(closeTab()).toBe(false);
  });
});
