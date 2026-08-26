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
    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot({
      name: 'gene-model',
      testThreshold: 0.03,
    })
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
    cy.get('canvas[data-testid="seqTrackCanvas"]').compareSnapshot({
      name: 'seq-track-canvas',
      testThreshold: 0.03,
    })

    cy.get('[data-testid="track_menu_icon"]').last().click()
    cy.contains('Display types').trigger('mouseover')
    cy.contains('LinearApolloSixFrameDisplay').click()
    cy.wait(2000) // Wait for render
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="canvas"]').compareSnapshot({
      name: 'linear-apollo-six-frame-display-canvas',
      testThreshold: 0.03,
    })

    cy.get('[data-testid="track_menu_icon"]').last().click()
    cy.contains('Display types').trigger('mouseover')
    cy.contains('LinearApolloDisplay').click()
    cy.get('button[data-testid="view_menu_icon"]', { timeout: 10_000 }).click({
      force: true,
      timeout: 10_000,
    })
    cy.contains('Navigation', { timeout: 10_000 }).click()
    cy.contains('Show all regions in assembly', { timeout: 10_000 }).click()
    cy.wait(2000) // Wait for render
    // This may fail locally due to differences in runtime such as installed
    // fonts on. The snapshots used in this test are generated on GitHub Actions
    cy.get('canvas[data-testid="canvas"]').compareSnapshot({
      name: 'linear-apollo-display-canvas',
      testThreshold: 0.03,
    })
  })
  it('Resizes a track by dragging its bottom resize handle', () => {
    cy.addAssemblyFromGff('so_types.gff3', 'test_data/so_types.gff3')
    cy.selectAssemblyToView('so_types.gff3')
    cy.contains('Open track selector').click()
    cy.contains('Reference sequence (').click()
    cy.contains('Annotations (so_types.gff3)').click()

    cy.get('body').then(($body) => {
      if ($body.find('button[aria-label="Close drawer"]').length > 0) {
        cy.get('button[aria-label="Close drawer"]').click()
      }
    })

    // The track's own Paper container is two ".MuiPaper-root" ancestors up
    // from its label text: the label has its own Paper, and its parent is
    // the track's Paper. The resize handle (data-gesture-owner) is a direct
    // child of that outer Paper, driving `display.resizeHeight()` on drag.
    cy.contains('Annotations (so_types.gff3)')
      .closest('.MuiPaper-root')
      .parent()
      .closest('.MuiPaper-root')
      .as('trackContainer')

    cy.get('@trackContainer')
      .find('> [data-gesture-owner="true"]')
      .as('resizeHandle')

    cy.get('@trackContainer')
      .invoke('outerHeight')
      .then((initialHeight: number) => {
        cy.get('@resizeHandle').then(($handle: JQuery) => {
          const rect: DOMRect = $handle[0].getBoundingClientRect()
          const x: number = rect.left + rect.width / 2
          const y: number = rect.top + rect.height / 2
          // The resize handle is driven by Pointer Events (it calls
          // setPointerCapture on pointerdown), not mouse events, so the
          // drag has to be simulated with pointerdown/pointermove/pointerup.
          const pointerOpts = {
            eventConstructor: 'PointerEvent',
            pointerId: 1,
            isPrimary: true,
            button: 0,
            force: true,
          }
          cy.get('@resizeHandle').trigger('pointerdown', {
            ...pointerOpts,
            clientX: x,
            clientY: y,
          })
          cy.get('@resizeHandle').trigger('pointermove', {
            ...pointerOpts,
            clientX: x,
            clientY: y + 50,
          })
          cy.get('@resizeHandle').trigger('pointerup', {
            ...pointerOpts,
            clientX: x,
            clientY: y + 50,
          })
        })

        cy.get('@trackContainer')
          .invoke('outerHeight')
          .should((finalHeight: number) => {
            expect(finalHeight).to.be.greaterThan(initialHeight)
          })
      })
  })
})
