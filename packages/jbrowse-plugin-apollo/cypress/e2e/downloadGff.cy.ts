describe('Download GFF', () => {
  beforeEach(() => {
    cy.task('removeFiles', {
      folder: Cypress.config('downloadsFolder'),
      suffix: '_apollo.gff3',
    })
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Keeps export errors visible and allows retrying', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.selectFromTrackMenu('Export annotations')
    let attempts = 0
    cy.intercept('GET', '**/export/getID*', (request) => {
      attempts += 1
      request.reply(
        attempts === 1
          ? { statusCode: 500, body: 'Export temporarily unavailable' }
          : { body: { exportID: 'retry-export' } },
      )
    }).as('exportId')
    cy.window().then((win) => {
      cy.stub(win, 'open').as('openExport')
    })

    cy.get('[data-testid="download-gff3"]')
      .contains('button', 'Download')
      .click()
    cy.wait('@exportId')
    cy.get('[data-testid="download-gff3"]')
      .should('be.visible')
      .and('contain', 'Export temporarily unavailable')
    cy.get('@openExport').should('not.have.been.called')

    cy.get('[data-testid="download-gff3"]')
      .contains('button', 'Download')
      .click()
    cy.wait('@exportId')
    cy.get('@openExport').should('have.been.calledOnce')
    cy.get('@openExport')
      .its('firstCall.args.0')
      .should('include', 'exportID=retry-export')
    cy.get('[data-testid="download-gff3"]').should('not.exist')
  })

  it('Can download gff with fasta', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.selectFromTrackMenu('Export annotations')
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
    cy.selectAssemblyToView('volvox')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.selectFromTrackMenu('Export annotations')
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
