describe('Download GFF', () => {
  beforeEach(() => {
    cy.exec(`rm ${Cypress.config('downloadsFolder')}/*_apollo.gff3`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      cy.log(result.stderr)
    })
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Can download gff with fasta', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectFromApolloMenu('Download GFF3')
    cy.focused()
      .contains('Select assembly')
      .parent()
      .within(() => {
        cy.get('input').parent().first().click()
      })
    cy.get('li').contains('volvox.fasta.gff3').click()
    cy.get('label[data-testid="include-fasta-checkbox"]').within(() => {
      cy.get('input').click()
    })
    cy.get('button').contains('Download').click()

    // We don't know when the download is done
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(10_000)
    cy.task('readdirSync', Cypress.config('downloadsFolder')).then((out) => {
      const gff = out as string
      cy.readFile(`${Cypress.config('downloadsFolder')}/${gff[0]}`).then(
        (x: string) => {
          const lines: string[] = x.trim().split('\n')
          expect(lines.length).eq(962)
        },
      )
    })
  })

  it('Can download gff without fasta', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectFromApolloMenu('Download GFF3')
    cy.focused()
      .contains('Select assembly')
      .parent()
      .within(() => {
        cy.get('input').parent().first().click()
      })
    cy.get('li').contains('volvox.fasta.gff3').click()
    cy.get('button').contains('Download').click()

    // We don't know when the download is done
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(10_000)
    cy.task('readdirSync', Cypress.config('downloadsFolder')).then((out) => {
      const gff = out as string
      cy.readFile(`${Cypress.config('downloadsFolder')}/${gff[0]}`).then(
        (x: string) => {
          const lines: string[] = x.trim().split('\n')
          expect(lines.length).eq(257)
        },
      )
    })
  })
})
