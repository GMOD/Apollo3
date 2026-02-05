declare module 'bson-objectid' {
  import { type Buffer } from 'node:buffer'

  export default ObjectID

  declare const ObjectID: ObjectIDCtor

  declare interface ObjectID {
    readonly id: string
    readonly str: string

    toHexString(): string
    equals(other: ObjectID): boolean
    getTimestamp(): Date
  }

  declare interface ObjectIDCtor {
    (hexStringOrIdStringOrArrayOrBuffer?: string | number[] | Buffer): ObjectID

    new (
      hexStringOrIdStringOrArrayOrBuffer?: string | number[] | Buffer,
    ): ObjectID

    createFromTime(time: number): ObjectID
    createFromHexString(hexString: string): ObjectID
    isValid(hexStringOrObjectID: string | ObjectID): boolean
    toString(): string
  }
}
