#!/bin/bash

###############################################################################
# 🚀 PRODUCTION STORY ANALYSIS - LIVE TEST
###############################################################################
#
# Analyzes the last 5 stories from production and shows optimization targets
#
# This script:
# 1. Calls the production analysis endpoint
# 2. Shows average scores for all 4 phases
# 3. Lists critical issues
# 4. Shows optimization priorities
#
# Usage:
#   chmod +x TEST-PRODUCTION-NOW.sh
#   ./TEST-PRODUCTION-NOW.sh
#
###############################################################################

BACKEND_URL="https://backend-2-production-3de1.up.railway.app"

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  📊 Production Story Analysis                                            ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Backend: $BACKEND_URL"
echo ""
echo "🔍 Analyzing the last 5 production stories..."
echo ""

# Call the analysis endpoint
RESPONSE=$(curl -s -X POST "$BACKEND_URL/story/analyze-recent" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}')

# Check if response is valid
if [ -z "$RESPONSE" ]; then
    echo "❌ No response from backend"
    echo ""
    echo "Possible reasons:"
    echo "  - Backend is not running"
    echo "  - Endpoint not deployed yet"
    echo "  - Network issue"
    echo ""
    exit 1
fi

# Check if it's an error
if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
    echo "❌ Error from backend:"
    echo "$RESPONSE" | head -20
    echo ""
    exit 1
fi

# Pretty print with jq if available, otherwise just print
if command -v jq > /dev/null; then
    echo "✅ Analysis complete!"
    echo ""

    # Extract key metrics
    OVERALL_SCORE=$(echo "$RESPONSE" | jq -r '.averageScores.overall')
    ANALYZED=$(echo "$RESPONSE" | jq -r '.analyzed')

    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  📈 AVERAGE SCORES (based on $ANALYZED stories)"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Phase 0 (Fairy Tale Selection):" $(echo "$RESPONSE" | jq -r '.averageScores.phase0') "/10.0"
    echo "  Phase 1 (Skeleton Generation): " $(echo "$RESPONSE" | jq -r '.averageScores.phase1') "/10.0"
    echo "  Phase 2 (Character Matching):  " $(echo "$RESPONSE" | jq -r '.averageScores.phase2') "/10.0"
    echo "  Phase 3 (Story Finalization):  " $(echo "$RESPONSE" | jq -r '.averageScores.phase3') "/10.0"
    echo "  Phase 4 (Image Generation):    " $(echo "$RESPONSE" | jq -r '.averageScores.phase4') "/10.0"
    echo ""
    echo "  OVERALL:                       $OVERALL_SCORE /10.0"
    echo ""

    # Show status indicator
    if (( $(echo "$OVERALL_SCORE >= 9.5" | bc -l) )); then
        echo "  🎉 EXCELLENT! System is performing optimally!"
    elif (( $(echo "$OVERALL_SCORE >= 8.0" | bc -l) )); then
        echo "  👍 GOOD! Some optimization opportunities available."
    else
        echo "  ⚠️  NEEDS IMPROVEMENT! Significant optimization potential."
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  ⚠️  TOP ISSUES"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""

    echo "$RESPONSE" | jq -r '.topIssues[]' | head -5 | while read -r issue; do
        echo "  • $issue"
    done

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  💡 OPTIMIZATION RECOMMENDATIONS"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""

    echo "$RESPONSE" | jq -r '.topRecommendations[]' | head -5 | while read -r rec; do
        echo "  • $rec"
    done

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  🎯 PRIORITY OPTIMIZATION TARGETS"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""

    echo "$RESPONSE" | jq -r '.priorityTargets[] | "\(.phase): \(.score)/10.0"' | while read -r target; do
        echo "  • $target"
    done

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  📝 NEXT STEPS"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "  1. Review the issues and recommendations above"
    echo "  2. Implement code optimizations (I can help with this!)"
    echo "  3. Deploy changes to Railway"
    echo "  4. Run this script again to measure improvement"
    echo "  5. Repeat until overall score >= 9.5/10.0"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"

    # Save full response
    TIMESTAMP=$(date +%Y-%m-%d-%H-%M-%S)
    FILENAME="test-results/production-analysis-$TIMESTAMP.json"
    echo "$RESPONSE" | jq '.' > "$FILENAME"
    echo ""
    echo "💾 Full results saved to: $FILENAME"
    echo ""

else
    echo "⚠️  jq not installed. Showing raw response:"
    echo ""
    echo "$RESPONSE"
    echo ""
    echo "Install jq for better formatting: brew install jq (macOS) or apt install jq (Linux)"
    echo ""
fi

echo "✅ Analysis complete!"
echo ""
