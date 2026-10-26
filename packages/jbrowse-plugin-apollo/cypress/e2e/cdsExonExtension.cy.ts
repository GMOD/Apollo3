import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface GraphicalDisplay {
  type: string
  seenFeatures: Map<string, AnnotationFeature>
  getRowForFeature(feature: AnnotationFeature): number | undefined
  apolloRowHeight: number
  apolloDragging: { feature: AnnotationFeature; current: { bp: number } } | null
}

function flatten(f: AnnotationFeature): AnnotationFeature[] {
  return [
    f,
    ...[...(f.children?.values() ?? [])].flatMap((feature) => flatten(feature)),
  ]
}

describe('CDS boundary extension', () => {
  afterEach(() => cy.deleteAssemblies())

  it('extends the enclosing exon through a graphical drag, persists, and undoes', () => {
    cy.loginAsGuest()
    const assemblyName = 'cds-exon-extension'
    cy.addAssemblyFromGff(assemblyName, 'test_data/mergeTranscripts.gff3')
    cy.selectAssemblyToView(assemblyName, 'chr2:1..60')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=exon2')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('28')
      })
    cy.window().then((win) => {
      const root = (
        win as unknown as {
          JBrowseRootModel: {
            session: {
              views: {
                tracks: {
                  displays: GraphicalDisplay[]
                }[]
                bpToPx: LinearGenomeViewModel['bpToPx']
                offsetPx: number
              }[]
            }
          }
        }
      ).JBrowseRootModel
      const [view] = root.session.views
      const display = view.tracks[0].displays.find(
        (d) => d.type === 'LinearApolloDisplay',
      )
      if (!display) {
        throw new Error('No graphical Apollo display')
      }
      const features = [...display.seenFeatures.values()].flatMap((feature) =>
        flatten(feature),
      )
      const feature = features.find((f) =>
        f.attributes.get('gff_id')?.includes('cds1'),
      )
      if (!feature) {
        throw new Error('No reported CDS')
      }
      const row = display.getRowForFeature(feature)
      const startPx = view.bpToPx({
        refName: 'chr2',
        coord: 26,
        regionNumber: 0,
      })
      const endPx = view.bpToPx({ refName: 'chr2', coord: 33, regionNumber: 0 })
      if (!startPx || !endPx) {
        throw new Error('CDS boundary is outside view')
      }
      const x = startPx.offsetPx - view.offsetPx
      const endX = endPx.offsetPx - view.offsetPx
      if (row === undefined) {
        throw new Error('No CDS layout row')
      }
      const y = row * display.apolloRowHeight + display.apolloRowHeight / 2
      cy.get('[data-testid="overlayCanvas"]').trigger('mousedown', x - 1, y, {
        force: true,
        button: 0,
        buttons: 1,
      })
      cy.window().then(() =>
        expect(display.apolloDragging?.feature._id).to.equal(feature._id),
      )
      cy.intercept('POST', '**/changes').as('dragChange')
      cy.get('[data-testid="overlayCanvas"]').trigger('mousemove', endX, y, {
        force: true,
        buttons: 1,
      })
      cy.window().then(() =>
        expect(display.apolloDragging?.current.bp).to.equal(33),
      )
      cy.get('[data-testid="overlayCanvas"]').trigger('mouseup', endX, y, {
        force: true,
        button: 0,
      })
      cy.wait('@dragChange').its('response.statusCode').should('equal', 201)
    })
    cy.refreshTableEditor()
    cy.contains('Id=exon2')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=mrna02')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=cds1')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=gene02')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('40')
      })
    cy.screenshot('cds-exon-after-drag', { capture: 'viewport' })
    cy.selectFromApolloMenu('Undo')
    cy.wait('@dragChange').its('response.statusCode').should('equal', 201)
    cy.refreshTableEditor()
    cy.contains('Id=exon2')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('28')
      })
    cy.contains('Id=mrna02')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('28')
      })
    cy.contains('Id=cds1')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('26')
      })
    cy.screenshot('cds-exon-after-undo', { capture: 'viewport' })
    cy.selectFromApolloMenu('Redo')
    cy.wait('@dragChange').its('response.statusCode').should('equal', 201)
    cy.refreshTableEditor()
    cy.contains('Id=exon2')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.reload()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=exon2')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=mrna02')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=cds1')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('33')
      })
    cy.contains('Id=gene02')
      .parent()
      .find('input')
      .should(($inputs) => {
        expect([...$inputs].map((input) => input.value)).to.include('40')
      })
    cy.screenshot('cds-exon-after-reload', { capture: 'viewport' })
  })
})
