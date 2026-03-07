const fs = require('fs');
let t = fs.readFileSync('c:/inetpub/wwwroot/rectangle/SLAB/SLAB - Copy/SLAB - Copy/src.js', 'utf8');

// Fix the missing } closures
t = t.replace(/\.h mm/g, '.h} mm');
t = t.replace(/\.height mm(?:<\/td>|`|,)/g, match => '.height}' + match.substring(7));

// Fix the CSS classes that lost their digits
t = t.replace(/font-size:1 mm/g, 'font-size:12px');
t = t.replace(/padding-left:1 mm/g, 'padding-left:12px');
t = t.replace(/margin-right: 1 mm; width: 1 mm; height: 1 mm;/g, 'margin-right: 10px; width: 16px; height: 16px;');
t = t.replace(/border: mm solid/g, 'border: 2px solid');
t = t.replace(/0  mm 2 mm/g, '0 4px 6px');
t = t.replace(/max-width: 120 mm;/g, 'max-width: 1200px;');
t = t.replace(/margin-bottom: 2 mm;/g, 'margin-bottom: 24px;');
t = t.replace(/gap:  mm;/g, 'gap: 8px;');
t = t.replace(/border-radius: 1 mm;/g, 'border-radius: 12px;');

fs.writeFileSync('c:/inetpub/wwwroot/rectangle/SLAB/SLAB - Copy/SLAB - Copy/src.js', t);
