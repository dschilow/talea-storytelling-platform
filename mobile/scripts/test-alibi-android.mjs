/** Builds an isolated fixture APK to exercise Android System WebView and audio.
 * Requires a running emulator/device. Does not sign in or modify Talea app data. */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(mobile);
const sdk = process.env.ANDROID_HOME || path.join(os.homedir(), 'AppData/Local/Android/Sdk');
const java = process.env.JAVA_HOME;
if (!java) throw new Error('Set JAVA_HOME to your JDK 17 installation.');
const tools = path.join(sdk, 'build-tools/36.0.0');
const jar = path.join(sdk, 'platforms/android-36/android.jar');
const adb = path.join(sdk, 'platform-tools/adb.exe');
const out = path.join(repo, 'scripts/game-qa/out/android-device');
const source = path.join(mobile, 'scripts/android-alibi-smoke');
const run = (exe, args, options = {}) => new Promise((resolve, reject) => {
  if (path.basename(exe) !== 'adb.exe') console.log(`Running ${path.basename(exe)} ${args[0]}`);
  const p = spawn(exe, args, { cwd: out, timeout: 120_000, ...options }); let text = '';
  p.stdout.on('data', b => text += b); p.stderr.on('data', b => text += b);
  p.on('error', reject); p.on('close', code => code ? reject(new Error(`${exe}: ${text}`)) : resolve(text));
});
await fs.mkdir(path.join(out, 'classes'), { recursive: true });
await fs.mkdir(path.join(out, 'dex'), { recursive: true });
if (!process.argv.includes('--reuse-assets')) await fs.cp(path.join(repo, 'scripts/game-qa/out/android-alibi'), path.join(out, 'assets/alibi'), { recursive: true });
const texts = await fs.readFile(path.join(repo, 'frontend/screens/Game/alibi/data/characters.ts'), 'utf8');
const chars = JSON.parse(texts.match(/=\s*(\[[\s\S]*\]);/)[1]);
const faces = ['eule', 'katze', 'frosch', 'huhn', 'ziege', 'fledermaus'];
await fs.writeFile(path.join(out, 'assets/pool.json'), JSON.stringify({ characters: chars.map((c, i) => ({ name: c.n, imageUrl: `game/alibi/sights/${faces[i % faces.length]}.webp` })) }));
const clips = await fs.readdir(path.join(out, 'assets/alibi/game/alibi/voices'));
const clip = clips.find(f => f.includes('Grün') && f.endsWith('.mp3')) || clips.find(f => f.endsWith('.mp3'));
await fs.writeFile(path.join(out, 'assets/checks.js'), `window.__QA_AUDIO__=${JSON.stringify(`game/alibi/voices/${clip}`)};\n${await fs.readFile(path.join(source, 'checks.js'), 'utf8')}`);
await run(path.join(java, 'bin/javac.exe'), ['-source', '8', '-target', '8', '-classpath', jar, '-d', path.join(out, 'classes'), path.join(source, 'MainActivity.java')]);
await run(path.join(java, 'bin/jar.exe'), ['cf', 'code.jar', '-C', path.join(out, 'classes'), '.']);
await run(path.join(java, 'bin/java.exe'), ['-cp', path.join(tools, 'lib/d8.jar'), 'com.android.tools.r8.D8', '--min-api', '24', '--lib', jar, '--output', path.join(out, 'dex'), path.join(out, 'code.jar')]);
await run(path.join(tools, 'aapt2.exe'), ['link', '-I', jar, '--manifest', path.join(source, 'AndroidManifest.xml'), '-o', path.join(out, 'unsigned.apk')]);
// Java's ZIP writer preserves UTF-8 voice filenames on Windows (aapt2 -A does
// not). Assets are plain APK files, independent of Android compiled resources.
// Match Gradle's uncompressed media assets: Android's media reader needs a
// seekable descriptor for these APK MP3s.
await run(path.join(java, 'bin/jar.exe'), ['uf0', 'unsigned.apk', '-C', path.join(out, 'dex'), 'classes.dex', '-C', out, 'assets']);
await run(path.join(java, 'bin/java.exe'), ['-jar', path.join(tools, 'lib/apksigner.jar'), 'sign', '--ks', path.join(mobile, 'android/app/debug.keystore'), '--ks-pass', 'pass:android', '--out', path.join(out, 'alibi-qa.apk'), path.join(out, 'unsigned.apk')]);
await run(adb, ['wait-for-device']);
for (let i = 0; i < 120; i++) {
  if ((await run(adb, ['shell', 'getprop', 'sys.boot_completed'])).trim() === '1') break;
  if (i === 119) throw new Error('Android has not finished booting');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await run(adb, ['install', '--no-incremental', '-r', path.join(out, 'alibi-qa.apk')]);
await run(adb, ['logcat', '-c']);
await run(adb, ['shell', 'am', 'start', '-n', 'com.talea.alibiqa/.MainActivity']);
for (let i = 0; i < 120; i++) {
  const log = await run(adb, ['logcat', '-d', '-s', 'AlibiQA:I', '*:S']);
  if (log.includes('ALIBI_QA:ERROR')) throw new Error(log);
  if (log.includes('ALIBI_QA:PASS')) {
    await fs.writeFile(path.join(out, 'result.log'), log);
    console.log(log.trim());
    await run(adb, ['shell', 'screencap', '-p', '/sdcard/alibi-qa.png']);
    await run(adb, ['pull', '/sdcard/alibi-qa.png', path.join(out, 'screenshot.png')]);
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
throw new Error('Android WebView smoke test timed out');
