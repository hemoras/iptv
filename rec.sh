#!/bin/bash

# Vérifier si un argument est fourni
if [ -z "$1" ]; then
    echo "Usage: ./start-enregistrement.sh \"NomDeLaChaine\""
    exit 1
fi

# Exécuter le script Node.js avec l'argument
cd /f/repositories/iptv
node enregistrer-iptv.js "$1"