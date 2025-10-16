@echo off
echo ========================================
echo Talea: Commit and Push Changes
echo ========================================
echo.

cd C:\MyProjects\Talea\talea-storytelling-platform

echo [1/5] Git Status pruefen...
git status
echo.

echo [2/5] Alle Aenderungen hinzufuegen...
git add -A
echo.

echo [3/5] Commit erstellen...
git commit -m "Switch to GitHub Actions + GHCR (like NotePad) - Delete railway.json"
echo.

echo [4/5] Zum Repository pushen...
git push
echo.

echo [5/5] GitHub Actions URL oeffnen...
start https://github.com/dschilow/talea-storytelling-platform/actions
echo.

echo ========================================
echo FERTIG!
echo ========================================
echo.
echo Naechste Schritte:
echo 1. Pruefe GitHub Actions (Browser sollte sich oeffnen)
echo 2. Warte bis Workflow durchgelaufen ist (ca. 5-10 Min)
echo 3. Gehe zu Railway und aendere Backend Source zu Docker Image
echo.
pause

