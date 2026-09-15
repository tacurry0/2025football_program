/* Matchday home markup. Scores and form still use the shared live-data updater. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrappHome = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fixtureDate(match) {
    const iso = String(match.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return {
      date: iso ? `${Number(iso[2])}.${Number(iso[3])}` : String(match.date || '日程未定'),
      day: iso ? ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])).getUTCDay()] : String(match.day || '').toUpperCase(),
      time: match.time && !/未定|TBD/i.test(match.time) ? match.time : '時刻未定',
      exact: Boolean(iso)
    };
  }
  function competitionBadge(context) {
    const id = context.competition;
    if (id === 'j2' || id === 'j3') return `<span class="poster-competition poster-league-logo"><img src="./data/assets/icons/${id}_2.png" alt="${escape(context.label)}" decoding="async"></span>`;
    const labels = { j1:'J1', leaguecup:'ルヴァン', emperor:'天皇杯', j2j3:'百年構想', friendly:'親善試合', playoff:'PO' };
    return `<span class="poster-competition poster-competition-text" title="${escape(context.label)}">${escape(labels[id] || context.label || 'その他')}</span>`;
  }
  function reportTeam(prefix, fullName, shortName, emblemHtml) {
    return `<section class="poster-report-team" aria-label="${escape(fullName)}の成績">
      <div class="poster-team-summary">
        <button type="button" class="poster-team-link dash-opp-emblem-link" data-opponent="${escape(fullName)}" aria-label="${escape(fullName)}の公式サイトを開く">${emblemHtml}</button>
        <div class="poster-team-numbers">
          <h3 class="poster-team-name" title="${escape(fullName)}">${escape(shortName)}</h3>
          <div class="poster-standing"><span class="poster-rank"><b class="val-rank-num-${prefix}">—</b><small>位</small></span><span class="poster-points"><b class="val-pts-${prefix}">—</b><small>pts</small></span></div>
        </div>
      </div>
      <div class="poster-previous">
        <h4 class="poster-section-label">直近の試合</h4>
        <div class="dash-prev-meta"><span class="val-prev-date-${prefix}">—</span><span class="dash-prev-vs">vs</span><img class="dash-prev-opp-emblem val-prev-opp-emblem-${prefix}" alt=""><span class="val-prev-ha-${prefix} dash-prev-ha">—</span></div>
        <div class="dash-prev-score-row"><span class="val-prev-score-${prefix}">—</span><span class="val-prev-res-${prefix}">—</span></div>
      </div>
      <div class="poster-recent"><h4 class="poster-section-label">直近5試合</h4><div class="val-prev-form-${prefix}"><p class="poster-pending">データを確認中</p></div></div>
    </section>`;
  }
  function renderCard(options) {
    const { match, clubName, ownName, myShortName, opponentShortName, isHome, isIntro, storageId, competition, roundHtml, myEmblemHtml, opponentEmblemHtml } = options;
    const club = match.club === 'kumamoto' ? 'kumamoto' : 'niigata';
    const crest = `./data/assets/icons/${club === 'niigata' ? 'alb' : 'roasso'}_logo1.png`;
    const date = fixtureDate(match);
    const ha = isHome ? 'HOME' : 'AWAY';
    const summary = `${ownName} 対 ${match.opponent} ${match.date} ${date.time}の試合詳細を開く`;
    return `<article class="dash-card white-theme home-card-enhanced poster-card${isIntro ? ' home-card-intro' : ''} home-card-${club}" id="dash-card-${club}" data-mid="${escape(storageId)}" style="--home-enter-delay:${club === 'kumamoto' ? '180ms' : '20ms'}">
      <div class="poster-hero" role="button" tabindex="0" aria-label="${escape(summary)}">
        <img class="poster-watermark" src="${crest}" alt="" aria-hidden="true" decoding="async">
        <header class="poster-header">
          <div class="poster-lockup"><span class="home-club-mark"><img src="${crest}" alt="" decoding="async"></span><div class="poster-brand"><h2 class="dash-team-name">${escape(clubName)}</h2><span>${escape(ownName)}</span></div></div>
          <div class="poster-badges">${competitionBadge(competition)}${roundHtml}<span class="poster-ha ${isHome ? 'is-home' : 'is-away'}">${ha}</span></div>
        </header>
        <p class="poster-slogan" aria-hidden="true">${club === 'niigata' ? '新潟と、<br>ともに。' : '熊本と、<br>ともに、<br>前へ。'}</p>
        <div class="poster-match-meta">
          <div class="poster-date-line${date.exact ? '' : ' is-undated'}"><time class="poster-date"${date.exact ? ` datetime="${escape(match.date)}"` : ''}>${escape(date.date)}</time><div class="poster-kickoff"><span>${escape(date.day)}</span><span class="poster-time${date.time === '時刻未定' ? ' is-tbd' : ''}">${escape(date.time)}</span></div></div>
          <div class="poster-venue">${escape(match.venue || '会場未定')}</div>
          <div class="poster-weather" id="dash-weather-${club}" data-venue="${escape(match.venue || '')}" data-date="${escape(match.date)}" aria-label="試合日の天気予報"><span class="val-weather"></span></div>
        </div>
        <div class="poster-opponent"><span class="poster-vs">VS</span><h3 class="dash-opp-name">${escape(match.opponent)}</h3></div>
        <span class="poster-signature" aria-hidden="true">${escape(clubName)}<br>${ha} MATCH</span>
      </div>
      <div class="poster-report">${reportTeam('my', ownName, myShortName, myEmblemHtml)}${reportTeam('opp', match.opponent, opponentShortName, opponentEmblemHtml)}</div>
    </article>`;
  }
  return { fixtureDate, renderCard };
});
