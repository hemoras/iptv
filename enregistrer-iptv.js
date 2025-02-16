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
        return { cheminEnregistrements: './enregistrements', cheminProgrammations: './' }; // Valeurs par défaut
    }
}

// Récupérer les chemins depuis properties.json
const { cheminEnregistrements, cheminProgrammations, abonnementPrincipal  } = lireProperties();
const PROGRAM_FILE = `${cheminProgrammations}/programmes.json`;

// Fonction pour ajouter des logs avec la date
function log(message) {
    const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }).replace(',', '');
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
        return [];
    }
}

// Fonction principale pour enregistrer le flux IPTV
function enregistrerIptv(abonnement = abonnementPrincipal, date_debut, date_fin, chaine, nom_fichier) {
    const dateDebut = new Date(date_debut);
    const dateFin = new Date(date_fin);
    const now = new Date();
    let dureeRestante = Math.floor((dateFin.getTime() - now.getTime()) / 1000);

    if (dateDebut > now) {
        const delay = dateDebut - now;
        log(`Le flux pour ${chaine} commencera dans ${delay / 1000} secondes.`);
        setTimeout(() => startRecording(abonnement, dureeRestante, chaine, nom_fichier), delay);
    } else {
        log(`Démarrage enregistrement de ${chaine} sur ${abonnement}`);
        startRecording(abonnement, dureeRestante, chaine, nom_fichier);
    }
}

// Fonction pour démarrer l'enregistrement avec relance automatique
function startRecording(abonnement, dureeRestante, chaine, nom_fichier) {
    if (dureeRestante <= 0) {
        log(`Enregistrement terminé pour ${chaine} après plusieurs tentatives.`);
        return;
    }

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
    log(`Exécution de la commande ffmpeg : ${recordCommand} ${ffmpegArgs.join(' ')}`);

    const startTime = Date.now();
    const ffmpegProcess = spawn(recordCommand, ffmpegArgs, {
        detached: true,
        stdio: 'ignore',
    });

    process.on('SIGINT', () => {
        log(`Interruption par l'utilisateur. Arrêt du processus ffmpeg...`);
        ffmpegProcess.kill('SIGINT');  // Envoie un signal SIGINT à ffmpeg pour l'arrêter proprement
        process.exit();  // Quitte le script proprement
    });

    ffmpegProcess.on('exit', (code) => {
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const tempsRestant = dureeRestante - elapsedTime;

        log(`Enregistrement terminé pour ${chaine}. Code de sortie : ${code}`);
        if (code === 0) {
            log(`Le fichier ${nomFichierUnique} a été créé avec succès.`);
        } else {
            log(`Erreur lors de l'enregistrement du fichier ${nomFichierUnique}.`);
        }

        if (tempsRestant > 80) {
            log(`Anomalie détectée : l'enregistrement a été interrompu prématurément (${elapsedTime}s au lieu de ${dureeRestante}s). Relance...`);
            startRecording(abonnement, tempsRestant, chaine, nom_fichier);
        } else {
            log(`Enregistrement terminé correctement pour ${chaine}.`);
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
let [abonnement, date_debut, date_fin, chaine, nom_fichier] = process.argv.slice(2);
// Si un seul argument, seule la chaine est spécifiée
if (!date_debut) {
    [chaine] = process.argv.slice(2);
    date_debut = new Date();
    date_fin = new Date(date_debut.getTime() + 3 * 60 * 60 * 1000);
    abonnement = abonnementPrincipal;
    const dateString = date_debut.toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit'
    }).replace(/\//g, '-').replace(/:/g, '').replace(' ', '_');
    
    nom_fichier = `${dateString}_${chaine}.ts`;
}
// Si 4 arguments, l'abonnement n'est pas spécifié
if (!nom_fichier) {
    [date_debut, date_fin, chaine, nom_fichier] = process.argv.slice(2);
    abonnement = abonnementPrincipal;
}
log('abonnement='+abonnement);
enregistrerIptv(abonnement, date_debut, date_fin, chaine, nom_fichier);