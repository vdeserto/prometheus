/**
 * MetricsPlugin Formatting & Flush Tests
 * Tests: Metric formatting, label formatting, flush operations, auto-flush, Vue plugin
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import metricsPlugin, { MetricsCollector } from '../../src/plugins/metricsPlugin.js'

global.fetch = vi.fn()

const mockPerformanceNow = vi.fn()
global.performance = {
  now: mockPerformanceNow,
  getEntriesByType: vi.fn(() => [])
}

describe('MetricsCollector - Formatting', () => {
  let collector

  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformanceNow.mockReturnValue(1000)
    global.fetch.mockResolvedValue({ ok: true, status: 200 })
  })

  afterEach(() => {
    collector?.destroy()
  })

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
})

describe('metricsPlugin', () => {
  let app

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    app = null
  })

  describe('Plugin Installation', () => {
    it('should install plugin with default options', () => {
      app = createApp({})
      app.use(metricsPlugin)

      expect(app.config.globalProperties.$metrics).toBeDefined()
    })

    it('should provide metrics via dependency injection', () => {
      app = createApp({})
      app.use(metricsPlugin)

      expect(app._context.provides.$metrics).toBeDefined()
    })

    it('should pass options to MetricsCollector', () => {
      app = createApp({})
      app.use(metricsPlugin, {
        endpoint: 'http://custom:9091',
        appName: 'custom-app'
      })

      const metrics = app.config.globalProperties.$metrics

      expect(metrics.endpoint).toBe('http://custom:9091')
      expect(metrics.appName).toBe('custom-app')
    })
  })
})
