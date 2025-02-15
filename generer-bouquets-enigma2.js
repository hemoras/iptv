const mysql = require('mysql');
const fs = require('fs');

// Configuration de la connexion à la base de données MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'iptv'
});

// Connexion à la base de données
connection.connect((err) => {
    if (err) throw err;
    console.log('Connecté à la base de données MySQL');
});

// Lecture du fichier m3u
fs.readFile('liens.m3u', 'utf8', async(err, data) => {
    if (err) throw err;
    data = data.replace(/ᵁ/g, 'U').replace(/ᴴ/g, 'H').replace(/ᴰ/g, 'D').replace(/ˢ/g, 'S');
    const lines = data.split('\n');
    let tvgName = '';
    let groupTitle = '';
    let url = '';
    let pays = null;

    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            const metadata = line.match(/^.+tvg-ID="([^"]*)".+tvg-name="([^"]+)".+group-title="([^"]+)"/);
            //console.log(metadata);
            if (metadata && metadata.length >= 3) {
                tvgId = metadata[1];
                tvgName = metadata[2];
                groupTitle = metadata[3];
                if (tvgName.match(/^\|?([A-Z]+)\|\|?/)) {
                    const infosChaine = tvgName.match(/^\|?([A-Z]+)\|\|?(.+)/);
                    pays = infosChaine[1];
                    tvgName = infosChaine[2].trim();
                    console.log(`${tvgName} : pays = ${pays}`);
                }
                //console.log(`ici:${tvgName},${groupTitle}`);
            } else {
                console.log("Erreur lors de l'extraction des métadonnées pour la ligne:", line);
            }
        } else if (line.startsWith('http')) {
            url = line;
            // Insertion des données dans la table lien_iptv avec ON DUPLICATE KEY UPDATE
            const insertQuery = `
          INSERT INTO lien_iptv (tvg_name, tvg_id, pays, group_title, url)
          VALUES ('${tvgName}', '${tvgId}', '${pays}', '${groupTitle}', '${url}')
          ON DUPLICATE KEY UPDATE tvg_name=VALUES(tvg_name), pays=VALUES(pays), tvg_id=VALUES(tvg_id), group_title=VALUES(group_title)
        `;
            try {
                await new Promise((resolve, reject) => {
                    connection.query(insertQuery, (err, result) => {
                        if (err) reject(err);
                        console.log(`Lien ajouté ou mis à jour dans la base de données: ${tvgName}`);
                        resolve();
                    });
                });
            } catch (error) {
                console.error('Erreur lors de l\'insertion ou de la mise à jour du lien:', error);
            }
        }
    }

    // Fermeture de la connexion à la base de données après l'insertion de tous les liens
    connection.end((err) => {
        if (err) throw err;
        console.log('Connexion à la base de données fermée.');
    });
});