/**
 * Vue 3 Metrics Plugin for Prometheus Monitoring
 *
 * Provides automatic instrumentation for Vue applications with Prometheus metrics collection.
 * Collects counters, gauges, and histograms for application performance monitoring.
 *
 * @module metricsPlugin
 * @author FlowForge Team
 * @since 1.0.0
 */

/**
 * MetricsCollector class for collecting and exporting Prometheus metrics.
 * Supports counters, gauges, and histograms with automatic flushing to Pushgateway.
 */
class MetricsCollector {
  /**
   * Creates a new MetricsCollector instance.
   *
   * @param {Object} options - Configuration options
   * @param {string} options.endpoint - Pushgateway endpoint URL
   * @param {string} options.appName - Application name for labeling
   * @param {number} options.flushInterval - Auto-flush interval in milliseconds
   * @param {string} options.job - Job name for Pushgateway
   */
  constructor(options = {}) {
    this.endpoint = options.endpoint ?? 'http://localhost:9091/metrics';
    this.appName = options.appName ?? 'vue-app';
    this.flushInterval = options.flushInterval ?? 10000;
    this.job = options.job ?? this.appName;

    // Metric storage
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.summaries = new Map();

    // Initialize built-in metrics
    this.initializeBuiltInMetrics();

    // Start auto-flush if interval is set
    if (this.flushInterval > 0) {
      this.startAutoFlush();
    }

    // Track page load performance
    this.trackPageLoadPerformance();
  }

  /**
   * Initializes built-in metrics with default values.
   * Sets up counters, gauges, and histograms for common Vue metrics.
   */
  initializeBuiltInMetrics() {
    // Initialize counters
    this.counters.set('vue_route_visits_total', { value: 0, labels: {} });
    this.counters.set('vue_component_mounts_total', { value: 0, labels: {} });
    this.counters.set('vue_errors_total', { value: 0, labels: {} });

    // Initialize gauges
    this.gauges.set('vue_dom_content_loaded_seconds', { value: 0, labels: {} });
    this.gauges.set('vue_active_components', { value: 0, labels: {} });

    // Initialize histograms with buckets
    this.histograms.set('vue_page_load_seconds', {
      buckets: [0.1, 0.5, 1, 2.5, 5, 10],
      values: [],
      labels: {}
    });
    this.histograms.set('vue_route_transition_seconds', {
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
      values: [],
      labels: {}
    });
  }

  /**
   * Increments a counter metric.
   *
   * @param {string} name - Metric name
   * @param {number} [value=1] - Value to increment by
   * @param {Object} [labels={}] - Labels for the metric
   * @example
   * metrics.incrementCounter('api_requests_total', 1, { method: 'GET', status: '200' });
   */
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.generateMetricKey(name, labels);

    if (!this.counters.has(key)) {
      this.counters.set(key, { value: 0, labels, name });
    }

    const counter = this.counters.get(key);
    counter.value += value;
  }

  /**
   * Sets a gauge metric value.
   *
   * @param {string} name - Metric name
   * @param {number} value - Value to set
   * @param {Object} [labels={}] - Labels for the metric
   * @example
   * metrics.setGauge('memory_usage_bytes', 1024000, { type: 'heap' });
   */
  setGauge(name, value, labels = {}) {
    const key = this.generateMetricKey(name, labels);
    this.gauges.set(key, { value, labels, name });
  }

  /**
   * Observes a value for histogram metric.
   *
   * @param {string} name - Metric name
   * @param {number} value - Observed value
   * @param {Object} [labels={}] - Labels for the metric
   * @example
   * metrics.observeHistogram('request_duration_seconds', 0.256, { endpoint: '/api/users' });
   */
  observeHistogram(name, value, labels = {}) {
    const key = this.generateMetricKey(name, labels);

    if (!this.histograms.has(key)) {
      this.histograms.set(key, {
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        values: [],
        labels,
        name
      });
    }

    const histogram = this.histograms.get(key);
    histogram.values.push(value);
  }

  /**
   * Starts a timer for measuring duration.
   * Returns a function that when called, stops the timer and records the duration.
   *
   * @param {string} name - Metric name for the histogram
   * @param {Object} [labels={}] - Labels for the metric
   * @returns {Function} End timer function
   * @example
   * const endTimer = metrics.startTimer('operation_duration_seconds', { operation: 'fetch' });
   * // ... perform operation ...
   * endTimer(); // Automatically records duration
   */
  startTimer(name, labels = {}) {
    const startTime = performance.now();

    return () => {
      const duration = (performance.now() - startTime) / 1000; // Convert to seconds
      this.observeHistogram(name, duration, labels);
      return duration;
    };
  }

  /**
   * Generates a unique key for a metric with labels.
   *
   * @param {string} name - Metric name
   * @param {Object} labels - Labels object
   * @returns {string} Unique metric key
   */
  generateMetricKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Formats metrics in Prometheus text exposition format.
   *
   * @returns {string} Formatted metrics string
   */
  formatMetrics() {
    const lines = [];
    const timestamp = Date.now();

    // Format counters
    this.counters.forEach((metric, key) => {
      const { name = key.split('{')[0], value, labels } = metric;
      const labelStr = this.formatLabels({ ...labels, app: this.appName });
      lines.push(`${name}${labelStr} ${value} ${timestamp}`);
    });

    // Format gauges
    this.gauges.forEach((metric, key) => {
      const { name = key.split('{')[0], value, labels } = metric;
      const labelStr = this.formatLabels({ ...labels, app: this.appName });
      lines.push(`${name}${labelStr} ${value} ${timestamp}`);
    });

    // Format histograms
    this.histograms.forEach((metric, key) => {
      const { name = key.split('{')[0], buckets, values, labels } = metric;

      if (values.length === 0) return;

      // Calculate bucket counts
      const bucketCounts = new Map();
      buckets.forEach(bucket => {
        bucketCounts.set(bucket, values.filter(v => v <= bucket).length);
      });

      // Output bucket metrics
      bucketCounts.forEach((count, bucket) => {
        const bucketLabels = { ...labels, app: this.appName, le: bucket.toString() };
        const labelStr = this.formatLabels(bucketLabels);
        lines.push(`${name}_bucket${labelStr} ${count} ${timestamp}`);
      });

      // Add +Inf bucket
      const infLabels = { ...labels, app: this.appName, le: '+Inf' };
      const infLabelStr = this.formatLabels(infLabels);
      lines.push(`${name}_bucket${infLabelStr} ${values.length} ${timestamp}`);

      // Add sum
      const sum = values.reduce((acc, val) => acc + val, 0);
      const sumLabels = { ...labels, app: this.appName };
      const sumLabelStr = this.formatLabels(sumLabels);
      lines.push(`${name}_sum${sumLabelStr} ${sum} ${timestamp}`);

      // Add count
      lines.push(`${name}_count${sumLabelStr} ${values.length} ${timestamp}`);
    });

    return lines.join('\n');
  }

  /**
   * Formats labels for Prometheus text format.
   *
   * @param {Object} labels - Labels object
   * @returns {string} Formatted labels string
   */
  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) return '';

    const labelPairs = Object.entries(labels)
      .filter(([k, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
      .join(',');

    return labelPairs ? `{${labelPairs}}` : '';
  }

  /**
   * Flushes metrics to Pushgateway.
   *
   * @returns {Promise<void>} Promise that resolves when flush is complete
   * @throws {Error} If flush fails
   */
  async flush() {
    try {
      const metrics = this.formatMetrics();

      if (!metrics) {
        return; // No metrics to flush
      }

      const url = `${this.endpoint}/job/${encodeURIComponent(this.job)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; version=0.0.4'
        },
        body: metrics
      });

      if (!response.ok) {
        throw new Error(`Failed to push metrics: ${response.status} ${response.statusText}`);
      }

      // Clear histogram values after successful flush
      this.histograms.forEach(histogram => {
        histogram.values = [];
      });

    } catch (error) {
      console.error('Failed to flush metrics:', error);
      throw error;
    }
  }

  /**
   * Starts automatic metric flushing at configured interval.
   */
  startAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Auto-flush failed:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Stops automatic metric flushing.
   */
  stopAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Tracks page load performance metrics.
   */
  trackPageLoadPerformance() {
    if (typeof window === 'undefined' || !window.performance) {
      return;
    }

    // Wait for page to fully load
    const measurePerformance = () => {
      const perfData = performance.getEntriesByType('navigation')[0];

      if (perfData) {
        // DOM Content Loaded
        const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart;
        this.setGauge('vue_dom_content_loaded_seconds', domContentLoaded / 1000);

        // Total page load time
        const loadTime = perfData.loadEventEnd - perfData.fetchStart;
        this.observeHistogram('vue_page_load_seconds', loadTime / 1000);

        // Other useful metrics
        this.observeHistogram('vue_dns_lookup_seconds',
          (perfData.domainLookupEnd - perfData.domainLookupStart) / 1000,
          { phase: 'dns' }
        );

        this.observeHistogram('vue_tcp_connect_seconds',
          (perfData.connectEnd - perfData.connectStart) / 1000,
          { phase: 'tcp' }
        );

        this.observeHistogram('vue_ttfb_seconds',
          (perfData.responseStart - perfData.requestStart) / 1000,
          { phase: 'ttfb' }
        );
      }
    };

    if (document.readyState === 'complete') {
      measurePerformance();
    } else {
      window.addEventListener('load', measurePerformance);
    }
  }

  /**
   * Cleans up resources and stops auto-flush.
   */
  destroy() {
    this.stopAutoFlush();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }
}

/**
 * Vue 3 Metrics Plugin
 *
 * @param {Object} app - Vue application instance
 * @param {Object} options - Plugin options
 * @param {string} [options.endpoint='http://localhost:9091/metrics'] - Pushgateway endpoint
 * @param {string} [options.appName='vue-app'] - Application name for labeling
 * @param {number} [options.flushInterval=10000] - Auto-flush interval in ms
 * @param {string} [options.job] - Job name for Pushgateway (defaults to appName)
 *
 * @example
 * // main.js
 * import { createApp } from 'vue';
 * import metricsPlugin from './plugins/metricsPlugin';
 *
 * const app = createApp(App);
 *
 * app.use(metricsPlugin, {
 *   endpoint: 'http://localhost:9091/metrics',
 *   appName: 'my-vue-app',
 *   flushInterval: 5000 // Flush every 5 seconds
 * });
 *
 * // In components:
 * this.$metrics.incrementCounter('custom_events_total', 1, { event: 'click' });
 *
 * // In Composition API:
 * import { inject } from 'vue';
 * const metrics = inject('$metrics');
 * metrics.setGauge('users_online', 42);
 */
const metricsPlugin = {
  install(app, options = {}) {
    // Create metrics collector instance
    const metrics = new MetricsCollector(options);

    // Make metrics available globally
    app.config.globalProperties.$metrics = metrics;
    app.provide('$metrics', metrics);

    // Track component lifecycle
    app.mixin({
      mounted() {
        metrics.incrementCounter('vue_component_mounts_total', 1, {
          component: this.$options.name ?? 'anonymous'
        });

        // Update active components gauge
        const currentActive = metrics.gauges.get('vue_active_components')?.value ?? 0;
        metrics.setGauge('vue_active_components', currentActive + 1);
      },

      unmounted() {
        // Decrease active components gauge
        const currentActive = metrics.gauges.get('vue_active_components')?.value ?? 0;
        metrics.setGauge('vue_active_components', Math.max(0, currentActive - 1));
      },

      errorCaptured(error, instance, info) {
        metrics.incrementCounter('vue_errors_total', 1, {
          type: error.name ?? 'unknown',
          info: info ?? 'unknown'
        });

        // Let error propagate
        return false;
      }
    });

    // Track router if available
    app.config.globalProperties.$router?.afterEach((to, from) => {
      // Track route visits
      metrics.incrementCounter('vue_route_visits_total', 1, {
        path: to.path,
        name: to.name ?? 'unnamed'
      });

      // Track route transition time
      const startTime = performance.now();

      // Use nextTick to measure after DOM update
      app.config.globalProperties.$nextTick?.(() => {
        const duration = (performance.now() - startTime) / 1000;
        metrics.observeHistogram('vue_route_transition_seconds', duration, {
          from: from?.path ?? 'initial',
          to: to.path
        });
      });
    });

    // Track global errors
    if (typeof window !== 'undefined') {
      const originalErrorHandler = window.onerror;

      window.onerror = function(message, source, lineno, colno, error) {
        metrics.incrementCounter('vue_errors_total', 1, {
          type: 'window_error',
          source: source ?? 'unknown'
        });

        // Call original handler if exists
        if (originalErrorHandler) {
          return originalErrorHandler.apply(this, arguments);
        }

        return false;
      };

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        metrics.incrementCounter('vue_errors_total', 1, {
          type: 'unhandled_rejection',
          reason: event.reason?.name ?? 'unknown'
        });
      });
    }

    // Clean up on app unmount
    const originalUnmount = app.unmount;
    app.unmount = function() {
      metrics.destroy();
      return originalUnmount.apply(this, arguments);
    };
  }
};

// Export both the plugin and the MetricsCollector class
export default metricsPlugin;
export { MetricsCollector };