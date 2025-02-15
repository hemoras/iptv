const fs = require('fs');
const { spawn } = require('child_process');

// Charger le fichier de propriétés pour obtenir le chemin des enregistrements
function lireProperties() {
    try {
        const data = fs.readFileSync('./properties.json', 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Erreur de lecture du fichier de propriétés :", error);
        return { cheminProgrammations: './' }; // Valeur par défaut si le fichier est introuvable
    }
}

// Charger le chemin des enregistrements depuis properties.json
const { cheminProgrammations } = lireProperties();
const PROGRAM_FILE = `${cheminProgrammations}/programmes.json`;
const CHECK_INTERVAL = 60 * 1000; // Vérification toutes les minutes

// Stocke les enregistrements déjà lancés pour éviter les doublons
const enregistrementsLances = new Set();

function lireProgrammes() {
    try {
        const data = fs.readFileSync(PROGRAM_FILE, 'utf-8');
        return JSON.parse(data).programmes || [];
    } catch (error) {
        console.error("Erreur de lecture du fichier JSON :", error);
        return [];
    }
}

function sauvegarderProgrammes(programmes) {
    try {
        fs.writeFileSync(PROGRAM_FILE, JSON.stringify({ programmes }, null, 4), 'utf-8');
    } catch (error) {
        console.error("Erreur d'écriture dans le fichier JSON :", error);
    }
}

function lancerEnregistrement(programme) {
    const { date_debut, date_fin, chaine, nom_fichier } = programme;
    console.log(`Démarrage de l'enregistrement : ${chaine} -> ${nom_fichier}`);

    const process = spawn('node', ['enregistrer-iptv.js', date_debut, date_fin, chaine, nom_fichier], {
        detached: true,
        stdio: 'ignore'
    });

    process.unref();
}

function verifierProgrammes() {
    const programmes = lireProgrammes();
    const maintenant = new Date();

    let programmesMisAJour = programmes.filter(programme => {
        const dateDebut = new Date(programme.date_debut);
        const dateFin = new Date(programme.date_fin);
        const dateExpiration = new Date(dateFin.getTime() + 5 * 24 * 60 * 60 * 1000);
        const idProgramme = `${programme.chaine}-${programme.date_debut}-${programme.date_fin}`;

        // Lancer l'enregistrement si la date de début est atteinte et qu'il n'a pas encore été lancé
        if (maintenant >= dateDebut && !enregistrementsLances.has(idProgramme)) {
            lancerEnregistrement(programme);
            enregistrementsLances.add(idProgramme); // Marquer comme lancé
        }

        return maintenant < dateExpiration; // Conserver si non expiré
    });

    if (JSON.stringify(programmesMisAJour) !== JSON.stringify(programmes)) {
        sauvegarderProgrammes(programmesMisAJour);
    }
}

setInterval(verifierProgrammes, CHECK_INTERVAL);
console.log("Service IPTV en cours d'exécution...");
