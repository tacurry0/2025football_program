$log = [System.IO.File]::ReadAllText("C:\Users\takahashi\.gemini\antigravity\brain\416dd342-9092-4e5c-bf03-97b0be1b2358\.system_generated\logs\overview.txt", [System.Text.Encoding]::UTF8)
$idx = $log.IndexOf("openBulkPasteBtn")
if ($idx -ge 0) {
    $len = [Math]::Min(1500, $log.Length - $idx)
    Write-Host $log.Substring($idx, $len)
} else {
    Write-Host "Not found"
}
