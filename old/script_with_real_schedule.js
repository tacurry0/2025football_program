let currentMonth = new Date().getMonth() + 1;
const months = Array.from(document.querySelectorAll('.month-section'));
const monthHeader = document.getElementById('month-header');
let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
if (currentIndex === -1) currentIndex = 0;
function showMonth(index) {
  months.forEach((m, i) => m.style.display = i === index ? 'block' : 'none');
  const monthName = mName(parseInt(months[index].dataset.month));
  monthHeader.textContent = monthName;
}
function mName(m) {
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return names[m - 1] || "Unknown";
}
showMonth(currentIndex);
window.addEventListener('touchstart', handleTouchStart, false);
window.addEventListener('touchend', handleTouchEnd, false);
let xDown = null;
function handleTouchStart(evt) {
  xDown = evt.touches[0].clientX;
}
function handleTouchEnd(evt) {
  if (!xDown) return;
  let xUp = evt.changedTouches[0].clientX;
  let xDiff = xDown - xUp;
  if (Math.abs(xDiff) > 50) {
    if (xDiff > 0 && currentIndex < months.length - 1) currentIndex++;
    else if (xDiff < 0 && currentIndex > 0) currentIndex--;
    showMonth(currentIndex);
  }
  xDown = null;
slider.innerHTML = `<div class="month-page">

</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 横浜F・マリノス</div>
        <div class="datetime">MW1 - 2/15 土 14:00</div>
        <div class="stadium">日産スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_横浜fyokohamafm.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 清水エスパルス</div>
        <div class="datetime">MW2 - 2/22 土 14:00</div>
        <div class="stadium">IAIスタジアム日本平</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_清水エスパルス.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 鹿島アントラーズ</div>
        <div class="datetime">MW3 - 2/26 水 19:00</div>
        <div class="stadium">県立カシマサッカースタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_鹿島kashima.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs セレッソ大阪</div>
        <div class="datetime">MW4 - 3/2 日 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_cosaka.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 東京ヴェルディ</div>
        <div class="datetime">MW5 - 3/8 土 14:05</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_東京ヴェルディ.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs FC町田ゼルビア</div>
        <div class="datetime">MW6 - 3/15 土 14:00</div>
        <div class="stadium">町田GIONスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_fc町田ゼルビア.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ガンバ大阪</div>
        <div class="datetime">MW7 - 3/29 土 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ガンバ大阪.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs アビスパ福岡</div>
        <div class="datetime">MW8 - 4/2 水 19:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_アビスパ福岡.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ヴィッセル神戸</div>
        <div class="datetime">MW9 - 4/6 日 14:00</div>
        <div class="stadium">国立競技場</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ヴィッセル神戸.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 横浜FC</div>
        <div class="datetime">MW10 - 4/13 日 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_横浜fc.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 京都サンガF.C.</div>
        <div class="datetime">MW11 - 4/19 土 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_京都サンガfc.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 柏レイソル</div>
        <div class="datetime">MW12 - 4/26 土 14:00</div>
        <div class="stadium">三協フロンティア柏スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_柏レイソル.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs サンフレッチェ広島</div>
        <div class="datetime">MW13 - 4/29 火・祝 14:00</div>
        <div class="stadium">エディオンピースウイング広島</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_サンフレッチェ広島.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs FC東京</div>
        <div class="datetime">MW14 - 5/3 土・祝 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_fc東京.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 川崎フロンターレ</div>
        <div class="datetime">MW15 - 5/6 火・休 15:00</div>
        <div class="stadium">Uvanceとどろきスタジアム by Fujitsu</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_kawasakif.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 浦和レッズ</div>
        <div class="datetime">MW16 - 5/11 日 14:05</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_浦和レッズ.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ファジアーノ岡山</div>
        <div class="datetime">MW17 - 5/18 日 15:00</div>
        <div class="stadium">JFE晴れの国スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ファジアーノ岡山.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 湘南ベルマーレ</div>
        <div class="datetime">MW18 - 5/25 日 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_湘南ベルマーレ.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 名古屋グランパス</div>
        <div class="datetime">MW19 - 5/31 土 14:00</div>
        <div class="stadium">豊田スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_名古屋グランパス.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 横浜F・マリノス</div>
        <div class="datetime">MW20 - 6/15 日 14:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_横浜fyokohamafm.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs アビスパ福岡</div>
        <div class="datetime">MW21 - 6/21 土 16:00</div>
        <div class="stadium">ベスト電器スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_アビスパ福岡.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 川崎フロンターレ</div>
        <div class="datetime">MW15※ - 6/25 水 19:00</div>
        <div class="stadium">Uvanceとどろきスタジアム by Fujitsu</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_kawasakif.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs FC町田ゼルビア</div>
        <div class="datetime">MW22 - 6/29 日 18:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_fc町田ゼルビア.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 京都サンガF.C.</div>
        <div class="datetime">MW23 - 7/5 土 19:00</div>
        <div class="stadium">サンガスタジアム by KYOCERA</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_京都サンガfc.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs サンフレッチェ広島</div>
        <div class="datetime">MW24 - 7/20 日 19:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_サンフレッチェ広島.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs セレッソ大阪</div>
        <div class="datetime">MW25 - 8/11 月・祝 19:00</div>
        <div class="stadium">ヨドコウ桜スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_cosaka.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 川崎フロンターレ</div>
        <div class="datetime">MW26 - 8/16 土 19:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_kawasakif.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 鹿島アントラーズ</div>
        <div class="datetime">MW27 - 8/23 土 19:00</div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_鹿島kashima.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 浦和レッズ</div>
        <div class="datetime">MW28 - 8/31 日 19:00</div>
        <div class="stadium">埼玉スタジアム２００２</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_浦和レッズ.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 清水エスパルス</div>
        <div class="datetime">MW29 - 9/13 土・日・月祝 </div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_清水エスパルス.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 横浜FC</div>
        <div class="datetime">MW30 - 9/20 土 </div>
        <div class="stadium">ニッパツ三ツ沢球技場</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_横浜fc.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 名古屋グランパス</div>
        <div class="datetime">MW31 - 9/23 火・祝 </div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_名古屋グランパス.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ガンバ大阪</div>
        <div class="datetime">MW32 - 9/27 土・日 </div>
        <div class="stadium">パナソニックスタジアム吹田</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ガンバ大阪.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ファジアーノ岡山</div>
        <div class="datetime">MW33 - 10/4 土・日 </div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ファジアーノ岡山.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 東京ヴェルディ</div>
        <div class="datetime">MW34 - 10/18 土・日 </div>
        <div class="stadium">味の素スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_東京ヴェルディ.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs ヴィッセル神戸</div>
        <div class="datetime">MW35 - 10/25 土・日 </div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_ヴィッセル神戸.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 湘南ベルマーレ</div>
        <div class="datetime">MW36 - 11/8 土・日 </div>
        <div class="stadium">レモンガススタジアム平塚</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_湘南ベルマーレ.png" />
    </div>

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs 柏レイソル</div>
        <div class="datetime">MW37 - 11/30 日 </div>
        <div class="stadium">デンカビッグスワンスタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_柏レイソル.png" />
    </div>
</div>
<div class="month-page">

    <div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs FC東京</div>
        <div class="datetime">MW38 - 12/6 土 </div>
        <div class="stadium">味の素スタジアム</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_fc東京.png" />
    </div>
</div>`;Date().getMonth() + 1;
const months = Array.from(document.querySelectorAll('.month-section'));
const monthHeader = document.getElementById('month-header');
let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
if (currentIndex === -1) currentIndex = 0;
function showMonth(index) {
  months.forEach((m, i) => m.style.display = i === index ? 'block' : 'none');
  const monthName = mName(parseInt(months[index].dataset.month));
  monthHeader.textContent = monthName;
}
function mName(m) {
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return names[m - 1] || "Unknown";
}
showMonth(currentIndex);
window.addEventListener('touchstart', handleTouchStart, false);
window.addEventListener('touchend', handleTouchEnd, false);
let xDown = null;
function handleTouchStart(evt) {
  xDown = evt.touches[0].clientX;
}
function handleTouchEnd(evt) {
  if (!xDown) return;
  let xUp = evt.changedTouches[0].clientX;
  let xDiff = xDown - xUp;
  if (Math.abs(xDiff) > 50) {
    if (xDiff > 0 && currentIndex < months.length - 1) currentIndex++;
    else if (xDiff < 0 && currentIndex > 0) currentIndex--;
    showMonth(currentIndex);
  }
  xDown = null;
}