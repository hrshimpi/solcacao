// Makes the browser ask before the tab is closed or the page is reloaded, while there is something that would be lost.
import { useEffect } from "react";

export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      // some browsers only ask when a value is set, and they show their own text, never this one
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
