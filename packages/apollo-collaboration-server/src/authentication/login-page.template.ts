interface LoginType {
  name: string
  message: string
  needsPopup: boolean
}

interface LoggedInUser {
  username: string
  role?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function dispatchHref(name: string, redirectUri: string): string {
  const params = new URLSearchParams({ type: name, redirect_uri: redirectUri })
  return `auth/login?${params.toString()}`
}

export function renderLoginPage({
  loginTypes,
  redirectUri,
  loggedInUser,
}: {
  loginTypes: LoginType[]
  redirectUri: string
  loggedInUser?: LoggedInUser
}): string {
  let body: string
  if (loggedInUser) {
    const roleText = loggedInUser.role
      ? ` (${escapeHtml(loggedInUser.role)})`
      : ''
    body = `
      <p>You are logged in as <strong>${escapeHtml(loggedInUser.username)}</strong>${roleText}.</p>
      <a class="button" href="${escapeHtml(redirectUri)}">Continue</a>
      <p class="logout"><a href="logout">Log out</a></p>`
  } else if (loginTypes.length === 0) {
    body = '<p>No login methods are configured. Contact your administrator.</p>'
  } else {
    body = loginTypes
      .map(
        (type) =>
          `<a class="button" href="${escapeHtml(dispatchHref(type.name, redirectUri))}">${escapeHtml(type.message)}</a>`,
      )
      .join('\n      ')
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Log in</title>
<style>
  body {
    font-family: system-ui, sans-serif;
    max-width: 360px;
    margin: 10vh auto;
    text-align: center;
    color: #222;
  }
  h1 {
    margin-bottom: 1.5em;
  }
  .button {
    display: block;
    margin: 0.5em 0;
    padding: 0.75em;
    border: 1px solid #ccc;
    border-radius: 6px;
    text-decoration: none;
    color: #222;
    background: #f7f7f7;
  }
  .button:hover {
    background: #eee;
  }
  .logout {
    margin-top: 2em;
    font-size: 0.9em;
  }
</style>
</head>
<body>
<h1>Apollo</h1>
${body}
</body>
</html>`
}
