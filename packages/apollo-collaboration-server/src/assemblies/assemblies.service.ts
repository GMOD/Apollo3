import * as fs from 'fs/promises'
import { join } from 'path'

import gff, { GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Feature, FeatureDocument } from '../features/schemas/feature.schema'
import { RefSeq, RefSeqDocument } from '../refSeqs/schemas/refSeq.schema'
import { getCurrentDateTime } from '../utils/commonUtilities'
import { CreateAssemblyDto } from './dto/create-assembly.dto'
import { Assembly, AssemblyDocument } from './schemas/assembly.schema'

@Injectable()
export class AssembliesService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(AssembliesService.name)

  /**
   * Download assembly by assemblyId. ******** TODO : SEARCH FEATURES BY ASSEMBLYID / REFSEQID! #### FASTA -text is missing in the file
   * @param assemblyId - assemblyId
   * @returns If assemblyId exists then return assembly data in GFF3 format. Otherwise throw exception
   */
  async downloadAssemblyByAssemblyId(assemblyId: string): Promise<string> {
    const { util } = gff
    let gff3Line = ''
    // Check if assembly exists
    const featureObject = await this.assemblyModel
      .findOne({ assemblyId })
      .exec()

    if (!featureObject) {
      const errMsg = `ERROR: The following assemblyId was not found in database: '${assemblyId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Search correct feature
    const allFeaturesCursor = await this.featureModel.find({}).cursor()

    if (!allFeaturesCursor) {
      const errMsg = `ERROR when loading data from database: No data found!`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Join path+filename
    const { DOWNLOADED_OUTPUT_FOLDER } = process.env
    if (!DOWNLOADED_OUTPUT_FOLDER) {
      throw new Error('No DOWNLOADED_OUTPUT_FOLDER found in .env file')
    }
    const downloadFilename = join(
      DOWNLOADED_OUTPUT_FOLDER,
      `downloaded_${getCurrentDateTime()}.gff3`,
    )

    // Loop all documents and load them into cache
    for (
      let currentDoc = await allFeaturesCursor.next();
      currentDoc != null;
      currentDoc = await allFeaturesCursor.next()
    ) {
      const entry =
        currentDoc.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
      // this.logger.debug(`Read new entry=${JSON.stringify(entry)}`)
      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        const tmp = entry as unknown as GFF3Item[]
        gff3Line = gff.formatSync(tmp)
        await fs.appendFile(downloadFilename, gff3Line)
      } else {
        gff3Line = util.formatItem(entry) as string
        await fs.appendFile(downloadFilename, gff3Line)
      }
    }
    this.logger.debug(
      `Assembly data saved as GFF3 into file ${downloadFilename}'`,
    )
    return downloadFilename
  }

  async create(createAssemblyDto: CreateAssemblyDto): Promise<Assembly> {
    // eslint-disable-next-line new-cap
    const createdAssembly = new this.assemblyModel(createAssemblyDto)
    return createdAssembly.save()
  }

  async findAll(): Promise<Assembly[]> {
    return this.assemblyModel.find().exec()
  }

  async find(id: string): Promise<Assembly> {
    const assembly = await this.assemblyModel.findOne({ _id: id }).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${id}" not found`)
    }
    return assembly
  }
}
