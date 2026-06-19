const fs = require('fs');
const path = require('path');

const libs = [
  { url: 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js', dest: 'public/wavesurfer.esm.js' },
  { url: 'https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.esm.js', dest: 'public/regions.esm.js' },
  { url: 'https://unpkg.com/wavesurfer.js@7/dist/plugins/timeline.esm.js', dest: 'public/timeline.esm.js' },
  { url: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', dest: 'public/lucide.min.js' }
];

async function download() {
  for (const lib of libs) {
    console.log(`Downloading ${lib.url}...`);
    const res = await fetch(lib.url);
    if (!res.ok) throw new Error(`Failed to download ${lib.url}: ${res.statusText}`);
    const text = await res.text();
    const destPath = path.join(__dirname, lib.dest);
    
    // Ensure parent directories exist
    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    fs.writeFileSync(destPath, text);
    console.log(`Saved to ${destPath}`);
  }
  console.log('All downloads completed!');
}

download().catch(err => {
  console.error(err);
  process.exit(1);
});
