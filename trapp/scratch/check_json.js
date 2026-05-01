const fs = require('fs');

try {
    const content = fs.readFileSync('results.json', 'utf8');
    const data = JSON.parse(content);
    console.log("JSON is valid. Number of items:", data.length);
} catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
}
