/** schema types used to strongly-type using the `idb` type system */
import { DBSchema } from 'idb'

import {
  Edge as OboGraphEdge,
  Meta as OboGraphMeta,
  Node as OboGraphNode,
} from './obo-graph-json-schema'
import { SourceLocation } from '.'

/** metadata about this IndexedDB ontology database */
export interface Meta {
  /** original OntologyManager record this was loaded from */
  ontologyRecord: {
    name: string
    version: string
    sourceLocation: SourceLocation
  }
  /** graph metadata in OBO Graph metadata format */
  graphMeta?: OboGraphMeta
  timestamp: string
  /** IndexedDB schemaVersion for this ontology */
  schemaVersion: number
  /** time taken to load this data */
  timings: {
    /** milliseconds to fetch, parse, and load the ontology */
    overall: number
    /** optional milliseconds to fetch the ontology source file over the network */
    fetch?: number
    /** optional milliseconds to parse the ontology source file */
    parse?: number
    /** optional milliseconds to load the ontology into IndexedDB */
    load?: number
  }
}

/** schema types used to strongly-type using the `idb` type system */
export interface OntologyDB extends DBSchema {
  meta: {
    key: string
    value: Meta
  }
  nodes: {
    key: string
    value: OboGraphNode
  }
  edges: {
    key: number
    value: OboGraphEdge
  }
}
