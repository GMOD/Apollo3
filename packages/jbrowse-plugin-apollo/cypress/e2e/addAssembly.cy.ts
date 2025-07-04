describe('Add Assembly', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Can add assembly from non-editable fasta', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.get('Button[data-testid="submit-button"]').should('be.disabled')
      cy.get('[data-testid="fasta-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        cy.get('input[type="checkbox"]').should('not.be.enabled')
      })

      cy.get('input[data-testid="fasta-input-file"]').selectFile(
        'test_data/volvox.fa.gz',
      )
      cy.get('input[data-testid="fai-input-file"]').selectFile(
        'test_data/volvox.fa.gz.fai',
      )
      cy.get('input[data-testid="gzi-input-file"]').selectFile(
        'test_data/volvox.fa.gz.gzi',
      )
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
    // Check logs to ensure we submitted index files
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('View Change Log').click()
    cy.get('textarea').should('have.length', 1)
    cy.get('textarea').within(() => {
      cy.contains('"AddAssemblyFromFileChange"')
      cy.contains('"gzi":')
      cy.contains('"fai":')
    })
  })

  it('Can add assembly from editable gzip fasta', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.get('[data-testid="sequence-is-editable-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('input[data-testid="fasta-input-file"]').selectFile(
        'test_data/volvox.fa.gz',
      )
      cy.get('input[data-testid="fai-input-file"]').should('be.disabled')
      cy.get('input[data-testid="gzi-input-file"]').should('be.disabled')
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
  })

  it('Can add assembly from editable uncompressed fasta', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.get('[data-testid="sequence-is-editable-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('input[data-testid="fasta-input-file"]').selectFile(
        'test_data/volvox.fa',
      )
      cy.get('[data-testid="fasta-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('not.be.checked')
      })
      cy.get('input[data-testid="fai-input-file"]').should('be.disabled')
      cy.get('input[data-testid="gzi-input-file"]').should('be.disabled')
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
  })

  it('Can add assembly from remote url', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.get('[data-testid="files-on-url-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('[data-testid="sequence-is-editable-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('be.disabled')
      })
      cy.get('[data-testid="fasta-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        cy.get('input[type="checkbox"]').should('not.be.enabled')
      })
      cy.get('[data-testid="fasta-input-url"]').within(() => {
        cy.get('input').type('http://localhost:3131/tiny.fasta.gz')
      })
      cy.get('[data-testid="fai-input-url"]').within(() => {
        cy.get('input').clear()
        cy.get('input').type('http://localhost:3131/tiny.fasta.gz.fai')
      })
      cy.get('[data-testid="gzi-input-url"]').within(() => {
        cy.get('input').clear()
        cy.get('input').type('http://localhost:3131/tiny.fasta.gz.gzi')
      })
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
  })

  it('Can add assembly and features from gff3', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.contains('GFF3 input')
        .parent()
        .parent()
        .within(() => {
          cy.get('button').click()
        })
      cy.get('input[data-testid="gff3-input-file"]').selectFile(
        'test_data/volvox.fasta.gff3',
      )
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
    // Check logs to ensure we submitted features
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('View Change Log').click()
    cy.get('textarea').should('have.length', 1)
    cy.get('textarea').within(() => {
      cy.contains('"AddAssemblyAndFeaturesFromFileChange"')
    })
  })

  it('Can add assembly from gff3 wihtout importing features', () => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.contains('GFF3 input')
        .parent()
        .parent()
        .within(() => {
          cy.get('button').click()
        })
      cy.get('input[data-testid="gff3-input-file"]').selectFile(
        'test_data/volvox.fasta.gff3',
      )
      cy.contains('Load features from GFF3').within(() => {
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
    // Check logs to ensure we submitted only assembly
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('View Change Log').click()
    cy.get('textarea').should('have.length', 1)
    cy.get('textarea').within(() => {
      cy.contains('"AddAssemblyFromFileChange"')
    })
  })

  it('Keep original defaults when switching panels', () => {
    // We select, but don't submit, a gff3 input. This should switch to "sequence is editable" mode.
    // Then we select fasta input: Ensure "Allow sequence to be edited" is unchecked and index files are required.
    // Basically, defaults don't change after having implicitly switched to editable mode.
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.contains('GFF3 input')
        .parent()
        .parent()
        .within(() => {
          cy.get('button').click()
        })
      cy.get('input[data-testid="gff3-input-file"]').selectFile(
        'test_data/volvox.fasta.gff3',
      )

      // Switch to FASTA input section
      cy.contains('FASTA input')
        .parent()
        .within(() => {
          cy.get('button').click()
        })
      // Indexes required
      cy.get('input[data-testid="fai-input-file"]').should('be.enabled')
      cy.get('input[data-testid="gzi-input-file"]').should('be.enabled')

      cy.get('[data-testid="sequence-is-editable-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('not.be.checked')
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('input[data-testid="fai-input-file"]').should('be.disabled')
      cy.get('input[data-testid="gzi-input-file"]').should('be.disabled')
    })
  })

  it('Add assembly from gzip GFF3 file', () => {
    cy.exec(
      'gzip -c test_data/volvox.fasta.gff3 > test_data/volvox.fasta.gff3.gz',
    )
    cy.addAssemblyFromGff('volvox.fasta', 'test_data/volvox.fasta.gff3.gz')
    cy.exec('rm test_data/volvox.fasta.gff3.gz')
  })

  it('Can override autodetection of gzip compression in FASTA', () => {
    cy.exec('cp test_data/volvox.fa test_data/tmp.fake.gz')
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.get('[data-testid="sequence-is-editable-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('input[data-testid="fasta-input-file"]').selectFile(
        'test_data/tmp.fake.gz',
      )
      cy.get('[data-testid="fasta-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
    cy.exec('rm test_data/tmp.fake.gz')
  })

  it('Can override autodetection of gzip compression in GFF3', () => {
    cy.exec('cp test_data/volvox.fasta.gff3 test_data/tmp.fake.gz')
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('Add Assembly').click()
    cy.get('form[data-testid="submit-form"]').within(() => {
      cy.get('input[type="TextField"]').type('volvox')
      cy.contains('GFF3 input')
        .parent()
        .parent()
        .within(() => {
          cy.get('button').click()
        })
      cy.get('[data-testid="gff3-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('not.be.checked')
      })
      cy.get('input[data-testid="gff3-input-file"]').selectFile(
        'test_data/tmp.fake.gz',
      )
      cy.get('[data-testid="gff3-is-gzip-checkbox"]').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        cy.get('input[type="checkbox"]').click()
      })
      cy.get('Button[data-testid="submit-button"]').click()
    })
    cy.contains('added successfully', { timeout: 10_000 })
    cy.reload()
    cy.contains('Launch view').click()
    cy.get('[data-testid="assembly-selector-textfield"]').within(() => {
      cy.contains('volvox')
    })
    // Check logs to ensure we submitted only assembly
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click()
    cy.contains('View Change Log').click()
    cy.get('textarea').should('have.length', 1)
    cy.get('textarea').within(() => {
      cy.contains('"AddAssemblyAndFeaturesFromFileChange"')
    })
    cy.exec('rm test_data/tmp.fake.gz')
  })
})
