import fs from 'fs'
import path from 'path'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OboJson } from 'apollo-common'
import { GetOntologyTermsOperation } from 'apollo-shared'

import { OperationsService } from '../operations/operations.service'

@Injectable()
export class OntologiesService {
  public ontology: OboJson
  constructor(
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

  goFindByStr(str: string) {
    const ontologyFile = path.join('..', '..', 'data', 'go.json')
    // const goTerms: Record<string, string> = {}
    const goTermsArray: { id: string; label: string }[] = []
    try {
      const ontologyLocation = path.resolve(__dirname, ontologyFile)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      const ontology: OboJson = ontologyJson
      // *********** TODO: NOW WE GET ONLY THE FIRST 50 TERMS
      let dummyCount = 0
      // Iterate over the nodes and edges in the JSON file
      for (const node of ontology.graphs[0].nodes) {
        if (node.id.startsWith('http://purl.obolibrary.org/obo/GO_')) {
          const lab = node.lbl || 'na'
          const idCode = (node.id as string).toUpperCase()
          if (idCode.indexOf(str) >= 0 || lab.toUpperCase().indexOf(str) >= 0) {
            goTermsArray.push({
              id: node.id.replace('http://purl.obolibrary.org/obo/GO_', 'GO:'),
              label: lab,
            })
            dummyCount++
          }
        }
        if (dummyCount > 50) {
          break
        }
      }
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }
    this.logger.debug(`RETURN: ${JSON.stringify(goTermsArray)}`)
    return goTermsArray
  }

  goFindAll() {
    const ontologyFile = path.join('..', '..', 'data', 'go.json')
    // const goTerms: Record<string, string> = {}
    const goTermsArray: { id: string; label: string }[] = []
    let dummyCount = 0
    try {
      const ontologyLocation = path.resolve(__dirname, ontologyFile)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      const ontology: OboJson = ontologyJson
      // *********** TODO: NOW WE GET ONLY THE FIRST 50 TERMS
      // Iterate over the nodes and edges in the JSON file
      for (const node of ontology.graphs[0].nodes) {
        if (node.id.startsWith('http://purl.obolibrary.org/obo/GO_')) {
          // goTerms[node.id.replace('http://purl.obolibrary.org/obo/GO_','GO:')] = node.lbl
          goTermsArray.push({
            id: node.id.replace('http://purl.obolibrary.org/obo/GO_', 'GO:'),
            label: node.lbl,
          })
          dummyCount++
        }
        if (dummyCount > 2000) {
          break
        }
      }
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }
    this.logger.debug(`Palautetaan ${dummyCount} kpl termia`)
    return goTermsArray
  }
}
