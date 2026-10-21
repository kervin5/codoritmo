import '@testing-library/jest-dom'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock
if (typeof HTMLElement !== "undefined") {
  global.HTMLElement.prototype.scrollIntoView = jest.fn()
}
