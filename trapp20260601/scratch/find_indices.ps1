$lines = Get-Content script.js -Encoding UTF8
for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'Uvance') {
        Write-Host "Uvance found at index $i"
    }
    if ($lines[$i] -match 'J_TEAM_KWS') {
        Write-Host "J_TEAM_KWS found at index $i"
    }
}
