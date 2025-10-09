/**
 * useMetrics Composable - Helper Functions Tests
 * Tests: setGauge, trackApiCall, trackInteraction
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useMetrics } from '../../src/composables/useMetrics.js'

const createMockMetrics = () => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn(() => vi.fn())
})

describe('useMetrics - Helpers', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    vi.clearAllMocks()
  })

  describe('setGauge', () => {
    it('should set gauge value', () => {
      const TestComponent = defineComponent({
        setup() {
          const { setGauge } = useMetrics()
          setGauge('active_users', 42)
          return {}
        },
        template: '<div>Test</div>'
      })

      mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      expect(mockMetrics.setGauge).toHaveBeenCalledWith(
        'vue_active_users',
        42,
        expect.objectContaining({ component: 'anonymous' })
      )
    })

    it('should set gauge with labels', () => {
      const TestComponent = defineComponent({
        setup() {
          const { setGauge } = useMetrics()
          setGauge('queue_size', 100, { queue: 'processing', priority: 'high' })
          return {}
        },
        template: '<div>Test</div>'
      })

      mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      expect(mockMetrics.setGauge).toHaveBeenCalledWith(
        'vue_queue_size',
        100,
        expect.objectContaining({
          component: 'anonymous',
          queue: 'processing',
          priority: 'high'
        })
      )
    })

    it('should handle zero value', () => {
      const TestComponent = defineComponent({
        setup() {
          const { setGauge } = useMetrics()
          setGauge('connections', 0)
          return {}
        },
        template: '<div>Test</div>'
      })

      mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      expect(mockMetrics.setGauge).toHaveBeenCalledWith(
        'vue_connections',
        0,
        expect.any(Object)
      )
    })
  })

  describe('trackApiCall', () => {
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

  describe('trackInteraction', () => {
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
})
