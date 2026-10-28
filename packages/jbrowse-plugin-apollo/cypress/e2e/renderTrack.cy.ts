/* eslint-disable cypress/no-unnecessary-waiting */
function closeDrawerIfOpen() {
  cy.get('body').then(($body) => {
    if ($body.find('button[aria-label="Close drawer"]').length > 0) {
      cy.get('button[aria-label="Close drawer"]').click()
    }
  })
}

function switchDisplayType(displayType: string) {
  cy.get('[data-testid="track_menu_icon"]').last().click()
  cy.contains('Display types').trigger('mouseover')
  cy.contains(displayType).click()
}

function showAllRegions() {
  cy.get('button[data-testid="view_menu_icon"]', { timeout: 10_000 }).click({
    force: true,
    timeout: 10_000,
  })
  cy.contains('Show...', { timeout: 10_000 }).click()
  cy.contains('Show all regions in assembly', { timeout: 10_000 }).click()
}

function compareCanvasSnapshot(testId: string, name: string) {
  cy.wait(2000) // Wait for render
  // This may fail locally due to differences in runtime such as installed
  // fonts on. The snapshots used in this test are generated on GitHub Actions
  cy.get(`canvas[data-testid="${testId}"]`).compareSnapshot({
    name,
    testThreshold: 0.03,
  })
}

describe('Simple tests for visuals', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  describe('Gene model', () => {
    afterEach(() => {
      cy.deleteAssemblies()
    })

    it('Shows correct gene model', () => {
      cy.addAssemblyFromGff('so_types.gff3', 'test_data/so_types.gff3')
      cy.selectAssemblyToView('so_types.gff3')
      closeDrawerIfOpen()

      cy.searchFeatures('TGGT1_200010', 1)
      cy.wait(5000)
      // This may fail locally due to differences in runtime such as installed
      // fonts on. The snapshots used in this test are generated on GitHub Actions
      cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot({
        name: 'gene-model',
        testThreshold: 0.03,
      })
    })
  })

  describe('Glyph types', () => {
    // Add the assembly once and share it among the tests in this block, so
    // each snapshot is its own test and one failing doesn't skip the others
    before(() => {
      cy.deleteAssemblies()
      cy.loginAsGuest()
      cy.addAssemblyFromGff('glyph_types.gff3', 'test_data/glyph_types.gff3')
    })

    after(() => {
      cy.deleteAssemblies()
    })

    beforeEach(() => {
      cy.contains('button', 'Launch view', { timeout: 10_000 }).click()
      cy.selectAssemblyToView('glyph_types.gff3')
      cy.contains('Open track selector').click()
      cy.contains('Reference sequence (').click()
      cy.contains('Annotations (').click()
      closeDrawerIfOpen()
    })

    it('Shows sequence track', () => {
      compareCanvasSnapshot('seqTrackCanvas', 'seq-track-canvas')
    })

    it('Shows six frame display for a single gene', () => {
      switchDisplayType('LinearApolloSixFrameDisplay')
      compareCanvasSnapshot(
        'canvas',
        'linear-apollo-six-frame-display-single-gene',
      )
    })

    it('Shows main display for multiple regions', () => {
      showAllRegions()
      compareCanvasSnapshot('canvas', 'linear-apollo-display-multi-region')
    })

    it('Shows six frame display for multiple regions', () => {
      showAllRegions()
      switchDisplayType('LinearApolloSixFrameDisplay')
      compareCanvasSnapshot(
        'canvas',
        'linear-apollo-six-frame-display-multi-region',
      )
    })
  })
})
