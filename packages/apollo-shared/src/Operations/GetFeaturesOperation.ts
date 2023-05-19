import {
  LocalGFF3DataStore,
  Operation,
  OperationOptions,
  SerializedOperation,
  ServerDataStore,
} from 'apollo-common'

interface SerializedGetFeaturesOperation extends SerializedOperation {
  typeName: 'GetFeaturesOperation'
  refSeq: string
  start: number
  end: number
}

export class GetFeaturesOperation extends Operation {
  typeName = 'GetFeaturesOperation' as const
  refSeq: string
  start: number
  end: number

  constructor(
    json: SerializedGetFeaturesOperation,
    options?: OperationOptions,
  ) {
    super(json, options)
    this.refSeq = json.refSeq
    this.start = json.start
    this.end = json.end
  }

  toJSON(): SerializedGetFeaturesOperation {
    const { typeName, refSeq, start, end } = this
    return { typeName, refSeq, start, end }
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refSeq, start and end -parameters
   * @returns Return Array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  executeOnServer(backend: ServerDataStore) {
    return backend.featureModel
      .find({
        refSeq: this.refSeq,
        start: { $lte: this.end },
        end: { $gte: this.start },
        status: 0,
      })
      .exec()
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }
}
