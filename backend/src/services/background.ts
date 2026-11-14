// Runs something without making the request wait for it, and swallows anything that goes wrong in it.
// The mail service never throws, but a request must not depend on that.
export function inTheBackground(run: () => Promise<unknown>): void {
  try {
    run().catch(() => {});
  } catch {
    // nothing to do, whatever the request really needed is already done
  }
}
