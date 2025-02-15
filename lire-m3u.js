const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
    console.error('Usage: node lire-m3u.js <m3u_filename>');
    process.exit(1);
}

const m3uFilename = process.argv[2];
const jsonFilename = path.basename(m3uFilename, path.extname(m3uFilename)) + '.json';

fs.readFile(m3uFilename, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    const lines = data.split('\n');
    const channels = [];
    let currentGroup = '';

    lines.forEach((line, index) => {
        if (line.startsWith('#EXTINF')) {
            const match = line.match(/tvg-name="([^"]+)".*?tvg-id="([^"]+)".*?tvg-logo="([^"]+)".*?group-title="([^"]+)"/);
            if (match) {
                const [, tvgName, tvgId, tvgLogo, groupTitle] = match;
                
                if (!channels.some(group => group.groupe === groupTitle)) {
                    channels.push({ groupe: groupTitle, chaines: [] });
                }

                const group = channels.find(group => group.groupe === groupTitle);
                group.chaines.push({ tvgName, tvgId, tvgLogo });
            }
        }
    });

    fs.writeFile(jsonFilename, JSON.stringify(channels, null, 4), 'utf8', err => {
        if (err) {
            console.error('Error writing JSON file:', err);
            return;
        }
        console.log(`JSON file saved as ${jsonFilename}`);
    });
});
