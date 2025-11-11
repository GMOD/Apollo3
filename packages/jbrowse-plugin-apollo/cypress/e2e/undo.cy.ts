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
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..200')

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains('td', '99').within(() => {
          cy.get('input').type('{selectall}{backspace}90{enter}')
        })
      })

    cy.refreshTableEditor()
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

    cy.refreshTableEditor()
    cy.contains('td', '80').within(() => {
      cy.get('input').type('{selectall}{backspace}70{enter}')
    })

    // Undo's
    cy.selectFromApolloMenu('Undo')
    cy.refreshTableEditor()
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains(80)
      })

    cy.selectFromApolloMenu('Undo')
    cy.refreshTableEditor()
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains(90)
      })

    cy.selectFromApolloMenu('Undo')
    cy.refreshTableEditor()
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
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..200')

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

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

  it('Undo and redo', () => {
    const assemblyName = 'onegene.fasta.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..200')

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'CDS1')
      .within(() => {
        cy.contains('td', 1).within(() => {
          cy.get('input').type('{selectall}{backspace}10{enter}')
        })
        cy.refreshTableEditor()

        cy.contains('td', 10).within(() => {
          cy.get('input').type('{selectall}{backspace}20{enter}')
        })
        cy.refreshTableEditor()

        cy.contains('td', 20).within(() => {
          cy.get('input').type('{selectall}{backspace}30{enter}')
        })

        cy.selectFromApolloMenu('Undo')
        cy.refreshTableEditor()
        cy.contains('td', 20)

        cy.selectFromApolloMenu('Undo')
        cy.refreshTableEditor()
        cy.contains('td', 10)

        // Make a change and check that there are no changes to redo and undo goes back to a valid state
        cy.contains('td', 10).within(() => {
          cy.get('input').type('{selectall}{backspace}40{enter}')
        })
        cy.refreshTableEditor()

        cy.selectFromApolloMenu('Redo').then(() => {
          cy.wrap(Cypress.$('body')).within(() => {
            cy.contains('No changes to redo')
          })
        })

        cy.selectFromApolloMenu('Undo')
        cy.refreshTableEditor()
        cy.contains('td', 10)

        cy.selectFromApolloMenu('Undo')
        cy.refreshTableEditor()
        cy.contains('td', 1)

        cy.selectFromApolloMenu('Redo')
        cy.refreshTableEditor()
        cy.contains('td', 10)

        cy.selectFromApolloMenu('Redo')
        cy.refreshTableEditor()
        cy.contains('td', 40)

        cy.selectFromApolloMenu('Redo').then(() => {
          cy.wrap(Cypress.$('body')).within(() => {
            cy.contains('No changes to redo')
          })
        })

        cy.contains('td', 40).within(() => {
          cy.get('input').type('{selectall}{backspace}50{enter}')
        })

        // Invalid change is ignored in undo/redo
        cy.contains('td', 50).within(() => {
          cy.get('input').type('{selectall}{backspace}200{enter}')
        })
        cy.wrap(Cypress.$('body')).within(() => {
          cy.contains('Error: Min "200" is greater than max "99"')
        })

        cy.selectFromApolloMenu('Undo')
        cy.refreshTableEditor()
        cy.contains('td', 40)

        cy.selectFromApolloMenu('Redo')
        cy.refreshTableEditor()
        cy.contains('td', 50)

        cy.selectFromApolloMenu('Redo').then(() => {
          cy.wrap(Cypress.$('body')).within(() => {
            cy.contains('No changes to redo')
          })
        })
        cy.contains('td', 50)
      })
  })
})
