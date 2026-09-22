<#
.SYNOPSIS
    Confere se o player (navegador em modo kiosk) ainda está de pé e o
    reabre se não estiver — chamado periodicamente pela tarefa agendada
    "AembiPlayerWatchdog" registrada por Provision-Player.ps1.

.DESCRIPTION
    Não recebe a URL/navegador como parâmetro: lê tudo do estado salvo em
    <StateDir>\kiosk-state.json na última vez que Provision-Player.ps1 rodou.
    Isso significa que trocar a URL do player é só rodar Provision-Player.ps1
    de novo — o watchdog já existente passa a usar o novo estado na próxima
    checagem, sem precisar recriar a tarefa agendada dele.

    Debounce: não relança se o último lançamento foi há menos de
    $MinSecondsSinceLastLaunch segundos — evita abrir um segundo processo
    enquanto o navegador ainda está no meio da própria inicialização (que o
    Get-CimInstance abaixo ainda não vê de pé).

.PARAMETER StateDir
    Mesma pasta de estado usada por Provision-Player.ps1. Passado pela
    tarefa agendada como argumento (ver Install-WatchdogTask); existe como
    parâmetro aqui também para os testes apontarem para uma pasta temporária.
#>
[CmdletBinding()]
param(
    [string]$StateDir = "C:\ProgramData\AembiPlay",
    [int]$MinSecondsSinceLastLaunch = 30
)

$script:StateFileName = "kiosk-state.json"
$script:LogFileName = "provision.log"

function Write-WatchdogLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO",
        [Parameter(Mandatory = $true)][string]$StateDir
    )

    $line = "[{0}] [{1}] [watchdog] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    try {
        if (-not (Test-Path -LiteralPath $StateDir)) {
            New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
        }
        Add-Content -LiteralPath (Join-Path $StateDir $script:LogFileName) -Value $line -ErrorAction Stop
    }
    catch {
        Write-Warning "Não consegui gravar o log em disco: $($_.Exception.Message)"
    }
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

function Set-KioskStateLastLaunch {
    # Só atualiza um timestamp no estado interno do watchdog — não é uma
    # mudança de sistema que justifique prompt de confirmação; suprime
    # PSUseShouldProcessForStateChangingFunctions (dispara só pelo verbo).
    [Diagnostics.CodeAnalysis.SuppressMessage("PSUseShouldProcessForStateChangingFunctions", "")]
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$State,
        [Parameter(Mandatory = $true)][string]$StateDir
    )
    $State.lastLaunchAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    $State | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $StateDir $script:StateFileName) -Encoding UTF8
}

# ─────────────────────────────────────────────────────────────────────────
# Confere se existe um processo do navegador com a linha de comando do
# nosso perfil kiosk (não basta "algum msedge.exe estar rodando" — pode ser
# um processo auxiliar/GPU do próprio Chromium, ou um navegador aberto por
# outro motivo).
# ─────────────────────────────────────────────────────────────────────────
function Test-KioskProcessRunning {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$UserDataDir)

    $processName = if ($UserDataDir -match "chrome") { "chrome.exe" } else { "msedge.exe" }
    # Nome evita `$matches` — variável automática do operador -match, que
    # reatribuí-la pisaria no seu uso interno pelo PowerShell.
    $matchingProcesses = Get-CimInstance Win32_Process -Filter "Name = '$processName'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($UserDataDir) }

    return ($null -ne $matchingProcesses -and @($matchingProcesses).Count -gt 0)
}

function Invoke-Watchdog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$StateDir,
        [int]$MinSecondsSinceLastLaunch = 30
    )

    $state = Get-KioskState -StateDir $StateDir
    if (-not $state) {
        Write-WatchdogLog -StateDir $StateDir -Level WARN -Message "Nenhum estado encontrado — rode Provision-Player.ps1 primeiro."
        return
    }

    if (Test-KioskProcessRunning -UserDataDir $state.userDataDir) {
        Write-WatchdogLog -StateDir $StateDir -Message "Player em execução — nada a fazer."
        return
    }

    if ($state.lastLaunchAtUtc) {
        $secondsSinceLastLaunch = ((Get-Date).ToUniversalTime() - [datetime]$state.lastLaunchAtUtc).TotalSeconds
        if ($secondsSinceLastLaunch -lt $MinSecondsSinceLastLaunch) {
            Write-WatchdogLog -StateDir $StateDir -Message ("Player não detectado, mas o último lançamento foi há " +
                "$([math]::Round($secondsSinceLastLaunch))s (< ${MinSecondsSinceLastLaunch}s) — aguardando, " +
                "provavelmente ainda está abrindo.")
            return
        }
    }

    Write-WatchdogLog -StateDir $StateDir -Level WARN -Message "Player não está rodando — relançando: $($state.browserPath)"
    Start-Process -FilePath $state.browserPath -ArgumentList $state.kioskArguments
    Set-KioskStateLastLaunch -State $state -StateDir $StateDir
}

if ($MyInvocation.InvocationName -ne ".") {
    Invoke-Watchdog -StateDir $StateDir -MinSecondsSinceLastLaunch $MinSecondsSinceLastLaunch
}
