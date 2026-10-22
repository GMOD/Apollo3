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
  const dbName = `Apollo-${assemblyName}`
  // Opening a database that doesn't exist yet would create it empty at
  // version 1, and then LocalDriver's upgrade (which creates the stores) would
  // never run
  const dbs = await globalThis.indexedDB.databases()
  if (!dbs.some((db) => db.name === dbName)) {
    return { features: [], changes: [] }
  }
  const db = await openDB(dbName)
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
  // The test body only queues commands, so anything that should happen when
  // the command runs (reading the clock, opening IndexedDB) goes in a callback
  let deadline = 0
  function check() {
    cy.wrap(null)
      .then(() => readLocalDb(assemblyName, refName))
      .then((data) => {
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
  cy.wrap(null).then(() => {
    deadline = Date.now() + timeout
  })
  check()
}

/**
 * Open ctgA:1..10000 and show the local Apollo track with both the graphical
 * and the table display
 */
function openAnnotationTrack() {
  cy.openLocalApollo()
  cy.get('input[placeholder="Search for location"]', {
    timeout: 20_000,
  }).type('{selectall}{backspace}ctgA:1..10000{enter}')
  cy.currentLocationEquals('ctgA', 1, 10_000, 10)

  cy.contains('Open track selector').click()
  cy.contains('Annotations (', { timeout: 10_000 }).click()
  cy.get('button[aria-label="Minimize drawer"]').click()
  cy.annotationTrackAppearance('Show both graphical and table display')
}

/** Get the table row of the only feature with the given type */
function getFeatureRow(type: string) {
  return cy
    .get('tbody', { timeout: 10_000 })
    .find(`input[type="text"][value="${type}"]`)
    .closest('tr')
}

/**
 * Use the table's right-click menu to add a child to the only feature with
 * the type `parentType`
 */
function addChildFeature(
  parentType: string,
  start: number,
  end: number,
  type: string,
) {
  getFeatureRow(parentType).rightclick()
  cy.contains('Add child feature').click()
  cy.contains('Add new child feature')
    .closest('[data-testid="add-feature-dialog"]')
    .within(() => {
      cy.get('#start').type(`{selectall}${start}`)
      cy.get('#end').type(`{selectall}${end}`)
      cy.contains('Type')
        .parent()
        .within(() => {
          cy.get('input').click()
        })
    })
  cy.contains('li', new RegExp(`^${type}$`), { timeout: 60_000 }).click()
  cy.get('[data-testid="add-feature-dialog"]').within(() => {
    cy.get('button').contains('Submit').click()
  })
  cy.get('[data-testid="add-feature-dialog"]').should('not.exist')
}

describe('Local mode (no collaboration server)', () => {
  beforeEach(() => {
    // A delete can be "blocked" for a moment while the previous test's page
    // closes its connections. It goes ahead once they're closed, so wait for
    // "success" rather than failing on "blocked".
    cy.wrap(null).then({ timeout: 20_000 }, async () => {
      const dbs = await globalThis.indexedDB.databases()
      await Promise.all(
        dbs.map(
          (db) =>
            new Promise<void>((resolve, reject) => {
              if (!db.name) {
                resolve()
                return
              }
              const request = globalThis.indexedDB.deleteDatabase(db.name)
              request.addEventListener('success', () => {
                resolve()
              })
              request.addEventListener('error', () => {
                reject(request.error ?? new Error('deleteDatabase failed'))
              })
            }),
        ),
      )
    })
    cy.preloadSequenceOntology()
  })

  it('Creates and edits a feature, persists it in IndexedDB, and restores it on reload', () => {
    openAnnotationTrack()

    // Create a feature
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.get('#start').type('{selectall}1000')
      cy.get('#end').type('{selectall}2000')
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

  it('Builds a gene and runs the transcript and CDS checks', () => {
    openAnnotationTrack()

    // Add a gene on the + strand
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.get('#start').type('{selectall}1000')
      cy.get('#end').type('{selectall}9000')
      cy.get('#demo-simple-select').click()
    })
    cy.contains('li', /^\+$/).click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.contains('Add feature with a sequence ontology type').click()
      cy.contains('Type')
        .parent()
        .within(() => {
          cy.get('input').click({ timeout: 60_000 })
        })
    })
    cy.contains('li', /^gene$/, { timeout: 60_000 }).click()
    cy.get('[data-testid="add-feature-dialog"]').within(() => {
      cy.get('button').contains('Submit').click()
    })
    getFeatureRow('gene').within(() => {
      cy.get('input[value="1000"]')
      cy.get('input[value="9000"]')
    })

    // Add the mRNA and its exons
    addChildFeature('gene', 1050, 9000, 'mRNA')
    addChildFeature('mRNA', 1300, 1499, 'exon')
    addChildFeature('mRNA', 3000, 3902, 'exon')
    addChildFeature('mRNA', 5000, 5500, 'exon')
    addChildFeature('mRNA', 7000, 9000, 'exon')
    cy.get('tbody')
      .find('input[type="text"][value="exon"]')
      .should('have.length', 4)

    // Add the CDS from the mRNA's right-click menu in the graphical display.
    // The view shows ctgA:1..10000, so x=361 is around bp 4000, in the first
    // intron, and y=10 is the mRNA's row.
    cy.get('[data-testid="overlayCanvas"]').rightclick(361, 10)
    cy.contains('[role="menuitem"]', /^mRNA$/).click()
    cy.contains('[role="menuitem"]', 'Add coding sequence').click()
    cy.get('[data-testid="add-coding-sequence"]').within(() => {
      cy.get('input[value="longest-orf"]').should('be.checked')
      cy.get('button').contains('Submit').click()
    })
    getFeatureRow('CDS').within(() => {
      cy.get('input[value="1315"]')
      cy.get('input[value="7600"]')
    })

    // The splice sites are canonical and the CDS has start and stop codons, so
    // there are no warnings
    cy.get('[data-testid^="ErrorIcon-"]').should('not.exist')

    // Moving the end of the second exon by 1 bp breaks its 5′ splice site
    // (TranscriptCheck) and shifts the CDS out of frame (CDSCheck)
    cy.get('tbody')
      .find('input[value="3902"]')
      .type('{selectall}{backspace}3903{enter}')
    cy.get('[data-testid="ErrorIcon-3903"]', { timeout: 10_000 })
    cy.get('[data-testid="ErrorIcon-7600"]', { timeout: 10_000 })

    waitForLocalDb(
      'volvox',
      'ctgA',
      ({ changes }) =>
        changes.filter((c) => c.typeName === 'LocationEndChange').length === 1,
    )

    // Undoing the edit runs the checks again and clears the warnings. This
    // uses Undo rather than typing 3902 back into the table because the
    // table's End cell doesn't pick up the new value after an edit, so typing
    // the old value back in isn't seen as a change.
    // selectFromApolloMenu waits for a user role, which local mode doesn't have
    cy.contains('button', /^Apollo$/i).click()
    cy.contains('[role="menuitem"]', /^Undo$/).click()
    cy.get('[data-testid^="ErrorIcon-"]', { timeout: 10_000 }).should(
      'not.exist',
    )
    waitForLocalDb(
      'volvox',
      'ctgA',
      ({ changes }) =>
        changes.filter((c) => c.typeName === 'LocationEndChange').length === 2,
    )
  })
})
