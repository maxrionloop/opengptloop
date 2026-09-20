/**
 * Minimal client-side router (no external dependency).
 *
 * The app has exactly two top-level pages:
 *   - Home  →  "/"                    the landing page (prompt box + quick start)
 *   - Chat  →  "/chat/<sessionId>"    a single chat session, keyed by its 20-char id
 *
 * These helpers are PURE (no store / no window side effects) so the store can import
 * them without a cycle. History side effects live in the store's `navigate` action.
 */

/** A resolved top-level route. */
export type Route = { name: "home" } | { name: "chat"; sessionId: string };

/** Parse a URL pathname into a Route. Anything unrecognized falls back to Home. */
export function parseLocation(pathname: string): Route {
  const match = pathname.match(/^\/chat\/([^/?#]+)\/?$/);
  if (match && match[1]) {
    const sessionId = decodeURIComponent(match[1]).trim();
    if (sessionId.length > 0) return { name: "chat", sessionId };
  }
  return { name: "home" };
}

/** Serialize a Route back into a URL pathname. */
export function routeToPath(route: Route): string {
  return route.name === "chat" ? `/chat/${encodeURIComponent(route.sessionId)}` : "/";
}

/** Read the current route from `window.location` (Home on the server / no window). */
export function currentRoute(): Route {
  if (typeof window === "undefined") return { name: "home" };
  return parseLocation(window.location.pathname);
}
