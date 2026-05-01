$content = Get-Content script.js -Raw -Encoding UTF8
$content = $content -replace "const isNiigata = \(row\.team \|\| ''\)\.includes\('.*?\);", "const isNiigata = (row.team || '').includes('新潟');"
$content = $content -replace "const isKumamoto = \(row\.team \|\| ''\)\.includes\('.*?\);", "const isKumamoto = (row.team || '').includes('熊本');"
$content = $content -replace "\{ label: '.*?, key: 'rank', type: 'num' \},", "{ label: '順位', key: 'rank', type: 'num' },"
$content = $content -replace "\{ label: '.*?, key: 'played', type: 'num' \},", "{ label: '試合', key: 'played', type: 'num' },"
$content = $content -replace "\{ label: '.*?, key: 'won', type: 'num' \},", "{ label: '勝', key: 'won', type: 'num' },"
$content = $content -replace "\{ label: '.*?, key: 'pk_won', type: 'num' \},", "{ label: 'PK勝', key: 'pk_won', type: 'num' },"
$content = $content -replace "\{ label: '.*?, key: 'goals_for', type: 'num' \},", "{ label: '得点', key: 'goals_for', type: 'num' },"
$content = $content -replace "alert\('.*?データを取得して反映しました.*?\);", "alert('最新データを取得して反映しました。');"
$content = $content -replace "alert\('インポート.*?アプリを.*?\);", "alert('インポートが完了しました。アプリを再読み込みします。');"
$content = $content -replace "alert\('該当する試合データ.*?\);", "alert('該当する試合データが見つかりませんでした。入力形式を確認してください。');"
Set-Content script.js -Value $content -Encoding UTF8
