/* eslint-disable cypress/no-unnecessary-waiting */
describe('Simple tests for visuals', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Shows correct gene model', () => {
    cy.addAssemblyFromGff('so_types.gff3', 'test_data/so_types.gff3')
    cy.selectAssemblyToView('so_types.gff3', 'TGGT1_200010')

    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label="Close drawer"]').length > 0) {
        cy.get('button[aria-label="Close drawer"]').click()
      }
    })

    cy.wait(5000)

    // NB: The size of the image differs between headless and interactive execution of cypress.
    // Use *headless for pushing to gihub
    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot(
      'gene-model-headless',
    )
    // cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model-interactive')
  })
})
