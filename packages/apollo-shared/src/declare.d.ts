declare module 'bson-objectid' {
  import type { Buffer } from 'node:buffer'

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

declare module 'jwt-decode' {
  export class InvalidTokenError extends Error {}

  export interface JwtDecodeOptions {
    header?: boolean
  }

  export interface JwtHeader {
    type?: string
    alg?: string
  }

  export interface JwtPayload {
    iss?: string
    sub?: string
    aud?: string[] | string
    exp?: number
    nbf?: number
    iat?: number
    jti?: string
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-unnecessary-type-constraint
  export default function jwtDecode<T extends unknown>(
    token: string,
    options?: JwtDecodeOptions,
  ): T
}
