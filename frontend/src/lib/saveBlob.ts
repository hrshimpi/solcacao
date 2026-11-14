// Hands a file that was fetched with the token to the browser, which saves it under the given name. A plain link to
// a protected file would not send the Authorization header, so the file is fetched first and saved from memory.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // the browser needs a moment to start reading the blob before it can be let go
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
