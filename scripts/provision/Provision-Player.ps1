<#
.SYNOPSIS
    Provisiona um mini PC Windows como player do Aembi Play (Fase 3, seção 3 do
    PROJECT_BRIEF.md — "Provisionamento de players | PowerShell (mini PCs Windows)").

.DESCRIPTION
    O player é uma PWA sem interface (fundo preto + vídeo; só a tela de
    pareamento mostra um código) — ver PROJECT_BRIEF.md seção 9.2. Este script
    configura a máquina pra abrir essa URL em modo kiosk no boot, sem depender
    de alguém logar ou clicar em nada:

      1. Localiza o navegador Chromium (Edge, já vem no Windows, ou Chrome)
         que vai rodar o player.
      2. Registra uma tarefa agendada que abre o navegador em `--kiosk` com um
         perfil próprio e persistente (necessário: o player cacheia vídeo via
         Service Worker/Cache API pra tocar offline — seção 5 — então NUNCA
         usa `--incognito`, que apagaria esse cache a cada reinício) e
         `--autoplay-policy=no-user-gesture-required` (sem isso o Chromium
         bloqueia o autoplay do vídeo por não haver interação do usuário).
      3. Registra uma segunda tarefa (watchdog) que roda a cada poucos minutos
         e reabre o navegador se ele cair, sem precisar reiniciar a máquina.
      4. Desliga suspensão/hibernação e a proteção de tela — uma tela de
         sinalização não pode dormir.
      5. Opcionalmente configura auto-logon de um usuário local dedicado, pra
         a tarefa "ao fazer logon" disparar sem intervenção.

    A orientação da tela (seção 5.6) é resolvida inteiramente pelo player via
    CSS (`transform: rotate()`), a partir do manifesto — este script não mexe
    na orientação do Windows/monitor.

    Idempotente: pode ser rodado de novo (ex.: pra trocar a URL) sem duplicar
    tarefas agendadas. Também aceita -Uninstall pra reverter o que foi feito.

.PARAMETER PlayerUrl
    URL do player (mesma para todas as telas — o pareamento por código é o
    que diferencia cada uma, ver PROJECT_BRIEF.md seção 5.1). Ex.:
    "https://play.aembi.com" ou, num teste local na mesma rede,
    "http://192.168.0.10:4000".

.PARAMETER Browser
    "Edge" (padrão — já vem instalado no Windows 10/11) ou "Chrome".

.PARAMETER WatchdogIntervalMinutes
    De quanto em quanto tempo o watchdog confere se o navegador ainda está
    aberto no kiosk. Padrão: 2 minutos.

.PARAMETER AutoLogonUser
    Nome de um usuário local já existente pra logar automaticamente no boot.
    Sem isto, a tarefa de kiosk é registrada para "ao logon de qualquer
    usuário" e alguém ainda precisa logar uma vez (ou o Windows já estar
    configurado com auto-logon por fora deste script).

.PARAMETER AutoLogonPassword
    Senha do AutoLogonUser. Se -AutoLogonUser for passado e a senha não for
    informada, o script pergunta de forma segura (Read-Host -AsSecureString).

.PARAMETER StateDir
    Onde o script guarda seu estado (perfil do navegador, log,
    kiosk-state.json). Padrão: C:\ProgramData\AembiPlay. Existe como
    parâmetro sobretudo para os testes (Pester) apontarem para uma pasta
    temporária em vez de mexer no ProgramData de verdade.

.PARAMETER SkipPowerSettings
    Não mexe em suspensão/hibernação/proteção de tela — útil se a máquina já
    está configurada assim por outro meio (GPO, imagem padrão etc.).

.PARAMETER Uninstall
    Remove as tarefas agendadas, o auto-logon (se foi este script que
    configurou) e o estado salvo. Não desfaz as alterações de energia (não há
    como saber com segurança o valor anterior de cada uma) — o log e a saída
    do -Uninstall lembram disso.

.EXAMPLE
    .\Provision-Player.ps1 -PlayerUrl "https://play.aembi.com"

.EXAMPLE
    .\Provision-Player.ps1 -PlayerUrl "https://play.aembi.com" -Browser Chrome `
        -AutoLogonUser "aembi-player" -WhatIf

.EXAMPLE
    .\Provision-Player.ps1 -Uninstall
#>
[CmdletBinding(SupportsShouldProcess = $true, DefaultParameterSetName = "Provision")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Provision", Position = 0)]
    [ValidatePattern("^https?://")]
    [string]$PlayerUrl,

    [Parameter(ParameterSetName = "Provision")]
    [ValidateSet("Edge", "Chrome")]
    [string]$Browser = "Edge",

    [Parameter(ParameterSetName = "Provision")]
    [ValidateRange(1, 60)]
    [int]$WatchdogIntervalMinutes = 2,

    [Parameter(ParameterSetName = "Provision")]
    [string]$AutoLogonUser,

    [Parameter(ParameterSetName = "Provision")]
    [securestring]$AutoLogonPassword,

    [Parameter(ParameterSetName = "Provision")]
    [switch]$SkipPowerSettings,

    [Parameter(ParameterSetName = "Uninstall", Mandatory = $true)]
    [switch]$Uninstall,

    [string]$StateDir = "C:\ProgramData\AembiPlay"
)

# ─────────────────────────────────────────────────────────────────────────
# Constantes / nomes usados nas tarefas agendadas e no perfil do navegador —
# centralizados aqui pra Install-*/Remove-* e os testes usarem os mesmos
# valores sem repeti-los.
# ─────────────────────────────────────────────────────────────────────────
$script:KioskTaskName = "AembiPlayerKiosk"
$script:WatchdogTaskName = "AembiPlayerWatchdog"
$script:LogFileName = "provision.log"
$script:StateFileName = "kiosk-state.json"
$script:KioskProfileDirName = "kiosk-profile"

# ─────────────────────────────────────────────────────────────────────────
# Logging — grava no console e no log em disco. Recebe $StateDir como
# parâmetro (em vez de ler a variável de script direto) só pra ficar fácil
# de chamar isolado nos testes.
# ─────────────────────────────────────────────────────────────────────────
function Write-ProvisionLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO",
        [Parameter(Mandatory = $true)][string]$StateDir
    )

    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message

    switch ($Level) {
        "WARN" { Write-Warning $Message }
        "ERROR" { Write-Error $Message -ErrorAction Continue }
        # Write-Information (em vez de Write-Host) para ficar redirecionável/
        # capturável; -InformationAction Continue garante que apareça no
        # console mesmo sem o técnico ter configurado $InformationPreference.
        default { Write-Information $line -InformationAction Continue }
    }

    try {
        if (-not (Test-Path -LiteralPath $StateDir)) {
            New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
        }
        Add-Content -LiteralPath (Join-Path $StateDir $script:LogFileName) -Value $line -ErrorAction Stop
    }
    catch {
        # Log em disco é best-effort — nunca deve derrubar o provisionamento
        # por causa de um problema de permissão de arquivo.
        Write-Warning "Não consegui gravar o log em disco: $($_.Exception.Message)"
    }
}

# ─────────────────────────────────────────────────────────────────────────
# Administrador — verificado como função própria (não `#Requires
# -RunAsAdministrator`, que depende de recursos exclusivos do Windows e
# impediria até carregar este arquivo, via dot-source, nos testes Pester
# rodando fora do Windows).
# ─────────────────────────────────────────────────────────────────────────
function Test-IsAdministrator {
    [CmdletBinding()]
    param()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ─────────────────────────────────────────────────────────────────────────
# Localiza o executável do navegador. Confere os caminhos padrão de
# instalação (por máquina e por usuário) antes de recorrer a `Get-Command`,
# porque um kiosk normalmente não tem o navegador no PATH de um usuário de
# serviço.
# ─────────────────────────────────────────────────────────────────────────
function Resolve-BrowserExecutable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][ValidateSet("Edge", "Chrome")][string]$Browser
    )

    $candidatePaths = if ($Browser -eq "Edge") {
        @(
            "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
            "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
        )
    }
    else {
        @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
            "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
    }

    foreach ($path in $candidatePaths) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            return $path
        }
    }

    $exeName = if ($Browser -eq "Edge") { "msedge.exe" } else { "chrome.exe" }
    $command = Get-Command -Name $exeName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    return $null
}

# ─────────────────────────────────────────────────────────────────────────
# Tenta instalar o Chrome via winget quando ele não foi encontrado — só
# usado para -Browser Chrome (o Edge já vem com o Windows 10/11; se não
# estiver lá, algo mais grave está errado na imagem e o script não tenta
# reinstalar o navegador padrão do sistema).
# ─────────────────────────────────────────────────────────────────────────
function Install-ChromeViaWinget {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$StateDir)

    $winget = Get-Command -Name "winget.exe" -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw "Google Chrome não está instalado e o winget não foi encontrado " +
        "para instalar automaticamente. Instale o Chrome manualmente (ou use " +
        "-Browser Edge) e rode o script de novo."
    }

    if ($PSCmdlet.ShouldProcess("Google Chrome", "Instalar via winget")) {
        Write-ProvisionLog -StateDir $StateDir -Message "Chrome não encontrado — instalando via winget..."
        & winget install --id Google.Chrome -e --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "winget install --id Google.Chrome falhou (código $LASTEXITCODE)."
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────
# Argumentos de linha de comando do navegador em modo kiosk. Perfil
# PERSISTENTE (nunca --incognito): o player depende do Cache API do Service
# Worker pra tocar offline (PROJECT_BRIEF.md seção 5), e autoplay liberado
# porque não há interação humana nenhuma pra "desbloquear" o autoplay padrão
# do Chromium.
# ─────────────────────────────────────────────────────────────────────────
function New-KioskArgumentList {
    # Função pura (só monta e devolve uma lista de strings, sem tocar em
    # nada do sistema) — suprime PSUseShouldProcessForStateChangingFunctions,
    # que dispara só pelo verbo "New-", não por um efeito colateral real.
    [Diagnostics.CodeAnalysis.SuppressMessage("PSUseShouldProcessForStateChangingFunctions", "")]
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$PlayerUrl,
        [Parameter(Mandatory = $true)][string]$UserDataDir,
        [Parameter(Mandatory = $true)][ValidateSet("Edge", "Chrome")][string]$Browser
    )

    $kioskArgs = @(
        "--kiosk"
        "`"$PlayerUrl`""
        "--user-data-dir=`"$UserDataDir`""
        "--no-first-run"
        "--noerrdialogs"
        "--disable-infobars"
        "--disable-session-crashed-bubble"
        "--disable-features=TranslateUI"
        "--overscroll-history-navigation=0"
        "--disable-pinch"
        "--autoplay-policy=no-user-gesture-required"
    )

    if ($Browser -eq "Edge") {
        # "fullscreen" (e não "public-browsing") é o que preserva o perfil
        # entre reinícios — o outro modo do kiosk do Edge é uma sessão
        # descartável, equivalente a --incognito.
        $kioskArgs += "--edge-kiosk-type=fullscreen"
    }

    return $kioskArgs
}

# ─────────────────────────────────────────────────────────────────────────
# Tarefa agendada que abre o navegador em kiosk. Removida e recriada a cada
# execução (idempotente) — assim trocar a URL ou o navegador com uma nova
# chamada do script atualiza a tarefa em vez de empilhar uma segunda.
# ─────────────────────────────────────────────────────────────────────────
function Install-KioskTask {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$BrowserPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$LogonUser,
        [Parameter(Mandatory = $true)][string]$StateDir
    )

    if (-not $PSCmdlet.ShouldProcess($script:KioskTaskName, "Registrar tarefa agendada")) {
        return
    }

    $existing = Get-ScheduledTask -TaskName $script:KioskTaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$($script:KioskTaskName)' já existia — removendo antes de recriar."
        Unregister-ScheduledTask -TaskName $script:KioskTaskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction -Execute $BrowserPath -Argument ($Arguments -join " ")
    $trigger = if ($LogonUser) {
        New-ScheduledTaskTrigger -AtLogOn -User $LogonUser
    }
    else {
        New-ScheduledTaskTrigger -AtLogOn
    }
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    # Nota: `(if (...) {...} else {...})` NÃO funciona como argumento inline
    # (só como atribuição direta, como `$trigger` acima) — por isso resolve
    # o UserId numa variável antes de passá-lo.
    $principalUserId = if ($LogonUser) { $LogonUser } else { "$env:USERDOMAIN\$env:USERNAME" }
    $principal = New-ScheduledTaskPrincipal -UserId $principalUserId -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask -TaskName $script:KioskTaskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal -Description "Aembi Play — abre o player em modo kiosk no logon." | Out-Null

    Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$($script:KioskTaskName)' registrada (logon: $(if ($LogonUser) { $LogonUser } else { 'qualquer usuário'}))."
}

# ─────────────────────────────────────────────────────────────────────────
# Tarefa agendada do watchdog — roda em intervalo fixo e chama
# Watchdog-Player.ps1, que relança o navegador se ele não estiver mais de
# pé. Existe pra sobreviver a uma aba/processo que trava sem precisar
# reiniciar a máquina inteira.
# ─────────────────────────────────────────────────────────────────────────
function Install-WatchdogTask {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$WatchdogScriptPath,
        [Parameter(Mandatory = $true)][string]$StateDir,
        [int]$IntervalMinutes = 2
    )

    if (-not $PSCmdlet.ShouldProcess($script:WatchdogTaskName, "Registrar tarefa agendada")) {
        return
    }

    $existing = Get-ScheduledTask -TaskName $script:WatchdogTaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$($script:WatchdogTaskName)' já existia — removendo antes de recriar."
        Unregister-ScheduledTask -TaskName $script:WatchdogTaskName -Confirm:$false
    }

    $pwshPath = (Get-Process -Id $PID).Path
    $action = New-ScheduledTaskAction -Execute $pwshPath `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScriptPath`" -StateDir `"$StateDir`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
        -RepetitionDuration ([TimeSpan]::MaxValue)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask -TaskName $script:WatchdogTaskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal -Description "Aembi Play — reabre o player se o navegador cair." | Out-Null

    Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$($script:WatchdogTaskName)' registrada (a cada $IntervalMinutes min)."
}

# ─────────────────────────────────────────────────────────────────────────
# Energia — uma tela de sinalização precisa ficar sempre acesa. Cada chamada
# é isolada em try/catch: numa Windows Home sem algumas políticas, ou numa
# VM sem monitor "de verdade", um comando pode falhar sem que isso deva
# interromper o resto do provisionamento.
# ─────────────────────────────────────────────────────────────────────────
function Set-KioskPowerConfiguration {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$StateDir)

    if (-not $PSCmdlet.ShouldProcess("Configurações de energia", "Desligar suspensão/hibernação/proteção de tela")) {
        return
    }

    $commands = @(
        @("/change", "monitor-timeout-ac", "0")
        @("/change", "standby-timeout-ac", "0")
        @("/change", "hibernate-timeout-ac", "0")
        @("/hibernate", "off")
    )

    foreach ($cmdArgs in $commands) {
        try {
            & powercfg.exe @cmdArgs | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "powercfg $($cmdArgs -join ' ') retornou código $LASTEXITCODE"
            }
        }
        catch {
            Write-ProvisionLog -StateDir $StateDir -Level WARN -Message "Falha ao aplicar 'powercfg $($cmdArgs -join " ")': $($_.Exception.Message)"
        }
    }

    try {
        Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0" -ErrorAction Stop
    }
    catch {
        Write-ProvisionLog -StateDir $StateDir -Level WARN -Message "Falha ao desativar a proteção de tela: $($_.Exception.Message)"
    }

    Write-ProvisionLog -StateDir $StateDir -Message "Configurações de energia aplicadas (sem suspensão/hibernação/proteção de tela)."
}

# ─────────────────────────────────────────────────────────────────────────
# Auto-logon — só configurado se o técnico passar -AutoLogonUser. Guarda
# como texto puro na Winlogon é a única forma nativa do Windows de fazer
# isto sem infra adicional (Sysinternals Autologon, domínio etc.); por isso
# só faz sentido para um usuário local dedicado e sem privilégios, num
# dispositivo fisicamente controlado só para exibir o player — documentado
# no README.
# ─────────────────────────────────────────────────────────────────────────
function Enable-KioskAutoLogon {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][securestring]$Password,
        [Parameter(Mandatory = $true)][string]$StateDir
    )

    if (-not $PSCmdlet.ShouldProcess($Username, "Configurar auto-logon")) {
        return
    }

    # PtrToStringBSTR (não PtrToStringAuto) porque o ponteiro veio de
    # SecureStringToBSTR — BSTR tem formato próprio (prefixo de tamanho +
    # UTF-16), e "Auto" assume a codificação "nativa" da plataforma, que no
    # Linux/.NET Core não é essa, truncando a senha na primeira diferença.
    # ZeroFreeBSTR limpa a memória não gerenciada assim que possível, para a
    # senha em texto puro não ficar por aí mais tempo que o necessário.
    $bstrPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try {
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrPointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrPointer)
    }

    $winlogonPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    Set-ItemProperty -Path $winlogonPath -Name "AutoAdminLogon" -Value "1"
    Set-ItemProperty -Path $winlogonPath -Name "DefaultUserName" -Value $Username
    Set-ItemProperty -Path $winlogonPath -Name "DefaultDomainName" -Value $env:COMPUTERNAME
    Set-ItemProperty -Path $winlogonPath -Name "DefaultPassword" -Value $plainPassword

    Write-ProvisionLog -StateDir $StateDir -Message "Auto-logon configurado para '$Username'."
}

function Disable-KioskAutoLogon {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$StateDir)

    if (-not $PSCmdlet.ShouldProcess("Auto-logon", "Remover")) {
        return
    }

    $winlogonPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    foreach ($name in @("AutoAdminLogon", "DefaultUserName", "DefaultDomainName", "DefaultPassword")) {
        Remove-ItemProperty -Path $winlogonPath -Name $name -ErrorAction SilentlyContinue
    }

    Write-ProvisionLog -StateDir $StateDir -Message "Auto-logon removido."
}

# ─────────────────────────────────────────────────────────────────────────
# Estado — o que o watchdog precisa saber para relançar o navegador, e o
# que -Uninstall precisa saber para limpar direito (ex.: se foi este script
# que configurou o auto-logon, pra não mexer numa configuração que já
# existia por fora dele).
# ─────────────────────────────────────────────────────────────────────────
function Save-KioskState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][hashtable]$State,
        [Parameter(Mandatory = $true)][string]$StateDir
    )

    if (-not (Test-Path -LiteralPath $StateDir)) {
        New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
    }
    $State | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $StateDir $script:StateFileName) -Encoding UTF8
}

function Get-KioskState {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$StateDir)

    $path = Join-Path $StateDir $script:StateFileName
    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }
    return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
}

# ─────────────────────────────────────────────────────────────────────────
# Fluxo principal — provisionar.
# ─────────────────────────────────────────────────────────────────────────
function Invoke-Provisioning {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$PlayerUrl,
        [string]$Browser = "Edge",
        [int]$WatchdogIntervalMinutes = 2,
        [string]$AutoLogonUser,
        [securestring]$AutoLogonPassword,
        [switch]$SkipPowerSettings,
        [Parameter(Mandatory = $true)][string]$StateDir,
        [Parameter(Mandatory = $true)][string]$WatchdogScriptPath
    )

    if (-not (Test-IsAdministrator)) {
        throw "Rode este script como Administrador (clique com o botão direito no " +
        "PowerShell → 'Executar como administrador')."
    }

    Write-ProvisionLog -StateDir $StateDir -Message "Iniciando provisionamento — PlayerUrl=$PlayerUrl Browser=$Browser"

    $browserPath = Resolve-BrowserExecutable -Browser $Browser
    if (-not $browserPath -and $Browser -eq "Chrome") {
        Install-ChromeViaWinget -StateDir $StateDir
        $browserPath = Resolve-BrowserExecutable -Browser $Browser
    }
    if (-not $browserPath) {
        throw "Não encontrei o $Browser instalado nesta máquina. " +
        $(if ($Browser -eq "Edge") { "Isso é inesperado — o Edge vem com o Windows 10/11; verifique a instalação." } else { "" })
    }
    Write-ProvisionLog -StateDir $StateDir -Message "Navegador: $browserPath"

    $userDataDir = Join-Path $StateDir $script:KioskProfileDirName
    $kioskArgs = New-KioskArgumentList -PlayerUrl $PlayerUrl -UserDataDir $userDataDir -Browser $Browser

    Install-KioskTask -BrowserPath $browserPath -Arguments $kioskArgs -LogonUser $AutoLogonUser -StateDir $StateDir
    Install-WatchdogTask -WatchdogScriptPath $WatchdogScriptPath -StateDir $StateDir -IntervalMinutes $WatchdogIntervalMinutes

    if (-not $SkipPowerSettings) {
        Set-KioskPowerConfiguration -StateDir $StateDir
    }
    else {
        Write-ProvisionLog -StateDir $StateDir -Message "-SkipPowerSettings: configurações de energia não alteradas."
    }

    $autoLogonConfigured = $false
    if ($AutoLogonUser) {
        if (-not $AutoLogonPassword) {
            $AutoLogonPassword = Read-Host -Prompt "Senha de auto-logon para '$AutoLogonUser'" -AsSecureString
        }
        Enable-KioskAutoLogon -Username $AutoLogonUser -Password $AutoLogonPassword -StateDir $StateDir
        $autoLogonConfigured = $true
    }

    Save-KioskState -StateDir $StateDir -State @{
        playerUrl           = $PlayerUrl
        browser              = $Browser
        browserPath          = $browserPath
        userDataDir          = $userDataDir
        kioskArguments       = $kioskArgs
        autoLogonUser        = $AutoLogonUser
        autoLogonConfigured  = $autoLogonConfigured
        provisionedAtUtc     = (Get-Date).ToUniversalTime().ToString("o")
        lastLaunchAtUtc      = $null
    }

    Write-ProvisionLog -StateDir $StateDir -Message "Provisionamento concluído. Reinicie a máquina (ou faça logon) para o kiosk iniciar."
}

# ─────────────────────────────────────────────────────────────────────────
# Fluxo principal — desinstalar.
# ─────────────────────────────────────────────────────────────────────────
function Invoke-Uninstall {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$StateDir)

    if (-not (Test-IsAdministrator)) {
        throw "Rode este script como Administrador para desinstalar."
    }

    Write-ProvisionLog -StateDir $StateDir -Message "Iniciando desinstalação do provisionamento do player."

    foreach ($taskName in @($script:KioskTaskName, $script:WatchdogTaskName)) {
        $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existing) {
            if ($PSCmdlet.ShouldProcess($taskName, "Remover tarefa agendada")) {
                Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
                Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$taskName' removida."
            }
        }
        else {
            Write-ProvisionLog -StateDir $StateDir -Message "Tarefa '$taskName' não existia — nada a remover."
        }
    }

    $state = Get-KioskState -StateDir $StateDir
    if ($state -and $state.autoLogonConfigured) {
        Disable-KioskAutoLogon -StateDir $StateDir
    }

    Write-ProvisionLog -StateDir $StateDir -Message ("Configurações de energia NÃO foram revertidas automaticamente " +
        "(não há como saber com segurança o valor anterior) — ajuste manualmente em " +
        "Configurações > Energia, se necessário.") -Level WARN

    Write-ProvisionLog -StateDir $StateDir -Message "Desinstalação concluída."
}

# ─────────────────────────────────────────────────────────────────────────
# Ponto de entrada — só roda quando o arquivo é executado diretamente, não
# quando é "dot-sourced" (é assim que os testes Pester carregam as funções
# acima sem disparar o provisionamento de verdade).
# ─────────────────────────────────────────────────────────────────────────
if ($MyInvocation.InvocationName -ne ".") {
    $watchdogScriptPath = Join-Path $PSScriptRoot "Watchdog-Player.ps1"

    if ($Uninstall.IsPresent) {
        Invoke-Uninstall -StateDir $StateDir
    }
    else {
        Invoke-Provisioning -PlayerUrl $PlayerUrl -Browser $Browser -WatchdogIntervalMinutes $WatchdogIntervalMinutes `
            -AutoLogonUser $AutoLogonUser -AutoLogonPassword $AutoLogonPassword -SkipPowerSettings:$SkipPowerSettings `
            -StateDir $StateDir -WatchdogScriptPath $watchdogScriptPath
    }
}
