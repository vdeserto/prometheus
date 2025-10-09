/**
 * useMetrics Composable Test Suite - Part 2
 *
 * Tests for trackApiCall, trackInteraction, useComponentLifecycle,
 * and useDataFetch composables.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useMetrics,
  useComponentLifecycle,
  useDataFetch
} from '../../src/composables/useMetrics.js'

// Line 19: Mock MetricsCollector

const createMockMetrics = () => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn(() => vi.fn())
})

// Line 28: trackApiCall Tests

describe('useMetrics - trackApiCall', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    vi.clearAllMocks()
  })

  it('should track successful API call', async () => {
    const endTimer = vi.fn()
    mockMetrics.startTimer.mockReturnValue(endTimer)

    const TestComponent = defineComponent({
      setup() {
        const { trackApiCall } = useMetrics()

        const fetchData = () => trackApiCall('/api/users', async () => {
          return { data: 'users' }
        })

        return { fetchData }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    const result = await wrapper.vm.fetchData()

    expect(result).toEqual({ data: 'users' })
    expect(mockMetrics.startTimer).toHaveBeenCalledWith(
      'vue_api_call_duration_seconds',
      expect.objectContaining({
        endpoint: '/api/users',
        method: 'GET'
      })
    )
    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_api_calls_total',
      1,
      expect.objectContaining({
        endpoint: '/api/users',
        method: 'GET',
        status: 'success'
      })
    )
    expect(endTimer).toHaveBeenCalled()
  })

  it('should track API call with custom method', async () => {
    mockMetrics.startTimer.mockReturnValue(vi.fn())

    const TestComponent = defineComponent({
      setup() {
        const { trackApiCall } = useMetrics()

        const createUser = () => trackApiCall(
          '/api/users',
          async () => ({ id: 1 }),
          { method: 'POST' }
        )

        return { createUser }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await wrapper.vm.createUser()

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_api_calls_total',
      1,
      expect.objectContaining({
        method: 'POST',
        status: 'success'
      })
    )
  })

  it('should track failed API call', async () => {
    const endTimer = vi.fn()
    mockMetrics.startTimer.mockReturnValue(endTimer)

    const TestComponent = defineComponent({
      setup() {
        const { trackApiCall } = useMetrics()

        const failingCall = () => trackApiCall('/api/fail', async () => {
          throw new Error('API Error')
        })

        return { failingCall }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await expect(wrapper.vm.failingCall()).rejects.toThrow('API Error')

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_api_calls_total',
      1,
      expect.objectContaining({
        endpoint: '/api/fail',
        status: 'error',
        error_type: 'Error'
      })
    )
    expect(endTimer).toHaveBeenCalled()
  })

  it('should include extra labels', async () => {
    mockMetrics.startTimer.mockReturnValue(vi.fn())

    const TestComponent = defineComponent({
      setup() {
        const { trackApiCall } = useMetrics()

        const fetch = () => trackApiCall(
          '/api/data',
          async () => 'data',
          { method: 'GET', version: 'v2', region: 'us-east' }
        )

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await wrapper.vm.fetch()

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_api_calls_total',
      1,
      expect.objectContaining({
        version: 'v2',
        region: 'us-east'
      })
    )
  })
})

// Line 195: trackInteraction Tests

describe('useMetrics - trackInteraction', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    vi.clearAllMocks()
  })

  it('should track user interaction', () => {
    const TestComponent = defineComponent({
      setup() {
        const { trackInteraction } = useMetrics()
        trackInteraction('click', 'submit-button')
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
      'vue_user_interactions_total',
      1,
      expect.objectContaining({
        action: 'click',
        target: 'submit-button'
      })
    )
  })

  it('should track interaction with additional labels', () => {
    const TestComponent = defineComponent({
      setup() {
        const { trackInteraction } = useMetrics()
        trackInteraction('input', 'search-field', {
          query_length: 10,
          has_filters: true
        })
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
      'vue_user_interactions_total',
      1,
      expect.objectContaining({
        action: 'input',
        target: 'search-field',
        query_length: 10,
        has_filters: true
      })
    )
  })

  it('should track various interaction types', () => {
    const TestComponent = defineComponent({
      setup() {
        const { trackInteraction } = useMetrics()

        trackInteraction('scroll', 'product-list')
        trackInteraction('hover', 'tooltip')
        trackInteraction('focus', 'input-field')

        return {}
      },
      template: '<div>Test</div>'
    })

    mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    expect(mockMetrics.incrementCounter).toHaveBeenCalledTimes(3)
  })
})

// Line 285: useComponentLifecycle Tests

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

// Line 405: useDataFetch Tests

describe('useDataFetch', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    mockMetrics.startTimer.mockReturnValue(vi.fn())
    vi.clearAllMocks()
  })

  it('should track successful data fetch', async () => {
    const TestComponent = defineComponent({
      name: 'DataComponent',
      setup() {
        const { fetch } = useDataFetch(
          async () => ({ data: 'test' }),
          { resource: 'users' }
        )

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    const result = await wrapper.vm.fetch()

    expect(result).toEqual({ data: 'test' })
    expect(mockMetrics.startTimer).toHaveBeenCalledWith(
      'vue_data_fetch_duration_seconds',
      expect.objectContaining({
        component: 'DataComponent',
        resource: 'users'
      })
    )
    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_data_fetch_total',
      1,
      expect.objectContaining({
        resource: 'users',
        status: 'success'
      })
    )
  })

  it('should track failed data fetch', async () => {
    const endTimer = vi.fn()
    mockMetrics.startTimer.mockReturnValue(endTimer)

    const TestComponent = defineComponent({
      setup() {
        const { fetch } = useDataFetch(
          async () => {
            throw new Error('Fetch failed')
          },
          { resource: 'posts' }
        )

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await expect(wrapper.vm.fetch()).rejects.toThrow('Fetch failed')

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_data_fetch_total',
      1,
      expect.objectContaining({
        resource: 'posts',
        status: 'error',
        error_type: 'Error'
      })
    )
    expect(endTimer).toHaveBeenCalled()
  })

  it('should use "unknown" resource when not specified', async () => {
    const TestComponent = defineComponent({
      setup() {
        const { fetch } = useDataFetch(async () => 'data')

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await wrapper.vm.fetch()

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_data_fetch_total',
      1,
      expect.objectContaining({ resource: 'unknown' })
    )
  })

  it('should include custom labels', async () => {
    const TestComponent = defineComponent({
      setup() {
        const { fetch } = useDataFetch(
          async () => 'data',
          {
            resource: 'articles',
            category: 'tech',
            page: 1
          }
        )

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await wrapper.vm.fetch()

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_data_fetch_total',
      1,
      expect.objectContaining({
        resource: 'articles',
        category: 'tech',
        page: 1
      })
    )
  })

  it('should work without metrics plugin', async () => {
    const TestComponent = defineComponent({
      setup() {
        const { fetch } = useDataFetch(async () => ({ result: 'data' }))

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent)

    const result = await wrapper.vm.fetch()

    expect(result).toEqual({ result: 'data' })
  })

  it('should handle async errors gracefully', async () => {
    const TestComponent = defineComponent({
      setup() {
        const { fetch } = useDataFetch(
          async () => {
            throw new TypeError('Type error')
          },
          { resource: 'data' }
        )

        return { fetch }
      },
      template: '<div>Test</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: { metrics: mockMetrics }
      }
    })

    await expect(wrapper.vm.fetch()).rejects.toThrow('Type error')

    expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
      'vue_data_fetch_total',
      1,
      expect.objectContaining({
        status: 'error',
        error_type: 'TypeError'
      })
    )
  })
})
