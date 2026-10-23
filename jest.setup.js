import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

// jsdom lacks these; workspace deep links (workspaceProgramHref) encode with them.
global.TextEncoder ??= TextEncoder
global.TextDecoder ??= TextDecoder

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock
if (typeof HTMLElement !== "undefined") {
  global.HTMLElement.prototype.scrollIntoView = jest.fn()
}
