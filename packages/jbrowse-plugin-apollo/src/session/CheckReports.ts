enum CHECK_TYPE {
  'StopCodonCheck',
}

enum STOP_CODONS {
  'TAG',
  'TAA',
  'TGA',
}

export class CheckReport {
  private type: CHECK_TYPE
  private featureId: string
  private message: string

  constructor(type: CHECK_TYPE, featureId: string, message: string) {
    this.type = type
    this.featureId = featureId
    this.message = message
  }

  public toString = (): string => {
    const checkTypeName: string = CHECK_TYPE[this.type]
    return `Check type: ${checkTypeName}; featureId: ${this.featureId}; message: ${this.message}`
  }
}

function splitSequenceInCodons(cds: string): string[] {
  if (cds.length % 3 !== 0) {
    throw new Error(
      `Length of coding sequence is not a multiple of 3: ${cds.length}`,
    )
  }
  const codons: string[] = []
  for (let i = 0; i <= cds.length - 3; i += 3) {
    codons.push(cds.slice(i, i + 3))
  }
  return codons
}

export function detectStopCodons(
  featureId: string,
  cds: string,
): CheckReport[] {
  const checkReports: CheckReport[] = []
  const codons: string[] = splitSequenceInCodons(cds)
  codons.pop() // Last codon is supposed to be a stop
  for (const stopCodon in STOP_CODONS) {
    const st: string = STOP_CODONS[stopCodon]
    for (const codon of codons) {
      if (st === codon) {
        const report: CheckReport = new CheckReport(
          CHECK_TYPE.StopCodonCheck,
          featureId,
          `Stop codon ${st} found in ${codons}`,
        )
        checkReports.push(report)
      }
    }
  }
  return checkReports
}
