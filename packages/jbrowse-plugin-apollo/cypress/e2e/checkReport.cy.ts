describe('Run check reports', () => {
  // before(() => {
  //   // eslint-disable-next-line prettier/prettier
  //   const hsGff = `${Cypress.config('downloadsFolder')}/Homo_sapiens.18.fasta.gff3`
  //   cy.exec(
  //     `curl -L -s https://ftp.ensembl.org/pub/release-110/gff3/homo_sapiens/Homo_sapiens.GRCh38.110.chromosome.18.gff3.gz \
  //         | gunzip > ${hsGff}
  //         echo '##FASTA' >> ${hsGff}
  //         curl -L -s https://ftp.ensembl.org/pub/release-110/fasta/homo_sapiens/dna/Homo_sapiens.GRCh38.dna.chromosome.18.fa.gz \
  //         | gunzip >> ${hsGff}`,
  //   ).then((result) => {
  //     cy.log(result.stderr)
  //   })
  // })

  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Does not report errors in correct sequence', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene01', 1)
    cy.contains('tbody', 'gene01', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(/Found 0 /)
          expect(arg).not.to.contain('gene')
        }
      })
  })

  it('Handle CDS not a multiple of 3', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene06', 1)
    cy.contains('tbody', 'gene06', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(
            /Found 2 |MultipleOfThreeCheck|StopCodonCheck |gene06.* TAG /,
          )
        }
      })
  })

  it('Can log unexpected stop codon in cDNA with multiple CDSs', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene02', 1)
    cy.contains('tbody', 'gene02', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(/Found 1 |gene02.* TAG /)
        }
      })
  })

  it('Can log multiple stop codons in reverse strand', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene04', 1)
    cy.contains('tbody', 'gene04', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(/Found 2|gene04.* TAG |gene04.* TGA/)
        }
      })
  })

  it('Can scan discontinous locations', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene03', 1)
    cy.contains('tbody', 'gene03', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(/Found 2|gene03.* TAG /)
        }
      })
  })

  it.skip('No errors in real data', () => {
    cy.addAssemblyFromGff('Homo_sapiens.18.fasta.gff3', 'test_data/cdsChecks/stopcodon.gff3hsGff')
    // cy.selectAssemblyToView('Homo_sapiens.18.fasta.gff3')

    // cy.searchFeatures('gene05', 1)
    // cy.contains('tbody', 'gene05', { timeout: 10_000 })

    // cy.window()
    //   .its('console')
    //   .then((console) => {
    //     cy.spy(console, 'log').as('log')
    //   })

    // cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
    //   .contains('Apollo')
    //   .click({ force: true, timeout: 10_000 })
    // cy.contains('Check stop codons', { timeout: 10_000 }).click()

    // cy.get('@log')
    //   .invoke('getCalls')
    //   .each((call) => {
    //     for (const arg of call.args) {
    //       expect(arg).to.match(/Found 0 /)
    //       expect(arg).not.to.contain('gene')
    //     }
    //   })
  })

  it('FIXME: Report error in SO other than CDS', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')

    cy.searchFeatures('gene05', 1)
    cy.contains('tbody', 'gene05', { timeout: 10_000 })

    cy.window()
      .its('console')
      .then((console) => {
        cy.spy(console, 'log').as('log')
      })

    cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
      .contains('Apollo')
      .click({ force: true, timeout: 10_000 })
    cy.contains('Check stop codons', { timeout: 10_000 }).click()

    cy.get('@log')
      .invoke('getCalls')
      .each((call) => {
        for (const arg of call.args) {
          expect(arg).to.match(/Found 0 /)
          expect(arg).not.to.contain('gene')
        }
      })
  })
})
