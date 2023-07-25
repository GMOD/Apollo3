/** schema types used to strongly-type using the `idb` type system */
import { DBSchema } from 'idb/with-async-ittr'

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

// a Node that goes in the DB must have id and type, so make a new type that specifies this
export type OntologyDBNode = OboGraphNode & {
  id: string
  type: 'CLASS' | 'INDIVIDUAL' | 'PROPERTY'
}
export function isOntologyDBNode(node: OboGraphNode): node is OntologyDBNode {
  return typeof node.id === 'string'
}

// an Edge that goes in our DB must have sub, pred, and obj, so make a new type and guard that specifies this
export type OntologyDBEdge = OboGraphEdge & {
  sub: string
  pred: string
  obj: string
}
export function isOntologyDBEdge(edge: OboGraphEdge): edge is OntologyDBEdge {
  return (
    typeof edge.sub === 'string' &&
    typeof edge.pred === 'string' &&
    typeof edge.obj === 'string'
  )
}

export function isDeprecated(thing: OntologyDBNode | OntologyDBEdge) {
  return Boolean(thing.meta?.deprecated)
}

/** schema types used to strongly-type using the `idb` type system */
export interface OntologyDB extends DBSchema {
  meta: {
    key: string
    value: Meta
  }
  nodes: {
    key: string
    value: OntologyDBNode
    indexes: {
      'by-label': string
      'by-type': string
      'by-synonym': string
    }
  }
  edges: {
    key: number
    value: OntologyDBEdge
    indexes: {
      'by-subject': string
      'by-object': string
      'by-predicate': string
    }
  }
}
