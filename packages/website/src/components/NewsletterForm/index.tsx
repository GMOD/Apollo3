import React, { useEffect } from 'react'

type MailerLiteFn = ((...args: unknown[]) => void) & { q?: unknown[] }

declare global {
  var ml: MailerLiteFn | undefined
}

const ACCOUNT_ID = '770673'
const FORM_ID = 'fAN2W8'
const SCRIPT_ID = 'mailerlite-universal'
const SCRIPT_SRC = 'https://assets.mailerlite.com/js/universal.js'

export default function NewsletterForm(): React.JSX.Element {
  useEffect(() => {
    // Define the MailerLite command queue (matches their universal snippet) if
    // it isn't present yet.
    if (!globalThis.ml) {
      const ml = ((...args: unknown[]) => {
        ;(ml.q = ml.q ?? []).push(args)
      }) as MailerLiteFn
      globalThis.ml = ml
    }
    globalThis.ml('account', ACCOUNT_ID)

    // universal.js scans the DOM for `.ml-embedded` elements exactly once when
    // it loads (no MutationObserver). Injecting it here, from an effect,
    // ensures the div below is already in the DOM when that scan runs, fixing
    // the race where the form would intermittently fail to appear. Guard
    // against adding the loader more than once across client-side navigations.
    if (!document.querySelector(`#${SCRIPT_ID}`)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.src = SCRIPT_SRC
      document.head.append(script)
    }
  }, [])

  return <div className="ml-embedded" data-form={FORM_ID} />
}
