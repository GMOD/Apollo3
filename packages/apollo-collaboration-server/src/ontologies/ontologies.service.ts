import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Node, NodeDocument } from 'apollo-schemas'
import { MongoClient } from 'mongodb'
import { Model } from 'mongoose'

@Injectable()
export class OntologiesService {
  /**
   * Loads OBO Graph JSON formatted JSON file into "nodes" and "edges" colletions in Mongo ()
   * "Normal" OBO file can be converted to OBO Graph JSON format using for example "robot" tools that can be found here: http://robot.obolibrary.org/convert.html
   * I did the following 
   * 1. I downloaded robot.jar from here: http://robot.obolibrary.org/
   * 2. I created robot.sh file in same directory where I downloaded robot.jar. The content of robot.sh looks like
            #!/bin/sh

            ## Check for Cygwin, use grep for a case-insensitive search
            IS_CYGWIN="FALSE"
            if uname | grep -iq cygwin; then
                IS_CYGWIN="TRUE"
            fi

            # Variable to hold path to this script
            # Start by assuming it was the path invoked.
            ROBOT_SCRIPT="$0"

            # Handle resolving symlinks to this script.
            # Using ls instead of readlink, because bsd and gnu flavors
            # have different behavior.
            while [ -h "$ROBOT_SCRIPT" ] ; do
            ls=`ls -ld "$ROBOT_SCRIPT"`
            # Drop everything prior to ->
            link=`expr "$ls" : '.*-> \(.*\)$'`
            if expr "$link" : '/.*' > /dev/null; then
                ROBOT_SCRIPT="$link"
            else
                ROBOT_SCRIPT=`dirname "$ROBOT_SCRIPT"`/"$link"
            fi
            done
    * 3. I executed command: ./robot.sh convert --input so-simple.obo --output obo-converted.json --format json
    * 4. I ran "loadOntology()" -method        
   * @param tempFullFileName
   */
  loadOntology(tempFullFileName: string) {
    const client = new MongoClient('mongodb://localhost:27017/')

    ;(async () => {
      await client.connect()

      // Read the JSON file
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      //   const data = require(tempFullFileName)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const data = require('../../test/uploaded/obo-converted.json')

      // Define the collections where the data will be inserted
      const nodesCollection = client.db('apolloDb').collection('nodes')
      const edgesCollection = client.db('apolloDb').collection('edges')

      // Iterate over the nodes and edges in the JSON file
      for (const node of data.graphs[0].nodes) {
        await nodesCollection.insertOne(node)
      }
      for (const edge of data.graphs[0].edges) {
        await edgesCollection.insertOne(edge)
      }

      await client.close()
    })()
  }

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
