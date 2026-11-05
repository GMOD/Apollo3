/* eslint-disable cypress/no-unnecessary-waiting */
// The drawer can hold several widgets (e.g. the track selector and the jobs
// list from importing features), and closing it only closes the top one, so
// keep closing until it's gone. Otherwise it narrows the view and changes the
// snapshots.
function closeDrawers(attemptsLeft = 5) {
  cy.get('body').then(($body) => {
    if (
      attemptsLeft > 0 &&
      $body.find('button[aria-label="Close drawer"]').length > 0
    ) {
      cy.get('button[aria-label="Close drawer"]').click()
      closeDrawers(attemptsLeft - 1)
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
  cy.contains('[role="menuitem"]', /^Show$/, { timeout: 10_000 }).click()
  cy.contains('Show all regions in assembly', { timeout: 10_000 }).click()
}

function compareCanvasSnapshot(testId: string, name: string) {
  cy.wait(2000) // Wait for render
  cy.get(`canvas[data-testid="${testId}"]`).compareSnapshot({
    name,
    // To account for font, etc. differences in other envs, e.g. GitHub Actions
    testThreshold: 0.03,
  })
}

describe('Simple tests for visuals', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  describe('Gene model', () => {
    afterEach(() => {
      cy.clearFeatures()
    })

    it('Shows correct gene model', () => {
      cy.importFeatures('test_data/so_types.gff3', 'so_types.gff3')
      cy.selectAssemblyToView('so_types.gff3')
      closeDrawers()

      cy.searchFeatures('TGGT1_200010', 1)
      cy.wait(5000)
      cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot({
        name: 'gene-model',
        // To account for font, etc. differences in other envs, e.g. GitHub Actions
        testThreshold: 0.03,
      })
    })
  })

  describe('Glyph types', () => {
    // Add the assembly once and share it among the tests in this block, so
    // each snapshot is its own test and one failing doesn't skip the others
    before(() => {
      cy.clearFeatures()
      cy.loginAsGuest()
      cy.importFeatures('test_data/glyph_types.gff3', 'glyph_types.gff3')
    })

    after(() => {
      cy.clearFeatures()
    })

    beforeEach(() => {
      cy.selectAssemblyToView('glyph_types.gff3')
      cy.contains('Open track selector').click()
      cy.contains('Reference sequence (').click()
      cy.contains('Annotations (').click()
      closeDrawers()
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

  describe('Track resizing', () => {
    afterEach(() => {
      cy.clearFeatures()
    })

    it('Resizes a track by dragging its bottom resize handle', () => {
      cy.importFeatures('test_data/so_types.gff3', 'so_types.gff3')
      cy.selectAssemblyToView('so_types.gff3')
      cy.contains('Open track selector').click()
      cy.contains('Reference sequence (').click()
      cy.contains('Annotations (so_types.gff3)').click()

      closeDrawers()

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
})
