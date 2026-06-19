const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Use the current directory as the workspace
const WORKSPACE_DIR = process.cwd();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, WORKSPACE_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original filename or resolve collisions
    let name = file.originalname;
    let ext = path.extname(name);
    let base = path.basename(name, ext);
    let counter = 1;
    let targetPath = path.join(WORKSPACE_DIR, name);
    
    while (fs.existsSync(targetPath)) {
      name = `${base}_${counter}${ext}`;
      targetPath = path.join(WORKSPACE_DIR, name);
      counter++;
    }
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.mp3' || ext === '.m4a' || ext === '.wav' || ext === '.ogg' || ext === '.aac') {
      cb(null, true);
    } else {
      cb(new Error('Supported audio formats: .mp3, .m4a, .wav, .ogg, .aac'));
    }
  }
});

// Helper: check if file is an audio file
const isAudioFile = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return ['.mp3', '.m4a', '.wav', '.ogg', '.aac'].includes(ext);
};

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `${command} exited with ${code}`)));
  });
}

function runBinary(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr || `${command} exited with ${code}`)));
  });
}

function uniqueOutputPath(base, ext) {
  let filename = `${base}${ext}`;
  let counter = 2;
  while (fs.existsSync(path.join(WORKSPACE_DIR, filename))) filename = `${base}_${counter++}${ext}`;
  return { filename, outputPath: path.join(WORKSPACE_DIR, filename) };
}

function safeOutputName(value, fallback) {
  const cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned || fallback;
}

// API: List audio files in workspace
app.get('/api/files', (req, res) => {
  try {
    fs.readdir(WORKSPACE_DIR, (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to read directory' });
      }

      const audioFiles = files
        .filter(file => isAudioFile(file))
        .map(file => {
          const filePath = path.join(WORKSPACE_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            mtime: stats.mtime,
            path: filePath
          };
        })
        // Sort by modified time descending (newest first)
        .sort((a, b) => b.mtime - a.mtime);

      res.json({ files: audioFiles, workspace: WORKSPACE_DIR });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Stream an audio file (express.static can do this, but this endpoint ensures explicit range support and custom pathing)
app.get('/api/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(WORKSPACE_DIR, filename);
  console.log(`Audio request: filename="${filename}", filePath="${filePath}", exists=${fs.existsSync(filePath)}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // res.sendFile handles byte-range requests out of the box, which is required for browser media players seeking
  res.sendFile(filePath);
});

// Precompute a compact waveform so long recordings do not need to be decoded by the browser.
app.get('/api/waveform/:filename', async (req, res) => {
  const inputPath = path.join(WORKSPACE_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'File not found' });
  try {
    const probe = await runProcess('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', inputPath]);
    const duration = Number(probe.stdout.trim());
    const raw = await runBinary('ffmpeg', ['-v', 'error', '-i', inputPath, '-ac', '1', '-ar', '200', '-f', 'f32le', '-']);
    const samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
    const binCount = Math.min(6000, Math.max(1000, Math.ceil(duration * 2)));
    const peaks = new Array(binCount).fill(0);
    const perBin = samples.length / binCount;
    for (let bin = 0; bin < binCount; bin++) {
      const from = Math.floor(bin * perBin);
      const to = Math.min(samples.length, Math.ceil((bin + 1) * perBin));
      let peak = 0;
      for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(samples[i]));
      peaks[bin] = Number(peak.toFixed(4));
    }
    res.json({ duration, peaks });
  } catch (err) {
    res.status(500).json({ error: 'Waveform generation failed', details: err.message });
  }
});

// API: Upload an audio file
app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    message: 'File uploaded successfully',
    file: {
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path
    }
  });
});

// API: Trim an audio file
app.post('/api/trim', (req, res) => {
  const { filename, startTime, endTime, mode, suffix } = req.body;

  if (!filename || startTime === undefined || endTime === undefined) {
    return res.status(400).json({ error: 'Missing parameters: filename, startTime, and endTime are required' });
  }

  const inputPath = path.join(WORKSPACE_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ error: 'Input file not found' });
  }

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const customSuffix = suffix ? suffix.replace(/[^a-zA-Z0-9_-]/g, '') : '_trimmed';
  const outputFilename = `${base}${customSuffix}${ext}`;
  const outputPath = path.join(WORKSPACE_DIR, outputFilename);

  // Compute duration
  const startSec = parseFloat(startTime);
  const endSec = parseFloat(endTime);
  if (startSec < 0 || endSec <= startSec) {
    return res.status(400).json({ error: 'Invalid time bounds' });
  }
  const duration = endSec - startSec;

  // Build FFmpeg command
  let ffmpegCmd = '';
  if (mode === 'reencode') {
    // Re-encoding ensures sample-accurate cuts and avoids header/keyframe sync issues
    if (ext.toLowerCase() === '.mp3') {
      ffmpegCmd = `ffmpeg -y -ss ${startSec} -t ${duration} -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}"`;
    } else if (ext.toLowerCase() === '.m4a' || ext.toLowerCase() === '.aac') {
      ffmpegCmd = `ffmpeg -y -ss ${startSec} -t ${duration} -i "${inputPath}" -c:a aac -b:a 192k "${outputPath}"`;
    } else {
      ffmpegCmd = `ffmpeg -y -ss ${startSec} -t ${duration} -i "${inputPath}" -c:a copy "${outputPath}"`;
    }
  } else {
    // Lossless (c:a copy) is instantaneous and avoids decoding/encoding
    // Putting -ss before -i makes it fast, but placing it after -i might be more accurate in copy mode.
    // However, for audio -ss before -i with -c copy is extremely fast and usually accurate enough.
    // Let's use -ss and -t before -i, which is standard for fast trimming.
    ffmpegCmd = `ffmpeg -y -ss ${startSec} -t ${duration} -i "${inputPath}" -c:a copy "${outputPath}"`;
  }

  console.log(`Executing: ${ffmpegCmd}`);

  exec(ffmpegCmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`FFmpeg error: ${err.message}`);
      console.error(stderr);
      return res.status(500).json({ error: 'FFmpeg trimming failed. Try Re-encode mode if Lossless mode fails.', details: err.message });
    }
    
    const stats = fs.statSync(outputPath);
    res.json({
      message: 'Audio trimmed successfully',
      outputFile: {
        filename: outputFilename,
        size: stats.size,
        path: outputPath
      }
    });
  });
});

// API: Split an audio file into chunks
app.post('/api/split', (req, res) => {
  const { filename, interval, mode } = req.body;

  if (!filename || !interval) {
    return res.status(400).json({ error: 'Missing parameters: filename and interval are required' });
  }

  const inputPath = path.join(WORKSPACE_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ error: 'Input file not found' });
  }

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  
  const outputPattern = path.join(WORKSPACE_DIR, `${base}_part_%03d${ext}`);
  
  const intervalSec = parseFloat(interval);
  if (isNaN(intervalSec) || intervalSec <= 0) {
    return res.status(400).json({ error: 'Invalid interval' });
  }

  // Build FFmpeg segment command
  let ffmpegCmd = '';
  if (mode === 'reencode') {
    if (ext.toLowerCase() === '.mp3') {
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -f segment -segment_time ${intervalSec} -c:a libmp3lame -q:a 2 "${outputPattern}"`;
    } else if (ext.toLowerCase() === '.m4a' || ext.toLowerCase() === '.aac') {
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -f segment -segment_time ${intervalSec} -c:a aac -b:a 192k "${outputPattern}"`;
    } else {
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -f segment -segment_time ${intervalSec} -c copy "${outputPattern}"`;
    }
  } else {
    ffmpegCmd = `ffmpeg -y -i "${inputPath}" -f segment -segment_time ${intervalSec} -c copy "${outputPattern}"`;
  }

  console.log(`Executing: ${ffmpegCmd}`);

  exec(ffmpegCmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`FFmpeg error: ${err.message}`);
      console.error(stderr);
      return res.status(500).json({ error: 'FFmpeg splitting failed. Try Re-encode mode if Lossless mode fails.', details: err.message });
    }

    fs.readdir(WORKSPACE_DIR, (readErr, files) => {
      if (readErr) {
        return res.status(500).json({ error: 'Failed to read workspace after split' });
      }

      const partRegex = new RegExp(`^${escapeRegExp(base)}_part_\\d{3}${escapeRegExp(ext)}$`, 'i');
      const segmentFiles = files
        .filter(file => partRegex.test(file))
        .map(file => {
          const filePath = path.join(WORKSPACE_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            path: filePath
          };
        })
        .sort((a, b) => a.filename.localeCompare(b.filename));

      res.json({
        message: 'Audio split successfully',
        files: segmentFiles
      });
    });
  });
});

// Detect song-like (non-silent) ranges. Nothing is written to disk here.
app.post('/api/detect-songs', async (req, res) => {
  const { filename } = req.body;
  const thresholdDb = Math.max(-60, Math.min(-10, Number(req.body.thresholdDb ?? -32)));
  const minSilence = Math.max(0.5, Math.min(30, Number(req.body.minSilence ?? 3)));
  const minSong = Math.max(5, Math.min(3600, Number(req.body.minSong ?? 45)));
  const padding = Math.max(0, Math.min(10, Number(req.body.padding ?? 1.5)));
  if (!filename) return res.status(400).json({ error: 'Filename is required' });
  const inputPath = path.join(WORKSPACE_DIR, path.basename(filename));
  if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });

  try {
    const probe = await runProcess('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', inputPath]);
    const duration = Number(probe.stdout.trim());
    const analysis = await runProcess('ffmpeg', ['-hide_banner', '-i', inputPath, '-af', `silencedetect=noise=${thresholdDb}dB:d=${minSilence}`, '-f', 'null', '-']);
    const events = [...analysis.stderr.matchAll(/silence_(start|end):\s*([0-9.]+)/g)]
      .map(match => ({ type: match[1], time: Number(match[2]) }));
    const silences = [];
    let silenceStart = null;
    for (const event of events) {
      if (event.type === 'start') silenceStart = event.time;
      if (event.type === 'end') {
        silences.push({ start: silenceStart ?? 0, end: event.time });
        silenceStart = null;
      }
    }
    if (silenceStart !== null) silences.push({ start: silenceStart, end: duration });

    const raw = [];
    let cursor = 0;
    for (const silence of silences) {
      if (silence.start > cursor) raw.push({ start: cursor, end: silence.start });
      cursor = Math.max(cursor, silence.end);
    }
    if (cursor < duration) raw.push({ start: cursor, end: duration });

    const regions = raw
      .map(range => ({ start: Math.max(0, range.start - padding), end: Math.min(duration, range.end + padding) }))
      .filter(range => range.end - range.start >= minSong)
      .map((range, index) => ({ ...range, name: `曲_${String(index + 1).padStart(2, '0')}`, confirmed: false }));
    res.json({ duration, thresholdDb, regions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '音量解析に失敗しました。FFmpeg/FFprobeが利用できるか確認してください。', details: err.message });
  }
});

// Save only reviewed ranges in one operation.
app.post('/api/export-songs', async (req, res) => {
  const { filename, mode = 'reencode', regions } = req.body;
  if (!filename || !Array.isArray(regions) || regions.length === 0) {
    return res.status(400).json({ error: 'Filename and at least one region are required' });
  }
  const inputPath = path.join(WORKSPACE_DIR, path.basename(filename));
  if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });
  const ext = path.extname(filename).toLowerCase();
  const sourceBase = path.basename(filename, ext);
  const files = [];
  try {
    for (let i = 0; i < regions.length; i++) {
      const start = Number(regions[i].start);
      const end = Number(regions[i].end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error(`Invalid range at ${i + 1}`);
      const label = safeOutputName(regions[i].name, `曲_${String(i + 1).padStart(2, '0')}`);
      const target = uniqueOutputPath(`${sourceBase}_${label}`, ext);
      const args = ['-y', '-ss', String(start), '-t', String(end - start), '-i', inputPath];
      if (mode === 'lossless') args.push('-c:a', 'copy');
      else if (ext === '.mp3') args.push('-c:a', 'libmp3lame', '-q:a', '2');
      else if (ext === '.m4a' || ext === '.aac') args.push('-c:a', 'aac', '-b:a', '192k');
      else args.push('-c:a', 'pcm_s16le');
      args.push(target.outputPath);
      await runProcess('ffmpeg', args);
      const stats = fs.statSync(target.outputPath);
      files.push({ filename: target.filename, size: stats.size, path: target.outputPath });
    }
    res.json({ message: 'Songs exported successfully', files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `${files.length}曲保存後に処理が停止しました`, details: err.message, files });
  }
});

// Helper: Escape RegExp special chars
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// API: Open in File Explorer
app.post('/api/open-folder', (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const filePath = path.join(WORKSPACE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Windows command to open explorer and highlight file
  const cmd = `explorer.exe /select,"${filePath}"`;
  exec(cmd, (err) => {
    if (err) {
      // Fallback: just open workspace dir
      exec(`explorer.exe "${WORKSPACE_DIR}"`);
    }
    res.json({ message: 'Folder opened successfully' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  
  // Auto-open browser
  const startUrl = `http://localhost:${PORT}`;
  let openCmd = '';
  if (process.platform === 'win32') {
    openCmd = `start ${startUrl}`;
  } else if (process.platform === 'darwin') {
    openCmd = `open ${startUrl}`;
  } else {
    openCmd = `xdg-open ${startUrl}`;
  }
  
  exec(openCmd, (err) => {
    if (err) {
      console.log(`Please open your browser and visit: ${startUrl}`);
    } else {
      console.log(`Browser automatically opened to: ${startUrl}`);
    }
  });
});
