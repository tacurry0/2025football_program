$lines = Get-Content script.js -Encoding UTF8
$lines[12] = "      alert('公式サイトのデータが読み込めませんでした。');"
$lines[13] = "      console.error('Failed to load club sites', e);"
Set-Content script.js -Value $lines -Encoding UTF8
