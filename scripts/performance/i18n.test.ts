import { expect, test } from 'bun:test';
import i18n, { SUPPORTED_LANGUAGES } from '../../frontend/src/i18n';

test('every lazily loaded language retains its translations and German fallback', async () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    await i18n.changeLanguage(code);
    const expected = (await import(`../../frontend/src/i18n/locales/${code}.json`)).default;
    expect(i18n.hasResourceBundle(code, 'translation')).toBe(true);
    expect(i18n.getResourceBundle(code, 'translation')).toEqual(expected);
    expect(i18n.getResourceBundle('de', 'translation')).toBeDefined();
  }
  await i18n.changeLanguage('de');
});
