const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:9090'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Storage para métricas
const metricsStore = new Map();
const logsStore = [];

// Endpoint para receber métricas do frontend
app.post('/api/metrics', (req, res) => {
  try {
    const { timestamp, metrics, logs, metadata } = req.body;
    
    const key = `${timestamp}-${Date.now()}`;
    metricsStore.set(key, {
      timestamp,
      metrics,
      metadata,
      receivedAt: new Date().toISOString()
    });
    
    if (logs && logs.length > 0) {
      logsStore.push(...logs.map(log => ({
        ...log,
        receivedAt: new Date().toISOString()
      })));
      
      if (logsStore.length > 1000) {
        logsStore.splice(0, logsStore.length - 1000);
      }
    }
    
    console.log(`📊 Métricas recebidas: ${Object.keys(metrics.counters || {}).length} counters, ${Object.keys(metrics.gauges || {}).length} gauges, ${Object.keys(metrics.histograms || {}).length} histograms`);
    if (logs && logs.length > 0) {
      console.log(`📝 Logs recebidos: ${logs.length} entradas`);
    }
    
    res.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      stored: key
    });
  } catch (error) {
    console.error('❌ Erro ao processar métricas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint para Prometheus scraping
app.get('/metrics', (req, res) => {
  try {
    let prometheusOutput = [];
    const now = Date.now();
    
    for (const [key, data] of metricsStore.entries()) {
      const { metrics } = data;
      
      if (metrics.counters) {
        for (const [metricName, value] of Object.entries(metrics.counters)) {
          prometheusOutput.push(`${metricName} ${value} ${now}`);
        }
      }
      
      if (metrics.gauges) {
        for (const [metricName, value] of Object.entries(metrics.gauges)) {
          prometheusOutput.push(`${metricName} ${value} ${now}`);
        }
      }
      
      if (metrics.histograms) {
        for (const [metricName, hist] of Object.entries(metrics.histograms)) {
          const baseName = metricName.split('{')[0];
          const labels = metricName.includes('{') ? metricName.split('{')[1].slice(0, -1) : '';
          const labelStr = labels ? `{${labels}}` : '';
          
          prometheusOutput.push(`${baseName}_count${labelStr} ${hist.count} ${now}`);
          prometheusOutput.push(`${baseName}_sum${labelStr} ${hist.sum} ${now}`);
          prometheusOutput.push(`${baseName}_avg${labelStr} ${hist.avg} ${now}`);
        }
      }
    }
    
    // 🆕 MÉTRICAS DE LOGS PARA PROMETHEUS/GRAFANA
    const logStats = logsStore.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {});
    
    // Métricas de logs por nível
    for (const [level, count] of Object.entries(logStats)) {
      prometheusOutput.push(`frontend_logs_total{level="${level}"} ${count} ${now}`);
    }
    
    // Total de logs
    prometheusOutput.push(`frontend_logs_total_count ${logsStore.length} ${now}`);
    
    // Logs recentes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentLogs = logsStore.filter(log => new Date(log.timestamp) > fiveMinutesAgo);
    prometheusOutput.push(`frontend_logs_recent_count ${recentLogs.length} ${now}`);
    
    // Logs por componente (se houver metadata.component)
    const componentStats = logsStore.reduce((acc, log) => {
      const component = log.metadata?.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {});
    
    for (const [component, count] of Object.entries(componentStats)) {
      prometheusOutput.push(`frontend_logs_by_component{component="${component}"} ${count} ${now}`);
    }
    
    // Limpeza de métricas antigas
    const cutoff = now - (5 * 60 * 1000);
    for (const [key, data] of metricsStore.entries()) {
      if (new Date(data.timestamp).getTime() < cutoff) {
        metricsStore.delete(key);
      }
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusOutput.join('\n'));
  } catch (error) {
    console.error('❌ Erro ao gerar métricas Prometheus:', error);
    res.status(500).send('# Error generating metrics');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    metrics: {
      stored: metricsStore.size,
      logs: logsStore.length
    }
  });
});

// Endpoint para dados (usado pelo frontend)
app.get('/api/data', (req, res) => {
  res.json({
    message: 'Dados do backend',
    timestamp: new Date().toISOString(),
    data: [
      { id: 1, name: 'Item 1', value: Math.random() * 100 },
      { id: 2, name: 'Item 2', value: Math.random() * 100 },
      { id: 3, name: 'Item 3', value: Math.random() * 100 }
    ],
    serverInfo: {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Endpoint para estatísticas
app.get('/api/stats', (req, res) => {
  res.json({
    metrics: {
      total: metricsStore.size,
      oldest: metricsStore.size > 0 ? Array.from(metricsStore.values())[0].timestamp : null,
      newest: metricsStore.size > 0 ? Array.from(metricsStore.values()).slice(-1)[0].timestamp : null
    },
    logs: {
      total: logsStore.length,
      byLevel: logsStore.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {})
    }
  });
});

// 🆕 ENDPOINTS PARA LOGS
app.get('/api/logs', (req, res) => {
  const { level, limit = 50, search } = req.query;
  
  let filteredLogs = [...logsStore];
  
  // Filtrar por nível
  if (level) {
    filteredLogs = filteredLogs.filter(log => log.level === level);
  }
  
  // Filtrar por busca
  if (search) {
    const searchLower = search.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.message.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
    );
  }
  
  // Ordenar por timestamp (mais recente primeiro)
  filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Limitar quantidade
  filteredLogs = filteredLogs.slice(0, parseInt(limit));
  
  res.json({
    logs: filteredLogs,
    totalCount: logsStore.length,
    filteredCount: filteredLogs.length,
    filters: { level, limit, search }
  });
});

// 🆕 LOGS RECENTES (últimos 5 minutos)
app.get('/api/logs/recent', (req, res) => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLogs = logsStore
    .filter(log => new Date(log.timestamp) > fiveMinutesAgo)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json({
    logs: recentLogs,
    count: recentLogs.length,
    timeRange: '5 minutes'
  });
});

// 🆕 LOGS POR NÍVEL
app.get('/api/logs/:level', (req, res) => {
  const { level } = req.params;
  const { limit = 20 } = req.query;
  
  const levelLogs = logsStore
    .filter(log => log.level === level)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));
  
  res.json({
    logs: levelLogs,
    level: level,
    count: levelLogs.length,
    totalByLevel: logsStore.filter(log => log.level === level).length
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Metrics backend rodando na porta ${PORT}`);
  console.log(`📊 Prometheus metrics: http://localhost:${PORT}/metrics`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
  console.log(`📝 Logs: http://localhost:${PORT}/api/logs`);
  console.log(`🔥 Recent logs: http://localhost:${PORT}/api/logs/recent`);
  console.log(`❌ Error logs: http://localhost:${PORT}/api/logs/error`);
  console.log(`⚠️  Warn logs: http://localhost:${PORT}/api/logs/warn`);
});