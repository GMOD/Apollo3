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

  it('Undo attribute changes', () => {
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

    cy.get('tbody', { timeout: 10_000 }).contains('tr', 'CDS1').rightclick()
    cy.contains('Edit feature details', { timeout: 10_000 }).click()
    cy.contains('li', 'source').within(() => {
      cy.get('button').click()
    })

    // Edit attribute
    cy.contains('li', 'Edit').click()
    cy.get('input[value="example"]').type(
      '{selectall}{backspace}EditExample{enter}',
    )
    cy.contains('button', 'Update').click()
    cy.get('tbody', { timeout: 10_000 }).contains('EditExample')

    // Add attribute
    cy.contains('button', 'Add new').click()
    cy.contains('label', 'Attribute key')
      .parent()
      .within(() => {
        cy.get('input').type('newKey{enter}')
      })
    cy.contains('newKey')
      .parent()
      .parent()
      .within(() => {
        cy.get('input').type('New value{enter}')
        cy.contains('button', 'Add').click()
      })
    cy.get('tbody', { timeout: 10_000 }).contains('New value')

    // Delete attribute
    cy.contains('li', 'newKey').within(() => {
      cy.get('button').click()
    })
    cy.contains('li', 'Delete').click()
    cy.get('tbody', { timeout: 10_000 })
      .contains('New value')
      .should('not.exist')

    // Undo's
    cy.selectFromApolloMenu('Undo') // Undo delete
    cy.get('tbody', { timeout: 10_000 }).contains('New value')
    cy.get('tbody', { timeout: 10_000 }).contains('EditExample')

    cy.selectFromApolloMenu('Undo') // Undo add
    cy.get('tbody', { timeout: 10_000 })
      .contains('New value')
      .should('not.exist')
    cy.get('tbody', { timeout: 10_000 }).contains('EditExample')

    cy.selectFromApolloMenu('Undo') // Undo edit
    cy.get('tbody', { timeout: 10_000 })
      .contains('EditExample')
      .should('not.exist')
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains('example')
      })

    cy.selectFromApolloMenu('Undo').then(() => {
      cy.contains('No changes to undo')
    })
  })
})
