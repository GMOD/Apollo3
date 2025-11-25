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
    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label="Close drawer"]').length > 0) {
        cy.get('button[aria-label="Close drawer"]').click()
      }
    })

    cy.searchFeatures('TGGT1_200010', 1)
    cy.wait(5000)
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model')
  })
  it('Shows different glyph types', () => {
    cy.addAssemblyFromGff('glyph_types.gff3', 'test_data/glyph_types.gff3')
    cy.selectAssemblyToView('glyph_types.gff3')
    cy.contains('Open track selector').click()
    cy.contains('Reference sequence (').click()
    cy.contains('Annotations (').click()

    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label="Close drawer"]').length > 0) {
        cy.get('button[aria-label="Close drawer"]').click()
      }
    })
    cy.wait(2000) // Wait for render
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="seqTrackCanvas"]').compareSnapshot(
      'seq-track-canvas',
    )

    cy.get('[data-testid="track_menu_icon"]').last().click()
    cy.contains('Display types').trigger('mouseover')
    cy.contains('LinearApolloSixFrameDisplay').click()
    cy.wait(2000) // Wait for render
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="canvas"]').compareSnapshot(
      'linear-apollo-six-frame-display-canvas',
    )

    cy.get('[data-testid="track_menu_icon"]').last().click()
    cy.contains('Display types').trigger('mouseover')
    cy.contains('LinearApolloDisplay').click()
    cy.get('button[data-testid="view_menu_icon"]', { timeout: 10_000 }).click({
      force: true,
      timeout: 10_000,
    })
    cy.contains('Show...', { timeout: 10_000 }).click()
    cy.contains('Show all regions in assembly', { timeout: 10_000 }).click()
    cy.wait(2000) // Wait for render
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="canvas"]').compareSnapshot({
      name: 'linear-apollo-display-canvas',
      testThreshold: 0.03,
    })
  })
})
