#!/bin/bash
# ==============================================================================
# POLARYON ELITE - SCRIPT DE LIMPEZA E PROTEÇÃO AUTOMÁTICA DO SERVIDOR
# ==============================================================================
# Este script roda de forma autônoma para garantir que o disco da VPS
# nunca fique cheio, mantendo o sistema web e os updates do robô 100% estáveis.
# ==============================================================================

echo "=============================================================================="
echo "📡 [POLARYON CLEANUP] Iniciando Varredura e Limpeza: $(date)"
echo "=============================================================================="

# 1. Limpeza do Gerenciador de Pacotes do Linux (APT)
echo "🧹 Limpando caches e pacotes obsoletos do sistema (APT)..."
apt-get clean
apt-get autoremove -y

# 2. Redução de Logs do Sistema Operacional (Journalctl)
# Mantém apenas os logs dos últimos 7 dias
echo "🧹 Reduzindo logs do sistema operacional para os últimos 7 dias..."
journalctl --vacuum-time=7d

# 3. Limpeza do Cache do Node.js/NPM
echo "🧹 Limpando cache do NPM..."
npm cache clean --force

# 4. Limpeza de Logs do PM2 (Gerenciador do Backend)
# Impede que os arquivos de log do PM2 cresçam infinitamente
if command -v pm2 &> /dev/null; then
    echo "🧹 Rotacionando e limpando logs acumulados do PM2..."
    pm2 flush
fi

# 5. Manutenção de Versões do Robô (Mantém apenas as 3 mais novas)
DOWNLOADS_DIR="/var/www/polaryon/storage/download"
if [ -d "$DOWNLOADS_DIR" ]; then
    echo "📂 Analisando pasta de downloads: $DOWNLOADS_DIR"
    cd "$DOWNLOADS_DIR"
    
    # Conta quantos instaladores existem
    NUM_EXES=$(ls -1 Polaryon-*.exe 2>/dev/null | wc -l)
    echo "   Encontrados $NUM_EXES instaladores (.exe) no servidor."
    
    if [ "$NUM_EXES" -gt 3 ]; then
        echo "⚠️ Mais de 3 instaladores detectados. Removendo versões antigas..."
        # Lista ordenado por modificação (mais novos primeiro), pula os 3 primeiros e apaga o resto
        ls -t Polaryon-*.exe 2>/dev/null | tail -n +4 | while read -r old_file; do
            echo "   [DELETE] Removendo instalador antigo: $old_file"
            rm -f "$old_file"
            # Remove o blockmap correspondente
            if [ -f "$old_file.blockmap" ]; then
                echo "   [DELETE] Removendo blockmap antigo: $old_file.blockmap"
                rm -f "$old_file.blockmap"
            fi
        done
    else
        echo "   [OK] Quantidade de instaladores sob controle (menor ou igual a 3)."
    fi

    # Limpeza de blockmaps órfãos (que não possuem o .exe correspondente)
    echo "🧹 Verificando blockmaps órfãos..."
    ls -1 Polaryon-*.exe.blockmap 2>/dev/null | while read -r blockmap; do
        exe_name="${blockmap%.blockmap}"
        if [ ! -f "$exe_name" ]; then
            echo "   [DELETE] Removendo blockmap órfão: $blockmap"
            rm -f "$blockmap"
        fi
    done
else
    echo "❌ Pasta de downloads não encontrada em: $DOWNLOADS_DIR"
fi

echo "=============================================================================="
echo "✅ [POLARYON CLEANUP] Limpeza concluída com sucesso! Disco Protegido."
echo "=============================================================================="
