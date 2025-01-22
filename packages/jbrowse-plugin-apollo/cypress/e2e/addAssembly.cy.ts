describe('Add Assembly', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Can add assembly from fasta', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox.fa')
    cy.get('input[value="text/x-fasta"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.fa')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    cy.contains('is being added', { timeout: 10_000 })
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })

  it('Can add assembly from gff3 with fasta', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox.fasta.gff3')
    cy.get('input[value="text/x-gff3"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.fasta.gff3')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    cy.contains('is being added', { timeout: 10_000 })
    cy.wait('@changes').its('response.statusCode').should('match', /2../)
  })

  it('Can import and add features', () => {
    cy.addAssemblyFromGff('volvox.fasta', 'test_data/volvox.fasta.gff3')
    cy.importFeatures('test_data/onegene.fasta.gff3', 'volvox.fasta', false)
    cy.selectAssemblyToView('volvox.fasta')
    cy.searchFeatures('gx1', 1)
    cy.searchFeatures('EDEN', 1)
  })

  it('Can import and replace features', () => {
    cy.addAssemblyFromGff('volvox.fasta', 'test_data/volvox.fasta.gff3')
    cy.importFeatures('test_data/onegene.fasta.gff3', 'volvox.fasta', true)
    cy.selectAssemblyToView('volvox.fasta')
    cy.searchFeatures('gx1', 1)
    cy.searchFeatures('EDEN', 0)
  })

  it('FIXME: Can add assembly from 2bit', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('input[type="TextField"]').type('volvox_deleteme')
    cy.get('input[value="text/x-fasta"]').check()
    cy.get('input[type="file"]').selectFile('test_data/volvox.2bit')

    cy.intercept('/changes').as('changes')
    cy.contains('Submit').click()
    // On success you should see this:
    // cy.contains('is being added', { timeout: 10_000 })
    // Not this:
    cy.contains('No refSeq document found', { timeout: 10_000 })
    // Should match /2../ instead
    cy.wait('@changes').its('response.statusCode').should('match', /4../)
  })
})
