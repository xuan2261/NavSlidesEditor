const TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  TABLE[index] = value >>> 0
}

function createCrc32() {
  let state = 0xffffffff
  return {
    update(chunk) {
      const bytes = Buffer.from(chunk)
      for (const byte of bytes) state = TABLE[(state ^ byte) & 0xff] ^ (state >>> 8)
      return this
    },
    digest() {
      return (state ^ 0xffffffff) >>> 0
    },
  }
}

function crc32(buffer) {
  return createCrc32().update(buffer).digest()
}

module.exports = { createCrc32, crc32 }
