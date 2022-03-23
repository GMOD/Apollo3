import { Controller, Logger, Param, Post } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { RefSeq, RefSeqDocument } from './schemas/refSeq.schema'

@Controller('refseqs')
export class RefseqsController {
  constructor(
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(RefseqsController.name)

  /**
   * Add new RefSeq for given assemblyId
   * @param assemblyId - assemblyId
   * @returns Return ...
   */
  //  @UseGuards(JwtAuthGuard)
  @Post('/:assemblyId')
  async getFeature(@Param('assemblyId') assemblyId: string) {
    this.logger.debug(`Adding new RefSeq, assemblyId=${assemblyId}`)
    const newRefSef = await this.refSeqModel.create({
      assemblyId: assemblyId,
      name: 'name 3',
      description: 'description 3',
      length: 30000,
    })
    this.logger.debug(`New RefSeq added: ${newRefSef}`)
    // return this.featuresService.getFeatureByFeatureId(featureid)
  }
}
