import { decodeMTI, parseISO8583 } from './parser';
import { PRESET_MESSAGES } from './presets';

describe('ISO 8583 parser', () => {
  it('decodes the MTI into its four components', () => {
    const mti = decodeMTI('0200');

    expect(mti.raw).toBe('0200');
    expect(mti.version.label).toContain('1987');
    expect(mti.messageClass.label).toBe('Financeira');
    expect(mti.function.label).toBe('Solicitação');
    expect(mti.origin.label).toBe('Adquirente');
  });

  it('parses every built-in example without structural errors', () => {
    for (const preset of PRESET_MESSAGES) {
      const result = parseISO8583(preset.hex);

      expect(result.success, preset.name).toBe(true);
      expect(result.mti?.raw, preset.name).toBe(preset.mti);
      expect(result.fields.length, preset.name).toBeGreaterThan(0);
    }
  });

  it('rejects non-hex input with a useful error', () => {
    const result = parseISO8583('01ZZ');

    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain('Invalid characters');
  });
});
