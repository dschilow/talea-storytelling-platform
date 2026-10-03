// Startet Chromium über Playwright (für drive-ma2.js, scenes-ma2.js, test-import.js).
// Einmalig: npm i playwright && npx playwright install chromium
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
module.exports = async function launch(opts) { return chromium.launch(Object.assign({ headless: true }, opts || {})); };
