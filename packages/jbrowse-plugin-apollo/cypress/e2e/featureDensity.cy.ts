function setFeatureDisplayThreshold(mode: 'auto' | 'fixed', value: number) {
  cy.get('[data-testid="track_menu_icon"]').click()
  cy.contains('Appearance').trigger('mouseover')
  cy.contains('Feature display threshold').click()
  cy.contains(mode === 'auto' ? 'Automatic:' : 'Fixed zoom level:').click()
  const input = `input[data-testid="${mode === 'auto' ? 'max-feature-count' : 'zoom-threshold'}"]`
  cy.get(input).clear()
  cy.get(input).type(String(value))
  cy.contains('button', 'Submit').click()
}

describe('Feature density', () => {
  beforeEach(() => {
    cy.loginAsGuest()
    // About 480 kb with 15 genes, so showing all of it is zoomed out past the
    // old fixed threshold of 200 bp/px but has few features
    cy.addAssemblyFromGff(
      'SM_V10_3.fasta.gff3.gz',
      'test_data/SM_V10_3.fasta.gff3.gz',
    )
    cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz', 'SM_V10_3')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('shows sparse features when zoomed out', () => {
    cy.get('canvas[data-testid="canvas"]', { timeout: 10_000 }).should('exist')
    cy.get('[data-testid="feature-density-histogram"]').should('not.exist')
  })

  it('shows a histogram when there are too many features', () => {
    setFeatureDisplayThreshold('auto', 5)
    cy.get('[data-testid="feature-density-histogram"]', { timeout: 10_000 })
      .should('contain', 'features in view')
      .find('[data-testid="feature-density-bar"]')
      .should('have.length.greaterThan', 10)
    cy.get('canvas[data-testid="canvas"]').should('not.exist')
    cy.contains('button', 'show them anyway').click()
    cy.get('canvas[data-testid="canvas"]', { timeout: 10_000 }).should('exist')
    cy.get('[data-testid="feature-density-histogram"]').should('not.exist')
  })

  it('uses a fixed zoom threshold', () => {
    setFeatureDisplayThreshold('fixed', 200)
    cy.get('[data-testid="feature-density-histogram"]', { timeout: 10_000 })
      .should('contain', 'zoomed out past 200 bp/px')
      // Zoom in 10x on a bar with features, to well under 200 bp/px
      .find('[data-testid="feature-density-bar"]:not([data-count="0"])')
      .first()
      .click()
    cy.get('canvas[data-testid="canvas"]', { timeout: 10_000 }).should('exist')
    cy.get('[data-testid="feature-density-histogram"]').should('not.exist')
  })
})
