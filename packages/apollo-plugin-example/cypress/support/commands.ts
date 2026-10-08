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
 * Stores the JBrowse configuration the collaboration server merges into the
 * one it generates: the Sequence Ontology, and the example plugin's client
 * half (served by this package's `serve:dist`). The server half is loaded by
 * the server itself, from `PLUGIN_URLS`.
 */
Cypress.Commands.add('setupJBrowseConfig', () => {
  cy.deleteMany({}, { collection: 'jbrowseconfigs' })
  cy.insertOne(
    {
      configuration: {
        ApolloPlugin: {
          ontologies: [
            {
              name: 'Sequence Ontology',
              version: 'unversioned',
              source: {
                uri: 'http://localhost:9000/test_data/so-2024-11-18.json',
                locationType: 'UriLocation',
              },
            },
          ],
        },
      },
      plugins: [
        {
          name: 'ApolloExample',
          url: 'http://localhost:3838/dist/plugin-example.umd.development.js',
        },
      ],
    },
    { collection: 'jbrowseconfigs' },
  )
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
  cy.visit(`/?config=${apolloServer}/jbrowse/config.json`)
  cy.contains('Yes, I trust it', { timeout: 10_000 }).click()
  // The login dialog doesn't always appear (e.g. in CI), so poll for it for a
  // few seconds and continue on if it never shows up
  const deadline = Date.now() + 2000
  function clickGuestLoginIfPresent() {
    cy.get('body').then(($body) => {
      const guestLogin = $body.find(':contains("Continue as Guest")').last()
      if (guestLogin.length > 0) {
        cy.wrap(guestLogin).click()
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(2000)
        cy.reload()
        return
      }
      if (Date.now() < deadline) {
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(250)
        clickGuestLoginIfPresent()
      }
    })
  }
  clickGuestLoginIfPresent()
})

Cypress.Commands.add('deleteAssemblies', () => {
  for (const collection of ['assemblies', 'features', 'checkresults']) {
    cy.deleteMany({}, { collection })
  }
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
    cy.wrap(Cypress.$('body')).within(() => {
      // Once the user is logged in, the Apollo session fetches the server's
      // config and rebuilds the whole app with it, which replaces every element
      // on the page, including an open menu. Wait for the rebuilt app, whose
      // config has `hasRole` set.
      cy.window({ timeout: 20_000 })
        .its('JBrowseRootModel.jbrowse.configuration.ApolloPlugin.hasRole')
        .should('equal', true)
      openApolloMenu()
      for (const pathPart of menuItemPathPrefix) {
        cy.contains(pathPart, { timeout: 10_000 }).click()
      }
      cy.contains(menuItemName, { timeout: 10_000 }).click()
    })
  },
)

Cypress.Commands.add('addAssemblyFromGff', (assemblyName, fin) => {
  cy.selectFromApolloMenu(['Admin', 'Add Assembly'])
  cy.get('form[data-testid="submit-form"]').within(() => {
    cy.get('input[type="TextField"]').type(assemblyName)
    cy.contains('GFF3 input')
      .parent()
      .parent()
      .within(() => {
        cy.get('button').click()
      })
    cy.get('input[data-testid="gff3-input-file"]').selectFile(fin)
    cy.intercept('/changes').as('changes')
    cy.get('Button[data-testid="submit-button"]').click()
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })
  cy.contains('AddAssemblyAndFeaturesFromFileChange')
    .parent()
    .should('contain', 'Finished')
  cy.get('button[aria-label="Close drawer"]', { timeout: 10_000 }).click()
  // Give JBrowse's session autosave (debounced 400ms) time to catch up so the
  // reload doesn't restore the session from before the change finished
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(1000)
  cy.reload()
  cy.contains('button', 'Launch view', { timeout: 10_000 }).click()
  cy.contains('Select assembly to view', { timeout: 10_000 })
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
