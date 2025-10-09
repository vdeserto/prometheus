/**
 * useComponentLifecycle Composable Tests
 * Tests: Component mount/unmount tracking, lifecycle events
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useComponentLifecycle } from '../../src/composables/useMetrics.js'

const createMockMetrics = () => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn(() => vi.fn())
})

describe('useComponentLifecycle', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    vi.clearAllMocks()
  })

  it('should track component mount', () => {
    const TestComponent = defineComponent({
      name: 'LifecycleComponent',
      setup() {
        useComponentLifecycle('LifecycleComponent')
        return {}
      },
      template: '<div>Test</div>'
    })

    mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_component_lifecycle_total',
      1,
      expect.objectContaining({
        component: 'LifecycleComponent',
        event: 'mounted'
      })
    )
  })

  it('should track component unmount', () => {
    const TestComponent = defineComponent({
      name: 'UnmountComponent',
      setup() {
        useComponentLifecycle('UnmountComponent')
        return {}
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    wrapper.unmount()

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_component_lifecycle_total',
      1,
      expect.objectContaining({
        component: 'UnmountComponent',
        event: 'unmounted'
      })
    )
  })

  it('should auto-detect component name', () => {
    const TestComponent = defineComponent({
      name: 'AutoDetect',
      setup() {
        useComponentLifecycle()
        return {}
      },
      template: '<div>Test</div>'
    })

    mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_component_lifecycle_total',
      1,
      expect.objectContaining({ component: 'AutoDetect' })
    )
  })

  it('should use "anonymous" when no name available', () => {
    const TestComponent = defineComponent({
      setup() {
        useComponentLifecycle()
        return {}
      },
      template: '<div>Test</div>'
    })

    mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_component_lifecycle_total',
      1,
      expect.objectContaining({ component: 'anonymous' })
    )
  })

  it('should do nothing when metrics not provided', () => {
    const TestComponent = defineComponent({
      setup() {
        useComponentLifecycle('Test')
        return {}
      },
      template: '<div>Test</div>'
    })

    expect(() => mount(TestComponent)).not.toThrow()
  })
})
