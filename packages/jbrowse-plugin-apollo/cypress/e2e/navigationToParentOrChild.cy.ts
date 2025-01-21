describe('Add navigation to parent/child features in feature details widget', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Display parent/child', () => {
    cy.addAssemblyFromGff('onegene.fasta.gff3', 'test_data/onegene.fasta.gff3')
    cy.selectAssemblyToView('onegene.fasta.gff3')

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('[data-testid="MinimizeIcon"]').eq(1).click()
    cy.contains('Drawer minimized')
      .parent()
      .within(() => {
        cy.get('[data-testid="CloseIcon"]').click()
      })
    cy.get('[data-testid="track_menu_icon"]').click()
    cy.contains('Appearance').trigger('mouseover')
    cy.contains('Show both graphical and table display').click()

    cy.get('tbody', { timeout: 10_000 }).contains('tr', 'gx1').rightclick()
    cy.contains('Edit feature details').click()
    cy.contains('label', 'Type')
      .parent()
      .within(() => {
        cy.get('input[value="gene"]')
      })
    cy.contains('Children:')
      .parent()
      .within(() => {
        cy.contains('mRNA', { matchCase: false })
        cy.get('button').click()
      })
    cy.contains('label', 'Type')
      .parent()
      .within(() => {
        cy.get('input[value="mRNA"]')
      })
  })
})
