import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Node, NodeDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

@Injectable()
export class OntologiesService {
  constructor(
    @InjectModel(Node.name)
    private readonly nodeModel: Model<NodeDocument>,
  ) {}

  private readonly logger = new Logger(OntologiesService.name)

  /**
   * Get children's allowed feature types by parent type.
   * @param parentType - string
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async findChildrenTypesByParentType(parentType: string) {
    // Get edges by parentType
    const nodes = await this.nodeModel
      .aggregate([
        {
          $match: {
            lbl: parentType,
            type: 'CLASS',
          },
        },
        {
          $lookup: {
            from: 'edges',
            as: 'id',
            let: { id: '$id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$$id', '$obj'] },
                  pred: 'is_a',
                },
              },
            ],
          },
        },
      ])
      .exec()

    const subIds: string[] = []
    for (const edge of nodes[0].id) {
      this.logger.debug(
        `The following feature(s) matched  = ${JSON.stringify(edge)}`,
      )
      subIds.push(edge.sub)
    }

    // Get children's types
    const childrenTypes = await this.nodeModel
      .aggregate([
        {
          $match: {
            id: { $in: subIds },
          },
        },
        {
          $project: {
            lbl: 1,
            _id: 0,
          },
        },
      ])
      .sort({ lbl: 1 })
    this.logger.debug(`Types are: ${JSON.stringify(childrenTypes)}`)

    return childrenTypes
  }
}
