import * as shared from 'revealjs-shared'
import { showError } from './app-feedback'
import { collectSemanticFontRequests } from 'revealjs-shared/src/pptx-source-font-request.js'
import { loadPptxSourceFontResources } from '../hooks/use-pptx-source-font-loader'

export const { generateRevealHTML, getBackgroundAttrs, escapeHtml } = shared

function runWithFeedback(action, operation) {
  const failure = (error) => {
    if (error?.name === 'AbortError') return undefined
    console.error(`${action}:`, error)
    showError(`${action}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
  try {
    const result = operation()
    return result?.then ? result.catch(failure) : result
  } catch (error) {
    return failure(error)
  }
}

export function assertOutputActive(signal) {
  if (signal?.aborted) throw new DOMException('Output cancelled', 'AbortError')
}

export async function prepareSemanticOutputResources(presentation, options = {}) {
  assertOutputActive(options.signal)
  if (!presentation?.pptxSemantic) return null
  const requests = collectSemanticFontRequests(presentation.pptxSemantic)
  if (requests.issues.length)
    throw Object.assign(new Error('source-font-declarations-invalid'), {
      code: 'source-font-declarations-invalid',
      issues: requests.issues,
    })
  if (!requests.faces?.length) {
    const outputDocument = options.document ?? globalThis.document
    const hash = await outputDocument.defaultView.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(requests.identity)
    )
    assertOutputActive(options.signal)
    return {
      schemaVersion: 1,
      sourceIdentity: [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
      fontProfile: { schemaVersion: 1, faces: [] },
      assets: [],
    }
  }
  return loadPptxSourceFontResources({
    presentationId: presentation.id,
    requestIdentity: requests.identity,
    document: options.document ?? globalThis.document,
    signal: options.signal,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })
}

export function reserveOutputWindow() {
  const popup = window.open('about:blank', '_blank')
  if (!popup) throw new Error('Output window was blocked')
  return popup
}

export function awaitSemanticOutputDocument(outputDocument, { signal, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let timer
    const finish = (error) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      if (error) reject(error)
      else resolve()
    }
    const cancel = () => finish(new DOMException('Output cancelled', 'AbortError'))
    if (signal?.aborted) {
      cancel()
      return
    }
    signal?.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => finish(new Error('Semantic output readiness deadline')), timeout)
    const handle = outputDocument.defaultView?.__navslidesSemanticOutput
    if (!handle?.ready) {
      finish(new Error('Semantic output readiness handle missing'))
      return
    }
    Promise.resolve(handle.ready)
      .then(() => {
        if (handle.state !== 'ready') throw new Error('Semantic output is not ready')
        assertOutputActive(signal)
        finish()
      })
      .catch(finish)
  })
}

export async function validateSemanticOutputHTML(html, { signal } = {}) {
  assertOutputActive(signal)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    'position:fixed;left:-100000px;top:0;width:960px;height:540px;border:0;pointer-events:none'
  const loaded = new Promise((resolve, reject) => {
    let timer
    const finish = (error) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      frame.onload = null
      if (error) reject(error)
      else resolve()
    }
    const cancel = () => finish(new DOMException('Output cancelled', 'AbortError'))
    signal?.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => finish(new Error('Output document load deadline')), 15000)
    frame.onload = () => finish()
  })
  try {
    frame.srcdoc = html
    document.body.append(frame)
    await loaded
    assertOutputActive(signal)
    await awaitSemanticOutputDocument(frame.contentDocument, { signal })
  } finally {
    frame.contentWindow?.__navslidesSemanticOutput?.dispose()
    frame.remove()
  }
}

async function fillOutputWindow(popup, presentation, options, print) {
  let url, rejectLoad
  let removeLoad = () => {}
  const release = () => {
    if (url) URL.revokeObjectURL(url)
    url = null
  }
  const cancel = () => {
    release()
    popup.close()
    rejectLoad?.(new DOMException('Output cancelled', 'AbortError'))
  }
  options.signal?.addEventListener('abort', cancel, { once: true })
  try {
    const semanticOutputResources = await prepareSemanticOutputResources(presentation, options)
    assertOutputActive(options.signal)
    if (popup.closed) throw new Error('Output window was closed')
    const html = (print ? shared.generatePrintHTML : shared.generateRevealHTML)(presentation, {
      ...options,
      semanticOutputResources,
    })
    const loadToken = crypto.randomUUID()
    const loadMessage = `<script>window.addEventListener('load',function(){window.opener.postMessage({type:'navslides-output-loaded',token:${JSON.stringify(loadToken)}},${JSON.stringify(window.location.origin)})},{once:true});</script>`
    url = URL.createObjectURL(
      new Blob([html.replace('</body>', `${loadMessage}</body>`)], { type: 'text/html' })
    )
    const loaded = new Promise((resolve, reject) => {
      const finish = (error) => {
        removeLoad()
        rejectLoad = null
        if (error) reject(error)
        else resolve()
      }
      const onLoad = (event) => {
        if (
          event.source === popup &&
          event.origin === window.location.origin &&
          event.data?.type === 'navslides-output-loaded' &&
          event.data.token === loadToken
        )
          finish()
      }
      const timer = setTimeout(() => finish(new Error('Output document load deadline')), 15000)
      removeLoad = () => {
        clearTimeout(timer)
        window.removeEventListener('message', onLoad)
      }
      rejectLoad = finish
      window.addEventListener('message', onLoad)
    })
    const hash = options.startAt ? `#/${options.startAt.h}/${options.startAt.v}` : ''
    popup.location.replace(url + hash)
    await loaded
    release()
    assertOutputActive(options.signal)
    if (popup.closed) throw new Error('Output window was closed')
    popup.addEventListener(
      'pagehide',
      () => {
        options.signal?.removeEventListener('abort', cancel)
        popup.__navslidesSemanticOutput?.dispose()
      },
      { once: true }
    )
    if (presentation.pptxSemantic) await awaitSemanticOutputDocument(popup.document, options)
    return popup
  } catch (error) {
    removeLoad()
    options.signal?.removeEventListener('abort', cancel)
    release()
    popup.close()
    throw error
  }
}

export function exportPDF(presentation, options = {}) {
  return runWithFeedback('PDF export failed', () => {
    if (!presentation?.pptxSemantic && !options.popup)
      return shared.exportPDF(presentation, options)
    const popup = options.popup ?? reserveOutputWindow()
    return fillOutputWindow(popup, presentation, options, true)
  })
}

export function presentInWindow(presentation, options = {}) {
  return runWithFeedback('Failed to present', () => {
    if (presentation?.id || !presentation?.pptxSemantic)
      return shared.presentInWindow(presentation, options)
    const popup = reserveOutputWindow()
    return fillOutputWindow(popup, presentation, options, false)
  })
}
