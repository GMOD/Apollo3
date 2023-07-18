/** TS types for OBO Graph JSON (https://github.com/geneontology/obographs) */
// started point generated with the help of https://transform.tools/json-schema-to-typescript
export interface GraphDocument {
  '@context'?: unknown
  meta?: Meta
  graphs?: Graph[]
  [k: string]: unknown
}

export default GraphDocument

export interface Meta {
  definition?: MetaDefinitionPropertyValue
  comments?: string[]
  subsets?: string[]
  synonyms?: MetaSynonymPropertyValue[]
  xrefs?: MetaXrefPropertyValue[]
  basicPropertyValues?: MetaBasicPropertyValue[]
  version?: string
  deprecated?: boolean
  [k: string]: unknown
}
export interface MetaDefinitionPropertyValue {
  pred?: string
  val?: string
  xrefs?: string[]
  meta?: Meta
  [k: string]: unknown
}
export interface MetaSynonymPropertyValue {
  synonymType?: string
  pred?: string
  val?: string
  xrefs?: string[]
  meta?: Meta
  [k: string]: unknown
}
export interface MetaXrefPropertyValue {
  lbl?: string
  pred?: string
  val?: string
  xrefs?: string[]
  meta?: Meta
  [k: string]: unknown
}
export interface MetaBasicPropertyValue {
  pred?: string
  val?: string
  xrefs?: string[]
  meta?: Meta
  [k: string]: unknown
}

export interface Graph {
  id?: string
  lbl?: string
  meta?: Meta
  nodes?: Node[]
  edges?: Edge[]

  equivalentNodesSets?: AxiomEquivalentNodesSet[]
  logicalDefinitionAxioms?: LogicalDefinitionAxiom[]
  domainRangeAxioms?: DomainRangeAxiom[]
  propertyChainAxioms?: PropertyChainAxiom[]
  [k: string]: unknown
}
export interface Node {
  id?: string
  lbl?: string
  type?: 'CLASS' | 'INDIVIDUAL' | 'PROPERTY'
  meta?: Meta
  [k: string]: unknown
}
export interface Edge {
  sub?: string
  pred?: string
  obj?: string
  meta?: Meta
  [k: string]: unknown
}
export interface AxiomEquivalentNodesSet {
  representativeNodeId?: string
  nodeIds?: string[]
  meta?: Meta
  [k: string]: unknown
}
export interface LogicalDefinitionAxiom {
  definedClassId?: string
  genusIds?: string[]
  restrictions?: AxiomExistentialRestrictionExpression[]
  meta?: Meta
  [k: string]: unknown
}
export interface AxiomExistentialRestrictionExpression {
  propertyId?: string
  fillerId?: string
  [k: string]: unknown
}
export interface DomainRangeAxiom {
  predicateId?: string
  domainClassIds?: string[]
  rangeClassIds?: string[]
  allValuesFromEdges?: Edge[]
  meta?: Meta
  [k: string]: unknown
}
export interface PropertyChainAxiom {
  predicateId?: string
  chainPredicateIds?: string[]
  meta?: Meta
  [k: string]: unknown
}
