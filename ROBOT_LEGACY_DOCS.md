# 🎖️ Polaryon War Flow: Documentação de Operação (Salto do Tigre)

Este documento "eterniza" e "blinda" o conhecimento técnico acumulado durante a estabilização do robô de lances (v2.1.2). Estas regras **NÃO DEVEM** ser alteradas sem compreensão total dos efeitos colaterais no backend do Serpro/Compras.gov.br.

---

## 1. 🎯 A "Fórmula Secreta" do Link Direto (Modality Mapping)

**Problema Histórico**: O portal Compras.gov.br retorna **Erro 500** ou **"Compra não encontrada"** se tentarmos acessar a sala de disputa de uma Dispensa 14.133 usando o código de modalidade `14` na URL.

**A Solução Infiltrada**: 
- Independente da modalidade real (Pregão 05, Dispensa 14, etc.), o link de salto direto **DEVE SEMPRE** usar o código **`06`**.
- **Modelo de Link Perfeito**: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra={UASG}{06}{NUMERO}{ANO}`
- UASG: 6 dígitos (Ex: `390004`)
- Modaliade: Fixa em `06` (2 dígitos)
- Número: 5 dígitos (Ex: `00006`)
- Ano: 4 dígitos (Ex: `2026`)

> [!IMPORTANT]
> O uso do código `06` é a "chave mestre" que permite o acesso direto ignorando a instabilidade do servidor de participação do Serpro.

---

## 2. 🐅 O Salto do Tigre (Base de Estabilidade)

Quando o "Salto Direto" falha por instabilidade de sessão, o robô recua para a estratégia v2.0.4:

1. **Navegação de Busca**: O robô entra na tela de "Pesquisa de Dispensa".
2. **Auto-Preenchimento**: Preenche via DOM os campos `UASG` e `Número`.
3. **Trigger de Busca**: Clica no botão "Pesquisar".
4. **Sincronia de Sessão**: Este fluxo é mais lento, mas **essencial** porque força o servidor do governo a "reconhecer" a empresa logada dentro da licitação específica, criando os cookies de sessão necessários.

---

## 3. 👻 Motor de Extração (Zero-Latência)

Para identificar os itens e dar lances, usamos o **Injetor Visual (MutationObserver)**:

- **MutationObserver**: Monitora mudanças em tempo real no DOM sem recarregar a página. Isso permite latência quase zero no Sniper.
- **Identificação Leaf-Node**: O robô não procura por classes CSS (que mudam sempre). Ele procura por "folhas" do HTML que contenham o texto `R$` e `Item [X]`.
- **Anti-Frame Trap**: Como o portal antigo usa Framesets, o robô usa recursão para varrer todos os frames e encontrar o menu `LICITAÇÃO E DISPENSA (NOVO)` ou `servico=226`.

---

## 4. 🛡️ Blindagem de Deploy (VPS)

O script de deploy (`scripts/deploy.js`) possui uma regra de ouro para o servidor Linux:
- **Unlink Strategy**: Antes de atualizar a pasta `dist`, o script executa `unlink dist/download`. 
- Isso evita o erro `Directory not empty` que acontece quando o Linux tenta apagar um link simbólico que está sendo acessado pelo sistema de arquivos.

---

## 📋 Ferramentas e Pilares Tecnológicos

- **Electron Preload**: Onde toda a inteligência reside, isolada do site do governo mas com acesso total ao DOM.
- **IPC-Bridge**: Ponte de comunicação entre a "Máquina de Lances" e o Dashboard do usuário.
- **Military-Grade Banner**: Injeção visual no topo do portal do governo para dar controle total ao usuário dentro da "zona de combate".

---

## ⚠️ Mandamentos para Futuros Desenvolvedores
1. **Nunca** mude o `06` para `14` no link de disputa.
2. **Sempre** mantenha o delay de 3-4 segundos no salto para dar tempo do backend sincronizar.
3. Se o governo mudar o layout, ajuste a regex de extração, mas mantenha a **Lógica do Tigre**.

**Status da Missão**: CONCLUÍDA E ETERNIZADA.
**Versão de Referência**: v2.1.2 (Tanque de Guerra GOLD)
