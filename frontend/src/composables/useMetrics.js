/**
 * Vue 3 Composable for Prometheus Metrics
 *
 * Simplifica o uso de métricas em componentes Vue usando Composition API.
 *
 * @usage
 * <script setup>
 * import { useMetrics } from '@/composables/useMetrics'
 *
 * const { trackEvent, trackTiming, trackError } = useMetrics()
 *
 * const handleClick = () => {
 *   trackEvent('button_click', { button: 'submit' })
 * }
 * </script>
 */

import { inject, onMounted, onUnmounted, getCurrentInstance } from 'vue'

/**
 * Composable principal para métricas Prometheus
 *
 * @param {object} options - Opções do composable
 * @param {string} options.componentName - Nome do componente (auto-detectado se omitido)
 * @returns {object} Funções de tracking de métricas
 */
export function useMetrics(options = {}) {
  const metrics = inject('metrics')

  if (!metrics) {
    console.warn('[useMetrics] Metrics plugin não está instalado')
    return createNoopMetrics()
  }

  const instance = getCurrentInstance()
  const componentName = options.componentName || instance?.type?.name || 'anonymous'

  /**
   * Rastreia evento personalizado
   *
   * @param {string} eventName - Nome do evento
   * @param {object} labels - Labels adicionais
   * @param {number} value - Valor para incrementar (default: 1)
   *
   * @example
   * trackEvent('add_to_cart', { product_id: '123' })
   * trackEvent('api_call', { endpoint: '/users' }, 2)
   */
  const trackEvent = (eventName, labels = {}, value = 1) => {
    metrics.incrementCounter(`vue_${eventName}_total`, value, {
      component: componentName,
      ...labels
    })
  }

  /**
   * Rastreia tempo de execução de uma função
   *
   * @param {string} operation - Nome da operação
   * @param {Function} fn - Função a ser executada
   * @param {object} labels - Labels adicionais
   * @returns {Promise<any>} Resultado da função
   *
   * @example
   * const data = await trackTiming('fetch_users', async () => {
   *   return await fetch('/api/users')
   * })
   */
  const trackTiming = async (operation, fn, labels = {}) => {
    const endTimer = metrics.startTimer(`vue_${operation}_duration_seconds`, {
      component: componentName,
      ...labels
    })

    try {
      const result = await fn()
      endTimer()
      return result
    } catch (error) {
      endTimer()
      throw error
    }
  }

  /**
   * Rastreia erro
   *
   * @param {Error} error - Objeto de erro
   * @param {object} context - Contexto adicional
   *
   * @example
   * try {
   *   await riskyOperation()
   * } catch (error) {
   *   trackError(error, { operation: 'riskyOperation' })
   * }
   */
  const trackError = (error, context = {}) => {
    metrics.incrementCounter('vue_custom_errors_total', 1, {
      component: componentName,
      error_type: error.name || 'Error',
      error_message: error.message?.substring(0, 100) || 'unknown',
      ...context
    })
  }

  /**
   * Cria timer manual para operações assíncronas
   *
   * @param {string} operation - Nome da operação
   * @param {object} labels - Labels adicionais
   * @returns {Function} Função para finalizar timer
   *
   * @example
   * const endTimer = startTimer('complex_calculation')
   * // ... operação demorada
   * endTimer()
   */
  const startTimer = (operation, labels = {}) => {
    return metrics.startTimer(`vue_${operation}_duration_seconds`, {
      component: componentName,
      ...labels
    })
  }

  /**
   * Define valor de gauge (métrica que pode subir/descer)
   *
   * @param {string} name - Nome do gauge
   * @param {number} value - Valor
   * @param {object} labels - Labels adicionais
   *
   * @example
   * setGauge('active_users', 42)
   * setGauge('shopping_cart_items', cartItems.length)
   */
  const setGauge = (name, value, labels = {}) => {
    metrics.setGauge(`vue_${name}`, value, {
      component: componentName,
      ...labels
    })
  }

  /**
   * Rastreia chamada de API
   *
   * @param {string} endpoint - Endpoint da API
   * @param {Function} fn - Função que faz a chamada
   * @param {object} options - Opções adicionais
   * @returns {Promise<any>} Resposta da API
   *
   * @example
   * const users = await trackApiCall('/api/users', async () => {
   *   return await fetch('/api/users').then(r => r.json())
   * }, { method: 'GET' })
   */
  const trackApiCall = async (endpoint, fn, options = {}) => {
    const { method = 'GET', ...extraLabels } = options
    const endTimer = metrics.startTimer('vue_api_call_duration_seconds', {
      component: componentName,
      endpoint,
      method,
      ...extraLabels
    })

    let status = 'success'
    try {
      const result = await fn()
      metrics.incrementCounter('vue_api_calls_total', 1, {
        component: componentName,
        endpoint,
        method,
        status: 'success',
        ...extraLabels
      })
      return result
    } catch (error) {
      status = 'error'
      metrics.incrementCounter('vue_api_calls_total', 1, {
        component: componentName,
        endpoint,
        method,
        status: 'error',
        error_type: error.name || 'Error',
        ...extraLabels
      })
      throw error
    } finally {
      endTimer()
    }
  }

  /**
   * Rastreia interação do usuário
   *
   * @param {string} action - Tipo de ação (click, input, scroll, etc)
   * @param {string} target - Alvo da interação
   * @param {object} labels - Labels adicionais
   *
   * @example
   * trackInteraction('click', 'submit-button')
   * trackInteraction('input', 'search-field', { query_length: 5 })
   */
  const trackInteraction = (action, target, labels = {}) => {
    metrics.incrementCounter('vue_user_interactions_total', 1, {
      component: componentName,
      action,
      target,
      ...labels
    })
  }

  return {
    trackEvent,
    trackTiming,
    trackError,
    startTimer,
    setGauge,
    trackApiCall,
    trackInteraction
  }
}

/**
 * Hook para rastrear ciclo de vida do componente automaticamente
 *
 * @param {string} componentName - Nome do componente (auto-detectado se omitido)
 *
 * @example
 * <script setup>
 * import { useComponentLifecycle } from '@/composables/useMetrics'
 *
 * useComponentLifecycle('MyComponent')
 * </script>
 */
export function useComponentLifecycle(componentName) {
  const metrics = inject('metrics')

  if (!metrics) {
    return
  }

  const instance = getCurrentInstance()
  const name = componentName || instance?.type?.name || 'anonymous'

  onMounted(() => {
    metrics.incrementCounter('vue_component_lifecycle_total', 1, {
      component: name,
      event: 'mounted'
    })
  })

  onUnmounted(() => {
    metrics.incrementCounter('vue_component_lifecycle_total', 1, {
      component: name,
      event: 'unmounted'
    })
  })
}

/**
 * Hook para rastrear carregamento de dados
 *
 * @param {Function} fetchFn - Função assíncrona de carregamento
 * @param {object} options - Opções
 * @returns {object} Estado de carregamento e função de refetch
 *
 * @example
 * const { data, loading, error, refetch } = useDataFetch(async () => {
 *   return await fetch('/api/users').then(r => r.json())
 * }, { resource: 'users' })
 */
export function useDataFetch(fetchFn, options = {}) {
  const metrics = inject('metrics')
  const { resource = 'unknown', ...labels } = options

  const instance = getCurrentInstance()
  const componentName = instance?.type?.name || 'anonymous'

  const fetch = async () => {
    if (!metrics) {
      return await fetchFn()
    }

    const endTimer = metrics.startTimer('vue_data_fetch_duration_seconds', {
      component: componentName,
      resource,
      ...labels
    })

    try {
      const result = await fetchFn()

      metrics.incrementCounter('vue_data_fetch_total', 1, {
        component: componentName,
        resource,
        status: 'success',
        ...labels
      })

      endTimer()
      return result
    } catch (error) {
      metrics.incrementCounter('vue_data_fetch_total', 1, {
        component: componentName,
        resource,
        status: 'error',
        error_type: error.name || 'Error',
        ...labels
      })

      endTimer()
      throw error
    }
  }

  return { fetch }
}

/**
 * Cria versão no-op do metrics para quando o plugin não está instalado
 * @private
 */
function createNoopMetrics() {
  const noop = () => {}
  const noopAsync = async (_, fn) => await fn()
  const noopTimer = () => noop

  return {
    trackEvent: noop,
    trackTiming: noopAsync,
    trackError: noop,
    startTimer: noopTimer,
    setGauge: noop,
    trackApiCall: noopAsync,
    trackInteraction: noop
  }
}
