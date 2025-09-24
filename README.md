# 🚀 Vue.js + Prometheus + Grafana Monitoring Stack

## ⚡ Start Rápido

```bash
# Iniciar tudo de uma vez
./start.sh

# Ou manualmente:
docker compose up -d
cd frontend && npm run dev
```

## 🌐 Acessos

- **Frontend Vue**: `http://localhost:5173`
- **Backend Metrics**: `http://localhost:3000`
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001`
  - **Login**: `admin` / `admin123`

## 📊 Métricas Coletadas

### ⏱️ Performance
- `page_load_time_ms` - Tempo de carregamento da página
- `dom_content_loaded_ms` - Tempo do DOM Content Loaded
- `vue_route_load_time_ms` - Tempo de carregamento de rotas

### 💾 Memória
- `memory_used_bytes` - Memória JS utilizada
- `memory_total_bytes` - Memória JS total
- `memory_limit_bytes` - Limite de memória JS

### 🧩 Vue.js
- `vue_component_created_total` - Total de componentes criados
- `vue_component_mount_time_ms` - Tempo de mount dos componentes
- `vue_component_errors_total` - Erros em componentes
- `vue_global_errors_total` - Erros globais do Vue
- `vue_route_changes_total` - Mudanças de rota

### 🌐 Rede & UX
- `connection_downlink_mbps` - Velocidade de download
- `connection_type_total` - Tipo de conexão (4g, wifi, etc)
- `viewport_width_px` / `viewport_height_px` - Dimensões da tela

## 🛠️ Comandos Úteis

```bash
# Ver status
docker compose ps

# Ver logs
docker compose logs -f
docker compose logs -f metrics-backend

# Parar tudo
docker compose down

# Limpar volumes
docker compose down -v

# Rebuild backend
docker compose build metrics-backend
```

## 📈 Queries Prometheus

```promql
# Tempo médio de carregamento
avg(page_load_time_ms)

# Uso de memória
memory_used_bytes / 1024 / 1024

# Rate de erros
rate(vue_component_errors_total[5m])

# Mudanças de rota por minuto  
rate(vue_route_changes_total[1m])
```

## 🎯 Como Funciona

```
Frontend Vue → Backend (:3000/api/metrics) → Prometheus (:9090) → Grafana (:3001)
```

1. **Frontend** coleta métricas automaticamente via instrumentation
2. **Backend** recebe e converte para formato Prometheus
3. **Prometheus** faz scraping do backend a cada 10s
4. **Grafana** visualiza as métricas em dashboards

## 🚨 Troubleshooting

### Backend não inicia
```bash
docker compose logs metrics-backend
```

### Prometheus não consegue conectar
- Verifique se `metrics-backend` está rodando
- Teste: `curl http://localhost:3000/metrics`

### Grafana sem dados
- Verifique datasource Prometheus em Configuration
- URL deve ser: `http://prometheus:9090`

### Frontend não envia métricas
- Verifique console do browser
- Endpoint deve estar: `http://localhost:3000/api/metrics`
