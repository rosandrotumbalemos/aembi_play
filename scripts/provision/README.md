# Provisionamento de players (Windows)

Scripts PowerShell para configurar um mini PC Windows como player do Aembi
Play (Fase 3 do roadmap, PROJECT_BRIEF.md seção 3 — "Provisionamento de
players | PowerShell (mini PCs Windows)").

O player em si (`apps/player`) não muda nada aqui: é a mesma PWA sem
interface (fundo preto + vídeo; só a tela de pareamento mostra um código,
ver PROJECT_BRIEF.md seção 9.2) rodando dentro de um navegador Chromium em
modo kiosk. O que este script resolve é a máquina em volta dela: abrir a URL
certa, em tela cheia, sem ninguém precisar clicar em nada, sobrevivendo a
reinícios, travamentos do navegador e a tela nunca dormir.

## O que o script faz

`Provision-Player.ps1`:

1. Localiza o Edge (padrão — já vem no Windows 10/11) ou o Chrome.
2. Registra uma tarefa agendada (**AembiPlayerKiosk**) que abre o navegador
   em `--kiosk` na URL do player, com um **perfil próprio e persistente**
   (nunca em modo anônimo/convidado — o player cacheia vídeo via Service
   Worker/Cache API para tocar offline, ver PROJECT_BRIEF.md seção 5, e isso
   se perderia a cada reinício se o perfil fosse descartável) e com
   `--autoplay-policy=no-user-gesture-required` (sem isso o Chromium bloqueia
   o autoplay do vídeo, já que não há nenhuma interação humana na tela).
3. Registra uma segunda tarefa (**AembiPlayerWatchdog**) que roda a cada
   poucos minutos e reabre o navegador se ele não estiver mais de pé —
   sobrevive a uma aba travada sem precisar reiniciar a máquina inteira.
4. Desliga suspensão, hibernação e a proteção de tela.
5. Opcionalmente configura auto-logon de um usuário local dedicado, para a
   tarefa do kiosk disparar sem ninguém logar manualmente.

A **orientação da tela** (seção 5.6 do briefing) é resolvida inteiramente
pelo player via CSS (`transform: rotate()`), a partir do manifesto — este
script não mexe na orientação do Windows/monitor.

O script é **idempotente**: rodar de novo (por exemplo, para trocar a URL)
substitui as tarefas em vez de duplicá-las. Também aceita `-Uninstall` para
reverter.

## Pré-requisitos

- Windows 10 ou 11, PowerShell (o 5.1 que já vem no Windows serve).
- Executar como **Administrador**.
- Microsoft Edge (já vem instalado) ou Google Chrome — se pedir Chrome e ele
  não estiver instalado, o script tenta instalar via `winget`.

## Uso

Uma URL só: é a mesma para todas as telas (o que diferencia cada uma é o
código de pareamento exibido nela, digitado depois no painel — seção 5.1).

```powershell
# Básico — Edge, sem auto-logon (alguém precisa logar uma vez, ou a máquina
# já ter auto-logon configurado por fora deste script)
.\Provision-Player.ps1 -PlayerUrl "https://play.aembi.com"

# Com Chrome e auto-logon de um usuário local dedicado
.\Provision-Player.ps1 -PlayerUrl "https://play.aembi.com" -Browser Chrome `
    -AutoLogonUser "aembi-player"
# (a senha é pedida de forma segura se não for passada com -AutoLogonPassword)

# Testando sem aplicar nada de verdade
.\Provision-Player.ps1 -PlayerUrl "https://play.aembi.com" -WhatIf

# Desfazer o provisionamento (remove as tarefas agendadas e o auto-logon, se
# foi este script que configurou)
.\Provision-Player.ps1 -Uninstall
```

Depois de rodar, reinicie a máquina (ou faça logon) para o kiosk abrir.

### Parâmetros principais

| Parâmetro | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `-PlayerUrl` | Sim (exceto com `-Uninstall`) | — | URL do player, ex. `https://play.aembi.com`. |
| `-Browser` | Não | `Edge` | `Edge` ou `Chrome`. |
| `-WatchdogIntervalMinutes` | Não | `2` | De quanto em quanto tempo o watchdog confere se o navegador ainda está aberto. |
| `-AutoLogonUser` | Não | — | Usuário local já existente para logar sozinho no boot. |
| `-AutoLogonPassword` | Não | — | Senha do `-AutoLogonUser` (`SecureString`); se omitida, é pedida com segurança. |
| `-SkipPowerSettings` | Não | — | Não mexe em suspensão/hibernação/proteção de tela. |
| `-Uninstall` | — | — | Remove o que foi provisionado. |
| `-StateDir` | Não | `C:\ProgramData\AembiPlay` | Onde o script guarda o perfil do navegador, o log e o estado (`kiosk-state.json`). |

Todos os parâmetros que alteram o sistema suportam `-WhatIf`/`-Confirm`
(`[CmdletBinding(SupportsShouldProcess)]`).

## Sobre o auto-logon

Configurar auto-logon grava a senha do usuário **em texto puro** no registro
(`HKLM\...\Winlogon\DefaultPassword`) — é a única forma nativa do Windows de
fazer isso sem infraestrutura adicional (Sysinternals Autologon, domínio
etc.). Por isso:

- Use um **usuário local dedicado e sem privilégios de administrador**, só
  para isso — nunca a conta de administrador da máquina.
- Isso só faz sentido num dispositivo **fisicamente controlado**, dedicado
  só a exibir o player (o cenário normal de uma tela de sinalização).
- `-Uninstall` remove o auto-logon **somente se foi este script que o
  configurou** (controlado por `kiosk-state.json`) — nunca mexe num
  auto-logon que já existia por fora dele.

Sem `-AutoLogonUser`, alguém ainda precisa logar uma vez (ou a máquina já
estar configurada com auto-logon por outro meio) para a tarefa "ao logon"
disparar.

## O watchdog

`Watchdog-Player.ps1` não recebe a URL/navegador como parâmetro — ele lê tudo
de `<StateDir>\kiosk-state.json`, escrito pela última execução do
`Provision-Player.ps1`. Isso significa que **trocar a URL do player é só
rodar `Provision-Player.ps1` de novo**; o watchdog já registrado passa a
usar o novo estado na próxima checagem, sem precisar recriar a tarefa dele.

A cada checagem, ele confere (via `Get-CimInstance Win32_Process`) se existe
um processo do navegador cuja linha de comando referencia o perfil do kiosk
— não basta "algum navegador estar aberto", porque pode ser um processo
auxiliar do próprio Chromium (GPU, renderer) ou uma janela aberta por outro
motivo. Se não achar, relança o navegador — com um pequeno *debounce* (30s
por padrão) para não abrir um segundo processo enquanto o primeiro ainda
está no meio da própria inicialização.

## Logs e estado

Tudo fica em `<StateDir>` (`C:\ProgramData\AembiPlay` por padrão):

- `provision.log` — log de tudo que o `Provision-Player.ps1` e o
  `Watchdog-Player.ps1` fizeram, com timestamp.
- `kiosk-state.json` — URL, navegador, caminho do executável, argumentos do
  kiosk e se o auto-logon foi configurado por este script.
- `kiosk-profile\` — perfil persistente do navegador (onde o Service Worker
  do player guarda o cache offline).

## Testes

Os scripts têm uma suíte [Pester](https://pester.dev/) que roda sem precisar
de um Windows de verdade (os cmdlets exclusivos do Windows — `ScheduledTasks`,
CIM, `powercfg.exe` — são substituídos por stubs em `tests/TestHelpers.ps1`
só para existirem e o Pester conseguir interceptá-los com `Mock`; o
comportamento testado continua vindo inteiramente do `Mock` de cada teste, e
os dois scripts nunca sabem que os stubs existem):

```powershell
Install-Module -Name Pester -Scope CurrentUser -MinimumVersion 5.5.0
cd scripts/provision
Invoke-Pester -Path tests
```

Também vale rodar o [PSScriptAnalyzer](https://github.com/PowerShell/PSScriptAnalyzer)
antes de mudar algo aqui:

```powershell
Install-Module -Name PSScriptAnalyzer -Scope CurrentUser
Invoke-ScriptAnalyzer -Path . -Recurse
```

**Nota de codificação:** `Provision-Player.ps1` e `Watchdog-Player.ps1` são
salvos com BOM UTF-8 de propósito — sem ele, o Windows PowerShell 5.1 (o que
vem instalado por padrão no Windows, diferente do PowerShell 7/`pwsh`) lê o
arquivo assumindo a página de código ativa do sistema em vez de UTF-8,
corrompendo os acentos dos comentários e mensagens em português. Ao editar
estes arquivos, salve mantendo o BOM.
