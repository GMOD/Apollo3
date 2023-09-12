describe('Add Assembly', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Can add assembly from fasta', () => {
    cy.contains('Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox_deleteme')
    cy.get('input[value="text/x-fasta"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.fa')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    cy.contains('is being added', { timeout: 10_000 })
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })

  it('Can add assembly from 2bit', () => {
    cy.contains('Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox_deleteme')
    cy.get('input[value="text/x-fasta"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.2bit')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    cy.contains('is being added', { timeout: 10_000 })
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })

  it('Can add assembly from gff3 with fasta', () => {
    cy.contains('Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox_deleteme')
    cy.get('input[value="text/x-gff3"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.fasta.gff3')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    cy.contains('is being added', { timeout: 10_000 })
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })
})
