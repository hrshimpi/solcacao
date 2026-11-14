// Text from forms comes in as plain text only: tags are stripped, and the length rules count what is left.
// Used by every schema that takes text from a person.
import { z } from "zod";

// one pass: takes out comments, whole <script> and <style> blocks and anything that looks like a tag
// (a lone "<" in text like "I <3 this" is kept, only things that look like tags are removed)
function stripTagsOnce(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[!?/]?[a-z][^>]*>/gi, "")
    .replace(/<[!?/]?[a-z][^>]*$/i, "");
}

// removing a tag can join the pieces around it into a new one ("<<b>script>"), so we go again until nothing changes
export function cleanText(value: string): string {
  let current = value;
  for (let round = 0; round < 10; round++) {
    const next = stripTagsOnce(current);
    if (next === current) break;
    current = next;
  }
  // if something tag shaped is still there (very deeply nested input), drop the opening characters
  if (/<[!?/]?[a-z]/i.test(current)) {
    current = current.replace(/<(?=[!?/]?[a-z])/gi, "");
  }
  return current.trim();
}

// the longest text we even look at, so a huge body cannot keep the checks busy
const MAX_RAW_LENGTH = 10000;

// a string that is cleaned first, so the length rules count the plain text and not the tags
export function text(missing: string) {
  return z
    .string({ error: missing })
    .max(MAX_RAW_LENGTH, "That is too long to send. Please shorten it.")
    .transform(cleanText);
}
