let index = Math.floor(Math.random() * 0xffffff)

function getInc(): number {
  return (index = (index + 1) % 0xffffff)
}

/**
 * Generate a 12 byte id buffer used in ObjectId's
 *
 * @param time - pass in a second based timestamp.
 */
export function generateObjectId(time?: number): string {
  if ('number' !== typeof time) {
    time = Math.floor(Date.now() / 1000)
  }

  const inc = getInc()
  const buffer = Buffer.alloc(12)

  // 4-byte timestamp
  buffer.writeUInt32BE(time, 0)

  // // set PROCESS_UNIQUE if yet not initialized
  // if (PROCESS_UNIQUE === null) {
  //   PROCESS_UNIQUE = randomBytes(5)
  // }

  const PROCESS_UNIQUE = window.crypto.getRandomValues(Buffer.alloc(5))

  // 5-byte process unique
  ;[buffer[4], buffer[5], buffer[6], buffer[7], buffer[8]] = PROCESS_UNIQUE

  // 3-byte counter
  buffer[11] = inc & 0xff
  buffer[10] = (inc >> 8) & 0xff
  buffer[9] = (inc >> 16) & 0xff

  return buffer.toString('hex')
}
