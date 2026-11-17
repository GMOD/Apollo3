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

interface HoverTestView {
  bpToPx(args: {
    refName: string
    coord: number
    regionNumber: number
  }): { offsetPx: number } | undefined
  offsetPx: number
  displayedRegions: { refName: string }[]
  tracks: { displays: { type: string; apolloRowHeight: number }[] }[]
}

/**
 * The number of pixels drawn on a canvas, optionally only in a band of rows
 * given in CSS pixels
 */
function countCanvasPixels($canvas: JQuery, top = 0, height?: number) {
  const canvas = $canvas[0] as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No canvas context')
  }
  const scale = canvas.height / canvas.getBoundingClientRect().height
  const { data } = ctx.getImageData(
    0,
    Math.round(top * scale),
    canvas.width,
    height === undefined ? canvas.height : Math.round(height * scale),
  )
  let count = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      count++
    }
  }
  return count
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

    it('Highlights a hovered feature and shows its tooltip', () => {
      // Wait for the features to be drawn, so there's something to hover
      cy.get('canvas[data-testid="canvas"]', { timeout: 10_000 }).should(
        ($canvas: JQuery) => {
          expect(countCanvasPixels($canvas)).to.be.greaterThan(0)
        },
      )
      cy.window().then((win) => {
        const [view] = (
          win as unknown as {
            JBrowseRootModel: { session: { views: HoverTestView[] } }
          }
        ).JBrowseRootModel.session.views
        const display = view.tracks
          .flatMap((track) => track.displays)
          .find((d) => d.type === 'LinearApolloDisplay')
        if (!display) {
          throw new Error('No graphical Apollo display')
        }
        const { apolloRowHeight } = display
        // The middle of the CDS's second segment (741..985), which the first
        // row shows
        const px = view.bpToPx({
          refName: view.displayedRegions[0].refName,
          coord: 860,
          regionNumber: 0,
        })
        if (!px) {
          throw new Error('Hover position is outside view')
        }
        const x = px.offsetPx - view.offsetPx
        const y = apolloRowHeight / 2

        cy.get('canvas[data-testid="overlayCanvas"]')
          .as('overlay')
          .should(($canvas) => {
            expect(countCanvasPixels($canvas, 0, apolloRowHeight)).to.eq(0)
          })
        cy.get('@overlay').trigger('mousemove', x, y)

        cy.contains('Type: CDS').should('contain.text', 'Loc: 61..1874')
        cy.get('@overlay').should(($canvas: JQuery) => {
          expect(
            countCanvasPixels($canvas, 0, apolloRowHeight),
          ).to.be.greaterThan(0)
        })

        // React builds onMouseLeave from mouseout events, not mouseleave
        cy.get('@overlay').trigger('mouseout')
        cy.contains('Type: CDS').should('not.exist')
        cy.get('@overlay').should(($canvas: JQuery) => {
          expect(countCanvasPixels($canvas, 0, apolloRowHeight)).to.eq(0)
        })
      })
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
