import fs from 'fs'
import path from 'path'

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OboJson } from 'apollo-common'
import { GetOntologyTermsOperation } from 'apollo-shared'

import { OperationsService } from '../operations/operations.service'

@Injectable()
export class OntologiesService {
  public ontology: OboJson
  constructor(
    @Inject(forwardRef(() => OperationsService))
    private readonly operationsService: OperationsService,
    private readonly configService: ConfigService<
      { ONTOLOGY_FILE?: string },
      true
    >,
  ) {
    let ontologyFile = this.configService.get('ONTOLOGY_FILE', {
      infer: true,
    })
    if (!ontologyFile) {
      ontologyFile = path.join('..', '..', 'data', 'so.json')
    }
    try {
      const ontologyLocation = path.resolve(__dirname, ontologyFile)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      this.ontology = ontologyJson
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }
  }

  private readonly logger = new Logger(OntologiesService.name)

  getDescendants(parentType: string) {
    return this.operationsService.executeOperation<GetOntologyTermsOperation>({
      typeName: 'GetOntologyTermsOperation',
      parentType,
    })
  }
}
