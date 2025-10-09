/**
 * useMetrics Composable Test Suite - Part 1
 *
 * Tests for main useMetrics composable: initialization, trackEvent,
 * trackTiming, trackError, startTimer, setGauge, trackApiCall, trackInteraction.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useMetrics } from '../../src/composables/useMetrics.js'

// Line 15: Mock MetricsCollector

const createMockMetrics = () => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn(() => vi.fn())
})

// Line 24: useMetrics Composable Tests

describe('useMetrics', () => {
  let mockMetrics

  beforeEach(() => {
    mockMetrics = createMockMetrics()
    vi.clearAllMocks()
  })

  // Line 34: Basic Functionality

  describe('Initialization', () => {
    it('should inject metrics from provide/inject', () => {
      const TestComponent = defineComponent({
        setup() {
          const metrics = useMetrics()
          return { metrics }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            metrics: mockMetrics
          }
        }
      })

      expect(wrapper.vm.metrics).toBeDefined()
      expect(wrapper.vm.metrics.trackEvent).toBeDefined()
    })

    it('should return noop functions when metrics not provided', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const TestComponent = defineComponent({
        setup() {
          const { trackEvent, trackError } = useMetrics()
          return { trackEvent, trackError }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent)

      expect(consoleWarnSpy).toHaveBeenCalledWith('[useMetrics] Metrics plugin não está instalado')

      // Should not throw when calling noop functions
      expect(() => wrapper.vm.trackEvent('test')).not.toThrow()
      expect(() => wrapper.vm.trackError(new Error('test'))).not.toThrow()

      consoleWarnSpy.mockRestore()
    })

    it('should use component name from options', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics({ componentName: 'CustomName' })
          trackEvent('test_event')
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
        'vue_test_event_total',
        1,
        expect.objectContaining({ component: 'CustomName' })
      )
    })

    it('should auto-detect component name', () => {
      const TestComponent = defineComponent({
        name: 'AutoDetectedComponent',
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('auto_event')
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
        'vue_auto_event_total',
        1,
        expect.objectContaining({ component: 'AutoDetectedComponent' })
      )
    })

    it('should use "anonymous" when no name available', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('event')
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
        'vue_event_total',
        1,
        expect.objectContaining({ component: 'anonymous' })
      )
    })
  })

  // Line 145: trackEvent

  describe('trackEvent', () => {
    it('should track event with default value', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('button_click')
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
        'vue_button_click_total',
        1,
        expect.objectContaining({ component: 'anonymous' })
      )
    })

    it('should track event with custom labels', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('api_call', { endpoint: '/users', method: 'GET' })
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
        'vue_api_call_total',
        1,
        expect.objectContaining({
          component: 'anonymous',
          endpoint: '/users',
          method: 'GET'
        })
      )
    })

    it('should track event with custom value', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('items_processed', { batch: '1' }, 50)
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
        'vue_items_processed_total',
        50,
        expect.objectContaining({ component: 'anonymous', batch: '1' })
      )
    })

    it('should handle empty labels', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackEvent } = useMetrics()
          trackEvent('simple_event', {})
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
        'vue_simple_event_total',
        1,
        expect.objectContaining({ component: 'anonymous' })
      )
    })
  })

  // Line 245: trackTiming

  describe('trackTiming', () => {
    it('should track async operation timing', async () => {
      const endTimer = vi.fn(() => 1.5)
      mockMetrics.startTimer.mockReturnValue(endTimer)

      const TestComponent = defineComponent({
        setup() {
          const { trackTiming } = useMetrics()

          const performOperation = async () => {
            return await trackTiming('data_fetch', async () => {
              await new Promise(resolve => setTimeout(resolve, 10))
              return 'result'
            })
          }

          return { performOperation }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      const result = await wrapper.vm.performOperation()

      expect(result).toBe('result')
      expect(mockMetrics.startTimer).toHaveBeenCalledWith(
        'vue_data_fetch_duration_seconds',
        expect.objectContaining({ component: 'anonymous' })
      )
      expect(endTimer).toHaveBeenCalled()
    })

    it('should track timing with custom labels', async () => {
      const endTimer = vi.fn()
      mockMetrics.startTimer.mockReturnValue(endTimer)

      const TestComponent = defineComponent({
        setup() {
          const { trackTiming } = useMetrics()

          const operation = async () => {
            return await trackTiming(
              'database_query',
              async () => 'data',
              { query_type: 'SELECT', table: 'users' }
            )
          }

          return { operation }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      await wrapper.vm.operation()

      expect(mockMetrics.startTimer).toHaveBeenCalledWith(
        'vue_database_query_duration_seconds',
        expect.objectContaining({
          component: 'anonymous',
          query_type: 'SELECT',
          table: 'users'
        })
      )
    })

    it('should stop timer even on error', async () => {
      const endTimer = vi.fn()
      mockMetrics.startTimer.mockReturnValue(endTimer)

      const TestComponent = defineComponent({
        setup() {
          const { trackTiming } = useMetrics()

          const failingOperation = async () => {
            return await trackTiming('failing_op', async () => {
              throw new Error('Operation failed')
            })
          }

          return { failingOperation }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      await expect(wrapper.vm.failingOperation()).rejects.toThrow('Operation failed')
      expect(endTimer).toHaveBeenCalled()
    })

    it('should propagate errors', async () => {
      mockMetrics.startTimer.mockReturnValue(vi.fn())

      const TestComponent = defineComponent({
        setup() {
          const { trackTiming } = useMetrics()

          const operation = () => trackTiming('op', async () => {
            throw new Error('Test error')
          })

          return { operation }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      await expect(wrapper.vm.operation()).rejects.toThrow('Test error')
    })
  })

  // Line 375: trackError

  describe('trackError', () => {
    it('should track error with component context', () => {
      const TestComponent = defineComponent({
        name: 'ErrorComponent',
        setup() {
          const { trackError } = useMetrics()
          trackError(new Error('Something went wrong'))
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
        'vue_custom_errors_total',
        1,
        expect.objectContaining({
          component: 'ErrorComponent',
          error_type: 'Error',
          error_message: 'Something went wrong'
        })
      )
    })

    it('should truncate long error messages', () => {
      const longMessage = 'a'.repeat(150)

      const TestComponent = defineComponent({
        setup() {
          const { trackError } = useMetrics()
          trackError(new Error(longMessage))
          return {}
        },
        template: '<div>Test</div>'
      })

      mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      const call = mockMetrics.incrementCounter.mock.calls[0]
      const labels = call[2]

      expect(labels.error_message.length).toBe(100)
    })

    it('should include additional context', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackError } = useMetrics()
          trackError(new Error('Failed'), {
            operation: 'data_fetch',
            user_id: '123'
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
        'vue_custom_errors_total',
        1,
        expect.objectContaining({
          operation: 'data_fetch',
          user_id: '123'
        })
      )
    })

    it('should handle error without message', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackError } = useMetrics()
          const error = new Error()
          error.message = undefined

          trackError(error)
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
        'vue_custom_errors_total',
        1,
        expect.objectContaining({ error_message: 'unknown' })
      )
    })

    it('should handle error without name', () => {
      const TestComponent = defineComponent({
        setup() {
          const { trackError } = useMetrics()
          const error = { message: 'test' }

          trackError(error)
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
        'vue_custom_errors_total',
        1,
        expect.objectContaining({ error_type: 'Error' })
      )
    })
  })

  // Line 510: startTimer

  describe('startTimer', () => {
    it('should create manual timer', () => {
      const endTimer = vi.fn()
      mockMetrics.startTimer.mockReturnValue(endTimer)

      const TestComponent = defineComponent({
        setup() {
          const { startTimer } = useMetrics()
          const timer = startTimer('manual_operation')
          return { timer }
        },
        template: '<div>Test</div>'
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      expect(mockMetrics.startTimer).toHaveBeenCalledWith(
        'vue_manual_operation_duration_seconds',
        expect.objectContaining({ component: 'anonymous' })
      )
      expect(wrapper.vm.timer).toBe(endTimer)
    })

    it('should create timer with labels', () => {
      const TestComponent = defineComponent({
        setup() {
          const { startTimer } = useMetrics()
          startTimer('processing', { batch_id: '123', type: 'batch' })
          return {}
        },
        template: '<div>Test</div>'
      })

      mount(TestComponent, {
        global: {
          provide: { metrics: mockMetrics }
        }
      })

      expect(mockMetrics.startTimer).toHaveBeenCalledWith(
        'vue_processing_duration_seconds',
        expect.objectContaining({
          component: 'anonymous',
          batch_id: '123',
          type: 'batch'
        })
      )
    })
  })

  // Line 567: setGauge

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

  // Line 642: trackApiCall
})
