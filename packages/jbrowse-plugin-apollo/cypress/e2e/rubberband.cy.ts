describe('Rubberband selection', () => {
  before(() => {
    cy.deleteAssemblies()
    cy.wrap(
      globalThis.indexedDB.databases().then((dbs) => {
        for (const db of dbs) {
          if (db.name) {
            globalThis.indexedDB.deleteDatabase(db.name)
          }
        }
      }),
    )
    cy.addOntologies()
  })

  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Can get sequence via rubberband selection', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..10000')

    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Get sequence').click()
    cy.contains('tgtcacctcgggtactgcctctattacagaggtatcttaatggcgcatccag')
  })

  it.only('Can get sequence via rubberband selection', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..10000')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').should('be.visible')
    cy.contains('Add feature with a sequence ontology type').click()
    cy.get('[data-testid="add-feature-dialog"]')
      .contains('Type')
      .parent()
      .within(() => {
        cy.get('input').click({ timeout: 60_000 })
      })
    cy.contains('li', /^remark$/, { timeout: 60_000, matchCase: false }).click()
    cy.get('button').contains('Submit').click()
    cy.get('tbody', { timeout: 10_000 }).find(
      'input[type="text"][value="remark"]',
    )
  })
})
