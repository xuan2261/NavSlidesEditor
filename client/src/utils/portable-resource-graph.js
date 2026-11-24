import {
  PortableResourceError,
  portableLimits,
  portableMimeMatches,
} from 'revealjs-shared/src/education/portable-resource-contract.js'
import { bytesToDataUrl, decodeDataUrl, resolvePortableUrl } from './portable-resource-bytes.js'
export class PortableResourceGraph {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || globalThis.window?.location?.href
    if (!this.baseUrl) throw new TypeError('Portable export requires a document base URL')
    this.origin = new URL(this.baseUrl).origin
    this.fetch = options.fetch || globalThis.fetch.bind(globalThis)
    this.limits = portableLimits(options.limits)
    this.nodes = new Map()
    this.transforms = new Map()
    this.totalBytes = 0
    this.runtimeCounter = 0
  }
  error(code, url, context, detail) {
    return new PortableResourceError(code, url, context, detail)
  }
  resolve(reference, base = this.baseUrl, context = {}) {
    try {
      const url = resolvePortableUrl(reference, base, this.origin)
      if (!/^(?:https?:|blob:|data:)/i.test(url)) throw new Error('Unsupported resource scheme')
      return url
    } catch (error) {
      throw this.error('scheme', reference, context, error.message)
    }
  }
  descend(context, url) {
    const chain = [...(context.chain || []), url]
    if (chain.length > this.limits.maxDepth) throw this.error('depth', url, { ...context, chain })
    if ((context.chain || []).includes(url)) throw this.error('cycle', url, { ...context, chain })
    return { ...context, chain }
  }
  async load(reference, kind, base, context = {}) {
    const full = this.resolve(reference, base, context)
    const parsed = new URL(full)
    const fragment = parsed.hash
    parsed.hash = ''
    const url = parsed.href
    let pending = this.nodes.get(url)
    if (!pending) {
      if (this.nodes.size >= this.limits.maxResources)
        throw this.error('size', url, context, 'Resource count exceeded')
      pending = this.read(url, context)
      this.nodes.set(url, pending)
    }
    const node = await pending
    if (!portableMimeMatches(kind, node.mime))
      throw this.error('mime', url, context, `Expected ${kind}, received ${node.mime}`)
    node.references.push({
      kind,
      slideId: context.slideId,
      elementId: context.elementId,
      chain: [...(context.chain || []), url],
    })
    return { ...node, fragment }
  }
  account(url, bytes, context) {
    if (bytes > this.limits.maxResourceBytes || this.totalBytes + bytes > this.limits.maxTotalBytes)
      throw this.error('size', url, context, `${bytes} bytes exceeds resource/total budget`)
    this.totalBytes += bytes
  }
  async read(url, context) {
    let mime,
      bytes,
      resolvedUrl = url,
      status = 200,
      statusText = '',
      headers = {}
    if (url.startsWith('data:')) {
      try {
        ;({ mime, bytes } = decodeDataUrl(url))
      } catch (error) {
        throw this.error('decode', url, context, error.message)
      }
      this.account(url, bytes.byteLength, context)
    } else {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.limits.timeoutMs)
      try {
        const response = await this.fetch(url, {
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit',
        })
        if (!response.ok || response.type === 'opaque')
          throw new Error(`HTTP ${response.status || 'opaque/CORS'}`)
        resolvedUrl = response.url || url
        mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
        status = response.status
        statusText = response.statusText
        headers = Object.fromEntries(response.headers.entries())
        delete headers['content-encoding']
        delete headers['transfer-encoding']
        const declared = Number(response.headers.get('content-length'))
        if (
          declared > this.limits.maxResourceBytes ||
          declared + this.totalBytes > this.limits.maxTotalBytes
        )
          throw this.error('size', url, context, `${declared} declared bytes`)
        if (response.body?.getReader) {
          const reader = response.body.getReader(),
            chunks = []
          let size = 0
          try {
            while (true) {
              const chunk = await reader.read()
              if (chunk.done) break
              this.account(url, chunk.value.byteLength, context)
              size += chunk.value.byteLength
              if (size > this.limits.maxResourceBytes)
                throw this.error('size', url, context, `${size} bytes`)
              chunks.push(chunk.value)
            }
          } catch (error) {
            try {
              await reader.cancel()
            } catch (cancelError) {
              error.cancelError = cancelError
            }
            throw error
          } finally {
            reader.releaseLock()
          }
          bytes = new Uint8Array(size)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
          }
        } else {
          bytes = new Uint8Array(await response.arrayBuffer())
          this.account(url, bytes.byteLength, context)
        }
      } catch (error) {
        if (error instanceof PortableResourceError) throw error
        throw this.error('fetch', url, context, error.message)
      } finally {
        clearTimeout(timer)
      }
    }
    return {
      url,
      base: resolvedUrl,
      mime,
      bytes,
      status,
      statusText,
      headers: { ...headers, 'content-type': headers['content-type'] || mime },
      references: [],
    }
  }
  async embed(reference, kind, base, context) {
    if (reference.startsWith('#')) return reference
    const node = await this.load(reference, kind, base, context)
    return bytesToDataUrl(node.bytes, node.mime) + node.fragment
  }
  async receipt() {
    const resources = await Promise.all(
      [...this.nodes.values()].map(async (pending) => {
        const node = await pending
        return {
          url: node.url,
          base: node.base,
          mime: node.mime,
          bytes: node.bytes.byteLength,
          references: node.references,
        }
      })
    )
    return { resources, totalBytes: this.totalBytes, offlineCapable: true }
  }
}
