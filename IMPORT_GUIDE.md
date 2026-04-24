# Sprint 0 — Import Guide (Fixed)

## ✅ Files Ready

Both files have been cleaned and validated:

| File | Items | Status |
|------|-------|--------|
| `talea-characters-2026-04-23T13-16-50-855Z.json` | 23 characters | ✅ Valid JSON, no null fields |
| `fairytales-export-all (7).json` | 52 fairytales | ✅ Valid JSON, null ageRange removed |

---

## 🚀 How to Import

### Option A: Via Web UI (Recommended)

1. **Start the backend** (if not already running):
   ```bash
   cd backend
   encore run
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   bun run dev
   ```

3. **Access the admin dashboard**:
   - Open: http://localhost:5173
   - Login as admin (use your Clerk account)

4. **Import Characters**:
   - Go to **Admin** → **Character Pool**
   - Click **Import** button
   - Select: `Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json`
   - Click **Import**
   - Wait for success message (should show "imported: 23")

5. **Import Fairy Tales**:
   - Go to **Admin** → **Fairy Tales**
   - Click **Import** button
   - Select: `Logs/logs/export/fairytales-export-all (7).json`
   - Click **Import**
   - Wait for success message (should show "imported: 52")

### Option B: Via API (Local Only)

```bash
# Make sure backend is running
cd backend && encore run

# In another terminal:

# Import characters
curl -X POST http://localhost:4000/story/character-pool/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json

# Import fairy tales
curl -X POST http://localhost:4000/story/fairytales/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @Logs/logs/export/fairytales-export-all\ \(7\).json
```

---

## ✨ What Was Fixed

### Problem 1: Fairy Tales Validation Error
**Error**: `invalid type: Option value, expected a number at tales[0].roles[0].ageRangeMax`

**Root Cause**: The fairytales export included null values for `ageRangeMax` and `ageRangeMin` in role definitions, which the import validator rejected.

**Solution**: Removed these optional fields from all role objects. Since they weren't being used anyway, this doesn't affect functionality.

### Problem 2: Character Import Authentication
**Error**: `500 Internal Server Error` or `401 Unauthenticated`

**Root Cause**: The import endpoints require Clerk authentication tokens. When calling from the web UI, tokens are automatically included. When calling via API, you need to add the Authorization header.

**Solution**: Use the web UI to import (auth is automatic) or get a valid Bearer token if using the API directly.

---

## 📊 What You're Importing

### Characters (23 total)
All original Talea character pool members - explorers, mentors, creatures, etc.

Examples:
- Astronautin Nova - explorer
- Zauberer Sternenschweif - mentor
- ... and 21 more

### Fairy Tales (52 total)
Complete collection of fairytales organized by source:
- Russian fairytales (Kolobok, etc.)
- Andersen tales
- Arabian tales  
- Classics & legends
- ... and more

Each fairytale includes:
- 5 scenes with dialogue and mood
- 3 roles (protagonist, helper, antagonist)
- Age recommendation, moral lesson, duration

---

## ✅ Success Indicators

After successful import, you should see:

**Characters**: 23 characters available in the Character Pool
**Fairy Tales**: 52 tales available for story generation

Both files will be loaded into the database and available for:
- Creating new stories
- Selecting characters
- Generating story content

---

## 🆘 Troubleshooting

### Import still fails locally

1. **Check backend is running**:
   ```bash
   curl http://localhost:4000/health
   ```
   Should return 200 OK

2. **Check file format**:
   ```bash
   # Characters
   node -e "console.log(JSON.parse(require('fs').readFileSync('Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json', 'utf8')).length)"
   
   # Fairy Tales
   node -e "console.log(JSON.parse(require('fs').readFileSync('Logs/logs/export/fairytales-export-all (7).json', 'utf8')).length)"
   ```

3. **Check auth is working**:
   - Open http://localhost:5173
   - Make sure you're logged in (see user menu in top right)
   - Try import again

### Import fails on Railway production

If importing to production fails with validation errors:
1. Use the local web UI to test first
2. Contact the team about the validation issue
3. Consider uploading via direct database migration if needed

---

## 📝 Files Location

```
Talea Project Root
└── Logs/logs/export/
    ├── talea-characters-2026-04-23T13-16-50-855Z.json  (23 characters)
    ├── fairytales-export-all (7).json  (52 fairytales)
    └── IMPORT_NOTES.md  (additional notes)
```

---

## ✨ Next Steps

After successful import:

1. **Create a story** using the imported characters and fairytales
2. **Test character selection** - ensure all 23 characters are available
3. **Test story generation** - ensure all 52 fairytales can be used as templates
4. **Verify quality** - check that character traits and fairytale structure are intact

---

**Created**: 2026-04-23  
**Status**: ✅ Files cleaned and validated  
**Ready to import**: Yes
