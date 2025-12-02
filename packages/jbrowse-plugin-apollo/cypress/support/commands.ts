import { type IDBPDatabase, openDB } from 'idb'

Cypress.Commands.add('loginAsGuest', () => {
  cy.visit('/?config=http://localhost:3999/jbrowse/config.json')
  cy.contains('Continue as Guest', { timeout: 10_000 }).click()
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(2000)
  cy.reload()
})

Cypress.Commands.add('deleteAssemblies', () => {
  for (const x of ['assemblies', 'features']) {
    cy.log(x)
    cy.deleteMany({}, { collection: x }).then((results: undefined) => {
      cy.log(`Collection ${x}: ${results}` as unknown as string)
    })
  }
})

type OntologyKey = 'nodes' | 'edges' | 'meta'

async function loadOntology(
  ontologyGZip: Buffer,
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

Cypress.Commands.add('addOntologies', () => {
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
                uri: 'http://localhost:9000/test_data/so-v3.1.json',
                locationType: 'UriLocation',
              },
            },
          ],
        },
      },
    },
    { collection: 'jbrowseconfigs' },
  )
  cy.readFile('cypress/data/so.json.gz', null).then((soGZip: Buffer) => {
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
    })
  },
)

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
    const menuItemPathPrefix = menuItemPath.slice(0, -1)
    cy.wrap(Cypress.$('body')).within(() => {
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(3000)
      cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
        .contains('Apollo')
        .click({ force: true, timeout: 10_000 })
      for (const pathPart of menuItemPathPrefix) {
        cy.contains(pathPart, { timeout: 10_000 }).click()
      }
      cy.contains(menuItemName, { timeout: 10_000 }).click()
    })
  },
)

Cypress.Commands.add(
  'addAssemblyFromGff',
  (assemblyName, fin, launch = true, loadFeatures = true) => {
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
      cy.contains('Load features from GFF3').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        if (!loadFeatures) {
          cy.get('input[type="checkbox"]').click()
          cy.get('input[type="checkbox"]').should('not.be.checked')
        }
      })
      cy.intercept('/changes').as('changes')
      cy.get('Button[data-testid="submit-button"]').click()
      cy.wait('@changes').its('response.statusCode').should('match', /2../)
    })

    cy.contains('UploadAssemblyFile')
      .parent()
      .should('contain', 'All operations successful')
    cy.contains(
      loadFeatures
        ? 'AddAssemblyAndFeaturesFromFileChange'
        : 'AddAssemblyFromFileChange',
    )
      .parent()
      .should('contain', 'All operations successful')
    cy.get('button[aria-label="Close drawer"]', { timeout: 10_000 }).click()
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000)
    cy.reload()
    if (launch) {
      cy.contains('Launch view').click()
    }
    cy.contains('Select assembly to view', { timeout: 10_000 })
  },
)

Cypress.Commands.add(
  'selectAssemblyToView',
  (assemblyName, locationOrSearch) => {
    cy.contains('Select assembly to view', { timeout: 10_000 })

    cy.get('input[data-testid="assembly-selector"]')
      .parent()
      .then((el) => {
        if (!el.text().includes(assemblyName)) {
          cy.get('input[data-testid="assembly-selector"]').parent().click()
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

Cypress.Commands.add('searchFeatures', (query, expectedNumOfHits) => {
  if (expectedNumOfHits < 0) {
    throw new Error(
      `Expected number of hits must be >= 0. Got: ${expectedNumOfHits}`,
    )
  }
  cy.intercept('POST', '/users/userLocation').as(`search ${query}`)
  cy.get('input[placeholder="Search for location"]').type(
    `{selectall}{backspace}${query}{enter}`,
  )
  if (expectedNumOfHits === 0) {
    cy.contains(`Error: Unknown feature or sequence "${query}"`)
  } else if (expectedNumOfHits === 1) {
    cy.wait(`@search ${query}`)
  } else {
    cy.contains('Search results')
      .parents('div')
      .first()
      .within(() => {
        cy.get('tbody')
          .find('tr')
          .then((rows) => {
            expect(rows.length).equal(expectedNumOfHits)
          })
      })
  }
})

Cypress.Commands.add('closeSearchBox', () => {
  cy.contains('Search results', { matchCase: false })
    .parent()
    .parent()
    .within(() => {
      cy.get('[data-testid="CloseIcon"]').click()
    })
})

Cypress.Commands.add(
  'currentLocationEquals',
  (contig, start, end, tolerance) => {
    cy.get('input[placeholder="Search for location"]')
      .invoke('val')
      .as('currentLocation')

    cy.get<string>('@currentLocation').should((currentLocation) => {
      const [xcontig, s, e] = currentLocation.split(/:|\.\./)
      const xstart: number = Number.parseInt(s.replace(',', ''), 10)
      const xend: number = Number.parseInt(e.replace(',', ''), 10)
      expect(xcontig).equal(contig)
      expect(xstart).to.be.within(start - tolerance, start + tolerance)
      expect(xend).to.be.within(end - tolerance, end + tolerance)
    })
  },
)

Cypress.Commands.add(
  'importFeatures',
  (gffFile, assemblyName, deleteExistingFeatures) => {
    cy.selectFromApolloMenu(['Admin', 'Import Features'])
    cy.contains('Import Features from GFF3 file', { matchCase: false })
      .parent()
      .within(() => {
        cy.contains('Upload GFF3 to load features', { matchCase: false })
          .parent()
          .within(() => {
            cy.get('input[type="file"]').selectFile(gffFile)
          })

        cy.contains('Select assembly')
          .parent()
          .within(() => {
            cy.get('input').parent().click()
          })
      })
    cy.contains('li', assemblyName, { timeout: 10_000 }).click()

    if (deleteExistingFeatures !== undefined) {
      cy.contains('Yes, delete existing features')
        .parent()
        .within(() => {
          if (deleteExistingFeatures) {
            cy.get('input[type="checkbox"]').click()
            cy.get('input[type="checkbox"]').should('be.checked')
          } else {
            cy.get('input[type="checkbox"]').should('be.not.checked')
          }
        })
    }

    cy.contains('button', 'Submit').click()
    cy.contains('Importing features for')
      .parent()
      .should('contain', 'All operations successful')
    cy.contains('AddFeaturesFromFileChange')
      .parent()
      .should('contain', 'All operations successful')
  },
)

Cypress.Commands.add('refreshTableEditor', () => {
  // Refresh table editor by close & re-open
  cy.annotationTrackAppearance('Show graphical display')
  cy.annotationTrackAppearance('Show both graphical and table display')
})
