/** The pages that may use the API: the dev server on this machine, and the desktop app's own app:// scheme. */
const APP_ORIGIN = /^(http:\/\/(127\.0\.0\.1|localhost)(:\d+)?|app:\/\/topsim)$/;

/**
 * Any website open in a browser can post to localhost, so state-changing and quota-spending routes check the
 * Origin header. A request without one is not from a browser page and is let through (curl, the tests).
 */
export function originAllowed(origin: string | undefined): boolean {
  return origin === undefined || APP_ORIGIN.test(origin);
}
