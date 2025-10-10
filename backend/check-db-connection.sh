#!/bin/bash
# 🔍 Database Connection Checker für Railway
# Dieses Script hilft dir, die Datenbankverbindung zu überprüfen

echo "======================================"
echo "🔍 Railway Database Connection Check"
echo "======================================"
echo ""

# Funktion für farbige Ausgabe
green='\033[0;32m'
red='\033[0;31m'
yellow='\033[1;33m'
nc='\033[0m' # No Color

check_var() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -n "$var_value" ]; then
        echo -e "${green}✅ $var_name${nc} ist gesetzt"
        if [ "$var_name" != "PGPASSWORD" ] && [ "$var_name" != "CLERK_SECRET_KEY" ] && [ "$var_name" != "OPENAI_API_KEY" ]; then
            echo "   Wert: $var_value"
        else
            echo "   Wert: ***versteckt***"
        fi
    else
        echo -e "${red}❌ $var_name${nc} ist NICHT gesetzt!"
        return 1
    fi
    return 0
}

echo "1️⃣ Überprüfe PostgreSQL Environment Variablen:"
echo "----------------------------------------------"

all_set=true

check_var "PGHOST" || all_set=false
check_var "PGUSER" || all_set=false
check_var "PGPASSWORD" || all_set=false
check_var "PGDATABASE" || all_set=false
check_var "PGPORT" || all_set=false

echo ""
echo "2️⃣ Konstruiere DATABASE_URL:"
echo "----------------------------"

if [ "$all_set" = true ]; then
    DB_URL="postgresql://${PGUSER}:***@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=disable"
    echo -e "${green}✅ DATABASE_URL kann konstruiert werden:${nc}"
    echo "   $DB_URL"
else
    echo -e "${red}❌ DATABASE_URL kann NICHT konstruiert werden!${nc}"
    echo -e "${yellow}⚠️  Fehlende Variablen müssen gesetzt werden!${nc}"
fi

echo ""
echo "3️⃣ Teste PostgreSQL Verbindung:"
echo "--------------------------------"

if command -v psql &> /dev/null; then
    if [ "$all_set" = true ]; then
        echo "Versuche Verbindung zu PostgreSQL..."
        
        # Test connection
        PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "SELECT version();" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${green}✅ PostgreSQL Verbindung erfolgreich!${nc}"
            
            # Check tables
            echo ""
            echo "4️⃣ Überprüfe Datenbank-Tabellen:"
            echo "--------------------------------"
            
            PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "\dt" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                echo -e "${green}✅ Tabellen gefunden!${nc}"
            else
                echo -e "${yellow}⚠️  Keine Tabellen gefunden - Migrations müssen laufen!${nc}"
            fi
        else
            echo -e "${red}❌ PostgreSQL Verbindung FEHLGESCHLAGEN!${nc}"
            echo -e "${yellow}⚠️  Mögliche Ursachen:${nc}"
            echo "   - Falscher Hostname"
            echo "   - Falsche Credentials"
            echo "   - PostgreSQL Service nicht erreichbar"
            echo "   - SSL-Konfiguration falsch"
        fi
    else
        echo -e "${yellow}⚠️  Überspringe Verbindungstest - Variablen fehlen${nc}"
    fi
else
    echo -e "${yellow}⚠️  'psql' nicht installiert - Überspringe Verbindungstest${nc}"
    echo "   Installiere mit: apt-get install postgresql-client"
fi

echo ""
echo "5️⃣ Weitere wichtige Variablen:"
echo "-------------------------------"

check_var "CLERK_SECRET_KEY"
check_var "OPENAI_API_KEY"
check_var "PORT"

echo ""
echo "======================================"
echo "📋 Zusammenfassung"
echo "======================================"

if [ "$all_set" = true ]; then
    echo -e "${green}✅ Alle PostgreSQL Variablen sind gesetzt!${nc}"
    echo ""
    echo "Nächste Schritte:"
    echo "1. Deploye deine App auf Railway"
    echo "2. Überprüfe die Logs: railway logs"
    echo "3. Teste die API-Endpoints im Frontend"
else
    echo -e "${red}❌ Einige Variablen fehlen!${nc}"
    echo ""
    echo "So behebst du das Problem:"
    echo "1. Gehe zu Railway → Backend Service → Variables"
    echo "2. Setze die fehlenden Variablen mit References zum PostgreSQL Service"
    echo "3. Siehe RAILWAY_FIX.md für detaillierte Anleitung"
fi

echo ""
echo "======================================"
echo "Fertig! 🎉"
echo "======================================"

