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

  it('FIXME: Can download gff', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
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

    // Once downloading works:
    // TODO 1: Wait for download to complete
    // TODO 2: Be sure you scan the right gff file! There may be other gffs
    // in downloadsFolder, possibly even from the same assembly used here
    /*
    cy.exec(`wc -l ${Cypress.config('downloadsFolder')}/*_apollo.gff3`).then(
      (result) => {
        expect(result.stdout).eq(242)
        cy.log(result.stderr)
      },
    )
    */
  })
})
