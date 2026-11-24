import { bytesToDataUrl } from './portable-resource-bytes.js'
import { serializeEducationConfig } from 'revealjs-shared/src/education/config-serialization.js'
/** A verified finite GET response; never a network proxy or a runtime fetch. */
export function finiteResponseExpression(node) {
  const base64 = bytesToDataUrl(node.bytes, node.mime).split(',')[1]
  const metadata = serializeEducationConfig({
    url: node.base,
    redirected: node.base !== node.url,
    status: node.status || 200,
    statusText: node.statusText || '',
    headers: node.headers || { 'content-type': node.mime },
  })
  return `(function(){var meta=${metadata},binary=atob(${JSON.stringify(base64)}),bytes=Uint8Array.from(binary,function(char){return char.charCodeAt(0);});function decorate(response){Object.defineProperties(response,{url:{value:meta.url},redirected:{value:meta.redirected},type:{value:'basic'}});var clone=response.clone.bind(response);response.clone=function(){return decorate(clone());};return response;}return Promise.resolve(decorate(new Response([204,205,304].includes(meta.status)?null:bytes,{status:meta.status,statusText:meta.statusText,headers:meta.headers})));})()`
}
