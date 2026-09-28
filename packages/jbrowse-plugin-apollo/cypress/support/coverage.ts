// @cypress/code-coverage only collects `window.__coverage__` if it already
// exists when the page's load event fires, but JBrowse loads the plugin after
// that, so none of the plugin's coverage would be collected. Instead we collect
// it ourselves, both when a page unloads (reloads, visits, and the reset between
// tests) and at the end of each test.

type Coverage = Record<string, unknown>

interface CoverageWindow {
  __coverage__?: Coverage
}

// Coverage objects already sent. Merging adds hit counts together, so sending
// one twice would double its counts.
const sent = new WeakSet<Coverage>()
const pending: string[] = []
let currentWindow: CoverageWindow | undefined

function takeCoverage(win: CoverageWindow | undefined) {
  let coverage: Coverage | undefined
  try {
    coverage = win?.__coverage__
  } catch {
    // Accessing a cross-origin window throws
    return
  }
  if (!coverage || sent.has(coverage)) {
    return
  }
  sent.add(coverage)
  // Copy now, since the window's objects go away once it unloads
  pending.push(JSON.stringify(coverage))
}

if (Cypress.expose('coverage')) {
  Cypress.on('window:load', (win) => {
    currentWindow = win as CoverageWindow
  })
  Cypress.on('window:before:unload', () => {
    takeCoverage(currentWindow)
  })
  afterEach(() => {
    cy.window({ log: false }).then((win) => {
      takeCoverage(win as CoverageWindow)
      for (const coverage of pending.splice(0)) {
        cy.task('combineCoverage', coverage, { log: false })
      }
    })
  })
}
