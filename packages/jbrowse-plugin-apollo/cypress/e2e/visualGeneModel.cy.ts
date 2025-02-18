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
    cy.selectAssemblyToView('so_types.gff3')
    cy.searchFeatures('TGGT1_200010', 1)
    cy.wait(5000) // Wait for gene model to render

    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label="Close drawer"]').length > 0) {
        cy.get('button[aria-label="Close drawer"]').click()
      }
    })

    cy.searchFeatures('TGGT1_200010', 1)
    cy.wait(5000)

    // NB: The size of the image differs between headless and interactive execution of cypress.
    // In headless mode (including github workflow) use this:
    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model')

    // For local testing use this (comment out when pushing to github):
    // cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model-local')
  })
})
