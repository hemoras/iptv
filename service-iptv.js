const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHECK_INTERVAL = 10 * 1000;
const ffmpegProcesses = new Set();
const enregistrementsLances = new Set();
const retryDelays = [0, 2, 5, 10, 30, 60]; // Délais en secondes
const retryCounters = new Map(); // Stocke les échecs successifs par chaîne

function lireProperties() {
    try {
        const data = fs.readFileSync('properties.json', 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Erreur de lecture du fichier de propriétés :", error);
        return { cheminEnregistrements: './enregistrements', cheminProgrammations: './', abonnementPrincipal: 'default' };
    }
}

// Charger les chaînes depuis un fichier JSON
function chargerChaines() {
    try {
        const data = fs.readFileSync('chaines.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        log(`Erreur lors du chargement de chaines.json : ${err.message}`);
        return [];
    }
}

const { cheminEnregistrements, cheminProgrammations, abonnementPrincipal } = lireProperties();
const PROGRAM_FILE = `${cheminProgrammations}/programmes.json`;

function log(message) {
    const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }).replace(',', '');
    fs.appendFileSync('logs.txt', `[${date}] ${message}\n`);
}

function lireProgrammes() {
    try {
        const data = fs.readFileSync(PROGRAM_FILE, 'utf-8');
        return JSON.parse(data).programmes || [];
    } catch (error) {
        log("Erreur de lecture du fichier JSON : " + error.message);
        return [];
    }
}

function sauvegarderProgrammes(programmes) {
    try {
        fs.writeFileSync(PROGRAM_FILE, JSON.stringify({ programmes }, null, 4), 'utf-8');
    } catch (error) {
        log("Erreur d'écriture dans le fichier JSON : " + error.message);
    }
}

function enregistrerIptv(abonnement, date_debut, date_fin, chaine, nom_fichier) {
    const dateDebut = new Date(date_debut);
    const dateFin = new Date(date_fin);
    const now = new Date();
    let dureeRestante = Math.floor((dateFin - now) / 1000);

    if (dateDebut > now) {
        setTimeout(() => startRecording(abonnement, dureeRestante, chaine, nom_fichier, dateFin), dateDebut - now);
    } else {
        startRecording(abonnement, dureeRestante, chaine, nom_fichier, dateFin);
    }
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

function startRecording(abonnement, dureeRestante, chaine, nom_fichier, dateFin) {
    if (dureeRestante <= 0) {
        log(`Enregistrement terminé pour ${chaine} après plusieurs tentatives.`);
        return;
    }

    if (!retryCounters.has(chaine)) {
        retryCounters.set(chaine, 0);
    }

    const retryCount = retryCounters.get(chaine);

    // Charger les chaînes IPTV
    const chaines = chargerChaines();
    const abonnementData = chaines.find(a => a.abonnement === abonnement);
    
    if (!abonnementData || !abonnementData.chaines[chaine]) {
        log(`Erreur : La chaîne ${chaine} n'est pas configurée pour l'abonnement ${abonnement}.`);
        return;
    }

    const lien = abonnementData.chaines[chaine];

    // Vérifier si le dossier d'enregistrement existe, sinon le créer
    if (!fs.existsSync(cheminEnregistrements)) {
        fs.mkdirSync(cheminEnregistrements, { recursive: true });
    }

    // Générer un nom de fichier unique
    let nomFichierUnique = getUniqueFilename(cheminEnregistrements, nom_fichier);
    const cheminFichier = path.join(cheminEnregistrements, nomFichierUnique);

    // Lancer ffmpeg
    const recordCommand = 'ffmpeg';
    const ffmpegArgs = ['-i', lien, '-t', dureeRestante.toString(), '-c', 'copy', cheminFichier];
    log(`Exécution de la commande ffmpeg : ${recordCommand} ${ffmpegArgs.join(' ')} (tentative ${retryCount})`);

    const startTime = Date.now();
    const ffmpegProcess = spawn(recordCommand, ffmpegArgs, {
        detached: true,
        stdio: 'ignore',
    });

    // Ajouter le processus à la liste des processus actifs
    ffmpegProcesses.add(ffmpegProcess);

    ffmpegProcess.on('exit', (code) => {
        let elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        let tempsRestant = dureeRestante - elapsedTime;

        log(`Enregistrement terminé pour ${chaine}. Code de sortie : ${code}`);
        if (code === 0) {
            log(`Le fichier ${nomFichierUnique} a été créé avec succès.`);
        } else {
            log(`Erreur lors de l'enregistrement du fichier ${nomFichierUnique}.`);
        }

        // Retirer le processus terminé de la liste
        ffmpegProcesses.delete(ffmpegProcess);
        if (tempsRestant > 30) {
            log(`Anomalie détectée : l'enregistrement a été interrompu prématurément (${elapsedTime}s au lieu de ${dureeRestante}s). Relance...`);
            if (elapsedTime > 10) {
                retryCounters.set(chaine, 0);
                tempsRestant = Math.floor((dateFin - Date.now()) / 1000);
                startRecording(abonnement, tempsRestant, chaine, nom_fichier, dateFin);
            } else {
                let nextRetry = retryDelays[Math.min(retryCount, retryDelays.length - 1)];
                log(`⚠️ Échec rapide détecté pour ${chaine} (${elapsedTime}s). Nouvelle tentative dans ${nextRetry}s.`);
    
                retryCounters.set(chaine, retryCount + 1);
    
                tempsRestant = Math.floor((dateFin - Date.now()) / 1000) - nextRetry;
                setTimeout(() => {
                    startRecording(abonnement, tempsRestant, chaine, nom_fichier, dateFin);
                }, nextRetry * 1000);
            }
        } else {
            log(`Enregistrement terminé correctement pour ${chaine}.`);
        }
    });

    ffmpegProcess.on('error', (err) => {
        log(`Erreur lors du lancement de ffmpeg : ${err.message}`);
    });
}

function verifierProgrammes() {
    const programmes = lireProgrammes();
    const maintenant = new Date();

    let programmesMisAJour = programmes.filter(programme => {
        const dateDebut = new Date(programme.date_debut);
        const dateFin = new Date(programme.date_fin);
        const idProgramme = `${programme.chaine}-${programme.date_debut}-${programme.date_fin}`;

        if (dateFin > maintenant && maintenant >= dateDebut && !enregistrementsLances.has(idProgramme)) {
            enregistrerIptv(programme.abonnement || abonnementPrincipal, programme.date_debut, programme.date_fin, programme.chaine, programme.nom_fichier);
            enregistrementsLances.add(idProgramme);
        }

        return dateFin > maintenant;
    });

    if (JSON.stringify(programmesMisAJour) !== JSON.stringify(programmes)) {
        sauvegarderProgrammes(programmesMisAJour);
    }
}

function arreterService(signal) {
    log(`Arrêt du service IPTV (Signal: ${signal})`);
    for (const process of ffmpegProcesses) {
        process.kill('SIGINT');
    }
    process.exit(0);
}

process.on('SIGINT', () => arreterService('SIGINT'));
process.on('SIGTERM', () => arreterService('SIGTERM'));

setInterval(verifierProgrammes, CHECK_INTERVAL);
log(`Démarrage du service IPTV`);