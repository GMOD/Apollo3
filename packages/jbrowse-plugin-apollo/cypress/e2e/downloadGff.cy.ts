describe('Download GFF', () => {
  beforeEach(() => {
    cy.exec(`rm -r ${Cypress.config('downloadsFolder')}/*`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      cy.log(result.stderr)
    })
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Can download gff', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/volvox.fasta.gff3')
    cy.get('button[data-testid="dropDownMenuButton"]')
      .contains('Apollo')
      .click()
    cy.contains('Download GFF3').click()
    cy.focused()
      .contains('Select assembly')
      .parent()
      .within(() => {
        cy.get('input').parent().click()
      })
    cy.contains('volvox_cy').click()
    cy.get('button').contains('Download').click()
    // TODO: Wait for download to complete

    cy.exec(`wc -l ${Cypress.config('downloadsFolder')}/*_apollo.gff3`).then(
      (result) => {
        expect(result.stdout).eq(242)
        cy.log(result.stderr)
      },
    )
  })
})
