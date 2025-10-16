@echo off
echo ========================================
echo JETZT PUSHEN - GitHub Actions triggern
echo ========================================
echo.

cd C:\MyProjects\Talea\talea-storytelling-platform

echo [1/4] Alle Aenderungen hinzufuegen...
git add -A

echo [2/4] Commit erstellen...
git commit -m "Trigger GitHub Actions - Add backend change"

echo [3/4] Pushen...
git push origin main

echo [4/4] GitHub Actions oeffnen...
start https://github.com/dschilow/talea-storytelling-platform/actions

echo.
echo ========================================
echo PUSH ERFOLGREICH!
echo ========================================
echo.
echo GitHub Actions sollte jetzt laufen!
echo Warte 5-10 Minuten fuer den Build.
echo.
pause

