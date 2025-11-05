# 🚀 QUICK START: Test Fairy Tale System v3.0

## Step 1: Wait for Railway Deployment ⏳

Keep running this until you get **200 OK**:

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Uri "https://talea-backend.railway.app/story/four-phase" -Method GET

# Expected: 404 Not Found (while deploying)
# Success: 200 OK with "GET method not allowed" (means backend is live!)
```

**Typical deployment time**: 3-5 minutes from git push

---

## Step 2: Test Story Generation with Variance 🎯

### Request 1: First Story
```powershell
$request1 = @{
  avatars = @(
    @{ name = "Alexander"; age = 8; description = "Mutiger Junge" },
    @{ name = "Sophie"; age = 7; description = "Cleveres Mädchen" }
  )
  ageGroup = "6-8"
  genre = "adventure"
  readingLevel = "intermediate"
  preferences = @{
    useFairyTaleTemplate = $true
  }
} | ConvertTo-Json -Depth 4

$response1 = Invoke-WebRequest `
  -Uri "https://talea-backend.railway.app/story/generate-four-phase" `
  -Method POST `
  -ContentType "application/json" `
  -Body $request1

$story1 = ($response1.Content | ConvertFrom-Json)

# Check which fairy tale was used
Write-Host "Request 1 - Selected Fairy Tale:" -ForegroundColor Cyan
Write-Host "  Tale: $($story1.metadata.fairyTaleUsed.title)" -ForegroundColor Green
Write-Host "  Score: $($story1.metadata.fairyTaleUsed.matchScore)" -ForegroundColor Yellow
Write-Host "  Reason: $($story1.metadata.fairyTaleUsed.matchReason)" -ForegroundColor Gray
Write-Host ""
```

**Expected Output**:
```
Request 1 - Selected Fairy Tale:
  Tale: Hänsel und Gretel
  Score: 90
  Reason: Perfekte Altersgruppe (6 Jahre), Passendes Genre (adventure), Genug Charaktere (2/2) | Usage: 0x
```

### Request 2: Test Variance (Same Parameters!)
```powershell
# SAME request - variance should give different tale
$response2 = Invoke-WebRequest `
  -Uri "https://talea-backend.railway.app/story/generate-four-phase" `
  -Method POST `
  -ContentType "application/json" `
  -Body $request1

$story2 = ($response2.Content | ConvertFrom-Json)

Write-Host "Request 2 - Selected Fairy Tale:" -ForegroundColor Cyan
Write-Host "  Tale: $($story2.metadata.fairyTaleUsed.title)" -ForegroundColor Green
Write-Host "  Score: $($story2.metadata.fairyTaleUsed.matchScore)" -ForegroundColor Yellow
Write-Host "  Reason: $($story2.metadata.fairyTaleUsed.matchReason)" -ForegroundColor Gray
Write-Host ""

# Variance check
if ($story1.metadata.fairyTaleUsed.title -ne $story2.metadata.fairyTaleUsed.title) {
  Write-Host "✅ VARIANCE WORKS! Different tales for same parameters" -ForegroundColor Green
} else {
  Write-Host "⚠️  Same tale - check usage_stats" -ForegroundColor Yellow
}
```

**Expected Output**:
```
Request 2 - Selected Fairy Tale:
  Tale: Rotkäppchen
  Score: 88
  Reason: Perfekte Altersgruppe (5 Jahre), Passendes Genre (adventure), Genug Charaktere (2/2) | Usage: 0x

✅ VARIANCE WORKS! Different tales for same parameters
```

---

## Step 3: Verify Professional Prompts 🎬

### Check Story Quality
```powershell
# Examine first chapter
$chapter1 = $story1.story.chapters[0]

Write-Host "=== CHAPTER 1 ANALYSIS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Title: $($chapter1.title)" -ForegroundColor White
Write-Host "Word Count: $(($chapter1.content -split ' ').Count)" -ForegroundColor Yellow
Write-Host ""
Write-Host "First Paragraph:" -ForegroundColor Gray
Write-Host ($chapter1.content -split "`n`n")[0]
Write-Host ""
Write-Host "Image Description (First 200 chars):" -ForegroundColor Gray
Write-Host ($chapter1.imageDescription.Substring(0, [Math]::Min(200, $chapter1.imageDescription.Length)))
Write-Host ""
```

**Quality Checklist**:
- [ ] Word count: 380-450 words ✅
- [ ] Short sentences present (3-7 words) ✅
- [ ] Sensory details (colors, sounds, feelings) ✅
- [ ] Image description starts with SHOT TYPE ✅
- [ ] Image description has LIGHTING section ✅
- [ ] Fairy tale plot is recognizable ✅

---

## Step 4: Compare With Old System 📊

### Old System (Before v3.0):
```
❌ Selected: Rotkäppchen
❌ But story about: "Die verlorene Karte des Schlossherzens"
❌ Fairy tale scenes ignored
❌ Language: "geteiltes Erinnern" (too abstract)
❌ Images: "A dim stone corridor" (generic)
```

### New System (v3.0):
```
✅ Selected: Rotkäppchen  
✅ Story follows: Rotkäppchen scenes (Auftrag, Wald, Wolf, Großmutter, Rettung, Happy End)
✅ Fairy tale scenes = mandatory plot
✅ Language: "Ihr Herz raste wie ein gehetztes Kaninchen" (concrete)
✅ Images: "HERO SHOT of Sophie in red cape. LIGHTING: dramatic sunset backlighting..."
```

---

## Step 5: Test Scene-to-Chapter Mapping 🗺️

```powershell
# Check how scenes map to chapters
Write-Host "=== SCENE MAPPING ===" -ForegroundColor Cyan

$taleTitle = $story1.metadata.fairyTaleUsed.title

switch ($taleTitle) {
  "Hänsel und Gretel" {
    Write-Host "Original: 9 scenes" -ForegroundColor Gray
    Write-Host "Mapped to 5 chapters:" -ForegroundColor Gray
    Write-Host "  Ch1: Scenes 1+2 (Familie + Wald)" -ForegroundColor White
    Write-Host "  Ch2: Scenes 3+4 (Lebkuchenhaus + Hexe)" -ForegroundColor White
    Write-Host "  Ch3: Scene 5 (Gretels List)" -ForegroundColor White
    Write-Host "  Ch4: Scenes 6+7 (Schätze + Überquerung)" -ForegroundColor White
    Write-Host "  Ch5: Scenes 8+9 (Heimweg + Happy End)" -ForegroundColor White
  }
  "Rotkäppchen" {
    Write-Host "Original: 6 scenes" -ForegroundColor Gray
    Write-Host "Mapped to 5 chapters:" -ForegroundColor Gray
    Write-Host "  Ch1: Scenes 1+2 (Auftrag + Wald)" -ForegroundColor White
    Write-Host "  Ch2: Scene 3 (Ablenkung)" -ForegroundColor White
    Write-Host "  Ch3: Scene 4 (Großmutter)" -ForegroundColor White
    Write-Host "  Ch4: Scene 5 (Rettung)" -ForegroundColor White
    Write-Host "  Ch5: Scene 6 (Happy End)" -ForegroundColor White
  }
}

Write-Host ""
Write-Host "Generated chapters: $($story1.story.chapters.Count)" -ForegroundColor Yellow
```

---

## 🎯 SUCCESS CRITERIA

Run these checks after generating a story:

### ✅ Variance System
- [ ] Request 1 uses Tale A
- [ ] Request 2 uses Tale B (different!)
- [ ] Request 3 uses Tale C (different!)
- [ ] Request 4 rotates back (least used)

### ✅ Plot Adherence
- [ ] Story title mentions fairy tale theme
- [ ] Story follows fairy tale scene sequence
- [ ] Iconic moments are present (e.g., Rotkäppchen meets wolf)
- [ ] Ending matches fairy tale ending

### ✅ Professional Language
- [ ] Chapters are 380-450 words
- [ ] Mix of short/medium/long sentences
- [ ] Concrete words (not abstract)
- [ ] Sensory details (3+ per chapter)
- [ ] Dialogue present (2-3 per chapter)

### ✅ Cinematic Images
- [ ] Starts with SHOT TYPE
- [ ] Has LIGHTING section
- [ ] Has COMPOSITION (foreground/midground/background)
- [ ] Has MOOD/ATMOSPHERE
- [ ] References watercolor style
- [ ] 80-120 words long

---

## 🐛 Troubleshooting

### "404 Not Found"
→ Railway still deploying. Wait 2-3 more minutes.

### "Tale is null" or "No fairy tales found"
→ Database not initialized. Run:
```powershell
Invoke-WebRequest -Uri "https://talea-backend.railway.app/health/complete-fairy-tales-setup" -Method POST
```

### "Same fairy tale twice"
→ Check usage_stats:
```powershell
# This endpoint doesn't exist yet, but usage_stats are updated automatically
# Variance should work after 3+ different tales are in DB
```

### Story doesn't follow fairy tale
→ Check Phase 3 logs. If skeleton still dominates, prompts may need adjustment.

---

## 📊 Expected Results

### With 3 Fairy Tales:
```
Tale 1: Hänsel und Gretel (9 scenes)
  - Age: 6+
  - Genre: adventure, fantasy, siblings
  - Roles: 2 protagonists, 1 antagonist
  - Match score for (2 avatars, age 6-8, adventure): 90

Tale 2: Rotkäppchen (6 scenes)  
  - Age: 5+
  - Genre: moral, adventure, animals
  - Roles: 1 protagonist, 1 antagonist, 2 supporting
  - Match score for (2 avatars, age 6-8, adventure): 88

Tale 3: Bremer Stadtmusikanten (4 scenes)
  - Age: 5+
  - Genre: animals, teamwork, adventure
  - Roles: 4 protagonists
  - Match score for (2 avatars, age 6-8, adventure): 70
```

**Rotation Pattern**:
```
Request 1: Hänsel & Gretel (score: 90, usage: 0) ✅
Request 2: Rotkäppchen (score: 88, usage: 0) ✅
Request 3: Bremer (score: 70, usage: 0) ✅
Request 4: Hänsel & Gretel (score: 90, usage: 1) ✅ (back to top)
```

---

## 🚀 Once Confirmed Working:

1. **Document results** in `TESTING_RESULTS.md`
2. **Generate comparison story** (before/after)
3. **Score improvement**: 6.5/10 → 9.5/10 (expected)
4. **Plan next 7 fairy tales** to add

---

## 📞 Quick Reference

**Check if deployed**:
```powershell
Invoke-WebRequest -Uri "https://talea-backend.railway.app/story/four-phase" -Method GET
```

**Generate story**:
```powershell
# See "Request 1" above for full example
```

**Re-initialize database** (if needed):
```powershell
Invoke-WebRequest -Uri "https://talea-backend.railway.app/health/complete-fairy-tales-setup" -Method POST
```

---

**Railway deployment should complete in 3-5 minutes from git push.**
**Then run these tests to verify everything works! 🎉**
