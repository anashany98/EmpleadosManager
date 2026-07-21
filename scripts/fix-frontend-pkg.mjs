// scripts/fix-frontend-pkg.mjs
import fs from 'fs';
import path from 'path';

const FILE = process.argv[2];
if (!FILE) { console.error('Uso: node fix-frontend-pkg.mjs <path>'); process.exit(1); }

let content = fs.readFileSync(FILE, 'utf8');
let modified = false;

// 1) Quitar la línea de xlsx (HIGH-008)
//    No hay import en el frontend (verificado con grep).
const lines = content.split(/\r?\n/);
const newLines = lines.filter(line => {
    const trimmed = line.trim();
    // Solo borra líneas del tipo `    "xlsx": "^0.18.5",`
    if (trimmed.match(/^"xlsx":\s*"[^"]*",?\s*$/)) {
        modified = true;
        return false;
    }
    return true;
});
content = newLines.join('\n');

if (modified) {
    fs.writeFileSync(FILE, content);
    console.log(`[fix-frontend-pkg] ${path.basename(FILE)}: xlsx quitado`);
} else {
    console.log(`[fix-frontend-pkg] ${path.basename(FILE)}: sin cambios`);
}
