# Stubs para cmdlets que só existem no Windows PowerShell/Windows de verdade
# (ScheduledTasks, CIM, o executável powercfg.exe) — sem eles, o Pester nem
# consegue interceptar a chamada com Mock (ele só "veste" um comando que já
# existe), e sem um bloco `param()` que espelhe os parâmetros de verdade,
# `-ParameterFilter` não teria a quem se referir (o proxy que o Pester gera
# para o Mock copia a assinatura do comando original). Dot-sourced no início
# de cada arquivo de teste, antes de dot-sourcing o script sob teste, para
# que os testes rodem tanto num Windows de verdade (onde estes cmdlets já
# existem e isto não faz nada) quanto no CI/dev em Linux/macOS (onde eles
# não existem e isto os cria como no-ops mockáveis).
#
# Só declara os parâmetros que Provision-Player.ps1/Watchdog-Player.ps1
# realmente usam — não é (nem precisa ser) um recriação completa do módulo
# ScheduledTasks real.
#
# Os scripts sob teste nunca precisam saber disto — eles só chamam os
# cmdlets normalmente.
#
# Os parâmetros abaixo existem só para dar forma à assinatura (ver acima) —
# os corpos das funções ficam vazios de propósito, então o PSScriptAnalyzer
# sempre os marcaria como "não usados"; suprimido deliberadamente.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute("PSReviewUnusedParameter", "")]
param()

function global:StubIfMissing {
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][scriptblock]$Definition)
    if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
        Set-Item -Path "function:global:$Name" -Value $Definition
    }
}

StubIfMissing -Name "Get-CimInstance" -Definition {
    [CmdletBinding()]
    param(
        [Parameter(Position = 0)][string]$ClassName,
        [string]$Filter
    )
}

StubIfMissing -Name "Get-ScheduledTask" -Definition {
    [CmdletBinding()]
    param([string]$TaskName)
}

StubIfMissing -Name "Register-ScheduledTask" -Definition {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [string]$TaskName,
        $Action,
        $Trigger,
        $Settings,
        $Principal,
        [string]$Description
    )
}

StubIfMissing -Name "Unregister-ScheduledTask" -Definition {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([string]$TaskName)
}

StubIfMissing -Name "New-ScheduledTaskAction" -Definition {
    [CmdletBinding()]
    param([string]$Execute, [string]$Argument)
}

StubIfMissing -Name "New-ScheduledTaskTrigger" -Definition {
    # Um único stub cobre as duas formas usadas no script real: o gatilho de
    # logon do kiosk (-AtLogOn -User) e o gatilho recorrente do watchdog
    # (-Once -At -RepetitionInterval -RepetitionDuration) — o cmdlet real
    # tem parameter sets distintos para cada forma; aqui basta um único
    # bloco com a união dos parâmetros.
    [CmdletBinding()]
    param(
        [switch]$AtLogOn,
        [string]$User,
        [switch]$Once,
        [datetime]$At,
        [timespan]$RepetitionInterval,
        [timespan]$RepetitionDuration
    )
}

StubIfMissing -Name "New-ScheduledTaskSettingsSet" -Definition {
    [CmdletBinding()]
    param(
        [switch]$AllowStartIfOnBatteries,
        [switch]$DontStopIfGoingOnBatteries,
        [switch]$StartWhenAvailable,
        [timespan]$ExecutionTimeLimit,
        [int]$RestartCount,
        [timespan]$RestartInterval,
        [string]$MultipleInstances
    )
}

StubIfMissing -Name "New-ScheduledTaskPrincipal" -Definition {
    [CmdletBinding()]
    param([string]$UserId, [string]$LogonType, [string]$RunLevel)
}

StubIfMissing -Name "powercfg.exe" -Definition {
    param([Parameter(ValueFromRemainingArguments = $true)]$RemainingArgs)
}
