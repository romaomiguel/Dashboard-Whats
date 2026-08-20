import '@testing-library/jest-dom/vitest'

// O jsdom não implementa PointerEvent, e os componentes do Base UI
// (Checkbox, Select, Dialog) despacham eventos de ponteiro ao clicar.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly isPrimary: boolean

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? true
    }
  }

  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}
