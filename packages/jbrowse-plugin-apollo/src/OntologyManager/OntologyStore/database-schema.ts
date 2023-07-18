/** schema types used to strongly-type using the `idb` type system */
import { DBSchema } from 'idb'

import {
  Edge as OboGraphEdge,
  Node as OboGraphNode,
} from './obo-graph-json-schema'

/** schema types used to strongly-type using the `idb` type system */
export interface OntologyDB extends DBSchema {
  meta: {
    key: string
    value: {
      id: string
      objectType: 'graph' | 'database'
      data: unknown
    }
  }
  nodes: {
    key: string
    value: OboGraphNode
  }
  edges: {
    key: string
    value: OboGraphEdge
  }
}
