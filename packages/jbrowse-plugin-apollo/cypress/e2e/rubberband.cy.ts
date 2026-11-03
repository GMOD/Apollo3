/** Get the sequence of `refName` from the ##FASTA section of a GFF3 file */
function getFastaSequence(gff3: string, refName: string): string {
  const fastaStart = gff3.indexOf('##FASTA')
  if (fastaStart === -1) {
    throw new Error('GFF3 file has no ##FASTA section')
  }
  let currentName: string | undefined
  const lines: string[] = []
  for (const line of gff3.slice(fastaStart).split('\n').slice(1)) {
    if (line.startsWith('>')) {
      if (currentName === refName) {
        break
      }
      ;[currentName] = line.slice(1).split(/\s/)
    } else if (currentName === refName) {
      lines.push(line.trim())
    }
  }
  if (lines.length === 0) {
    throw new Error(`No sequence found for "${refName}"`)
  }
  return lines.join('')
}

describe('Rubberband selection', () => {
  before(() => {
    cy.deleteAssemblies()
    cy.deleteIndexedDatabases()
    cy.addOntologies()
  })

  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Can get sequence via rubberband selection', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(
      assemblyName,
      `test_data/${assemblyName}`,
      true,
      false,
    )
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..10000')

    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5, {
      force: true,
    })
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Get sequence').click()

    // Which bases the drag covers depends on how wide the view is (e.g. whether
    // a drawer is open), so check that the dialog's sequence matches the region
    // it says was selected instead of expecting a fixed sequence.
    cy.readFile<string>(`test_data/${assemblyName}`).then((gff3) => {
      const reference = getFastaSequence(gff3, 'ctgA').toLowerCase()
      cy.contains('[role="dialog"]', 'Reference sequence')
        .find('textarea:not([aria-hidden="true"])')
        .should(($textarea) => {
          const value = $textarea.val()
          if (typeof value !== 'string') {
            throw new TypeError('Sequence textarea has no value')
          }
          const [header = '', ...sequenceLines] = value.trim().split('\n')
          const match = /^>ctgA:(\d+)-(\d+)$/.exec(header.trim())
          if (!match) {
            throw new Error(`Unexpected FASTA header "${header}"`)
          }
          const start = Number(match[1])
          const end = Number(match[2])
          expect(end, 'selection end').to.be.greaterThan(start)
          expect(sequenceLines.join('').trim().toLowerCase()).to.equal(
            reference.slice(start - 1, end),
          )
        })
    })
  })

  it('Can add new feature via rubberband selection', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(
      assemblyName,
      `test_data/${assemblyName}`,
      true,
      false,
    )
    cy.selectAssemblyToView(assemblyName, 'ctgA:1..10000')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 120, 5, {
      force: true,
    })
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 120, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').should('be.visible')
    cy.contains('Add feature with a sequence ontology type').click()
    cy.get('[data-testid="add-feature-dialog"]')
      .contains('Type')
      .parent()
      .within(() => {
        cy.get('input').click({ timeout: 60_000 })
      })
    cy.contains('li', /^remark$/, { timeout: 60_000, matchCase: false }).click()
    cy.get('button').contains('Submit').click()
    cy.get('tbody', { timeout: 10_000 }).find(
      'input[type="text"][value="remark"]',
    )

    cy.importFeatures(`test_data/${assemblyName}`, assemblyName, false)
    // A fresh reload is needed for the imported features to show up in the
    // already-open view.
    cy.reload()
    cy.get('input[type="text"][value="gene"]', { timeout: 10_000 })

    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 140, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 160, 5, {
      force: true,
    })
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 160, 5, {
      force: true,
    })
    cy.contains('Add new feature').click()
    cy.get('[data-testid="add-feature-dialog"]').should('be.visible')
    cy.contains('Add feature with a sequence ontology type').click()
    cy.get('[data-testid="add-feature-dialog"]')
      .contains('Type')
      .parent()
      .within(() => {
        cy.get('input').click({ timeout: 60_000 })
      })
    cy.contains('li', /^remark$/, { timeout: 60_000, matchCase: false }).click()
    cy.get('button').contains('Submit').click()
    cy.get('tbody', { timeout: 10_000 }).find(
      'input[type="text"][value="remark"]',
    )
  })
})
