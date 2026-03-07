const fs = require('fs');
let t = fs.readFileSync('c:/inetpub/wwwroot/rectangle/SLAB/SLAB - Copy/SLAB - Copy/src.js', 'utf8');

let lines = t.split('\n');
let modified = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // ctx.font = `bold ${Math.max(10, Math.floor(11 * scale)) mm -apple-system...
    if (line.includes(' mm') && line.includes('Math.floor')) {
        lines[i] = line.replace(/\)\)\s*mm\b/g, '))}px');
        modified = true;
    } else if (line.includes(' mm') && line.includes('`')) {
        // Just in case there are others
        console.log(`Potential other broken template literal at line ${i + 1}: ${line}`);
        lines[i] = line.replace(/\)\)\s*mm\b/g, '))}px');
        modified = true;
    }
}

if (modified) {
    fs.writeFileSync('c:/inetpub/wwwroot/rectangle/SLAB/SLAB - Copy/SLAB - Copy/src.js', lines.join('\n'));
    console.log("Fixed template literals.");
} else {
    console.log("No broken template literals found.");
}
