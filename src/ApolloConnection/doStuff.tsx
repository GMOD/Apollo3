import React from 'react'
import ReactDOM from 'react-dom'
import LoginModal from '../components/LoginModal'

export function checkApolloLogin() {
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
