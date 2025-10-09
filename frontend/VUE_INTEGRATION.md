# Integração Vue.js + Prometheus

Guia rápido para adicionar métricas Prometheus em aplicações Vue.js existentes.

## 📦 Arquivos Necessários

Copie estes arquivos para seu projeto Vue:

```
seu-projeto/
├── src/
│   ├── plugins/
│   │   └── metricsPlugin.js      # Plugin principal (copiar)
│   └── composables/
│       └── useMetrics.js          # Composable helpers (copiar)
```

## 🚀 Setup (5 minutos)

### 1. Instale o Plugin

```javascript
// main.js
import { createApp } from 'vue'
import metricsPlugin from '@/plugins/metricsPlugin'

const app = createApp(App)

app.use(metricsPlugin, {
  endpoint: 'http://localhost:9091/metrics/job/vue-app',
  appName: 'my-app',
  flushInterval: 10000  // Envia métricas a cada 10s
})

app.mount('#app')
```

### 2. Use em Componentes

```vue
<script setup>
import { useMetrics } from '@/composables/useMetrics'

const { trackEvent, trackApiCall } = useMetrics()

// Rastreia clique em botão
const handleClick = () => {
  trackEvent('button_click', { button: 'submit' })
}

// Rastreia chamada de API com timing
const fetchUsers = async () => {
  return await trackApiCall('/api/users', async () => {
    const res = await fetch('/api/users')
    return res.json()
  })
}
</script>

<template>
  <button @click="handleClick">Enviar</button>
</template>
```

## 📊 Tipos de Métricas

### Counters (contadores que só aumentam)

```javascript
const { trackEvent } = useMetrics()

// Rastreia eventos
trackEvent('add_to_cart', { product_id: '123' })
trackEvent('form_submit', { form: 'contact' })
```

### Gauges (valores que sobem/descem)

```javascript
const { setGauge } = useMetrics()

// Rastreia quantidade
setGauge('cart_items', cartItems.value.length)
setGauge('active_users', 42)
```

### Histograms (distribuição de tempos)

```javascript
const { trackTiming } = useMetrics()

// Rastreia duração de operação
await trackTiming('data_load', async () => {
  return await loadData()
})
```

## 🎯 Exemplos Práticos

### Rastrear Cliques

```vue
<template>
  <button @click="handleClick">Clique Aqui</button>
</template>

<script setup>
import { useMetrics } from '@/composables/useMetrics'

const { trackEvent } = useMetrics()

const handleClick = () => {
  trackEvent('cta_click', {
    button_name: 'hero_signup',
    page: 'landing'
  })
}
</script>
```

### Rastrear API Calls

```javascript
import { useMetrics } from '@/composables/useMetrics'

const { trackApiCall } = useMetrics()

async function fetchUsers() {
  const users = await trackApiCall('/api/users', async () => {
    const response = await fetch('/api/users')
    return response.json()
  }, {
    method: 'GET'
  })

  return users
}
```

### Rastrear Erros

```javascript
import { useMetrics } from '@/composables/useMetrics'

const { trackError } = useMetrics()

try {
  await riskyOperation()
} catch (error) {
  trackError(error, { operation: 'riskyOperation' })
  throw error
}
```

### Rastrear Performance de Componente

```javascript
import { onMounted } from 'vue'
import { useMetrics } from '@/composables/useMetrics'

const { trackTiming } = useMetrics()

onMounted(async () => {
  await trackTiming('component_load', async () => {
    await fetchData()
    await initializeCharts()
  })
})
```

### Rastrear Inputs do Usuário

```vue
<template>
  <input v-model="search" @input="handleInput" />
</template>

<script setup>
import { ref } from 'vue'
import { useMetrics } from '@/composables/useMetrics'

const search = ref('')
const { trackInteraction } = useMetrics()

const handleInput = (event) => {
  trackInteraction('input', 'search', {
    length: event.target.value.length
  })
}
</script>
```

## 🔧 Configuração Avançada

### Options API (Vue 2 style)

```javascript
export default {
  methods: {
    handleAction() {
      // Acessa via this.$metrics
      this.$metrics.incrementCounter('custom_action_total', 1, {
        action: 'button_click'
      })
    }
  }
}
```

### Métricas de Negócio

```javascript
// composables/useBusinessMetrics.js
import { inject } from 'vue'

export function useBusinessMetrics() {
  const metrics = inject('$metrics')

  const trackPurchase = (amount, currency = 'BRL') => {
    metrics.incrementCounter('purchases_total', 1, { currency })
    metrics.observeHistogram('purchase_amount', amount, { currency })
  }

  return { trackPurchase }
}
```

### Flush Manual

```javascript
// Envia métricas imediatamente (antes de navegação)
window.addEventListener('beforeunload', async () => {
  await app.config.globalProperties.$metrics.flush()
})
```

## 📈 Visualizando no Grafana

Após instrumentar seu app, as métricas estarão disponíveis em:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000

### Queries PromQL Úteis

```promql
# Taxa de cliques por segundo
rate(vue_button_click_total[5m])

# Tempo médio de API calls
rate(vue_api_call_duration_seconds_sum[5m])
  / rate(vue_api_call_duration_seconds_count[5m])

# Erros por componente
sum(increase(vue_errors_total[1h])) by (component)

# Gauge atual
vue_cart_items{app="my-app"}
```

## 🛠️ Troubleshooting

### Métricas não aparecem

1. Verifique Pushgateway: `curl http://localhost:9091/metrics`
2. Verifique endpoint no plugin (deve incluir `/job/nome`)
3. Veja console do browser por erros de CORS

### Plugin não disponível

Certifique-se que o plugin foi registrado ANTES do mount:

```javascript
app.use(metricsPlugin, { /* ... */ })  // ANTES
app.mount('#app')                       // DEPOIS
```

## 💡 Dicas

1. **Use labels significativos** - facilita filtros no Grafana
2. **Evite high cardinality** - não use IDs únicos como labels
3. **Nomeie métricas consistentemente** - `vue_noun_verb_unit`
4. **Track apenas o necessário** - evite ruído

## 📚 Arquivos de Referência

- Plugin: `/frontend/src/plugins/metricsPlugin.js`
- Composable: `/frontend/src/composables/useMetrics.js`
- Dashboard: `/monitoring/grafana/dashboards/vue-performance.json`

---

**PoC Prometheus + Grafana**
**Última atualização**: 2025-10-09
