const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Charger les propriétés depuis properties.json
function lireProperties() {
    try {
        const data = fs.readFileSync('properties.json', 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Erreur de lecture du fichier de propriétés :", error);
        return { cheminEnregistrements: './enregistrements' }; // Valeur par défaut
    }
}

// Récupérer le chemin des enregistrements
const { cheminEnregistrements } = lireProperties();

// Fonction pour ajouter des logs avec la date
function log(message) {
    const date = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logMessage = `[${date}] ${message}\n`;
    fs.appendFileSync('logs.txt', logMessage);
}

// Charger les chaînes depuis un fichier JSON
function chargerChaines() {
    try {
        const data = fs.readFileSync('chaines.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        log(`Erreur lors du chargement de chaines.json : ${err.message}`);
        return {};
    }
}

// Fonction principale pour enregistrer le flux IPTV
function enregistrerIptv(date_debut, date_fin, chaine, nom_fichier) {
    const dateDebut = new Date(date_debut);
    const dateFin = new Date(date_fin);
    const now = new Date();

    if (dateDebut > now) {
        const delay = dateDebut - now;
        log(`Le flux pour ${chaine} commencera dans ${delay / 1000} secondes.`);
        setTimeout(() => startRecording(date_debut, date_fin, chaine, nom_fichier), delay);
    } else {
        log(`Le flux pour ${chaine} commence directement`);
        startRecording(date_debut, date_fin, chaine, nom_fichier);
    }
}

// Fonction pour démarrer l'enregistrement
function startRecording(date_debut, date_fin, chaine, nom_fichier) {
    const dateDebut = new Date(date_debut);
    const dateFin = new Date(date_fin);
    const nowTime = new Date().getTime();
    const dureeEnSecondes = Math.floor((dateFin.getTime() - nowTime) / 1000);

    if (dureeEnSecondes <= 0) {
        log(`Erreur : La durée calculée est négative ou nulle. Vérifiez les dates.`);
        return;
    }

    log(`On enregistre pendant ${dureeEnSecondes} secondes`);

    // Charger les chaînes IPTV
    const chaines = chargerChaines();
    const lien = chaines[chaine];

    if (!lien) {
        log(`Erreur : La chaîne ${chaine} n'est pas configurée.`);
        return;
    }

    // Vérifier si le dossier d'enregistrement existe, sinon le créer
    if (!fs.existsSync(cheminEnregistrements)) {
        fs.mkdirSync(cheminEnregistrements, { recursive: true });
    }

    // Générer un nom de fichier unique
    let nomFichierUnique = getUniqueFilename(cheminEnregistrements, nom_fichier);
    const cheminFichier = path.join(cheminEnregistrements, nomFichierUnique);

    // Exécuter ffmpeg
    const recordCommand = 'ffmpeg';
    const ffmpegArgs = ['-i', lien, '-t', dureeEnSecondes.toString(), '-c', 'copy', cheminFichier];
    log(`Exécution de la commande ffmpeg : ${recordCommand} ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn(recordCommand, ffmpegArgs, {
        detached: true,
        stdio: 'ignore',
    });

    ffmpegProcess.on('exit', (code) => {
        log(`Enregistrement terminé pour ${chaine}. Code de sortie : ${code}`);
        if (code === 0) {
            log(`Le fichier ${nom_fichier} a été créé avec succès.`);
        } else {
            log(`Erreur lors de l'enregistrement du fichier ${nom_fichier}.`);
        }
    });

    ffmpegProcess.on('error', (err) => {
        log(`Erreur lors du lancement de ffmpeg : ${err.message}`);
    });
}

// Fonction pour générer un nom de fichier unique
function getUniqueFilename(directory, filename) {
    let baseName = path.basename(filename, path.extname(filename));
    let extension = path.extname(filename);
    let newFilename = filename;
    let counter = 1;

    while (fs.existsSync(path.join(directory, newFilename))) {
        newFilename = `${baseName}-${counter}${extension}`;
        counter++;
    }

    return newFilename;
}

// Exécution avec les paramètres en argument
const [date_debut, date_fin, chaine, nom_fichier] = process.argv.slice(2);
enregistrerIptv(date_debut, date_fin, chaine, nom_fichier);
