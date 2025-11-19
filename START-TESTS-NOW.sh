#!/bin/bash

###############################################################################
# 🚀 QUICK START: Automatische Story-Optimierung
###############################################################################
#
# Dieser Script startet den kompletten automatischen Test-Zyklus:
# 1. Prüft ob Backend läuft
# 2. Startet 5 automatische Tests
# 3. Analysiert alle Ergebnisse
# 4. Zeigt Optimierungsprioritäten
#
# Usage:
#   chmod +x START-TESTS-NOW.sh
#   ./START-TESTS-NOW.sh
#
###############################################################################

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
USER_ID="${USER_ID:-test-user-$(date +%s)}"

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  🤖 Automatische Story-Generierung Optimierung                          ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Schritt 1: Prüfe ob Backend läuft
echo "🔍 Schritt 1: Prüfe Backend-Status..."

if curl -s "$BACKEND_URL/healthz" > /dev/null 2>&1; then
    echo "✅ Backend läuft auf $BACKEND_URL"
else
    echo ""
    echo "❌ Backend läuft NICHT!"
    echo ""
    echo "Bitte starte das Backend in einem anderen Terminal:"
    echo ""
    echo "  cd backend"
    echo "  encore run"
    echo ""
    echo "Warte bis du siehst: '✓ Running on http://localhost:4000'"
    echo "Dann führe dieses Script erneut aus."
    echo ""
    exit 1
fi

# Schritt 2: Starte automatische Tests
echo ""
echo "🚀 Schritt 2: Starte 5 automatische Story-Generierungs-Tests..."
echo "   (Dies wird ca. 5-10 Minuten dauern)"
echo ""

bun run run-optimization-tests.ts

# Schritt 3: Zeige Zusammenfassung
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Tests abgeschlossen!                                                 ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Test-Ergebnisse:"
echo ""

# Finde neuestes Test-Ergebnis
LATEST_RESULT=$(ls -t test-results/optimization-run-*.json 2>/dev/null | head -1)

if [ -n "$LATEST_RESULT" ]; then
    echo "📄 Ergebnis-Datei: $LATEST_RESULT"
    echo ""

    # Zeige Zusammenfassung
    if command -v jq > /dev/null; then
        echo "Zusammenfassung:"
        cat "$LATEST_RESULT" | jq '.summary'
        echo ""

        echo "Durchschnittliche Scores:"
        cat "$LATEST_RESULT" | jq -r '
          .results[0].report.phases as $phases |
          "  Phase 0: \($phases.phase0.score)/10.0",
          "  Phase 1: \($phases.phase1.score)/10.0",
          "  Phase 2: \($phases.phase2.score)/10.0",
          "  Phase 3: \($phases.phase3.score)/10.0",
          "  Phase 4: \($phases.phase4.score)/10.0",
          "  Gesamt:  \(.results[0].report.overallScore)/10.0"
        ' 2>/dev/null || echo "  (Nutze 'jq' für detaillierte Ansicht)"
    else
        echo "⚠️  Installiere 'jq' für bessere Formatierung: brew install jq"
        echo ""
        cat "$LATEST_RESULT"
    fi
else
    echo "⚠️  Keine Test-Ergebnisse gefunden in test-results/"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  📝 Nächste Schritte                                                     ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Schaue dir die detaillierten Ergebnisse an:"
echo "   cat $LATEST_RESULT | jq '.'"
echo ""
echo "2. Identifiziere die Issues:"
echo "   cat $LATEST_RESULT | jq '.results[].report.phases[].issues[]'"
echo ""
echo "3. Schaue dir die Empfehlungen an:"
echo "   cat $LATEST_RESULT | jq '.results[].report.phases[].recommendations[]'"
echo ""
echo "4. Implementiere Optimierungen im Code"
echo ""
echo "5. Führe diesen Script erneut aus:"
echo "   ./START-TESTS-NOW.sh"
echo ""
echo "6. Wiederhole bis Gesamt-Score >= 9.5/10.0"
echo ""
echo "✅ Viel Erfolg bei der Optimierung! 🚀"
echo ""
