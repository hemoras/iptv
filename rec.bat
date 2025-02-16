@echo off
setlocal

:: Vérifier si un argument est fourni
if "%~1"=="" (
    echo Usage: start-enregistrement.bat "NomDeLaChaine"
    exit /b 1
)

cd F:\repositories\iptv
:: Exécuter le script Node.js avec l'argument
node enregistrer-iptv.js "%~1"

endlocal