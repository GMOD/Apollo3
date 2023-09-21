import { listenerCount } from 'node:process'

describe('Download GFF', () => {
  beforeEach(() => {
    cy.exec(`rm ${Cypress.config('downloadsFolder')}/*_apollo.gff3`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      cy.log(result.stderr)
    })
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Can download gff', () => {
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
    cy.contains('volvox.fasta.gff3').click()
    cy.get('button').contains('Download').click()

    // We don't know when the download is done
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(4000)
    cy.task('readdirSync', Cypress.config('downloadsFolder')).then((out) => {
      const gff = out as string
      cy.readFile(`${Cypress.config('downloadsFolder')}/${gff[0]}`).then(
        (x: string) => {
          const lines: string[] = x.trim().split('\n')
          expect(lines.length).eq(247)
        },
      )
    })
  })
})
