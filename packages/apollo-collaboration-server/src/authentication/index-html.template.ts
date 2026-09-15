/**
 * Derive the Apollo API path prefix (e.g. "/apollo/" or "/") from the
 * server's configured public URL. This doubles as both the "is this fetch
 * talking to Apollo" check and the login page's location.
 */
export function getApiPrefixFromUrl(url: string): string {
  const { pathname } = new URL(url)
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

function buildAuthRedirectScript(apiPrefix: string): string {
  const apiPrefixLiteral = JSON.stringify(apiPrefix)
  return `<script>
(function () {
  if (window.__apolloAuthRedirectInstalled) {
    return;
  }
  window.__apolloAuthRedirectInstalled = true;
  var apiPrefix = ${apiPrefixLiteral};
  var originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') {
    return;
  }
  window.fetch = function apolloFetch(input, init) {
    return originalFetch.call(this, input, init).then(function (response) {
      if (response.status !== 401) {
        return response;
      }
      try {
        var requestUrl = new URL(
          input instanceof Request ? input.url : String(input),
          window.location.href,
        );
        var onLoginPage = window.location.pathname === apiPrefix + 'login';
        if (
          requestUrl.origin === window.location.origin &&
          requestUrl.pathname.startsWith(apiPrefix) &&
          !onLoginPage
        ) {
          var redirectUri = window.location.href;
          window.location.href =
            apiPrefix + 'login?redirect_uri=' + encodeURIComponent(redirectUri);
        }
      } catch (error) {
        // Malformed/unrecognizable request URL: nothing sensible to redirect on.
      }
      return response;
    });
  };
})();
</script>`
}

/**
 * Insert a small inline script right after the opening `<head>` tag of the
 * app shell. It watches for a same-origin 401 from Apollo's own API and
 * does a full-page redirect to the login page, carrying the current URL
 * along as `redirect_uri` so the existing login flow can send the user
 * back once they're authenticated.
 *
 * The script is placed as early as possible, and specifically as a plain
 * (non-deferred) inline script, so it patches `window.fetch` before the
 * app's own `<script defer ...>` bundle runs.
 */
export function injectAuthRedirectScript(
  html: string,
  { apiPrefix }: { apiPrefix: string },
): string {
  const script = buildAuthRedirectScript(apiPrefix)
  const headOpenTag = /<head[^>]*>/i
  if (headOpenTag.test(html)) {
    return html.replace(headOpenTag, (match) => `${match}\n${script}`)
  }
  return `${script}\n${html}`
}
