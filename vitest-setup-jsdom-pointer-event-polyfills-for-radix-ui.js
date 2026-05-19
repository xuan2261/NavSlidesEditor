// JSDOM polyfills for Radix UI primitives (DropdownMenu, Toolbar)
// JSDOM lacks PointerEvent + element pointer-capture APIs that Radix uses for
// outside-click detection, focus management, and dismissal flows.

if (typeof window !== 'undefined') {
  if (!window.PointerEvent) {
    class PointerEvent extends Event {
      constructor(type, params = {}) {
        super(type, params)
        this.button = params.button ?? 0
        this.ctrlKey = params.ctrlKey ?? false
        this.pointerType = params.pointerType ?? 'mouse'
        this.pointerId = params.pointerId ?? 1
        this.clientX = params.clientX ?? 0
        this.clientY = params.clientY ?? 0
      }
    }
    window.PointerEvent = PointerEvent
    globalThis.PointerEvent = PointerEvent
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function () {
      return false
    }
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {}
  }
}
