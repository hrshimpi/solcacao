// The token that proves to the server who is signed in. It only lives in this variable, in memory: it is never put in
// a storage of the browser (where any script of the page, or an extension, could copy it and use it after the tab was
// closed). It lasts a few minutes. The long lived part of the sign in is a cookie that scripts cannot read, and the
// page gets a new token with it (see session.ts), so a reload keeps a person signed in without any token being saved.
let token: string | null = null;

export function getAuthToken(): string | null {
  return token;
}

export function setAuthToken(next: string | null): void {
  token = next;
}
