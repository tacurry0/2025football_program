import WaveSurfer from './wavesurfer.esm.js';
import RegionsPlugin from './regions.esm.js';
import TimelinePlugin from './timeline.esm.js';

// Application State
let wavesurfer = null;
let wsRegions = null;
let activeRegion = null;
let activeFilename = null;
let isLooping = false;
let isPlayingSelectionOnly = false;
let trimHistory = [];
let songRegions = [];
let selectedSongIndex = -1;
let audioLoadRequest = 0;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileUploadInput = document.getElementById('file-upload');
const fileListContainer = document.getElementById('file-list');
const btnRefresh = document.getElementById('btn-refresh');

const activeTrackTitle = document.getElementById('active-track-title');
const trackFormatBadge = document.getElementById('track-format-badge');
const workspacePath = document.getElementById('workspace-path');
const waveLoading = document.getElementById('wave-loading');
const currentTimeDisplay = document.getElementById('current-time-display');
const durationTimeDisplay = document.getElementById('duration-time-display');

const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const btnStop = document.getElementById('btn-stop');
const btnPlaySelection = document.getElementById('btn-play-selection');
const btnLoopToggle = document.getElementById('btn-loop-toggle');
const loopIcon = document.getElementById('loop-icon');
const volumeSlider = document.getElementById('volume-slider');
const speedSelector = document.getElementById('speed-selector');
const zoomSlider = document.getElementById('zoom-slider');

const inputStartTime = document.getElementById('input-start-time');
const inputEndTime = document.getElementById('input-end-time');
const inputDuration = document.getElementById('input-duration');
const btnSetStart = document.getElementById('btn-set-start');
const btnSetEnd = document.getElementById('btn-set-end');

const inputSuffix = document.getElementById('input-suffix');
const selectMode = document.getElementById('select-mode');
const btnExecuteTrim = document.getElementById('btn-execute-trim');
const historyListContainer = document.getElementById('history-list');

// Split panel elements
const btnExecuteSplit = document.getElementById('btn-execute-split');
const selectSplitMode = document.getElementById('select-split-mode');
const inputSplitInterval = document.getElementById('input-split-interval');
const customSplitGroup = document.getElementById('custom-split-group');
let currentSplitIntervalSec = 300; // default 5 min

const btnDetectSongs = document.getElementById('btn-detect-songs');
const btnExportSongs = document.getElementById('btn-export-songs');
const songThreshold = document.getElementById('song-threshold');
const songMinSilence = document.getElementById('song-min-silence');
const songMinLength = document.getElementById('song-min-length');
const songRegionList = document.getElementById('song-region-list');
const songConfirmSummary = document.getElementById('song-confirm-summary');
const songExportMode = document.getElementById('song-export-mode');

const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');
const toastIcon = document.getElementById('toast-icon');

// Initialize WaveSurfer
function initWaveSurfer() {
  if (wavesurfer) {
    wavesurfer.destroy();
  }

  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4f6080',          // bright enough to see on black background
    progressColor: '#818cf8',       // vivid indigo for played section
    cursorColor: '#22d3ee',
    cursorWidth: 2,
    barWidth: 3,
    barGap: 1,
    barRadius: 2,
    height: 120,
    fillParent: true,
    minPxPerSec: 0,                // Start with zoom-to-fit
    plugins: [
      TimelinePlugin.create({
        container: '#wave-timeline',
        insertPosition: 'beforebegin',
        style: {
          color: '#94a3b8',
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, monospace'
        }
      })
    ]
  });

  // Initialize Regions plugin
  wsRegions = wavesurfer.registerPlugin(RegionsPlugin.create());

  // WaveSurfer Event Listeners
  wavesurfer.on('ready', () => {
    waveLoading.style.display = 'none';
    btnExecuteTrim.disabled = false;
    if (btnExecuteSplit) btnExecuteSplit.disabled = false;
    if (btnDetectSongs) btnDetectSongs.disabled = false;
    
    const duration = wavesurfer.getDuration();
    durationTimeDisplay.textContent = formatTime(duration);
    
    // Setup inputs
    inputStartTime.max = duration;
    inputEndTime.max = duration;
    
    if (songRegions.length) {
      rebuildSongWaveRegions();
    } else {
      // Create initial region covering 20% to 80% of track
      wsRegions.clearRegions();
      activeRegion = wsRegions.addRegion({
        id: 'trim-region',
        start: duration * 0.2,
        end: duration * 0.8,
        color: 'rgba(6, 182, 212, 0.18)',
        drag: true,
        resize: true
      });
      updateSelectionUI(activeRegion.start, activeRegion.end);
    }
    
    // Sync speed
    wavesurfer.setPlaybackRate(parseFloat(speedSelector.value));
    
    showToast('オーディオファイルの解析が完了しました', 'success');
  });

  wavesurfer.on('timeupdate', (currentTime) => {
    currentTimeDisplay.textContent = formatTime(currentTime);
    
    // Handle selection-only playback boundary
    if (isPlayingSelectionOnly && activeRegion) {
      if (currentTime >= activeRegion.end) {
        if (isLooping) {
          wavesurfer.setTime(activeRegion.start);
        } else {
          wavesurfer.pause();
          isPlayingSelectionOnly = false;
        }
      }
    }
  });

  wavesurfer.on('finish', () => {
    if (isLooping && !isPlayingSelectionOnly) {
      wavesurfer.play();
    } else {
      updatePlayPauseButton(false);
    }
  });

  wavesurfer.on('play', () => updatePlayPauseButton(true));
  wavesurfer.on('pause', () => updatePlayPauseButton(false));

  // Regions Event Listeners
  wsRegions.on('region-updated', (region) => {
    if (region.id === 'trim-region') {
      activeRegion = region;
      updateSelectionUI(region.start, region.end);
    }
    const songIndex = Number(String(region.id).replace('song-region-', ''));
    if (String(region.id).startsWith('song-region-') && songRegions[songIndex]) {
      songRegions[songIndex].start = region.start;
      songRegions[songIndex].end = region.end;
      songRegions[songIndex].confirmed = false;
      activeRegion = region;
      selectedSongIndex = songIndex;
      updateSelectionUI(region.start, region.end);
      renderSongRegions();
    }
  });

  wsRegions.on('region-clicked', (region, event) => {
    event?.stopPropagation();
    selectSongRegion(region);
  });

  // WaveSurfer Error Listener
  wavesurfer.on('error', (err) => {
    console.error('WaveSurfer error:', err);
    waveLoading.style.display = 'none';
    showToast(`オーディオ解析エラー: ${err.message || err}`, 'error');
  });
}

// Helper: Format Time (MM:SS.mmm)
function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  const pad = (num, size) => ('00' + num).slice(-size);
  return `${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
}

// Update selection inputs and duration display
function updateSelectionUI(start, end) {
  inputStartTime.value = start.toFixed(3);
  inputEndTime.value = end.toFixed(3);
  const diff = Math.max(0, end - start);
  if (inputDuration) inputDuration.value = diff.toFixed(3);
}

// Update play/pause icon
function updatePlayPauseButton(isPlaying) {
  if (isPlaying) {
    playIcon.setAttribute('data-lucide', 'pause');
  } else {
    playIcon.setAttribute('data-lucide', 'play');
  }
  lucide.createIcons();
}

// Load workspace files
async function loadFilesList() {
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    
    if (data.workspace) {
      workspacePath.textContent = `ワークスペース: ${data.workspace}`;
    }
    
    renderFileList(data.files);
  } catch (err) {
    showToast('ファイル一覧の取得に失敗しました', 'error');
  }
}

// Render File List in Sidebar
function renderFileList(files) {
  fileListContainer.innerHTML = '';
  
  if (files.length === 0) {
    fileListContainer.innerHTML = '<div class="empty-list">オーディオファイルがありません</div>';
    return;
  }
  
  files.forEach(file => {
    const isCurrent = file.filename === activeFilename;
    const fileItem = document.createElement('div');
    fileItem.className = `file-item ${isCurrent ? 'active' : ''}`;
    
    const ext = file.filename.split('.').pop();
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    fileItem.innerHTML = `
      <div class="file-info">
        <div class="file-name" title="${file.filename}">${file.filename}</div>
        <div class="file-meta">
          <span class="file-ext">${ext}</span>
          <span>${sizeMB} MB</span>
        </div>
      </div>
    `;
    
    // Clicking load file
    fileItem.addEventListener('click', () => {
      loadAudioFile(file.filename);
    });
    
    fileListContainer.appendChild(fileItem);
  });
}

// Load chosen file into editor
async function loadAudioFile(filename) {
  if (activeFilename === filename) return;
  
  activeFilename = filename;
  
  // Highlight active item
  const items = fileListContainer.querySelectorAll('.file-item');
  items.forEach(item => {
    const nameEl = item.querySelector('.file-name');
    if (nameEl && nameEl.textContent === filename) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Reset workspace headers
  activeTrackTitle.textContent = filename;
  const ext = filename.split('.').pop().toUpperCase();
  trackFormatBadge.textContent = ext;
  trackFormatBadge.className = 'track-badge';
  
  // Show Loading state
  waveLoading.style.display = 'flex';
  btnExecuteTrim.disabled = true;
  if (btnExecuteSplit) btnExecuteSplit.disabled = true;
  if (btnDetectSongs) btnDetectSongs.disabled = true;
  songRegions = [];
  selectedSongIndex = -1;
  renderSongRegions();
  isPlayingSelectionOnly = false;
  
  // Ask the server for compact peaks; this keeps long recordings responsive.
  const requestId = ++audioLoadRequest;
  // Song detection runs on the server and does not need to wait for waveform generation.
  if (btnDetectSongs) btnDetectSongs.disabled = false;
  try {
    const response = await fetch(`/api/waveform/${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('waveform unavailable');
    const waveform = await response.json();
    if (requestId !== audioLoadRequest) return;
    await wavesurfer.load(
      `/api/audio/${encodeURIComponent(filename)}`,
      [Float32Array.from(waveform.peaks)],
      waveform.duration
    );
  } catch (err) {
    if (requestId !== audioLoadRequest) return;
    console.warn('Compact waveform failed; using browser decoding.', err);
    wavesurfer.load(`/api/audio/${encodeURIComponent(filename)}`);
  }
}

// Show Toast Alert
let toastTimeout = null;
function showToast(message, type = 'info') {
  clearTimeout(toastTimeout);
  
  toastMessage.textContent = message;
  toastNotification.className = `toast ${type}`;
  
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
  toastIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
  
  toastNotification.style.display = 'block';
  
  toastTimeout = setTimeout(() => {
    toastNotification.style.display = 'none';
  }, 4000);
}

// Upload Audio File
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('audio', file);
  
  showToast('ファイルをアップロード中...', 'info');
  
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast('アップロードが完了しました', 'success');
      await loadFilesList();
      // Auto-load uploaded file
      loadAudioFile(data.file.filename);
    } else {
      showToast(data.error || 'アップロードに失敗しました', 'error');
    }
  } catch (err) {
    showToast('通信エラーが発生しました', 'error');
  }
}

// Execute Trim Request
async function executeTrim() {
  if (!activeFilename || !activeRegion) return;
  
  const startTime = activeRegion.start;
  const endTime = activeRegion.end;
  const mode = selectMode.value;
  const suffix = inputSuffix.value.trim();
  
  btnExecuteTrim.disabled = true;
  showToast('トリミング処理を実行中...', 'info');
  
  try {
    const res = await fetch('/api/trim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: activeFilename,
        startTime,
        endTime,
        mode,
        suffix
      })
    });
    
    const data = await res.json();
    btnExecuteTrim.disabled = false;
    
    if (res.ok) {
      showToast('トリミングが成功しました！', 'success');
      
      // Add to history
      addToHistory(data.outputFile, 'trim');
      
      // Reload workspace files to show the new trimmed file
      await loadFilesList();
    } else {
      showToast(data.error || 'トリミング処理に失敗しました', 'error');
    }
  } catch (err) {
    btnExecuteTrim.disabled = false;
    showToast('通信エラーが発生しました', 'error');
  }
}

// Add Item to Trim History
function addToHistory(fileInfo, type = 'trim') {
  trimHistory.unshift({ ...fileInfo, type, time: new Date() });
  renderHistory();
}

function renderHistory() {
  historyListContainer.innerHTML = '';
  
  if (trimHistory.length === 0) {
    historyListContainer.innerHTML = '<div class="empty-history">トリミングされたファイルはここに表示されます</div>';
    return;
  }
  
  trimHistory.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    
    const sizeMB = (item.size / (1024 * 1024)).toFixed(2);
    const badge = item.type === 'split'
      ? `<span class="history-badge split-badge">分割</span>`
      : item.type === 'songs'
        ? `<span class="history-badge song-badge">曲</span>`
        : `<span class="history-badge trim-badge">トリム</span>`;
    
    itemEl.innerHTML = `
      <div class="history-info">
        <div class="history-name" title="${item.filename}">${badge} ${item.filename}</div>
        <div class="history-meta">
          <span><i data-lucide="hard-drive"></i> ${sizeMB} MB</span>
          <span><i data-lucide="clock"></i> ${item.time ? item.time.toLocaleTimeString() : ''}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="playback-btn btn-history-play" title="エディタで再生">
          <i data-lucide="play"></i> <span>聴く</span>
        </button>
        <button class="playback-btn btn-history-folder" title="フォルダで表示">
          <i data-lucide="folder-open"></i> <span>表示</span>
        </button>
      </div>
    `;
    
    // Play button
    itemEl.querySelector('.btn-history-play').addEventListener('click', () => {
      loadAudioFile(item.filename);
    });
    
    // Open containing folder
    itemEl.querySelector('.btn-history-folder').addEventListener('click', async () => {
      try {
        await fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: item.filename })
        });
      } catch (err) {
        showToast('フォルダを開けませんでした', 'error');
      }
    });
    
    historyListContainer.appendChild(itemEl);
  });
  
  lucide.createIcons();
}

function selectSongRegion(regionOrIndex, play = false) {
  const index = typeof regionOrIndex === 'number'
    ? regionOrIndex
    : Number(String(regionOrIndex.id).replace('song-region-', ''));
  const song = songRegions[index];
  if (!song) return;
  selectedSongIndex = index;
  activeRegion = song.region;
  updateSelectionUI(song.start, song.end);
  if (play) {
    isPlayingSelectionOnly = true;
    wavesurfer.setTime(song.start);
    wavesurfer.play();
  }
  renderSongRegions();
}

function renderSongRegions() {
  if (!songRegionList) return;
  songRegionList.innerHTML = '';
  if (songRegions.length === 0) {
    songRegionList.innerHTML = '<div class="empty-history">曲を検出すると、ここに候補が並びます</div>';
  }
  songRegions.forEach((song, index) => {
    const row = document.createElement('div');
    row.className = `song-region-item ${index === selectedSongIndex ? 'active' : ''} ${song.confirmed ? 'confirmed' : ''}`;
    row.innerHTML = `
      <button class="song-number" title="波形上でこの範囲を選択">${String(index + 1).padStart(2, '0')}</button>
      <input class="styled-input song-name" aria-label="曲名" value="">
      <span class="song-time mono-font">${formatTime(song.start)} – ${formatTime(song.end)}<small>${formatTime(song.end - song.start)}</small></span>
      <button class="playback-btn song-preview"><i data-lucide="play"></i><span>試聴</span></button>
      <label class="song-confirm"><input type="checkbox" ${song.confirmed ? 'checked' : ''}><span>確認済み</span></label>
      <button class="icon-button song-remove" title="候補から削除"><i data-lucide="trash-2"></i></button>`;
    const nameInput = row.querySelector('.song-name');
    nameInput.value = song.name;
    nameInput.addEventListener('change', e => { song.name = e.target.value.trim() || `曲_${String(index + 1).padStart(2, '0')}`; });
    row.querySelector('.song-number').addEventListener('click', () => selectSongRegion(index));
    row.querySelector('.song-preview').addEventListener('click', () => selectSongRegion(index, true));
    row.querySelector('.song-confirm input').addEventListener('change', e => { song.confirmed = e.target.checked; renderSongRegions(); });
    row.querySelector('.song-remove').addEventListener('click', () => {
      song.region.remove();
      songRegions.splice(index, 1);
      rebuildSongWaveRegions();
    });
    songRegionList.appendChild(row);
  });
  const confirmed = songRegions.filter(song => song.confirmed).length;
  if (songConfirmSummary) songConfirmSummary.textContent = `確認済み ${confirmed} / ${songRegions.length} 曲`;
  if (btnExportSongs) btnExportSongs.disabled = confirmed === 0;
  lucide.createIcons();
}

function rebuildSongWaveRegions() {
  const data = songRegions.map(({ start, end, name, confirmed }) => ({ start, end, name, confirmed }));
  wsRegions.clearRegions();
  songRegions = data.map((song, index) => ({
    ...song,
    region: wsRegions.addRegion({
      id: `song-region-${index}`,
      start: song.start,
      end: song.end,
      color: song.confirmed ? 'rgba(16, 185, 129, .22)' : 'rgba(6, 182, 212, .18)',
      drag: true,
      resize: true
    })
  }));
  selectedSongIndex = songRegions.length ? Math.min(Math.max(selectedSongIndex, 0), songRegions.length - 1) : -1;
  activeRegion = selectedSongIndex >= 0 ? songRegions[selectedSongIndex].region : null;
  renderSongRegions();
}

async function detectSongs() {
  if (!activeFilename) return;
  btnDetectSongs.disabled = true;
  showToast('録音全体の音量を解析しています...', 'info');
  try {
    const res = await fetch('/api/detect-songs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: activeFilename,
        thresholdDb: Number(songThreshold.value),
        minSilence: Number(songMinSilence.value),
        minSong: Number(songMinLength.value),
        padding: 1.5
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '解析に失敗しました');
    songRegions = data.regions;
    selectedSongIndex = 0;
    rebuildSongWaveRegions();
    showToast(songRegions.length ? `${songRegions.length} 曲の候補を検出しました。試聴して確認してください` : '候補が見つかりませんでした。音量設定を変更してください', songRegions.length ? 'success' : 'info');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnDetectSongs.disabled = false;
  }
}

async function exportSongs() {
  const confirmed = songRegions.filter(song => song.confirmed);
  if (!confirmed.length) return;
  btnExportSongs.disabled = true;
  showToast(`${confirmed.length} 曲を保存しています...`, 'info');
  try {
    const res = await fetch('/api/export-songs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: activeFilename,
        mode: songExportMode.value,
        regions: confirmed.map(({ start, end, name }) => ({ start, end, name }))
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存に失敗しました');
    data.files.forEach(file => addToHistory(file, 'songs'));
    await loadFilesList();
    showToast(`${data.files.length} 曲を一括保存しました`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnExportSongs.disabled = songRegions.filter(song => song.confirmed).length === 0;
  }
}

// Bind UI Listeners
function bindEvents() {
  // Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });
  
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  });
  
  fileUploadInput.addEventListener('change', (e) => {
    if (fileUploadInput.files.length > 0) {
      uploadFile(fileUploadInput.files[0]);
    }
  });
  
  // Refresh List
  btnRefresh.addEventListener('click', loadFilesList);
  
  // Playback Buttons
  btnPlayPause.addEventListener('click', () => {
    isPlayingSelectionOnly = false;
    wavesurfer.playPause();
  });
  
  btnStop.addEventListener('click', () => {
    isPlayingSelectionOnly = false;
    wavesurfer.stop();
    updatePlayPauseButton(false);
  });
  
  btnPlaySelection.addEventListener('click', () => {
    if (!activeRegion) return;
    isPlayingSelectionOnly = true;
    wavesurfer.setTime(activeRegion.start);
    wavesurfer.play();
  });
  
  btnLoopToggle.addEventListener('click', () => {
    isLooping = !isLooping;
    btnLoopToggle.classList.toggle('active', isLooping);
    showToast(isLooping ? 'ループ再生を有効にしました' : 'ループ再生を無効にしました');
  });
  
  // Audio Tweaks
  volumeSlider.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value) / 100;
    wavesurfer.setVolume(vol);
  });
  
  speedSelector.addEventListener('change', (e) => {
    const rate = parseFloat(e.target.value);
    wavesurfer.setPlaybackRate(rate);
  });
  
  zoomSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    // 0 = zoom to fit entire file in container
    if (val === 0) {
      const duration = wavesurfer.getDuration();
      const containerWidth = document.querySelector('#waveform').clientWidth || 800;
      const fitZoom = containerWidth / (duration || 1);
      wavesurfer.zoom(fitZoom);
    } else {
      wavesurfer.zoom(val);
    }
  });
  
  // Time manual inputs
  inputStartTime.addEventListener('change', () => {
    if (!activeRegion) return;
    let startVal = parseFloat(inputStartTime.value) || 0;
    const totalDuration = wavesurfer.getDuration() || 0;
    const selLen = parseFloat(inputDuration.value) || (activeRegion.end - activeRegion.start);
    
    // Clamp start
    if (startVal < 0) startVal = 0;
    if (startVal >= totalDuration) startVal = totalDuration - 0.001;
    
    // Keep duration constant: shift end
    let endVal = startVal + selLen;
    if (endVal > totalDuration) endVal = totalDuration;
    
    activeRegion.setOptions({ start: startVal, end: endVal });
    updateSelectionUI(startVal, endVal);
  });
  
  inputEndTime.addEventListener('change', () => {
    if (!activeRegion) return;
    let endVal = parseFloat(inputEndTime.value) || 0;
    const totalDuration = wavesurfer.getDuration() || 0;
    if (endVal > totalDuration) endVal = totalDuration;
    if (endVal <= activeRegion.start) endVal = activeRegion.start + 0.001;
    activeRegion.setOptions({ end: endVal });
    updateSelectionUI(activeRegion.start, endVal);
  });

  // Duration field: keep start fixed, adjust end
  if (inputDuration) {
    inputDuration.addEventListener('change', () => {
      if (!activeRegion) return;
      let durVal = parseFloat(inputDuration.value) || 0;
      if (durVal <= 0) durVal = 0.001;
      const totalDuration = wavesurfer.getDuration() || 0;
      let endVal = activeRegion.start + durVal;
      if (endVal > totalDuration) endVal = totalDuration;
      activeRegion.setOptions({ end: endVal });
      updateSelectionUI(activeRegion.start, endVal);
    });
  }
  
  // Get time from current cursor
  btnSetStart.addEventListener('click', () => {
    if (!activeRegion) return;
    const curTime = wavesurfer.getCurrentTime();
    if (curTime < activeRegion.end) {
      activeRegion.setOptions({ start: curTime });
      updateSelectionUI(curTime, activeRegion.end);
    } else {
      showToast('開始位置は終了位置より前である必要があります', 'error');
    }
  });
  
  btnSetEnd.addEventListener('click', () => {
    if (!activeRegion) return;
    const curTime = wavesurfer.getCurrentTime();
    if (curTime > activeRegion.start) {
      activeRegion.setOptions({ end: curTime });
      updateSelectionUI(activeRegion.start, curTime);
    } else {
      showToast('終了位置は開始位置より後である必要があります', 'error');
    }
  });
  
  // Action Execute (Trim)
  btnExecuteTrim.addEventListener('click', executeTrim);

  // ---- Tab Navigation ----
  const panelTabs = document.querySelectorAll('.panel-tab');
  panelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      panelTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetTab = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      const targetContent = document.getElementById(`content-${targetTab}`);
      if (targetContent) targetContent.style.display = 'block';
      lucide.createIcons();
    });
  });

  // ---- Split Preset Buttons ----
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const secs = btn.dataset.seconds;
      if (secs === 'custom') {
        customSplitGroup.style.display = 'flex';
      } else {
        customSplitGroup.style.display = 'none';
        currentSplitIntervalSec = parseFloat(secs);
        if (inputSplitInterval) inputSplitInterval.value = currentSplitIntervalSec;
      }
    });
  });

  if (inputSplitInterval) {
    inputSplitInterval.addEventListener('change', () => {
      currentSplitIntervalSec = parseFloat(inputSplitInterval.value) || 300;
    });
  }

  // Action Execute (Split)
  if (btnExecuteSplit) {
    btnExecuteSplit.addEventListener('click', executeSplit);
  }
  if (btnDetectSongs) btnDetectSongs.addEventListener('click', detectSongs);
  if (btnExportSongs) btnExportSongs.addEventListener('click', exportSongs);
}

// Execute Split Request
async function executeSplit() {
  if (!activeFilename) {
    showToast('ファイルを選択してください', 'error');
    return;
  }

  const interval = currentSplitIntervalSec;
  if (!interval || interval <= 0) {
    showToast('有効な分割間隔を入力してください', 'error');
    return;
  }

  const mode = selectSplitMode ? selectSplitMode.value : 'lossless';

  btnExecuteSplit.disabled = true;
  showToast(`${Math.floor(interval / 60)}分${interval % 60}秒ごとに分割中...`, 'info');

  try {
    const res = await fetch('/api/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: activeFilename, interval, mode })
    });

    const data = await res.json();
    btnExecuteSplit.disabled = false;

    if (res.ok) {
      showToast(`${data.files.length} 個のファイルに分割完了！`, 'success');
      // Add all split files to history
      data.files.forEach(f => addToHistory(f, 'split'));
      await loadFilesList();
    } else {
      showToast(data.error || '分割処理に失敗しました', 'error');
    }
  } catch (err) {
    btnExecuteSplit.disabled = false;
    showToast('通信エラーが発生しました', 'error');
  }
}

// App Entrypoint
try {
  initWaveSurfer();
  bindEvents();
  loadFilesList();
  lucide.createIcons();
} catch (err) {
  console.error("Initialization error:", err);
  showToast(`初期化エラー: ${err.message || err}`, 'error');
}
