import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import React from 'react'
import ReactDOM from 'react-dom'
import LoginModal from './components/LoginModal'

export async function apolloFetch(
  apolloConfig: AnyConfigurationModel,
  endpoint: string,
  init?: RequestInit,
): Promise<Response> {
  const apolloId = readConfObject(apolloConfig, 'apolloId')
  const apolloName = readConfObject(apolloConfig, 'name')
  let username = sessionStorage.getItem(`${apolloId}-apolloUsername`)
  let password = sessionStorage.getItem(`${apolloId}-apolloPassword`)
  if (!(username && password)) {
    await checkApolloLogin(apolloConfig)
    username = sessionStorage.getItem(`${apolloId}-apolloUsername`)
    password = sessionStorage.getItem(`${apolloId}-apolloPassword`)
  }
  if (!(username && password)) {
    throw new Error(`Apollo login for "${apolloName}" failed`)
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
  const location = readConfObject(apolloConfig, ['location', 'uri'])
  return fetch(`${location}/${endpoint}`, apolloInit)
}

function checkApolloLogin(apolloConfig: AnyConfigurationModel) {
  const appRoot = document.getElementById('root')
  const modal = document.createElement('div')
  modal.setAttribute('id', 'modal-root')
  appRoot?.parentElement?.appendChild(modal)
  return new Promise(resolve => {
    function resolveLoginCheck() {
      resolve(null)
      ReactDOM.unmountComponentAtNode(modal)
    }
    ReactDOM.render(
      <LoginModal apolloConfig={apolloConfig} resolve={resolveLoginCheck} />,
      modal,
    )
  })
}
