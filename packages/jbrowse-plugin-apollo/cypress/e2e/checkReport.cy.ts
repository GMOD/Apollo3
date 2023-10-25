describe('Run check reports', () => {
  before(() => {
    // eslint-disable-next-line prettier/prettier
    const gff = `${Cypress.config('downloadsFolder')}/PlasmoDB-64_Pfalciparum3D7.fasta.gff3`
    cy.exec(
      `curl -L -s https://plasmodb.org/common/downloads/release-64/Pfalciparum3D7/gff/data/PlasmoDB-64_Pfalciparum3D7.gff \
      | grep -P '^##|^Pf3D7_01_v3' > ${gff}
      echo '##FASTA' >> ${gff}
      curl -L -s https://plasmodb.org/common/downloads/release-64/Pfalciparum3D7/fasta/data/PlasmoDB-64_Pfalciparum3D7_Genome.fasta \
      | awk -v start=0 '{
        if(start == 1 && $1 ~ "^>"){exit 0} 
        if($1 ~ "^>Pf3D7_01_v3") {start = 1} 
        if(start == 1){print $0}
      }' >> ${gff}`,
    ).then((result) => {
      cy.log(result.stderr)
    })
  })

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

  it('Real data', () => {
    cy.addAssemblyFromGff(
      'PlasmoDB-64_Pfalciparum3D7.fasta.gff3',
      `${Cypress.config(
        'downloadsFolder',
      )}/PlasmoDB-64_Pfalciparum3D7.fasta.gff3`,
    )
    cy.selectAssemblyToView('PlasmoDB-64_Pfalciparum3D7.fasta.gff3')

    cy.searchFeatures('PF3D7_0102200', 1)
    cy.contains('tbody', 'PF3D7_0102200', { timeout: 10_000 })

    const query = 'Pf3D7_01_v3:30000..200000'
    cy.get('input[placeholder="Search for location"]').type(
      `{selectall}{backspace}${query}{enter}`,
    )
    cy.contains('tbody', 'PF3D7_0102200', { timeout: 10_000 })
    cy.contains('tbody', 'PF3D7_0104300', { timeout: 10_000 })

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
