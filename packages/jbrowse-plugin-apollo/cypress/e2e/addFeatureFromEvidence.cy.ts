// jbrowse-web exposes its root session on `window.JBrowseSession` for use by
// e2e tests; this is the minimal slice of that shape this spec relies on.
interface JBrowseDebugWindow extends Window {
  JBrowseSession?: {
    views: {
      offsetPx: number
      bpToPx: (location: { refName: string; coord: number }) => {
        offsetPx: number
      }
      tracks: {
        configuration: { trackId: string }
        displays: { mouseoverExtraInformation?: string }[]
      }[]
    }[]
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function canCreateApolloAnnotationFromEvidence() {
  cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz', 'SM_V10_3:323,000..330,000')
  cy.openAnnotationsTrack()

  // Add an evidence track pointing at a gff3 file that isn't part of the
  // Apollo annotations themselves
  cy.get('button').contains('File').click()
  cy.contains('Open track...').click()
  cy.contains('Add a track')
  cy.get('[data-testid="urlInput"]')
    .eq(0)
    .type('http://localhost:9000/test_data/SM_V10_3.sorted.gff3.gz')
  // The index file URL is inferred automatically; leave it as suggested
  cy.contains(
    'Found "SM_V10_3.sorted.gff3.gz.tbi" next to the main file and filled it in.',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()
  cy.get('[data-testid="trackNameInput"]').should(
    'have.value',
    'SM_V10_3.sorted.gff3.gz',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()

  cy.contains('Smp_093620', { timeout: 20_000 }).rightclick({
    force: true,
  })
  cy.contains('Create Apollo annotation').click()
  cy.contains('Create Apollo Annotation')
  cy.contains('gene - Smp_093620 (324611..327358)')
  cy.contains('button', 'Create').click()
  cy.get('[data-testid="snackbar-success"]').should(
    'contain',
    'Successfully copied selected gene and transcript(s)',
  )

  // Check the copied gene and mRNA actually ended up in the Apollo track.
  // Scope to the Annotations track's own header, since a second,
  // non-Apollo track (the evidence track) is also open and its track menu
  // doesn't have an "Appearance" submenu.
  cy.contains('Annotations (SM_V10_3.fasta.gff3.gz)')
    .closest('.MuiPaper-elevation1')
    .find('[data-testid="track_menu_icon"]')
    .click()
  cy.contains('Appearance').trigger('mouseover')
  cy.contains('Show both graphical and table display').click()
  cy.press(Cypress.Keyboard.Keys.ESC)
  cy.press(Cypress.Keyboard.Keys.ESC)

  cy.get('tbody', { timeout: 10_000 }).within(() => {
    cy.contains('td', 'Id=gene:Smp_093620')
      .parent()
      .within(() => {
        cy.contains('td', '324611')
        cy.contains('td', '327358')
      })
    cy.contains('td', 'Id=transcript:Smp_093620.1')
  })
}

function canCreateApolloAnnotationFromReadEvidence() {
  cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz', 'SM_V10_3:417,000..424,000')
  cy.openAnnotationsTrack()

  // Add a CRAM evidence track with read alignments that aren't part of the
  // Apollo annotations themselves
  cy.get('button').contains('File').click()
  cy.contains('Open track...').click()
  cy.contains('Add a track')
  cy.get('[data-testid="urlInput"]')
    .eq(0)
    .type('http://localhost:9000/test_data/ERR6365560.SM_V10_3.cram')
  // The index file URL is inferred automatically; leave it as suggested
  cy.contains(
    'Found "ERR6365560.SM_V10_3.cram.crai" next to the main file and filled it in.',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()
  cy.get('[data-testid="trackNameInput"]').should(
    'have.value',
    'ERR6365560.SM_V10_3.cram',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()
  cy.contains('ERR6365560.SM_V10_3.cram', { timeout: 20_000 })
  // Close the "Add a track" drawer: while open it narrows the view, which
  // pushes the alignments track past its feature-density threshold into a
  // summarized coverage-only display with no individual reads to target.
  cy.get('button[aria-label="Minimize drawer"]').click()

  // The read pileup is drawn on a canvas, so individual reads can't be
  // targeted by visible text the way GFF3 glyphs can. Several alignment
  // records in this file share the read name "ERR6365560.70743" (they're
  // secondary/supplementary alignments of the same fragment); the one we
  // want is uniquely identified by its exact coordinates and strand, which
  // is exactly what JBrowse reports as the tooltip for whatever the mouse is
  // over. Every copy of this read starts at the same reference position, so
  // probe straight down that pixel column until the tooltip matches, then
  // fire a real contextmenu event there - the same thing a user right-click
  // would do - to open Apollo's "Create Apollo annotation" menu item.
  const targetTooltip = 'ERR6365560.70743 SM_V10_3:418,159-423,701 (-)'
  cy.window().then(async (win) => {
    const debugWin = win as unknown as JBrowseDebugWindow
    const view = debugWin.JBrowseSession?.views[0]
    const track = view?.tracks.find((t) =>
      /cram/i.test(t.configuration.trackId),
    )
    if (!view || !track) {
      throw new Error('Could not find the CRAM track in the JBrowse session')
    }
    const [display] = track.displays

    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      const canvas = win.document.querySelector<HTMLCanvasElement>(
        `[data-testid*="${track.configuration.trackId.toLowerCase()}"] [data-testid="pileup-display"] canvas`,
      )
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const { offsetPx: bpOffsetPx } = view.bpToPx({
          refName: 'SM_V10_3',
          coord: 418_200,
        })
        const x = bpOffsetPx - view.offsetPx
        for (let y = rect.top + 1; y < rect.bottom; y += 2) {
          canvas.dispatchEvent(
            new MouseEvent('mousemove', {
              clientX: x,
              clientY: y,
              bubbles: true,
            }),
          )
          await sleep(5)
          if (display.mouseoverExtraInformation === targetTooltip) {
            canvas.dispatchEvent(
              new MouseEvent('contextmenu', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true,
                button: 2,
              }),
            )
            return
          }
        }
      }
      await sleep(200)
    }
    throw new Error(`Could not find a read matching "${targetTooltip}"`)
  })

  cy.contains('Create Apollo annotation').click()
  cy.contains('Create Apollo Annotation')
  cy.contains('mRNA - ERR6365560.70743 (418159..423701)')
  cy.contains('button', 'Create').click()
  cy.get('[data-testid="snackbar-success"]').should(
    'contain',
    'Successfully created a new gene with selected transcripts',
  )

  // Check the copied gene and mRNA actually ended up in the Apollo track.
  // Scope to the Annotations track's own header, since a second,
  // non-Apollo track (the evidence track) is also open and its track menu
  // doesn't have an "Appearance" submenu.
  cy.contains('Annotations (SM_V10_3.fasta.gff3.gz)')
    .closest('.MuiPaper-elevation1')
    .find('[data-testid="track_menu_icon"]')
    .click()
  cy.contains('Appearance').trigger('mouseover')
  cy.contains('Show both graphical and table display').click()
  cy.press(Cypress.Keyboard.Keys.ESC)
  cy.press(Cypress.Keyboard.Keys.ESC)

  cy.get('tbody', { timeout: 10_000 }).within(() => {
    cy.contains('td', 'Name=ERR6365560.70743')
      .parent()
      .within(() => {
        cy.contains('td', '418159')
        cy.contains('td', '423701')
      })
  })
}

describe('Add feature from evidence', () => {
  describe('using the collaboration server', () => {
    beforeEach(() => {
      cy.loginAsGuest()
    })
    afterEach(() => {
      cy.clearFeatures()
    })

    it('Can create an Apollo annotation from a feature in a gene track', () => {
      canCreateApolloAnnotationFromEvidence()
    })

    it(
      'Can create an Apollo annotation from a read in a CRAM track',
      { defaultCommandTimeout: 25_000 },
      () => {
        canCreateApolloAnnotationFromReadEvidence()
      },
    )
  })

  describe('using local editing', () => {
    beforeEach(() => {
      cy.visitLocalSession()
    })
    afterEach(() => {
      cy.clearLocalFeatures()
    })

    it('Can create an Apollo annotation from a feature in a gene track', () => {
      canCreateApolloAnnotationFromEvidence()
    })

    it(
      'Can create an Apollo annotation from a read in a CRAM track',
      { defaultCommandTimeout: 25_000 },
      () => {
        canCreateApolloAnnotationFromReadEvidence()
      },
    )
  })
})
