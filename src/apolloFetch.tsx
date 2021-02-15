import React from 'react'
import ReactDOM from 'react-dom'
import LoginModal from './components/LoginModal'

export async function apolloFetch(
  info: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  let username = sessionStorage.getItem('apolloUsername')
  let password = sessionStorage.getItem('apolloPassword')
  if (!(username && password)) {
    await checkApolloLogin()
    username = sessionStorage.getItem('apolloUsername')
    password = sessionStorage.getItem('apolloPassword')
  }
  const apolloInit: RequestInit = {
    ...(init || {}),
    method: 'POST',
    headers: { ...(init?.headers || {}), 'Content-Type': 'application/json' },
  }
  if (apolloInit.body && typeof apolloInit.body === 'string') {
    const newBody = JSON.parse(apolloInit.body)
    apolloInit.body = JSON.stringify({ ...newBody, username, password })
  } else {
    apolloInit.body = JSON.stringify({ username, password })
  }
  return fetch(info, apolloInit)
}

function checkApolloLogin() {
  const appRoot = document.getElementById('root')
  const modal = document.createElement('div')
  modal.setAttribute('id', 'modal-root')
  appRoot?.parentElement?.appendChild(modal)
  return new Promise(resolve => {
    function finish() {
      resolve(null)
      ReactDOM.unmountComponentAtNode(modal)
    }
    ReactDOM.render(<LoginModal resolve={finish} />, modal)
  })
}
