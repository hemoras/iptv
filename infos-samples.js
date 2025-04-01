const fs = require("fs");
const path = require("path");
const MediaInfo = require("mediainfo-wrapper");
const fastcsv = require("fast-csv");

const { cheminEnregistrements, cheminProgrammations, abonnementPrincipal  } = lireProperties();
const folderPath = path.join(cheminEnregistrements, 'samples');
console.log(`folderPath=${folderPath}`);
const outputCsv = path.join(cheminEnregistrements, 'samples/infos-chaines.csv');

// Fonction pour extraire les informations d'un fichier .ts
async function getMediaInfo(filePath) {
    const mediainfo = await MediaInfo();
    const data = await mediainfo.analyzeData(() => fs.promises.readFile(filePath));

    const general = data.media.track.find(t => t["@type"] === "General") || {};
    const video = data.media.track.find(t => t["@type"] === "Video") || {};

    return {
        resolution: video.Width && video.Height ? `${video.Width} x ${video.Height}` : "N/A",
        framerate: video.FrameRate ? `${video.FrameRate} FPS` : "N/A",
        scantype: video.ScanType || "N/A",
        bitrate: general.OverallBitRate ? `${Math.round(general.OverallBitRate / 1000)} kbps` : "N/A"
    };
}

async function processFiles() {
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith(".ts"));
    const csvData = [];

    csvData.push(["Abonnement", "Chaine", "id", "Résolution", "Framerate", "Scan Type", "Bitrate"]);

    for (const file of files) {
        const parts = file.split("-");
        if (parts.length < 4) continue;

        const abonnement = parts[0];
        const chaine = parts.slice(1, -2).join(" ");
        const id = parts[parts.length - 2];

        const filePath = path.join(folderPath, file);
        const info = await getMediaInfo(filePath);

        csvData.push([abonnement, chaine, id, info.resolution, info.framerate, info.scantype, info.bitrate]);
    }

    // Correction : writeToPath attend un tableau de données
    fastcsv
        .writeToPath(outputCsv, csvData, { headers: false, delimiter: ";" })
        .on("finish", () => console.log(`Fichier CSV généré : ${outputCsv}`))
        .on("error", err => console.error("Erreur d'écriture CSV :", err));
}

// Charger les propriétés depuis properties.json
function lireProperties() {
    try {
        const data = fs.readFileSync('properties.json', 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Erreur de lecture du fichier de propriétés :", error);
        return { cheminEnregistrements: './enregistrements', cheminProgrammations: './' }; // Valeurs par défaut
    }
}

// Lancer le script
processFiles().catch(console.error);
