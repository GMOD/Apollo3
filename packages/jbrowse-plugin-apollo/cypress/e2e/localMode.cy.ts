import { openDB } from 'idb'

interface StoredFeature {
  _id: string
  type: string
  min: number
  max: number
}

interface StoredChange {
  typeName: string
}

interface LocalDbData {
  features: StoredFeature[]
  changes: StoredChange[]
}

/**
 * Read the features and changes that LocalDriver has saved to IndexedDB for an
 * assembly
 */
async function readLocalDb(
  assemblyName: string,
  refName: string,
): Promise<LocalDbData> {
  const db = await openDB(`Apollo-${assemblyName}`)
  try {
    const featureStoreName = `features-${refName}`
    const features = db.objectStoreNames.contains(featureStoreName)
      ? ((await db.getAll(featureStoreName)) as StoredFeature[])
      : []
    const changes = db.objectStoreNames.contains('changes')
      ? ((await db.getAll('changes')) as StoredChange[])
      : []
    return { features, changes }
  } finally {
    db.close()
  }
}

/**
 * Retry reading IndexedDB until `predicate` passes, since LocalDriver writes to
 * it asynchronously after the change is applied in the client
 */
function waitForLocalDb(
  assemblyName: string,
  refName: string,
  predicate: (data: LocalDbData) => boolean,
  timeout = 10_000,
) {
  const deadline = Date.now() + timeout
  function check() {
    cy.wrap<Promise<LocalDbData>, LocalDbData>(
      readLocalDb(assemblyName, refName),
    ).then((data) => {
      if (predicate(data)) {
        return
      }
      if (Date.now() > deadline) {
        throw new Error(
          `IndexedDB never reached the expected state. Last read: ${JSON.stringify(data)}`,
        )
      }
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(250)
      check()
    })
  }
  check()
}

describe('Local mode (no collaboration server)', () => {
  before(() => {
    cy.wrap(
      globalThis.indexedDB.databases().then((dbs) => {
        for (const db of dbs) {
          if (db.name) {
            globalThis.indexedDB.deleteDatabase(db.name)
          }
        }
      }),
    )
    cy.preloadSequenceOntology()
  })

  it('Creates and edits a feature, persists it in IndexedDB, and restores it on reload', () => {
    cy.openLocalApollo()

    cy.get('input[placeholder="Search for location"]', {
      timeout: 20_000,
    }).type('{selectall}{backspace}ctgA:1..10000{enter}')
    cy.currentLocationEquals('ctgA', 1, 10_000, 10)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (', { timeout: 10_000 }).click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

    // Create a feature
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.get('#start').type('{selectall}{backspace}1000')
      cy.get('#end').type('{selectall}{backspace}2000')
      cy.contains('Add feature with a sequence ontology type').click()
      cy.contains('Type')
        .parent()
        .within(() => {
          cy.get('input').click({ timeout: 60_000 })
        })
    })
    cy.contains('li', /^remark$/, { timeout: 60_000, matchCase: false }).click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.get('button').contains('Submit').click()
    })
    cy.get('tbody', { timeout: 10_000 }).find(
      'input[type="text"][value="remark"]',
    )

    waitForLocalDb(
      'volvox',
      'ctgA',
      ({ features, changes }) =>
        features.some(
          (f) => f.type === 'remark' && f.min === 999 && f.max === 2000,
        ) && changes.some((c) => c.typeName === 'AddFeatureChange'),
    )

    // Edit the feature
    cy.get('tbody')
      .find('input[type="text"][value="remark"]')
      .closest('tr')
      .within(() => {
        cy.get('input[value="2000"]').type('{selectall}{backspace}2500{enter}')
      })
    cy.get('tbody')
      .find('input[type="text"][value="remark"]')
      .closest('tr')
      .within(() => {
        cy.get('input[value="2500"]')
      })

    waitForLocalDb('volvox', 'ctgA', ({ features, changes }) => {
      const remarks = features.filter((f) => f.type === 'remark')
      return (
        remarks.length === 1 &&
        remarks[0].min === 999 &&
        remarks[0].max === 2500 &&
        changes.some((c) => c.typeName === 'LocationEndChange')
      )
    })

    // Give JBrowse's session autosave (debounced 400ms) time to catch up so the
    // reload restores the current session
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000)
    cy.reload()

    // The feature is restored from IndexedDB
    cy.currentLocationEquals('ctgA', 1, 10_000, 10)
    cy.get('tbody', { timeout: 20_000 })
      .find('input[type="text"][value="remark"]')
      .closest('tr')
      .within(() => {
        cy.get('input[value="1000"]')
        cy.get('input[value="2500"]')
      })
  })
})
