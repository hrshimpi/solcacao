// Where to go after signing in. The address of the page that needed the sign in travels in the sign in address
// (?next=/wholesale/studio), without the language, so it still works when the language is switched on the way.
// It comes from the address bar, so only a page of this site is accepted.

// "/en/wholesale/studio?x=1" -> "/wholesale/studio?x=1", and "/en" -> "/"
export function withoutLanguage(pathname: string): string {
  return pathname.replace(/^\/(en|es)(?=\/|$)/, "") || "/";
}

// the path to go back to, or null when the value is missing or is not a path of this site
export function safeNextPath(value: string | null): string | null {
  if (value === null || value === "") return null;
  // one slash and then a page: not "//host" or "/\host" (both can leave the site), not "https://host" and no line breaks
  if (!/^\/(?![/\\])[^\\\r\n\t]*$/.test(value)) return null;
  // the sign in page itself, so nobody is sent in a circle
  if (/^\/account\/login(?=[/?#]|$)/.test(value)) return null;
  return value;
}

// the sign in address for a page that needs it, like "/account/login?next=%2Fwholesale%2Fstudio"
export function loginWithNext(next: string): string {
  return `/account/login?next=${encodeURIComponent(next)}`;
}
