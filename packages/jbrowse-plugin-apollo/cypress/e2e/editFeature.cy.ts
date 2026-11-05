import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface GraphicalDisplay {
  type: string
  seenFeatures: Map<string, AnnotationFeature>
  getRowForFeature(feature: AnnotationFeature): number | undefined
  apolloRowHeight: number
  apolloDragging: { feature: AnnotationFeature; current: { bp: number } } | null
}

describe('Different ways of editing features', () => {
  before(() => {
    cy.clearFeatures()
    cy.deleteIndexedDatabases()
    cy.addOntologies()
  })

  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.clearFeatures()
  })

  it('Edit feature via table editor', () => {
    const assemblyName = 'space.gff3'
    cy.importFeatures(
      `test_data/${assemblyName}`,
      assemblyName,
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView(assemblyName, 'ctgA:9400..9600')

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()

    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'Match5')
      .within(() => {
        cy.get('input[type="text"][value="EST_match"]').type('CDS{enter}', {
          force: true,
        })
        cy.contains('td', '9520').within(() => {
          cy.get('input').type('{selectall}{backspace}9432')
        })
        cy.contains('td', '9900').within(() => {
          cy.get('input').type('{selectall}{backspace}9567')
        })
      })
    cy.get('body').click(0, 0)
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000)

    // Check edit is done
    cy.reload()
    cy.get('tbody', { timeout: 10_000 }).within(() => {
      cy.get('input[type="text"][value="CDS"]')
      cy.contains('9432')
      cy.contains('9567')
    })
  })

  it('FIXME: Can delete feature with checks', () => {
    cy.importFeatures(
      'test_data/cdsChecks/stopcodon.gff3',
      'stopcodon',
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView('stopcodon', 'chr2:1..30')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', '=cds02.1').rightclick()
    cy.contains('Delete feature').click()
    cy.contains('Are you sure you want to delete the selected feature?')
      .parent()
      .parent()
      .within(() => {
        cy.contains('button', /^yes$/, { matchCase: false }).click()
      })
    // Nice to fix: Avoid reloading to make the deleted row disappear
    cy.reload()
    cy.contains('td', '=gene02', { timeout: 10_000 })
    cy.contains('td', '=cds02.1', { timeout: 10_000 }).should('not.exist')
  })

  it('FIXME: Can delete single CDS mRNA with checks', () => {
    cy.importFeatures(
      'test_data/cdsChecks/stopcodon.gff3',
      'stopcodon',
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView('stopcodon', 'chr4:1..30')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', '=cds04.1').rightclick()
    cy.contains('Delete feature').click()

    // Fails with `Cannot destructure property 'topLevelFeature' of 'feature' as it is undefined.`
    // cy.contains('Are you sure you want to delete the selected feature?')
    //   .parent()
    //   .parent()
    //   .within(() => {
    //     cy.contains('button', /^yes$/, { matchCase: false }).click()
    //   })
    // cy.reload()
    // cy.contains('td', '=gene04', { timeout: 10_000 })
    // cy.contains('td', '=cds04.1', { timeout: 10_000 }).should('not.exist')
  })

  it('Can delete feature', () => {
    cy.importFeatures(
      'test_data/onegene.fasta.gff3',
      'onegene.fasta.gff3',
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView('onegene.fasta.gff3', 'ctgA:1..100')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', '=CDS1')
    cy.contains('td', '=tx1').rightclick()
    cy.contains('Delete feature').click()
    cy.contains('Are you sure you want to delete the selected feature?')
      .parent()
      .parent()
      .within(() => {
        cy.contains('button', /^yes$/, { matchCase: false }).click()
      })
    cy.contains('td', '=gx1')
    cy.contains('td', '=tx1').should('not.exist')
    cy.contains('td', '=CDS1').should('not.exist')
  })

  it('Suggest only valid SO terms from dropdown', () => {
    cy.importFeatures(
      'test_data/onegene.fasta.gff3',
      'onegene.fasta.gff3',
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView('onegene.fasta.gff3', 'ctgA:1..100')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    // In headless mode it seems to take a long time for menus to be populated
    cy.get('input[type="text"][value="CDS"]', { timeout: 60_000 }).click({
      timeout: 60_000,
      force: true,
    })
    cy.contains('li', /^start_codon$/, {
      timeout: 60_000,
      matchCase: false,
    }).should('exist')
    cy.contains('li', /^gene$/, { timeout: 60_000, matchCase: false }).should(
      'not.exist',
    )
  })

  it('Can add child feature via table editor', () => {
    cy.importFeatures(
      'test_data/onegene.fasta.gff3',
      'onegene.fasta.gff3',
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView('onegene.fasta.gff3', 'ctgA:1..100')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    // Right-click the ID cell rather than the type input. Right-clicking the
    // type input opens its autocomplete dropdown behind the dialog, and that
    // dropdown's options then shadow the dialog's options.
    cy.contains('td', '=CDS1', { timeout: 60_000 }).rightclick()
    cy.contains('Add child feature').click()
    cy.contains('Add new child feature')
      .parent()
      .within(() => {
        cy.get('form').within(() => {
          cy.contains('Start')
            .parent()
            .within(() => {
              cy.get('input').type('{selectall}{backspace}1')
            })
          cy.contains('End')
            .parent()
            .within(() => {
              cy.get('input').type('{selectall}{backspace}3')
            })
          cy.contains('Type')
            .parent()
            .within(() => {
              cy.get('input').click({ timeout: 60_000 })
            })
        })
      })
    cy.contains('li', /^start_codon$/, {
      timeout: 60_000,
      matchCase: false,
    }).click()
    cy.get('button').contains('Submit').click()
    cy.reload() // Ideally, you shouldn't need to reload to see the change?
    cy.get('tbody', { timeout: 60_000 }).within(() => {
      cy.get('input[value="start_codon"]').should('have.length', 1)
      cy.get('input[value="1"]').should('have.length', 5)
      cy.get('input[value="3"]').should('have.length', 1)
    })
  })

  it('Can drag and move position', () => {
    const assemblyName = 'space.gff3'
    cy.importFeatures(
      `test_data/${assemblyName}`,
      assemblyName,
      // eslint-disable-next-line unicorn/no-useless-undefined
      undefined,
    )
    cy.selectAssemblyToView(assemblyName, 'ctgA:9400..9600')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('tr', 'Match5', { timeout: 10_000 })
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('9520')
      })

    // Drag the start (left edge) of Match5 from 9520 to 9451
    cy.window().then((win) => {
      const { session } = (
        win as unknown as {
          JBrowseRootModel: {
            session: {
              views: {
                tracks: { displays: GraphicalDisplay[] }[]
                bpToPx: LinearGenomeViewModel['bpToPx']
                offsetPx: number
                bpPerPx: number
              }[]
            }
          }
        }
      ).JBrowseRootModel
      const [view] = session.views
      const display = view.tracks[0].displays.find(
        (d) => d.type === 'LinearApolloDisplay',
      )
      if (!display) {
        throw new Error('No graphical Apollo display')
      }
      const feature = [...display.seenFeatures.values()].find((f) =>
        f.attributes.get('gff_id')?.includes('Match5'),
      )
      if (!feature) {
        throw new Error('Match5 not found')
      }
      const row = display.getRowForFeature(feature)
      if (row === undefined) {
        throw new Error('No Match5 layout row')
      }
      const startPx = view.bpToPx({
        refName: 'ctgA',
        coord: feature.min,
        regionNumber: 0,
      })
      const endPx = view.bpToPx({
        refName: 'ctgA',
        coord: 9450,
        regionNumber: 0,
      })
      if (!startPx || !endPx) {
        throw new Error('Drag coordinates are outside view')
      }
      // Aim inside bases rather than exactly on base boundaries, where
      // floating-point error can make pxToBp land on the neighboring base.
      // Mousedown just inside the feature's start edge (within the 4px edge
      // tolerance), then move to the center of base 9450.
      const x = startPx.offsetPx - view.offsetPx + 2
      const endX = endPx.offsetPx - view.offsetPx + 0.5 / view.bpPerPx
      const y = row * display.apolloRowHeight + display.apolloRowHeight / 2
      cy.intercept('POST', '**/changes').as('dragChange')
      cy.get('[data-testid="overlayCanvas"]').trigger('mousedown', x, y, {
        force: true,
        button: 0,
        buttons: 1,
      })
      cy.window().then(() =>
        expect(display.apolloDragging?.feature._id).to.equal(feature._id),
      )
      cy.get('[data-testid="overlayCanvas"]').trigger('mousemove', endX, y, {
        force: true,
        buttons: 1,
      })
      cy.window().then(() =>
        expect(display.apolloDragging?.current.bp).to.equal(9450),
      )
      cy.get('[data-testid="overlayCanvas"]').trigger('mouseup', endX, y, {
        force: true,
        button: 0,
      })
      cy.wait('@dragChange').its('response.statusCode').should('equal', 201)
    })

    cy.refreshTableEditor()
    cy.contains('tr', 'Match5')
      .find('input')
      .should(($inputs) => {
        const values = [...$inputs].map((input) => input.value)
        expect(values).to.include('9451')
        expect(values).to.include('9900')
      })
  })
})
