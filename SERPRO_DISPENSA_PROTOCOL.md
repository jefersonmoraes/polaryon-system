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

---

## 🔒 PROTOCOLO DE AUTENTICAÇÃO CRUZADA (HANDSHAKE)

### 1. O Gateway de Transição Seguro
A transição entre o portal legado de compras governamentais e a nova sala de disputas (`cnetmobile...`) **DEVE** ocorrer exclusivamente pela URL oficial de handshake:
`https://www.comprasnet.gov.br/assinadas/dispensa_eletronica.asp`

*   **Evite 404**: Roteamentos legados como `/seguro/login_f.asp?servico=226` não são acessíveis via requisição GET comum sem um contexto do IIS ativo e retornam erro.
*   **O Mecanismo**: Esta página de transição gera internamente o token `compras-id` de forma legítima baseada no Certificado Digital instalado.

### 2. Propagação Obrigatória do `compras-id`
Para evitar o erro de segurança `Cnet-id inválido.` ou `Acesso não autorizado` na sala de disputa moderna:
*   O token `compras-id` obtido no redirecionamento **DEVE** ser extraído e acoplado a qualquer rota de disputa final no Electron:
    `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=UASGMODNUMANO&compras-id=UUID_DO_TOKEN`
*   **Persistent Headers**: Os cabeçalhos `Referer` (`https://www.comprasnet.gov.br/seguro/intro.htm`) e `Origin` (`https://www.comprasnet.gov.br`) devem ser interceptados e forçados via `onBeforeSendHeaders` para as rotas `/assinadas/dispensa_eletronica.asp` e `/comprasnet-web/seguro`.

### 3. Escudo Autolimpante de Sessão (Legacy Shield)
O robô deve interceptar qualquer rota que aponte para páginas legadas de erro/expiração (como `main2.asp`, `analise_amigavel.asp`, `AcessoNaoAutorizado.asp`) e redirecionar imediatamente o usuário de volta ao gateway `dispensa_eletronica.asp` para restabelecer a autorização com zero cliques.

