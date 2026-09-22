#Requires -Modules Pester

BeforeAll {
    . (Join-Path -Path $PSScriptRoot -ChildPath "TestHelpers.ps1")
    . (Join-Path -Path $PSScriptRoot -ChildPath ".." -AdditionalChildPath "Watchdog-Player.ps1")
}

Describe "Test-KioskProcessRunning" {
    It "retorna `$true quando há um processo cuja linha de comando contém o perfil do kiosk" {
        Mock Get-CimInstance {
            @(
                [pscustomobject]@{ CommandLine = 'msedge.exe --kiosk --user-data-dir="C:\state\kiosk-profile"' }
                [pscustomobject]@{ CommandLine = 'msedge.exe --type=gpu-process' }
            )
        }
        Test-KioskProcessRunning -UserDataDir "C:\state\kiosk-profile" | Should -Be $true
    }

    It "retorna `$false quando nenhum processo bate com o perfil do kiosk (mesmo com outros msedge.exe abertos)" {
        Mock Get-CimInstance {
            @([pscustomobject]@{ CommandLine = "msedge.exe --profile-directory=Default" })
        }
        Test-KioskProcessRunning -UserDataDir "C:\state\kiosk-profile" | Should -Be $false
    }

    It "retorna `$false quando Get-CimInstance não encontra nada" {
        Mock Get-CimInstance { $null }
        Test-KioskProcessRunning -UserDataDir "C:\state\kiosk-profile" | Should -Be $false
    }

    It "procura por chrome.exe quando o perfil indica Chrome" {
        Mock Get-CimInstance { @() }
        Test-KioskProcessRunning -UserDataDir "C:\state\chrome-profile" | Out-Null
        Should -Invoke Get-CimInstance -ParameterFilter { $Filter -eq "Name = 'chrome.exe'" }
    }
}

Describe "Invoke-Watchdog" {
    It "não faz nada (e avisa) quando ainda não há estado salvo" {
        Mock Test-KioskProcessRunning { $true }
        Mock Start-Process { }
        Mock Write-WatchdogLog { }

        Invoke-Watchdog -StateDir (Join-Path $TestDrive "vazio")

        Should -Invoke Start-Process -Times 0
    }

    It "não relança quando o player já está rodando" {
        $dir = Join-Path $TestDrive "rodando"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        @{ browserPath = "C:\edge.exe"; userDataDir = "C:\state\kiosk-profile"; kioskArguments = @("--kiosk") } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir "kiosk-state.json")

        Mock Test-KioskProcessRunning { $true }
        Mock Start-Process { }

        Invoke-Watchdog -StateDir $dir

        Should -Invoke Start-Process -Times 0
    }

    It "relança o navegador quando o player não está rodando e não houve lançamento recente" {
        $dir = Join-Path $TestDrive "caiu"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        @{ browserPath = "C:\edge.exe"; userDataDir = "C:\state\kiosk-profile"; kioskArguments = @("--kiosk"); lastLaunchAtUtc = $null } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir "kiosk-state.json")

        Mock Test-KioskProcessRunning { $false }
        Mock Start-Process { }

        Invoke-Watchdog -StateDir $dir

        Should -Invoke Start-Process -Times 1 -ParameterFilter { $FilePath -eq "C:\edge.exe" }
        (Get-KioskState -StateDir $dir).lastLaunchAtUtc | Should -Not -BeNullOrEmpty
    }

    It "não relança de novo (debounce) se o último lançamento foi há poucos segundos" {
        $dir = Join-Path $TestDrive "debounce"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $recentLaunch = (Get-Date).ToUniversalTime().AddSeconds(-5).ToString("o")
        @{ browserPath = "C:\edge.exe"; userDataDir = "C:\state\kiosk-profile"; kioskArguments = @("--kiosk"); lastLaunchAtUtc = $recentLaunch } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir "kiosk-state.json")

        Mock Test-KioskProcessRunning { $false }
        Mock Start-Process { }

        Invoke-Watchdog -StateDir $dir -MinSecondsSinceLastLaunch 30

        Should -Invoke Start-Process -Times 0
    }

    It "relança de novo se o último lançamento foi há mais tempo que o debounce" {
        $dir = Join-Path $TestDrive "debounce-expirado"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $oldLaunch = (Get-Date).ToUniversalTime().AddMinutes(-10).ToString("o")
        @{ browserPath = "C:\edge.exe"; userDataDir = "C:\state\kiosk-profile"; kioskArguments = @("--kiosk"); lastLaunchAtUtc = $oldLaunch } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir "kiosk-state.json")

        Mock Test-KioskProcessRunning { $false }
        Mock Start-Process { }

        Invoke-Watchdog -StateDir $dir -MinSecondsSinceLastLaunch 30

        Should -Invoke Start-Process -Times 1
    }
}
