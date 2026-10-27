// Sets the browser tab title for a page, like "Shop | SolCacao".
import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | SolCacao`;
  }, [title]);
}
