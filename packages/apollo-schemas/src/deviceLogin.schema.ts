import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type DeviceLoginDocument = HydratedDocument<DeviceLogin>

/** How long a device login (e.g. from the CLI) can wait to be completed */
export const DEVICE_LOGIN_EXPIRES_IN_SECONDS = 600

/**
 * A login started on a device without a usable browser (e.g. the CLI on a
 * remote server) and completed by the user in a browser elsewhere
 */
@Schema({ timestamps: true })
export class DeviceLogin {
  /** SHA-256 hash of the secret code the device uses to poll for the token */
  @Prop({ required: true, unique: true })
  deviceCodeHash: string

  /** Short code the user confirms in the browser, without the hyphen */
  @Prop({ required: true, unique: true })
  userCode: string

  /** Login type to use, e.g. "google" */
  @Prop({ required: true })
  type: string

  @Prop({ required: true, enum: ['pending', 'approved'], default: 'pending' })
  status: 'pending' | 'approved'

  @Prop()
  token?: string

  @Prop()
  lastPolledAt?: Date

  createdAt: Date
}

export const DeviceLoginSchema = SchemaFactory.createForClass(DeviceLogin)

DeviceLoginSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: DEVICE_LOGIN_EXPIRES_IN_SECONDS },
)
