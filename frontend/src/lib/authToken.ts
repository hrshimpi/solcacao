// The token that proves to the server who is signed in. The real sign in has not been built yet, so this is a small
// stand-in: it reads the token from the browser tab, where the real sign in will put it. Without one the server answers
// "please sign in", which the pages show like any other problem.
export const TOKEN_STORAGE_KEY = "sc_token";

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // a browser that does not let the page read its storage just has nobody signed in
    return null;
  }
}
