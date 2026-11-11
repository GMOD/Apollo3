import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SearchFeaturesRequest {
  /** Text to search for in feature IDs and attributes */
  term: string
  /** Comma-separated list of assembly IDs to search in */
  assemblies: string
}

export class FeatureCountRequest {
  /** Only count features in this assembly */
  assemblyId?: string
  /** Only count features on this reference sequence */
  refSeqId?: string
  /** Only count features that end after this position */
  start?: number
  /** Only count features that start before this position */
  end?: number
}

/** Query parameters arrive as strings */
export class FeatureDensityRequest {
  /** Reference sequence ID */
  refSeq: string
  /** Start of the range (0-based) */
  @ApiProperty({ type: Number })
  start: string
  /** End of the range */
  @ApiProperty({ type: Number })
  end: string
  /** Size of each bin, at least 1. At most 10,000 bins can be requested. */
  @ApiProperty({ type: Number, minimum: 1 })
  binSize: string
  /** Only count top-level features of these types. Repeat for more types. */
  @ApiPropertyOptional({ type: [String] })
  type?: string | string[]
}

export class GetByIndexedIdRequest {
  /** Indexed ID to look for, e.g. a `gff_id` attribute value */
  id: string
  /** Comma-separated list of assembly IDs to search in */
  assemblies?: string
  /** Return the top-level feature that contains the match */
  topLevel?: boolean
}
