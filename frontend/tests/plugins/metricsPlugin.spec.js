/**
 * MetricsPlugin Test Suite
 *
 * Comprehensive tests for Vue 3 Metrics Plugin and MetricsCollector class.
 * Tests cover: counters, gauges, histograms, timers, formatting, flushing,
 * Vue integration, lifecycle hooks, error handling, and edge cases.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import metricsPlugin, { MetricsCollector } from '../../src/plugins/metricsPlugin.js'

// Line 17: Mock implementations

// Mock fetch globally
global.fetch = vi.fn()

// Mock performance API
const mockPerformanceNow = vi.fn()
global.performance = {
  now: mockPerformanceNow,
  getEntriesByType: vi.fn(() => [])
}

// Mock window for browser-specific tests
global.window = {
  addEventListener: vi.fn(),
  onerror: null,
  performance: global.performance
}

global.document = {
  readyState: 'complete'
}

// Line 42: MetricsCollector Class Tests

describe('MetricsCollector', () => {
  let collector

  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformanceNow.mockReturnValue(1000)
    global.fetch.mockResolvedValue({ ok: true, status: 200 })
  })

  afterEach(() => {
    collector?.destroy()
  })

  // Line 56: Constructor and Initialization

  describe('Constructor', () => {
    it('should create collector with default options', () => {
      collector = new MetricsCollector()

      expect(collector.endpoint).toBe('http://localhost:9091/metrics')
      expect(collector.appName).toBe('vue-app')
      expect(collector.flushInterval).toBe(10000)
      expect(collector.job).toBe('vue-app')
    })

    it('should create collector with custom options', () => {
      collector = new MetricsCollector({
        endpoint: 'http://custom:9091/metrics',
        appName: 'custom-app',
        flushInterval: 5000,
        job: 'custom-job'
      })

      expect(collector.endpoint).toBe('http://custom:9091/metrics')
      expect(collector.appName).toBe('custom-app')
      expect(collector.flushInterval).toBe(5000)
      expect(collector.job).toBe('custom-job')
    })

    it('should use nullish coalescing for options', () => {
      collector = new MetricsCollector({
        endpoint: null,
        appName: undefined
      })

      expect(collector.endpoint).toBe('http://localhost:9091/metrics')
      expect(collector.appName).toBe('vue-app')
    })

    it('should initialize built-in metrics', () => {
      collector = new MetricsCollector()

      expect(collector.counters.has('vue_route_visits_total')).toBe(true)
      expect(collector.counters.has('vue_component_mounts_total')).toBe(true)
      expect(collector.counters.has('vue_errors_total')).toBe(true)
      expect(collector.gauges.has('vue_dom_content_loaded_seconds')).toBe(true)
      expect(collector.gauges.has('vue_active_components')).toBe(true)
      expect(collector.histograms.has('vue_page_load_seconds')).toBe(true)
      expect(collector.histograms.has('vue_route_transition_seconds')).toBe(true)
    })

    it('should start auto-flush when interval is positive', () => {
      vi.useFakeTimers()
      collector = new MetricsCollector({ flushInterval: 1000 })

      expect(collector.flushTimer).toBeDefined()

      vi.useRealTimers()
    })

    it('should not start auto-flush when interval is zero', () => {
      collector = new MetricsCollector({ flushInterval: 0 })

      expect(collector.flushTimer).toBeUndefined()
    })
  })

  // Line 125: Counter Operations

  describe('incrementCounter', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should increment counter with default value', () => {
      collector.incrementCounter('test_counter')

      const counter = collector.counters.get('test_counter')
      expect(counter.value).toBe(1)
    })

    it('should increment counter with custom value', () => {
      collector.incrementCounter('test_counter', 5)

      const counter = collector.counters.get('test_counter')
      expect(counter.value).toBe(5)
    })

    it('should increment counter multiple times', () => {
      collector.incrementCounter('test_counter', 1)
      collector.incrementCounter('test_counter', 2)
      collector.incrementCounter('test_counter', 3)

      const counter = collector.counters.get('test_counter')
      expect(counter.value).toBe(6)
    })

    it('should handle counters with labels', () => {
      collector.incrementCounter('requests', 1, { method: 'GET', status: '200' })
      collector.incrementCounter('requests', 1, { method: 'POST', status: '201' })

      expect(collector.counters.size).toBeGreaterThan(2)
    })

    it('should create separate counters for different labels', () => {
      collector.incrementCounter('api_calls', 1, { endpoint: '/users' })
      collector.incrementCounter('api_calls', 1, { endpoint: '/posts' })

      const key1 = collector.generateMetricKey('api_calls', { endpoint: '/users' })
      const key2 = collector.generateMetricKey('api_calls', { endpoint: '/posts' })

      expect(collector.counters.get(key1).value).toBe(1)
      expect(collector.counters.get(key2).value).toBe(1)
    })

    it('should handle empty labels', () => {
      collector.incrementCounter('test', 1, {})

      const counter = collector.counters.get('test')
      expect(counter.value).toBe(1)
    })
  })

  // Line 185: Gauge Operations

  describe('setGauge', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should set gauge value', () => {
      collector.setGauge('memory_usage', 1024)

      const gauge = collector.gauges.get('memory_usage')
      expect(gauge.value).toBe(1024)
    })

    it('should update existing gauge', () => {
      collector.setGauge('cpu_usage', 50)
      collector.setGauge('cpu_usage', 75)

      const gauge = collector.gauges.get('cpu_usage')
      expect(gauge.value).toBe(75)
    })

    it('should handle gauge with labels', () => {
      collector.setGauge('temperature', 22.5, { sensor: 'cpu' })
      collector.setGauge('temperature', 18.3, { sensor: 'gpu' })

      const key1 = collector.generateMetricKey('temperature', { sensor: 'cpu' })
      const key2 = collector.generateMetricKey('temperature', { sensor: 'gpu' })

      expect(collector.gauges.get(key1).value).toBe(22.5)
      expect(collector.gauges.get(key2).value).toBe(18.3)
    })

    it('should handle zero value', () => {
      collector.setGauge('connections', 0)

      const gauge = collector.gauges.get('connections')
      expect(gauge.value).toBe(0)
    })

    it('should handle negative values', () => {
      collector.setGauge('balance', -100)

      const gauge = collector.gauges.get('balance')
      expect(gauge.value).toBe(-100)
    })
  })

  // Line 235: Histogram Operations

  describe('observeHistogram', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should observe histogram value', () => {
      collector.observeHistogram('request_duration', 0.5)

      const key = 'request_duration'
      const histogram = collector.histograms.get(key)

      expect(histogram.values).toContain(0.5)
    })

    it('should collect multiple observations', () => {
      collector.observeHistogram('latency', 0.1)
      collector.observeHistogram('latency', 0.2)
      collector.observeHistogram('latency', 0.3)

      const histogram = collector.histograms.get('latency')
      expect(histogram.values).toEqual([0.1, 0.2, 0.3])
    })

    it('should create histogram with default buckets', () => {
      collector.observeHistogram('custom_metric', 1.5)

      const histogram = collector.histograms.get('custom_metric')
      expect(histogram.buckets).toEqual([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10])
    })

    it('should handle histogram with labels', () => {
      collector.observeHistogram('response_time', 0.5, { endpoint: '/api/users' })
      collector.observeHistogram('response_time', 0.8, { endpoint: '/api/posts' })

      const key1 = collector.generateMetricKey('response_time', { endpoint: '/api/users' })
      const key2 = collector.generateMetricKey('response_time', { endpoint: '/api/posts' })

      expect(collector.histograms.get(key1).values).toEqual([0.5])
      expect(collector.histograms.get(key2).values).toEqual([0.8])
    })

    it('should handle zero values', () => {
      collector.observeHistogram('metric', 0)

      const histogram = collector.histograms.get('metric')
      expect(histogram.values).toContain(0)
    })
  })

  // Line 285: Timer Operations

  describe('startTimer', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should create timer and measure duration', () => {
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(2500)

      const endTimer = collector.startTimer('operation_duration')

      expect(typeof endTimer).toBe('function')

      const duration = endTimer()

      expect(duration).toBe(1.5) // (2500 - 1000) / 1000
      const histogram = collector.histograms.get('operation_duration')
      expect(histogram.values).toContain(1.5)
    })

    it('should handle timer with labels', () => {
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250)

      const endTimer = collector.startTimer('task_duration', { task: 'processing' })
      endTimer()

      const key = collector.generateMetricKey('task_duration', { task: 'processing' })
      const histogram = collector.histograms.get(key)

      expect(histogram.values).toContain(0.25)
    })

    it('should return duration value when stopped', () => {
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(3000)

      const endTimer = collector.startTimer('test')
      const duration = endTimer()

      expect(duration).toBe(2)
    })
  })

  // Line 326: Metric Key Generation

  describe('generateMetricKey', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should generate key without labels', () => {
      const key = collector.generateMetricKey('metric_name', {})

      expect(key).toBe('metric_name')
    })

    it('should generate key with single label', () => {
      const key = collector.generateMetricKey('metric', { env: 'prod' })

      expect(key).toBe('metric{env="prod"}')
    })

    it('should generate key with multiple labels sorted', () => {
      const key = collector.generateMetricKey('metric', {
        z: 'last',
        a: 'first',
        m: 'middle'
      })

      expect(key).toBe('metric{a="first",m="middle",z="last"}')
    })

    it('should handle quotes in label values', () => {
      const key = collector.generateMetricKey('metric', { msg: 'value"with"quotes' })

      // Note: Current implementation doesn't escape quotes, just includes them
      expect(key).toContain('msg="value"with"quotes"')
    })
  })

  // Line 360: Metric Formatting

  describe('formatMetrics', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0, appName: 'test-app' })
    })

    it('should format counter metrics', () => {
      collector.incrementCounter('test_counter', 5, { type: 'test' })

      const output = collector.formatMetrics()

      expect(output).toContain('test_counter')
      expect(output).toContain('5')
      expect(output).toContain('app="test-app"')
      expect(output).toContain('type="test"')
    })

    it('should format gauge metrics', () => {
      collector.setGauge('test_gauge', 42.5)

      const output = collector.formatMetrics()

      expect(output).toContain('test_gauge')
      expect(output).toContain('42.5')
    })

    it('should format histogram metrics with buckets', () => {
      collector.observeHistogram('test_histogram', 0.5)
      collector.observeHistogram('test_histogram', 1.5)

      const output = collector.formatMetrics()

      expect(output).toContain('test_histogram_bucket')
      expect(output).toContain('test_histogram_sum')
      expect(output).toContain('test_histogram_count')
      expect(output).toContain('le="+Inf"')
    })

    it('should include timestamp in metrics', () => {
      const timeSpy = vi.spyOn(Date, 'now').mockReturnValue(123456789)

      collector.incrementCounter('test', 1)
      const output = collector.formatMetrics()

      expect(output).toContain('123456789')

      timeSpy.mockRestore()
    })

    it('should skip histograms with no values', () => {
      collector.histograms.set('empty_histogram', {
        buckets: [1, 2, 3],
        values: [],
        labels: {},
        name: 'empty_histogram'
      })

      const output = collector.formatMetrics()

      expect(output).not.toContain('empty_histogram')
    })

    it('should calculate histogram sum correctly', () => {
      collector.observeHistogram('test_hist', 1.0)
      collector.observeHistogram('test_hist', 2.0)
      collector.observeHistogram('test_hist', 3.0)

      const output = collector.formatMetrics()

      expect(output).toContain('test_hist_sum{app="test-app"} 6')
    })

    it('should calculate histogram count correctly', () => {
      collector.observeHistogram('test_hist', 0.5)
      collector.observeHistogram('test_hist', 1.5)

      const output = collector.formatMetrics()

      expect(output).toContain('test_hist_count{app="test-app"} 2')
    })
  })

  // Line 440: Label Formatting

  describe('formatLabels', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should format empty labels', () => {
      const result = collector.formatLabels({})

      expect(result).toBe('')
    })

    it('should format single label', () => {
      const result = collector.formatLabels({ env: 'prod' })

      expect(result).toBe('{env="prod"}')
    })

    it('should format multiple labels', () => {
      const result = collector.formatLabels({
        env: 'prod',
        region: 'us-east'
      })

      expect(result).toContain('env="prod"')
      expect(result).toContain('region="us-east"')
    })

    it('should filter out null and undefined values', () => {
      const result = collector.formatLabels({
        valid: 'value',
        nullValue: null,
        undefinedValue: undefined
      })

      expect(result).toBe('{valid="value"}')
    })

    it('should escape quotes in values', () => {
      const result = collector.formatLabels({ msg: 'has "quotes"' })

      expect(result).toBe('{msg="has \\"quotes\\""}')
    })

    it('should convert non-string values to strings', () => {
      const result = collector.formatLabels({
        number: 42,
        boolean: true
      })

      expect(result).toContain('number="42"')
      expect(result).toContain('boolean="true"')
    })
  })

  // Line 497: Flush Operations

  describe('flush', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0, appName: 'test-app' })
    })

    it('should flush metrics to pushgateway', async () => {
      collector.incrementCounter('test_metric', 1)

      await collector.flush()

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:9091/metrics/job/test-app',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; version=0.0.4' }
        })
      )
    })

    it('should include metrics in request body', async () => {
      collector.incrementCounter('requests_total', 5)

      await collector.flush()

      const callArgs = global.fetch.mock.calls[0]
      const body = callArgs[1].body

      expect(body).toContain('requests_total')
      expect(body).toContain('5')
    })

    it('should encode job name in URL', async () => {
      collector = new MetricsCollector({
        flushInterval: 0,
        job: 'my-custom/job'
      })
      collector.incrementCounter('test', 1)

      await collector.flush()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('my-custom%2Fjob'),
        expect.any(Object)
      )
    })

    it('should not flush when no metrics exist', async () => {
      collector = new MetricsCollector({ flushInterval: 0 })
      collector.counters.clear()
      collector.gauges.clear()
      collector.histograms.clear()

      await collector.flush()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should throw error on failed flush', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      collector.incrementCounter('test', 1)

      await expect(collector.flush()).rejects.toThrow('Failed to push metrics: 500 Internal Server Error')
    })

    it('should clear histogram values after successful flush', async () => {
      collector.observeHistogram('test_hist', 1)
      collector.observeHistogram('test_hist', 2)

      await collector.flush()

      const histogram = collector.histograms.get('test_hist')
      expect(histogram.values).toEqual([])
    })

    it('should not clear histogram values on failed flush', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      collector.observeHistogram('test_hist', 1)

      try {
        await collector.flush()
      } catch (error) {
        // Expected error
      }

      const histogram = collector.histograms.get('test_hist')
      expect(histogram.values).toEqual([1])
    })
  })

  // Line 586: Auto-Flush

  describe('Auto-Flush', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should auto-flush at configured interval', async () => {
      collector = new MetricsCollector({ flushInterval: 5000 })
      collector.incrementCounter('test', 1)

      expect(global.fetch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(5000)

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should flush multiple times', async () => {
      collector = new MetricsCollector({ flushInterval: 1000 })

      await vi.advanceTimersByTimeAsync(3000)

      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('should stop auto-flush when stopped', async () => {
      collector = new MetricsCollector({ flushInterval: 1000 })

      collector.stopAutoFlush()

      await vi.advanceTimersByTimeAsync(2000)

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should restart auto-flush when called again', async () => {
      collector = new MetricsCollector({ flushInterval: 1000 })

      collector.stopAutoFlush()
      collector.startAutoFlush()

      await vi.advanceTimersByTimeAsync(1000)

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle flush errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      collector = new MetricsCollector({ flushInterval: 1000 })
      collector.incrementCounter('test', 1)

      await vi.advanceTimersByTimeAsync(1000)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Auto-flush failed:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  // Line 660: Destroy and Cleanup

  describe('destroy', () => {
    it('should stop auto-flush', () => {
      vi.useFakeTimers()
      collector = new MetricsCollector({ flushInterval: 1000 })

      collector.destroy()

      expect(collector.flushTimer).toBeNull()

      vi.useRealTimers()
    })

    it('should clear all metrics', () => {
      collector = new MetricsCollector({ flushInterval: 0 })
      collector.incrementCounter('test', 1)
      collector.setGauge('gauge', 42)
      collector.observeHistogram('hist', 0.5)

      collector.destroy()

      expect(collector.counters.size).toBe(0)
      expect(collector.gauges.size).toBe(0)
      expect(collector.histograms.size).toBe(0)
    })
  })
})

// Line 690: Vue Plugin Tests

describe('metricsPlugin', () => {
  let app
  let metrics

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    app = null
    metrics = null
  })

  // Line 705: Plugin Installation

  describe('Plugin Installation', () => {
    it('should install plugin with default options', () => {
      app = createApp({})
      app.use(metricsPlugin)

      expect(app.config.globalProperties.$metrics).toBeDefined()
    })

    it('should provide metrics via dependency injection', () => {
      app = createApp({})
      app.use(metricsPlugin)

      // Metrics should be provided for injection
      expect(app._context.provides.$metrics).toBeDefined()
    })

    it('should pass options to MetricsCollector', () => {
      app = createApp({})
      app.use(metricsPlugin, {
        endpoint: 'http://custom:9091',
        appName: 'custom-app'
      })

      metrics = app.config.globalProperties.$metrics

      expect(metrics.endpoint).toBe('http://custom:9091')
      expect(metrics.appName).toBe('custom-app')
    })
  })
})
