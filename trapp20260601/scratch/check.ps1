$lines = Get-Content script.js -Encoding UTF8
for ($i = 0; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    $dq = ([regex]::Matches($l, '"')).Count
    $sq = ([regex]::Matches($l, "'")).Count
    if (($dq % 2 -ne 0) -and ($l -notmatch "//")) {
        Write-Host "Odd DQ at line $($i+1): $l"
    }
    if (($sq % 2 -ne 0) -and ($l -notmatch "//")) {
        Write-Host "Odd SQ at line $($i+1): $l"
    }
}
