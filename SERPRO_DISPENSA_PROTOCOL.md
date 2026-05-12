# PROTOCOLO DE IMORTALIDADE: SERPRO DISPENSA (v3.5.73)

## 🎯 OBJETIVO PRINCIPAL
Garantir que a lógica de lances para a API de Dispensa Eletrônica do Serpro permaneça funcional e que a identidade visual **POLARYON ELITE** seja preservada em todas as manutenções futuras.

---

## 🛠️ ESPECIFICAÇÕES TÉCNICAS (LANCE)

### 1. Estrutura do Payload (Dispensa v1)
Para salas detectadas com o padrão `/comprasnet-disputa/v1/compras/`, o payload **DEVE** seguir o formato de réplica humana minimalista:
```json
{
  "valorInformado": 100.0000,
  "faseItem": "LA"
}
```
*   **PRECISÃO**: Suporte nativo para até 4 casas decimais quando ativado pelo operador.
*   **IDENTIFICAÇÃO**: O campo `faseItem` é obrigatório e deve ser `"LA"`.

### 2. Sincronia de Tempo (Cronômetro)
O motor de captura deve realizar extração multi-camada para evitar travamentos em `00:00`:
1. `item.segundosParaEncerramento`
2. `item.segundosEncerramento`
3. `item.disputaItem.segundosParaEncerramento`

---

## 🎨 IDENTIDADE VISUAL: POLARYON ELITE

### 1. Proibição de Branding de Terceiros
*   **NUNCA** utilizar o nome "SIGA" ou "Siga Pregão".
*   O sistema deve ser referenciado apenas como **POLARYON**.

### 2. Design System (Deep Space)
*   **Fundo**: `#05070a` (Preto Profundo)
*   **Cards**: `#0d1117` com bordas semitransparentes.
*   **Destaques**: Emerald Green (`#10b981`) para ações positivas e Neon Red para alertas.
*   **Tipografia**: Uso de fontes técnicas (Inter/Montserrat 900) para valores monetários e cronômetros.

---

## 🚀 FUNCIONALIDADES CRÍTICAS

### 1. Modo Kamikaze (Instant Fire)
*   Ignora delays de simulação humana.
*   Disparo imediato ao detectar perda de posição ou gatilho manual.
*   Prioridade absoluta de thread durante os últimos 10 segundos da disputa.

### 2. Precisão de 4 Casas
*   Habilita inputs com step `0.0001`.
*   Formata o envio para o Serpro com precisão total, garantindo vantagem em lances de centavos fracionados.

---

> [!IMPORTANT]
> Qualquer alteração que simplifique a UI para padrões "bootstrap" ou "vanilla" é considerada uma falha de protocolo. A Polaryon deve sempre parecer um terminal tático de alta performance.
