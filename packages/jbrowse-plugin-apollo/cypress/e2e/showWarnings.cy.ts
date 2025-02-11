describe('Warning signs', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('FIXME Show warnings', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')
    cy.searchFeatures('gene07', 1)

    // Here it would be nice to check that there are no ErrorIcons yet.
    // For this we need to make sure that the gene model is actually on the canvas,
    // which is not obvious how to do.

    cy.get('button[data-testid="track_menu_icon"]').click()
    cy.contains('Appearance').trigger('mouseover')
    cy.contains('Show both graphical and table display').click()
    cy.contains('cds07').rightclick()
    cy.contains('Edit feature details').click()
    cy.contains('Basic information')
      .parent()
      .within(() => {
        cy.get('input[value="16"]').type('{selectall}{backspace}4{enter}')
        cy.get('input[value="27"]').type('{selectall}{backspace}24{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()

    // FIXME: There should be 2 ErrorIcons not 3
    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 }).should(
      'have.length',
      3,
    )
    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 })
      .last()
      .trigger('mouseover')
    cy.contains(/(internal stop codon)|(missing stop codon)/)

    // Fix the missing stop codon. Internal stop still expected
    cy.contains('Basic information')
      .parent()
      .within(() => {
        cy.get('input[value="24"]').type('{selectall}{backspace}27{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()
    cy.reload()

    // FIXME: There should be 1 error icon not 4
    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 }).should(
      'have.length',
      4,
    )
  })
})
