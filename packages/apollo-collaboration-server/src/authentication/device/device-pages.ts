/** Minimal server-rendered pages for completing a device login in a browser */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string) {
  return text.replaceAll(/["&'<>]/g, (char) => HTML_ESCAPES[char] ?? char)
}

/** @param body - Trusted HTML, any interpolated values must already be escaped */
function renderPage(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | Apollo</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
  .code { font-family: ui-monospace, monospace; font-size: 2rem; letter-spacing: 0.15em; }
  input[name=user_code] { font-family: ui-monospace, monospace; font-size: 1.5rem; width: 10em; text-transform: uppercase; }
  button { font-size: 1rem; padding: 0.5em 1.25em; cursor: pointer; }
  .warning { border-left: 4px solid #c77700; padding-left: 0.75rem; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>
`
}

export function renderEnterCodePage(actionURL: string, error?: string) {
  return renderPage(
    'Log in to Apollo CLI',
    `${error ? `<p><strong>${escapeHtml(error)}</strong></p>` : ''}
<p>Enter the code shown in your terminal by <code>apollo login</code>.</p>
<form method="get" action="${escapeHtml(actionURL)}">
  <p><input name="user_code" autocomplete="off" autofocus required placeholder="XXXX-XXXX" aria-label="Code"></p>
  <p><button type="submit">Next</button></p>
</form>`,
  )
}

export function renderConfirmPage(
  actionURL: string,
  userCode: string,
  csrf: string,
) {
  return renderPage(
    'Log in to Apollo CLI',
    `<p>Confirm this code matches the one shown in your terminal:</p>
<p class="code">${escapeHtml(userCode)}</p>
<p class="warning">Only continue if you ran <code>apollo login</code> yourself.
If someone else sent you this link, close this page, since continuing would let
them act as you in Apollo.</p>
<form method="post" action="${escapeHtml(actionURL)}">
  <input type="hidden" name="user_code" value="${escapeHtml(userCode)}">
  <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
  <p><button type="submit">Continue</button></p>
</form>`,
  )
}

export function renderCompletePage() {
  return renderPage(
    'Login complete',
    '<p>You can close this window and return to the terminal.</p>',
  )
}

export function renderErrorPage(message: string, retryURL?: string) {
  return renderPage(
    'Login failed',
    `<p>${escapeHtml(message)}</p>${
      retryURL
        ? `<p>Run <code>apollo login</code> again, or <a href="${escapeHtml(retryURL)}">enter a different code</a>.</p>`
        : ''
    }`,
  )
}
