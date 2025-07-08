export async function copyToClipboard(element: HTMLElement) {
  if (isSecureContext) {
    const textBlob = new Blob([element.outerText], { type: 'text/plain' })
    const htmlBlob = new Blob([element.outerHTML], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({
      [textBlob.type]: textBlob,
      [htmlBlob.type]: htmlBlob,
    })
    return navigator.clipboard.write([clipboardItem])
  }
  const copyCallback = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/plain', element.outerText)
    event.clipboardData?.setData('text/html', element.outerHTML)
    event.preventDefault()
  }
  document.addEventListener('copy', copyCallback)
  // fall back to deprecated only in non-secure contexts
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  document.execCommand('copy')
  document.removeEventListener('copy', copyCallback)
}
