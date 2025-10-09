/**
 * MetricsPlugin Core Tests
 * Tests: Constructor, counters, gauges, histograms, timers, metric keys
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetricsCollector } from '../../src/plugins/metricsPlugin.js'

global.fetch = vi.fn()

const mockPerformanceNow = vi.fn()
global.performance = {
  now: mockPerformanceNow,
  getEntriesByType: vi.fn(() => [])
}

global.window = {
  addEventListener: vi.fn(),
  onerror: null,
  performance: global.performance
}

global.document = {
  readyState: 'complete'
}

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

  describe('startTimer', () => {
    beforeEach(() => {
      collector = new MetricsCollector({ flushInterval: 0 })
    })

    it('should create timer and measure duration', () => {
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(2500)

      const endTimer = collector.startTimer('operation_duration')

      expect(typeof endTimer).toBe('function')

      const duration = endTimer()

      expect(duration).toBe(1.5)
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
