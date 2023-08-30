describe('Different ways of resizing features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Drag feature boundaries', () => {
    cy.viewport(1000, 1000)
    cy.addAssemblyFromGff('volvox_cy', 'test_data/space.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('[data-testid="MinimizeIcon"]').eq(1).click()
    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:9,400..9600{enter}',
    )
    cy.contains('Table').click()

    cy.get('input[type="text"][value="EST_match"]').type('CDS')

    cy.get('tbody')
      .contains('tr', 'Match5')
      .then((tr) => {
        // cy.wrap(tr)
        //   .get('input[type="text"][value="EST_match"]')
        //   .then((td) => {
        //     cy.wrap(td).parent().parent().click()
        //     cy.wrap(td).clear()
        //     cy.wrap(td).type('CDS')
        //   })
        cy.wrap(tr)
          .contains('9500')
          .then((td) => {
            cy.wrap(td).click()
            cy.wrap(td).clear()
            cy.wrap(td).type('9440')
          })
        cy.wrap(tr)
          .contains('9900')
          .then((td) => {
            cy.wrap(td).click()
            cy.wrap(td).clear()
            cy.wrap(td).type('9560')
          })
        cy.get('body').click(0, 0)
      })
    // cy.contains('Match5').rightclick()
    // cy.contains('Add child feature').click()
  })
})
