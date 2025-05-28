export type GFFReservedAttribute =
  | 'ID'
  | 'Name'
  | 'Alias'
  | 'Parent'
  | 'Target'
  | 'Gap'
  | 'Derives_from'
  | 'Note'
  | 'Dbxref'
  | 'Ontology_term'
  | 'Is_circular'

export type GFFInternalAttribute =
  | 'gff_id'
  | 'gff_name'
  | 'gff_alias'
  | 'gff_parent'
  | 'gff_target'
  | 'gff_gap'
  | 'gff_derives_from'
  | 'gff_note'
  | 'gff_dbxref'
  | 'gff_ontology_term'
  | 'gff_is_circular'

export const gffToInternal: Record<GFFReservedAttribute, GFFInternalAttribute> =
  {
    ID: 'gff_id',
    Name: 'gff_name',
    Alias: 'gff_alias',
    Parent: 'gff_parent',
    Target: 'gff_target',
    Gap: 'gff_gap',
    Derives_from: 'gff_derives_from',
    Note: 'gff_note',
    Dbxref: 'gff_dbxref',
    Ontology_term: 'gff_ontology_term',
    Is_circular: 'gff_is_circular',
  }

export function isGFFReservedAttribute(
  attribute: string,
): attribute is GFFReservedAttribute {
  return attribute in gffToInternal
}

export const internalToGFF: Record<GFFInternalAttribute, GFFReservedAttribute> =
  {
    gff_id: 'ID',
    gff_name: 'Name',
    gff_alias: 'Alias',
    gff_parent: 'Parent',
    gff_target: 'Target',
    gff_gap: 'Gap',
    gff_derives_from: 'Derives_from',
    gff_note: 'Note',
    gff_dbxref: 'Dbxref',
    gff_ontology_term: 'Ontology_term',
    gff_is_circular: 'Is_circular',
  }

export function isGFFInternalAttribute(
  attribute: string,
): attribute is GFFInternalAttribute {
  return attribute in internalToGFF
}

export type GFFColumn = 'score' | 'source'
export type GFFColumnInternal = 'gff_score' | 'gff_source'
export const gffColumnToInternal: Record<GFFColumn, GFFColumnInternal> = {
  score: 'gff_score',
  source: 'gff_source',
}
export function isGFFColumn(attribute: string): attribute is GFFColumn {
  return attribute in gffColumnToInternal
}
export const gffInternalToColumn: Record<GFFColumnInternal, GFFColumn> = {
  gff_score: 'score',
  gff_source: 'source',
}
export function isGFFColumnInternal(
  column: string,
): column is GFFColumnInternal {
  return column in gffInternalToColumn
}
