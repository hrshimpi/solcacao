// The short reference a person sees for a quote request (like SC-1A2B3C4D), made from the end of its id.
// The success screen and the list of requests both use it, so the same request has the same reference everywhere.
export function requestReference(id: string) {
  return `SC-${id.slice(-8).toUpperCase()}`;
}
