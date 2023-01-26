import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Feature, FeatureDocument, Node, NodeDocument } from 'apollo-schemas'
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
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Node.name)
    private readonly nodeModel: Model<NodeDocument>, // private readonly featureService: FeaturesService,
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
                  pred: 'http://purl.obolibrary.org/obo/so#part_of',
                },
              },
            ],
          },
        },
      ])
      .exec()

    const subIds: string[] = []
    for (const edge of nodes[0].id) {
      // this.logger.debug(
      //   `The following feature(s) matched  = ${JSON.stringify(edge)}`,
      // )
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
    this.logger.debug(
      `For "${parentType}" the allowed children's types are: ${JSON.stringify(
        childrenTypes,
      )}`,
    )

    return childrenTypes
  }

  /**
   * Get feature's allowed types by its child type. This is needed to check when the feature is updating its current type
   * @param childType - string
   * @returns Return 'HttpStatus.OK' and the allowed feature's types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async findParentTypesByChildType(childType: string) {
    // Go up and find all nodes where relation is 'is_a'
    const isaNodes = await this.nodeModel
      .aggregate([
        {
          $match: { lbl: childType, type: 'CLASS' },
        },
        {
          $graphLookup: {
            from: 'edges',
            startWith: '$id',
            connectFromField: 'obj',
            connectToField: 'sub',
            maxDepth: 10,
            as: 'subcategories',
            restrictSearchWithMatch: { pred: 'is_a' },
          },
        },
      ])
      .exec()

    const { subcategories } = isaNodes[0] as any
    const isAIds: string[] = []
    for (const edge of subcategories) {
      isAIds.indexOf(edge.obj) === -1
        ? isAIds.push(edge.obj)
        : this.logger.verbose(`Array has already item "${edge.obj}"`)
      isAIds.indexOf(edge.sub) === -1
        ? isAIds.push(edge.sub)
        : this.logger.verbose(`Array has already item "${edge.sub}"`)
    }

    this.logger.debug(`IS_A nodes are: ${JSON.stringify(isAIds)}`)

    // Get parent's terms. The matched terms are saved in "id" attribute of parentNodes
    const parentNodes = await this.nodeModel.aggregate([
      {
        $match: {
          id: { $in: isAIds },
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
                $expr: { $eq: ['$$id', '$sub'] },
                pred: {
                  $in: [
                    'http://purl.obolibrary.org/obo/so#part_of',
                    'http://purl.obolibrary.org/obo/so#member_of',
                  ],
                },
              },
            },
          ],
        },
      },
    ])

    const subIds: string[] = []
    for (const edge of parentNodes) {
      for (const innerEdge of edge.id) {
        this.logger.debug(
          `+++ The following parent is possible: ${JSON.stringify(
            innerEdge.obj,
          )}`,
        )
        subIds.push(innerEdge.obj)
      }
    }
    // Get parent's types
    const parentTypes = await this.nodeModel
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
    this.logger.debug(
      `For "${childType}" the allowed parent's types are: ${JSON.stringify(
        parentTypes,
      )}`,
    )
    return parentTypes
  }

  /**
   * Find possible feature types for given featureId.
   * First, we check if the feature has a parent and if there is one, then we check possible child feature types of the parent
   * Secondly, we check if the feature has children and if there are, then we check possible parent feature types of each child
   * Last, we make intersect of array that we produced in steps #1 and #2
   * @param featureId - featureId
   */
  async getPossibleFeatureTypes(featureId: string) {
    let resultArray: string[] = [] // Final result
    const parentChildArray: string[] = [] // This array contains types that we have got when retrieved all possible children types for feature's parent
    const childParentArray: string[] = [] // This array contains types that we have got when retrieved feature's each child's possible parent types
    const topLevelFeature = await this.featureModel.findById(featureId) // Check if given feature is top level feature
    let childrenTypes: any[] = []
    let featureChildParentTypes: any[] = []

    if (topLevelFeature) {
      this.logger.debug(
        `Feature has no parent, feature type: "${topLevelFeature.type}"`,
      )
    } else {
      const currentFeature = await this.findById(featureId, 2)
      this.logger.debug(`Feature type: "${currentFeature.type}"`)
      const parentFeature = await this.findById(featureId, 1)
      this.logger.debug(`Feature's parent type: "${parentFeature.type}"`)
      // We get all possible types for feature's parent
      childrenTypes = await this.findChildrenTypesByParentType(
        parentFeature.type,
      )
    }

    const feature = await this.findById(featureId, 2) // Flag "2" indicates that we return feature itself (not top level feature)
    // Loop over all children
    // First we get all possible parent types of the first child. For the following children we check that their possible parents's type overlaps with the first child's possible parent types
    // because feature's new type must match with feature's all children's parent type
    let firstChild = true
    if (feature.children) {
      for (const element of feature.allIds) {
        if (element !== featureId) {
          const childFeature = await this.findById(element, 2)
          this.logger.debug(
            `Feature's child "${childFeature._id}" type is "${childFeature.type}"`,
          )
          featureChildParentTypes = await this.findParentTypesByChildType(
            childFeature.type,
          )
          if (firstChild) {
            for (const item of featureChildParentTypes) {
              // featureChildParentTypes.forEach((item) => {
              childParentArray.indexOf(item.lbl) === -1
                ? childParentArray.push(item.lbl)
                : this.logger.verbose(`Array has already item "${item.lbl}"`)
            }
            firstChild = false
          } else {
            // If child's possible parent type is not found in "childParentArray" (that contais originally the possible parent types of the 1st child) then remove the type from "childParentArray" array
            // console.log(
            //   `So far childParenArray has value: ${JSON.stringify(
            //     childParentArray,
            //   )}`,
            // )
            // console.log(
            //   `featureChildParentTypes has value: ${JSON.stringify(
            //     featureChildParentTypes,
            //   )}`,
            // )
            childParentArray.forEach((itm) => {
              let childTypeFound = false
              featureChildParentTypes.forEach((tmpElement) => {
                if (tmpElement.lbl === itm) {
                  childTypeFound = true
                }
              })
              if (!childTypeFound) {
                this.logger.debug(
                  `Possible feature's "${childFeature._id}" type "${itm}" is not compatible with its child type "${childFeature.type}"`,
                )
                const index = childParentArray.indexOf(itm)
                childParentArray.splice(index, 1)
              }
            })
          }
          this.logger.debug(
            `Feature has children and their possible parent types are: ${JSON.stringify(
              childParentArray,
            )}`,
          )
        }
      }
    } else {
      childrenTypes.forEach((element) => {
        parentChildArray.indexOf(element.lbl) === -1
          ? parentChildArray.push(element.lbl)
          : this.logger.verbose(`Array has already item "${element.lbl}"`)
      })
      this.logger.debug(
        `Feature has no children so feature's possible types are: ${JSON.stringify(
          parentChildArray,
        )}`,
      )
    }

    // If feature's has children and parent then possible types are intersection of "parentChildArray" and "childParentArray"
    // If one of them is filled then return it
    if (parentChildArray.length > 0 && childParentArray.length > 0) {
      resultArray = parentChildArray.filter((value) =>
        childParentArray.includes(value),
      )
      this.logger.debug(
        `Feature has parent and children. Those array intersection is : "${resultArray}"`,
      )
    } else if (parentChildArray.length > 0) {
      resultArray = [...parentChildArray]
      this.logger.debug(
        `Feature has parent but no any child. Parent array is : "${resultArray}"`,
      )
    } else if (childParentArray.length > 0) {
      resultArray = [...childParentArray]
      this.logger.debug(
        `Feature has children but no any parent. Children array is : "${resultArray}"`,
      )
    }
    this.logger.debug(`FINAL RESULT: ${JSON.stringify(resultArray)}`)
    return resultArray
  }

  async findById(featureId: string, flag: number) {
    // Search correct feature
    const topLevelFeature = await this.featureModel.findOne({
      allIds: featureId,
    })

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = await this.getFeatureFromId(topLevelFeature, featureId)
    if (!foundFeature) {
      const errMsg = `ERROR when searching feature by featureId`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    if (flag === 1) {
      return topLevelFeature
    }
    return foundFeature
  }

  /**
   * Get single feature by featureId
   * @param featureOrDocument -
   * @param featureId -
   * @returns
   */
  async getFeatureFromId(
    feature: Feature,
    featureId: string,
  ): Promise<Feature | null> {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      // this.logger.debug(
      //   `Top level featureId matches in object ${JSON.stringify(feature)}`,
      // )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    // this.logger.debug(
    //   `FeatureId was not found on top level so lets make recursive call...`,
    // )
    for (const [, childFeature] of feature.children || new Map()) {
      const subFeature = await this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }
}