#Requires -Modules Pester
# As senhas de teste abaixo são strings fixas só para exercitar a
# conversão SecureString -> texto puro em Enable-KioskAutoLogon — não são
# segredos reais, então ConvertTo-SecureString -AsPlainText é o padrão
# aceito aqui (PSScriptAnalyzer normalmente proíbe isso em código de
# produção, com razão).
[Diagnostics.CodeAnalysis.SuppressMessageAttribute("PSAvoidUsingConvertToSecureStringWithPlainText", "")]
param()

# Testa Provision-Player.ps1 "dot-sourced" (nunca executado como script) —
# ver o guard `if ($MyInvocation.InvocationName -ne ".")` no final do
# arquivo sob teste. Cmdlets exclusivos do Windows (ScheduledTasks, CIM,
# powercfg.exe) que não existem neste runspace são substituídos por stubs em
# TestHelpers.ps1 ANTES do dot-source, só para existirem e o Pester
# conseguir interceptá-los com Mock — o comportamento de verdade continua
# vindo inteiramente do Mock de cada teste.

BeforeAll {
    . (Join-Path -Path $PSScriptRoot -ChildPath "TestHelpers.ps1")
    . (Join-Path -Path $PSScriptRoot -ChildPath ".." -AdditionalChildPath "Provision-Player.ps1") -Uninstall
}

Describe "New-KioskArgumentList" {
    It "inclui a URL do player entre aspas em --kiosk" {
        $result = New-KioskArgumentList -PlayerUrl "https://play.aembi.com" -UserDataDir "C:\state\kiosk-profile" -Browser Edge
        $result | Should -Contain "--kiosk"
        $result | Should -Contain '"https://play.aembi.com"'
    }

    It "usa um perfil PERSISTENTE (--user-data-dir) e nunca --incognito, para não perder o cache offline do player" {
        $result = New-KioskArgumentList -PlayerUrl "https://play.aembi.com" -UserDataDir "C:\state\kiosk-profile" -Browser Edge
        $result | Should -Contain '--user-data-dir="C:\state\kiosk-profile"'
        $result | Should -Not -Contain "--incognito"
        $result | Should -Not -Contain "--guest"
    }

    It "libera autoplay sem gesto do usuário (senão o vídeo não toca sozinho)" {
        $result = New-KioskArgumentList -PlayerUrl "https://play.aembi.com" -UserDataDir "C:\state\kiosk-profile" -Browser Edge
        $result | Should -Contain "--autoplay-policy=no-user-gesture-required"
    }

    It "adiciona --edge-kiosk-type=fullscreen só para o Edge" {
        $edgeResult = New-KioskArgumentList -PlayerUrl "https://x" -UserDataDir "C:\d" -Browser Edge
        $chromeResult = New-KioskArgumentList -PlayerUrl "https://x" -UserDataDir "C:\d" -Browser Chrome

        $edgeResult | Should -Contain "--edge-kiosk-type=fullscreen"
        $chromeResult | Should -Not -Contain "--edge-kiosk-type=fullscreen"
    }
}

Describe "Resolve-BrowserExecutable" {
    It "retorna o caminho quando um dos candidatos existe" {
        Mock Test-Path { $true }
        $result = Resolve-BrowserExecutable -Browser Edge
        $result | Should -Not -BeNullOrEmpty
    }

    It "cai para Get-Command quando nenhum candidato existe" {
        Mock Test-Path { $false }
        Mock Get-Command { [pscustomobject]@{ Source = "/caminho/via/PATH/msedge.exe" } }
        $result = Resolve-BrowserExecutable -Browser Edge
        $result | Should -Be "/caminho/via/PATH/msedge.exe"
    }

    It "retorna `$null quando o navegador não é encontrado de jeito nenhum" {
        Mock Test-Path { $false }
        Mock Get-Command { $null }
        $result = Resolve-BrowserExecutable -Browser Chrome
        $result | Should -BeNullOrEmpty
    }
}

Describe "Install-KioskTask" {
    BeforeEach {
        Mock Get-ScheduledTask { $null }
        Mock Unregister-ScheduledTask { }
        Mock Register-ScheduledTask { }
        Mock New-ScheduledTaskAction { "action" }
        Mock New-ScheduledTaskTrigger { "trigger" }
        Mock New-ScheduledTaskSettingsSet { "settings" }
        Mock New-ScheduledTaskPrincipal { "principal" }
        Mock Write-ProvisionLog { }
    }

    It "registra a tarefa quando nenhuma existia ainda" {
        Install-KioskTask -BrowserPath "C:\edge.exe" -Arguments @("--kiosk") -StateDir "C:\state"
        Should -Invoke Register-ScheduledTask -Times 1
        Should -Invoke Unregister-ScheduledTask -Times 0
    }

    It "remove a tarefa existente antes de recriar (idempotente)" {
        Mock Get-ScheduledTask { [pscustomobject]@{ TaskName = "AembiPlayerKiosk" } }
        Install-KioskTask -BrowserPath "C:\edge.exe" -Arguments @("--kiosk") -StateDir "C:\state"
        Should -Invoke Unregister-ScheduledTask -Times 1
        Should -Invoke Register-ScheduledTask -Times 1
    }

    It "usa -AtLogOn -User quando um usuário de auto-logon é informado" {
        Install-KioskTask -BrowserPath "C:\edge.exe" -Arguments @("--kiosk") -LogonUser "aembi-player" -StateDir "C:\state"
        Should -Invoke New-ScheduledTaskTrigger -ParameterFilter { $User -eq "aembi-player" }
    }

    It "não chama nenhum cmdlet quando -WhatIf é passado" {
        Install-KioskTask -BrowserPath "C:\edge.exe" -Arguments @("--kiosk") -StateDir "C:\state" -WhatIf
        Should -Invoke Register-ScheduledTask -Times 0
        Should -Invoke Get-ScheduledTask -Times 0
    }
}

Describe "Install-WatchdogTask" {
    BeforeEach {
        Mock Get-ScheduledTask { $null }
        Mock Unregister-ScheduledTask { }
        Mock Register-ScheduledTask { }
        Mock New-ScheduledTaskAction { "action" }
        Mock New-ScheduledTaskTrigger { "trigger" }
        Mock New-ScheduledTaskSettingsSet { "settings" }
        Mock New-ScheduledTaskPrincipal { "principal" }
        Mock Get-Process { [pscustomobject]@{ Path = "/usr/local/bin/pwsh" } }
        Mock Write-ProvisionLog { }
    }

    It "registra a tarefa do watchdog com o intervalo informado" {
        Install-WatchdogTask -WatchdogScriptPath "C:\scripts\Watchdog-Player.ps1" -StateDir "C:\state" -IntervalMinutes 5
        Should -Invoke New-ScheduledTaskTrigger -ParameterFilter { $RepetitionInterval -eq (New-TimeSpan -Minutes 5) }
        Should -Invoke Register-ScheduledTask -Times 1
    }

    It "roda como SYSTEM (não depende de nenhum usuário estar logado)" {
        Install-WatchdogTask -WatchdogScriptPath "C:\scripts\Watchdog-Player.ps1" -StateDir "C:\state"
        Should -Invoke New-ScheduledTaskPrincipal -ParameterFilter { $UserId -eq "SYSTEM" }
    }

    It "substitui a tarefa existente em vez de duplicar" {
        Mock Get-ScheduledTask { [pscustomobject]@{ TaskName = "AembiPlayerWatchdog" } }
        Install-WatchdogTask -WatchdogScriptPath "C:\scripts\Watchdog-Player.ps1" -StateDir "C:\state"
        Should -Invoke Unregister-ScheduledTask -Times 1
        Should -Invoke Register-ScheduledTask -Times 1
    }
}

Describe "Set-KioskPowerConfiguration" {
    It "não derruba o provisionamento se um powercfg falhar" {
        Mock powercfg.exe { $global:LASTEXITCODE = 1 }
        Mock Set-ItemProperty { }
        Mock Write-ProvisionLog { }
        { Set-KioskPowerConfiguration -StateDir "C:\state" } | Should -Not -Throw
    }

    It "desativa a proteção de tela via registro" {
        Mock powercfg.exe { $global:LASTEXITCODE = 0 }
        Mock Set-ItemProperty { }
        Mock Write-ProvisionLog { }
        Set-KioskPowerConfiguration -StateDir "C:\state"
        Should -Invoke Set-ItemProperty -ParameterFilter { $Name -eq "ScreenSaveActive" -and $Value -eq "0" }
    }
}

Describe "Enable-KioskAutoLogon / Disable-KioskAutoLogon" {
    It "grava AutoAdminLogon=1 e a senha em texto puro extraída do SecureString" {
        Mock Set-ItemProperty { }
        Mock Write-ProvisionLog { }
        $securePassword = ConvertTo-SecureString "senha-super-secreta" -AsPlainText -Force

        Enable-KioskAutoLogon -Username "aembi-player" -Password $securePassword -StateDir "C:\state"

        Should -Invoke Set-ItemProperty -ParameterFilter { $Name -eq "AutoAdminLogon" -and $Value -eq "1" }
        Should -Invoke Set-ItemProperty -ParameterFilter { $Name -eq "DefaultUserName" -and $Value -eq "aembi-player" }
        Should -Invoke Set-ItemProperty -ParameterFilter { $Name -eq "DefaultPassword" -and $Value -eq "senha-super-secreta" }
    }

    It "remove as quatro chaves de auto-logon ao desinstalar" {
        Mock Remove-ItemProperty { }
        Mock Write-ProvisionLog { }
        Disable-KioskAutoLogon -StateDir "C:\state"
        Should -Invoke Remove-ItemProperty -Times 4
    }
}

Describe "Save-KioskState / Get-KioskState" {
    It "grava e relê o estado (sem mocks — I/O real contra uma pasta temporária)" {
        $dir = Join-Path $TestDrive "state"
        Save-KioskState -StateDir $dir -State @{ playerUrl = "https://play.aembi.com"; browser = "Edge" }

        $state = Get-KioskState -StateDir $dir
        $state.playerUrl | Should -Be "https://play.aembi.com"
        $state.browser | Should -Be "Edge"
    }

    It "retorna `$null quando não há estado salvo ainda" {
        $dir = Join-Path $TestDrive "vazio"
        Get-KioskState -StateDir $dir | Should -BeNullOrEmpty
    }
}

Describe "Invoke-Provisioning" {
    BeforeEach {
        Mock Test-IsAdministrator { $true }
        Mock Resolve-BrowserExecutable { "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
        Mock Install-KioskTask { }
        Mock Install-WatchdogTask { }
        Mock Set-KioskPowerConfiguration { }
        Mock Write-ProvisionLog { }
    }

    It "recusa rodar sem privilégio de administrador" {
        Mock Test-IsAdministrator { $false }
        { Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -StateDir (Join-Path $TestDrive "s1") -WatchdogScriptPath "C:\w.ps1" } |
            Should -Throw "*Administrador*"
    }

    It "salva o estado com a URL, navegador e argumentos do kiosk corretos" {
        $dir = Join-Path $TestDrive "s2"
        Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -Browser Edge -StateDir $dir -WatchdogScriptPath "C:\w.ps1"

        $state = Get-KioskState -StateDir $dir
        $state.playerUrl | Should -Be "https://play.aembi.com"
        $state.browser | Should -Be "Edge"
        $state.autoLogonConfigured | Should -Be $false
    }

    It "pula Set-KioskPowerConfiguration quando -SkipPowerSettings é passado" {
        Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -SkipPowerSettings `
            -StateDir (Join-Path $TestDrive "s3") -WatchdogScriptPath "C:\w.ps1"
        Should -Invoke Set-KioskPowerConfiguration -Times 0
    }

    It "propaga o erro quando o Chrome não é encontrado e o winget também não está disponível" {
        Mock Resolve-BrowserExecutable { $null }
        Mock Get-Command { $null } -ParameterFilter { $Name -eq "winget.exe" }

        { Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -Browser Chrome `
                -StateDir (Join-Path $TestDrive "s4") -WatchdogScriptPath "C:\w.ps1" } |
            Should -Throw "*winget*"
    }

    It "pergunta a senha de auto-logon quando -AutoLogonUser é dado sem -AutoLogonPassword" {
        Mock Read-Host { ConvertTo-SecureString "perguntada-com-seguranca" -AsPlainText -Force }
        Mock Enable-KioskAutoLogon { }

        Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -AutoLogonUser "aembi-player" `
            -StateDir (Join-Path $TestDrive "s5") -WatchdogScriptPath "C:\w.ps1"

        Should -Invoke Read-Host -Times 1
        Should -Invoke Enable-KioskAutoLogon -ParameterFilter { $Username -eq "aembi-player" }
    }

    It "marca autoLogonConfigured=true no estado quando o auto-logon foi configurado" {
        Mock Enable-KioskAutoLogon { }
        $securePassword = ConvertTo-SecureString "x" -AsPlainText -Force
        $dir = Join-Path $TestDrive "s6"

        Invoke-Provisioning -PlayerUrl "https://play.aembi.com" -AutoLogonUser "aembi-player" `
            -AutoLogonPassword $securePassword -StateDir $dir -WatchdogScriptPath "C:\w.ps1"

        (Get-KioskState -StateDir $dir).autoLogonConfigured | Should -Be $true
    }
}

Describe "Invoke-Uninstall" {
    BeforeEach {
        Mock Test-IsAdministrator { $true }
        Mock Get-ScheduledTask { $null }
        Mock Unregister-ScheduledTask { }
        Mock Disable-KioskAutoLogon { }
        Mock Write-ProvisionLog { }
    }

    It "recusa rodar sem privilégio de administrador" {
        Mock Test-IsAdministrator { $false }
        { Invoke-Uninstall -StateDir (Join-Path $TestDrive "u1") } | Should -Throw "*Administrador*"
    }

    It "remove as duas tarefas quando ambas existem" {
        Mock Get-ScheduledTask { [pscustomobject]@{ TaskName = "qualquer" } }
        Invoke-Uninstall -StateDir (Join-Path $TestDrive "u2")
        Should -Invoke Unregister-ScheduledTask -Times 2
    }

    It "não tenta remover tarefas que não existem" {
        Invoke-Uninstall -StateDir (Join-Path $TestDrive "u3")
        Should -Invoke Unregister-ScheduledTask -Times 0
    }

    It "desfaz o auto-logon só quando foi este script que o configurou" {
        $dir = Join-Path $TestDrive "u4"
        Save-KioskState -StateDir $dir -State @{ autoLogonConfigured = $true }
        Invoke-Uninstall -StateDir $dir
        Should -Invoke Disable-KioskAutoLogon -Times 1
    }

    It "não mexe no auto-logon quando ele nunca foi configurado por este script" {
        $dir = Join-Path $TestDrive "u5"
        Save-KioskState -StateDir $dir -State @{ autoLogonConfigured = $false }
        Invoke-Uninstall -StateDir $dir
        Should -Invoke Disable-KioskAutoLogon -Times 0
    }
}
