const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
    console.error('Usage: node script.js <input-file.m3u>');
    process.exit(1);
}

const inputFile = process.argv[2];
const outputDir = path.join(__dirname, inputFile.replace(/\.m3u*/, ''));

// Créer le dossier de sortie s'il n'existe pas
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Lire le fichier M3U
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

let currentGroup = '';
let currentFile = '';

for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
        // Extraire le group-title
        const match = line.match(/group-title="([^"]+)"/);
        if (match) {
            // Remplacer tous les caractères spéciaux par _ et éviter les _ successifs
            currentGroup = match[1].replace(/[\/\\?%*:|"<>]+/g, '_').replace(/^_+|_+$/g, ''); 
            currentFile = path.join(outputDir, `${currentGroup}.m3u`);
        }
        
        // Ajouter la ligne au fichier correspondant
        fs.appendFileSync(currentFile, line + '\n');
    } else if (line.startsWith('http')) {
        // Ajouter l'URL dans le même fichier
        fs.appendFileSync(currentFile, line + '\n');
    }
}

console.log('Découpage terminé avec succès !');
