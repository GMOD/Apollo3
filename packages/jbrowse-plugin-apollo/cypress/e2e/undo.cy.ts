describe('Undo edits', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Undo chain of edits', () => {
    const assemblyName = 'onegene.fasta.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:1..200{enter}',
    )

    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains('td', '99').within(() => {
          cy.get('input').type('{selectall}{backspace}90{enter}')
        })
      })

    // Refresh table editor by close & re-open
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', '90').within(() => {
      cy.get('input').type('{selectall}{backspace}80{enter}')
    })

    // An invalid edit
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains('td', '1').within(() => {
          cy.get('input').type('{selectall}{backspace}95{enter}')
        })
      })
    cy.contains('Error: Min "95" is greater than max "80"')

    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', '80').within(() => {
      cy.get('input').type('{selectall}{backspace}70{enter}')
    })

    // Undo's
    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains(80)
      })

    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains(90)
      })

    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains(99)
      })

    cy.selectFromApolloMenu('Undo').then(() => {
      cy.contains('No changes to undo')
    })
  })
})
