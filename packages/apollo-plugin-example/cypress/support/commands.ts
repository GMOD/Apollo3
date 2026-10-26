// These commands are trimmed-down copies of the ones in
// packages/jbrowse-plugin-apollo/cypress/support/commands.ts, so that this
// Cypress setup is self-contained and can be copied as a starting point for
// testing other plugins.
import { type IDBPDatabase, openDB } from 'idb'

const apolloServer = 'http://localhost:3999'

type OntologyKey = 'nodes' | 'edges' | 'meta'

async function loadOntology(
  ontologyGZip: ArrayBuffer,
  name: string,
  version: number,
) {
  const blob = new Blob([ontologyGZip])
  const ds = new DecompressionStream('gzip')
  const decompressedStream = blob.stream().pipeThrough(ds)
  const ontologyBlob = await new Response(decompressedStream).blob()
  const ontologyJSON = await ontologyBlob.text()
  const ontologyData = JSON.parse(ontologyJSON) as Record<
    OntologyKey,
    unknown[]
  >
  // @ts-expect-error could use more typing
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  ontologyData.meta[0].storeOptions.prefixes = new Map(
    // @ts-expect-error could use more typing
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    Object.entries(ontologyData.meta[0].storeOptions.prefixes),
  )
  await openDB(name, version, {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async upgrade(database: IDBPDatabase): Promise<void> {
      const meta = database.createObjectStore('meta')
      await meta.add(ontologyData.meta[0], 'meta')
      const nodes = database.createObjectStore('nodes', { keyPath: 'id' })
      nodes.createIndex('by-label', 'lbl')
      nodes.createIndex('by-type', 'type')
      nodes.createIndex('by-synonym', ['meta', 'synonyms', 'val'])
      nodes.createIndex('full-text-words', 'fullTextWords', {
        multiEntry: true,
      })
      for (const node of ontologyData.nodes) {
        await nodes.add(node)
      }
      const edges = database.createObjectStore('edges', { autoIncrement: true })
      edges.createIndex('by-subject', 'sub')
      edges.createIndex('by-object', 'obj')
      edges.createIndex('by-predicate', 'pred')
      for (const edge of ontologyData.edges) {
        await edges.add(edge)
      }
    },
  })
}

/**
 * The JBrowse configuration (the "example" assembly, the Sequence Ontology and
 * the example plugin's client half, served by this package's `serve:dist`)
 * comes from cypress/fixtures/jbrowse/config_example.json, which the server
 * is told to serve with `JBROWSE_CONFIG_FILES` (see `cypress:start:example`).
 * The server half is loaded by the server itself, from `PLUGIN_URLS`.
 */
Cypress.Commands.add('preloadOntology', () => {
  // Preloading the ontology into IndexedDB saves parsing it in every test.
  // so.json.gz was generated from an IndexedDB dump using the script found at
  // https://gist.github.com/loilo/ed43739361ec718129a15ae5d531095b
  cy.readFile<ArrayBuffer>(
    '../jbrowse-plugin-apollo/cypress/data/so.json.gz',
    null,
  ).then((soGZip) => {
    cy.wrap<Promise<void>>(
      loadOntology(
        soGZip,
        'Apollo Ontology "Sequence Ontology" "unversioned"',
        2,
      ),
      { timeout: 120_000 },
    )
  })
})

/**
 * In CI, the browser sometimes fails to load one of JBrowse's code files
 * ("ChunkLoadError"), and JBrowse shows a "Fatal error" dialog instead of the
 * app. On every page load, watch for that dialog and reload the page (what its
 * "Refresh" button does) if it appears, at most a few times per test. Other
 * fatal errors are left for the test to fail on. This runs in the page rather
 * than as Cypress commands so it doesn't depend on what the test is doing.
 */
const chunkLoadRefreshesKey = 'cypress-chunk-load-error-refreshes'
Cypress.on('window:load', (win) => {
  const timer = win.setInterval(() => {
    const failed = [...win.document.querySelectorAll('[role="dialog"]')].some(
      (dialog) =>
        dialog.textContent.includes('Fatal error') &&
        dialog.textContent.includes('ChunkLoadError'),
    )
    if (!failed) {
      return
    }
    win.clearInterval(timer)
    // sessionStorage is cleared between tests, so this is a per-test limit
    const refreshes = Number(win.sessionStorage.getItem(chunkLoadRefreshesKey))
    if (refreshes >= 3) {
      return
    }
    win.sessionStorage.setItem(chunkLoadRefreshesKey, String(refreshes + 1))
    win.location.reload()
  }, 500)
})

Cypress.Commands.add('loginAsGuest', () => {
  // Visiting while unauthenticated redirects (server-side, before the JBrowse
  // app loads) to the login page, which redirects back after logging in
  cy.visit('/?config=config_example.json')
  // Visit the link instead of clicking it. Cypress doesn't reliably wait for
  // the page load from the click's redirects, so the next commands could get
  // elements from the login page or from the app before it finished loading.
  cy.contains('Continue as Guest', { timeout: 10_000 })
    .should('have.prop', 'href')
    .then((href) => {
      cy.visit(String(href))
    })
})

/**
 * Assemblies are seeded at server startup from config_example.json, so only
 * remove what the tests add, and turn the assemblies' checks back to the
 * default ones
 */
Cypress.Commands.add('clearFeatures', () => {
  for (const collection of [
    'changes',
    'checkresults',
    'counters',
    'features',
    'files',
  ]) {
    cy.deleteMany({}, { collection })
  }
  cy.findMany({ isDefault: true }, { collection: 'checks' }).then(
    (defaultChecks) => {
      const checkIds = (defaultChecks as unknown as { _id: unknown }[]).map(
        (check) => check._id,
      )
      cy.updateMany(
        {},
        { $set: { checks: checkIds } },
        { collection: 'assemblies' },
      )
    },
  )
})

Cypress.Commands.add(
  'selectFromApolloMenu',
  (menuItemNameOrPath: string | string[]) => {
    const menuItemPath = Array.isArray(menuItemNameOrPath)
      ? menuItemNameOrPath
      : [menuItemNameOrPath]
    const menuItemName = menuItemPath.at(-1)
    if (!menuItemName) {
      return
    }
    const [firstMenuItem] = menuItemPath
    const menuItemPathPrefix = menuItemPath.slice(0, -1)
    // Some items (e.g. "Admin") are only added once the user's role is known,
    // and an already-open menu doesn't pick them up, so reopen the menu until
    // the item is there
    const deadline = Date.now() + 10_000
    function openApolloMenu() {
      cy.get('button', { timeout: 10_000 })
        .contains('Apollo')
        .click({ force: true, timeout: 10_000 })
      cy.get('[role="menu"]', { timeout: 10_000 }).then(($menu) => {
        if ($menu.text().includes(firstMenuItem) || Date.now() > deadline) {
          return
        }
        // Already within <body>, so cy.root() is the body
        cy.root().type('{esc}')
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500)
        openApolloMenu()
      })
    }
    // Once the user is logged in, the Apollo session fetches the server's
    // config and rebuilds the whole app with it, which replaces every element
    // on the page, including an open menu. Wait for the rebuilt app, whose
    // config has `hasRole` set. This also waits out the page load from the
    // login redirect, so do it before getting <body>.
    cy.window({ timeout: 20_000 })
      .its('JBrowseRootModel.jbrowse.configuration.ApolloPlugin.hasRole')
      .should('equal', true)
    // `withinSubject: null` keeps an enclosing within() from limiting the search
    // (see https://github.com/cypress-io/cypress/issues/6666), and unlike
    // Cypress.$('body') it gets <body> when the command runs, not when it's
    // queued
    cy.get('body', { withinSubject: null }).within(() => {
      openApolloMenu()
      for (const pathPart of menuItemPathPrefix) {
        cy.contains(pathPart, { timeout: 10_000 }).click()
      }
      cy.contains(menuItemName, { timeout: 10_000 }).click()
    })
  },
)

Cypress.Commands.add('importFeatures', (gffFile, assemblyName) => {
  cy.selectFromApolloMenu(['Admin', 'Import Features'])
  cy.contains('Import Features from GFF3 file', { matchCase: false })
    .parent()
    .within(() => {
      cy.contains('Upload GFF3 to load features', { matchCase: false })
        .parent()
        .within(() => {
          cy.get('input[type="file"]').selectFile(gffFile)
        })
      cy.get('[role="combobox"]').click()
    })
  cy.contains('li', assemblyName, { timeout: 10_000 }).click()
  cy.contains('button', 'Submit').click()
  cy.contains('AddFeaturesFromFileChange')
    .parent()
    .should('contain', 'Finished')
})

Cypress.Commands.add(
  'selectAssemblyToView',
  (assemblyName, locationOrSearch) => {
    cy.contains('Select assembly to view', { timeout: 10_000 })
    cy.get('div')
      .contains('Assembly')
      .parent()
      .then((el) => {
        if (!el.text().includes(assemblyName)) {
          cy.get('div').contains('Assembly').parent().click()
          cy.get('li').contains(assemblyName).click()
        }
      })
    cy.intercept('POST', '/users/userLocation').as('selectAssemblyToViewDone')
    if (locationOrSearch) {
      cy.get('input[placeholder="Search for location"]').type(
        `{selectall}{backspace}${locationOrSearch}{enter}`,
      )
    } else {
      cy.contains('button', /^Open$/, { matchCase: false }).click()
    }
    cy.wait('@selectAssemblyToViewDone')
  },
)

Cypress.Commands.add(
  'annotationTrackAppearance',
  (
    appearance:
      | 'Show both graphical and table display'
      | 'Show graphical display'
      | 'Show table display',
  ) => {
    cy.wrap(Cypress.$('body')).within(() => {
      // cy.wrap() makes it work inside within() scope - see
      // https://github.com/cypress-io/cypress/issues/6666
      cy.get('[data-testid="track_menu_icon"]').click()
      cy.contains('Appearance').trigger('mouseover')
      cy.contains(appearance).click()
      cy.press(Cypress.Keyboard.Keys.ESC)
      cy.press(Cypress.Keyboard.Keys.ESC)
    })
  },
)

/** Gets a top-level feature from MongoDB by the ID it had in the GFF3 file */
Cypress.Commands.add(
  'getFeature',
  (gffId: string) =>
    // cypress-mongodb doesn't type the documents it finds
    cy.findOne(
      { 'attributes.gff_id': gffId },
      { collection: 'features' },
    ) as unknown as Cypress.Chainable<Cypress.ApolloDocument>,
)

/**
 * Makes a request to the collaboration server as the guest user, without
 * going through the UI. Doesn't fail on error statuses, so tests can check
 * them.
 */
Cypress.Commands.add(
  'apolloRequest',
  (method: string, path: string, body?: object) =>
    cy
      .request<{ token: string }>(`${apolloServer}/auth/guest`)
      .then(({ body: { token } }) =>
        cy.request({
          method,
          url: `${apolloServer}${path}`,
          body,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }),
      ),
)
