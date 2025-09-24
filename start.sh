#!/bin/bash

# 🚀 Start Vue.js Monitoring Stack

set -e

echo "🚀 Iniciando stack de monitoramento Vue.js..."

# Verificar se Docker está rodando
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker não está rodando. Inicie o Docker Desktop primeiro."
    exit 1
fi

# Criar diretórios se não existirem
mkdir -p monitoring/grafana/{provisioning/{datasources,dashboards},dashboards}

# Build e start
echo "🔨 Building backend..."
docker compose build metrics-backend

echo "🚀 Starting services..."
docker compose up -d

echo "⏳ Aguardando serviços..."
sleep 15

# Verificar se está funcionando
echo "🔍 Verificando serviços..."
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FALHOU"
fi

if curl -s http://localhost:9090/-/healthy >/dev/null 2>&1; then
    echo "✅ Prometheus: OK" 
else
    echo "❌ Prometheus: FALHOU"
fi

if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ Grafana: OK"
else
    echo "❌ Grafana: FALHOU"
fi

echo ""
echo "🌐 Acessos:"
echo "  • Backend: http://localhost:3000"
echo "  • Prometheus: http://localhost:9090"
echo "  • Grafana: http://localhost:3001 (admin/admin123)"
echo ""
echo "📱 Para o frontend Vue:"
echo "  cd frontend && npm run dev"
