import fs from 'fs'
import path from 'path'

import { Injectable, Logger } from '@nestjs/common'
import { GetOntologyTermsOperation, OboJson } from 'apollo-shared'

import { OperationsService } from '../operations/operations.service'

@Injectable()
export class OntologiesService {
  protected ontology: OboJson
  constructor(private readonly operationsService: OperationsService) {
    const { ONTOLOGY_FILENAME } = process.env
    if (!ONTOLOGY_FILENAME) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    try {
      const ontologyLocation = path.resolve(__dirname, ONTOLOGY_FILENAME)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      this.ontology = ontologyJson
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }
  }

  private readonly logger = new Logger(OntologiesService.name)

  getTypesUsingOperation(parentType: string) {
    return this.operationsService.executeOperation<GetOntologyTermsOperation>({
      typeName: 'GetOntologyTermsOperation',
      parentType,
      ontology: this.ontology,
    })
  }
}
