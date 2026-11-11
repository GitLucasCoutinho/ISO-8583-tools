import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FIELD_SPECS,
  MTI_DESCRIPTIONS,
  PROCESSING_CODES,
  RESPONSE_CODES,
  CURRENCY_CODES,
  type FieldSpec,
} from './iso8583/fieldSpecs';
import { MCC_DATABASE } from './iso8583/mccDatabase';
import { parseISO8583, type BitmapInfo, type ParsedField, type ParseResult } from './iso8583/parser';
import { LEARNING_SCENARIOS, PRESET_MESSAGES } from './iso8583/presets';

interface BinInfo {
  brand: string;
  type: string;
  category: string;
  issuer: string;
  country: string;
}

interface MessageStat {
  category: string;
  label: string;
  bytes: number;
  count: number;
  percent: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  identification: 'Cartão / identificação',
  amount: 'Valores',
  processing: 'Processamento',
  date_time: 'Data e hora',
  reference: 'Referência',
  network: 'Rede',
  terminal: 'Terminal',
  security: 'Segurança',
  private: 'Privado',
  reserved: 'Reservado',
  mti: 'MTI',
  bitmap: 'Mapa de bits',
  error: 'Erro',
};

const CATEGORY_COLORS: Record<string, string> = {
  identification: '#cf5b8b',
  amount: '#2a9d75',
  processing: '#dd8a38',
  date_time: '#288eaf',
  reference: '#7b64c2',
  network: '#3985bb',
  terminal: '#bd9634',
  security: '#cf5a52',
  private: '#777f8d',
  reserved: '#9299a5',
  mti: '#8861cb',
  bitmap: '#4383d0',
  error: '#cb4e4e',
};

const CURRENCY_DETAILS: Record<string, { code: string; name: string; symbol: string; minor: number }> = {
  '036': { code: 'AUD', name: 'Dólar australiano', symbol: 'A$', minor: 2 },
  '124': { code: 'CAD', name: 'Dólar canadense', symbol: 'C$', minor: 2 },
  '156': { code: 'CNY', name: 'Yuan chinês', symbol: '¥', minor: 2 },
  '356': { code: 'INR', name: 'Rupia indiana', symbol: '₹', minor: 2 },
  '392': { code: 'JPY', name: 'Iene japonês', symbol: '¥', minor: 0 },
  '410': { code: 'KRW', name: 'Won sul-coreano', symbol: '₩', minor: 0 },
  '484': { code: 'MXN', name: 'Peso mexicano', symbol: '$', minor: 2 },
  '554': { code: 'NZD', name: 'Dólar neozelandês', symbol: 'NZ$', minor: 2 },
  '578': { code: 'NOK', name: 'Coroa norueguesa', symbol: 'kr', minor: 2 },
  '702': { code: 'SGD', name: 'Dólar de Singapura', symbol: 'S$', minor: 2 },
  '710': { code: 'ZAR', name: 'Rand sul-africano', symbol: 'R', minor: 2 },
  '752': { code: 'SEK', name: 'Coroa sueca', symbol: 'kr', minor: 2 },
  '756': { code: 'CHF', name: 'Franco suíço', symbol: 'CHF', minor: 2 },
  '764': { code: 'THB', name: 'Baht tailandês', symbol: '฿', minor: 2 },
  '784': { code: 'AED', name: 'Dirham dos Emirados', symbol: 'د.إ', minor: 2 },
  '826': { code: 'GBP', name: 'Libra esterlina', symbol: '£', minor: 2 },
  '840': { code: 'USD', name: 'Dólar americano', symbol: '$', minor: 2 },
  '978': { code: 'EUR', name: 'Euro', symbol: '€', minor: 2 },
  '986': { code: 'BRL', name: 'Real brasileiro', symbol: 'R$', minor: 2 },
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App implements OnInit {
  readonly fieldSpecs = FIELD_SPECS;
  readonly presets = PRESET_MESSAGES;
  readonly scenarios = LEARNING_SCENARIOS;
  readonly responseCodes = Object.entries(RESPONSE_CODES).map(([code, info]) => ({ code, ...info }));

  hexInput = '';
  result: ParseResult | null = null;
  activeTab: 'parse' | 'learn' | 'reference' = 'parse';
  highlightedDe: number | null = null;
  fieldSearch = '';
  responseSearch = '';
  copiedNotice = '';
  binMap = new Map<string, BinInfo>();
  binLoading = false;
  binError = '';
  private binLoadStarted = false;

  ngOnInit(): void {
    const sharedHex = this.decodeHexFromHash();
    if (sharedHex) {
      this.hexInput = sharedHex;
      this.parseInput();
    }
  }

  parseInput(): void {
    const cleaned = this.hexInput.replace(/\s/g, '').toUpperCase();
    this.result = cleaned ? parseISO8583(cleaned) : null;
    this.highlightedDe = null;

    if (cleaned) {
      window.history.replaceState(null, '', `${window.location.pathname}#hex=${encodeURIComponent(cleaned)}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (this.result?.fields.some((field) => field.de === 2)) {
      void this.loadBinData();
    }
  }

  loadPreset(id: string): void {
    const preset = this.presets.find((item) => item.id === id);
    if (!preset) return;
    this.hexInput = preset.hex;
    this.activeTab = 'parse';
    this.parseInput();
  }

  loadScenario(presetId: string): void {
    this.loadPreset(presetId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearInput(): void {
    this.hexInput = '';
    this.parseInput();
  }

  get selectedPreset() {
    return this.presets.find((preset) => preset.hex === this.hexInput.replace(/\s/g, '').toUpperCase()) ?? null;
  }

  get inputBytes(): number {
    return Math.ceil(this.hexInput.replace(/\s/g, '').length / 2);
  }

  get filteredFields(): Array<{ de: number; spec: FieldSpec }> {
    const query = this.fieldSearch.trim().toLowerCase();
    return Object.entries(this.fieldSpecs)
      .map(([de, spec]) => ({ de: Number(de), spec }))
      .filter(({ de, spec }) =>
        !query ||
        String(de).includes(query) ||
        spec.name.toLowerCase().includes(query) ||
        spec.format.toLowerCase().includes(query) ||
        spec.type.toLowerCase().includes(query) ||
        (spec.description ?? '').toLowerCase().includes(query),
      );
  }

  get filteredResponseCodes() {
    const query = this.responseSearch.trim().toLowerCase();
    return this.responseCodes.filter((item) =>
      !query ||
      item.code.includes(query) ||
      item.text.toLowerCase().includes(query) ||
      item.severity.includes(query),
    );
  }

  get messageStats(): { totalBytes: number; fixedCount: number; variableCount: number; payloadBytes: number; payloadPercent: number; categories: MessageStat[] } | null {
    if (!this.result?.mti || !this.result.primaryBitmap) return null;
    const categoryMap = new Map<string, { bytes: number; count: number }>();
    let payloadBytes = 0;
    let fixedCount = 0;
    let variableCount = 0;

    for (const field of this.result.fields) {
      const bytes = Math.ceil(field.rawHex.length / 2);
      const current = categoryMap.get(field.category) ?? { bytes: 0, count: 0 };
      current.bytes += bytes;
      current.count += 1;
      categoryMap.set(field.category, current);
      payloadBytes += bytes;
      if (field.format === 'FIXED') fixedCount += 1;
      else variableCount += 1;
    }

    const bitmapBytes = this.result.secondaryBitmap ? 16 : 8;
    const totalBytes = 2 + bitmapBytes + payloadBytes;
    const categories = [...categoryMap.entries()]
      .map(([category, value]) => ({
        category,
        label: this.categoryLabel(category),
        bytes: value.bytes,
        count: value.count,
        percent: payloadBytes ? Math.round((value.bytes / payloadBytes) * 100) : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      totalBytes,
      fixedCount,
      variableCount,
      payloadBytes,
      payloadPercent: totalBytes ? Math.round((payloadBytes / totalBytes) * 100) : 0,
      categories,
    };
  }

  categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  categoryColor(category: string): string {
    return CATEGORY_COLORS[category] ?? '#778091';
  }

  bitmapCells(bitmap: BitmapInfo, offset: number): Array<{ field: number; active: boolean }> {
    return bitmap.binary.split('').map((bit, index) => ({ field: offset + index + 1, active: bit === '1' }));
  }

  fieldName(de: number): string {
    if (de === 1) return 'Mapa de bits secundário';
    return this.fieldSpecs[de]?.name ?? 'Campo reservado';
  }

  toggleHighlight(de: number): void {
    this.highlightedDe = this.highlightedDe === de ? null : de;
  }

  isLuhnValid(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let doubleNext = false;
    // O algoritmo alterna os dígitos dobrados da direita para a esquerda e soma seus algarismos.
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleNext) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleNext = !doubleNext;
    }
    return sum % 10 === 0;
  }

  maskPan(value: string): string {
    return value.length >= 13 ? `${value.slice(0, 6)}••••${value.slice(-4)}` : value;
  }

  displayValue(field: ParsedField): string {
    const value = field.decodedValue;
    if (field.de === 2 || field.de === 20) return this.maskPan(value);
    if (field.de === 3 && value.length >= 2) {
      const code = PROCESSING_CODES[value.slice(0, 2)];
      return code ? `${value} · ${code}` : value;
    }
    if ([4, 5, 6].includes(field.de) && /^\d+$/.test(value)) {
      const currencyCode = this.result?.fields.find((item) => item.de === 49)?.decodedValue;
      const currency = currencyCode ? CURRENCY_DETAILS[currencyCode] : undefined;
      const amount = Number(value) / 10 ** (currency?.minor ?? 2);
      const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: currency?.minor ?? 2, maximumFractionDigits: currency?.minor ?? 2 }).format(amount);
      return `${value} · ${currency?.symbol ?? '$'} ${formatted}`;
    }
    if (field.de === 7 && /^\d{10}$/.test(value)) return `${value} · ${value.slice(0, 2)}/${value.slice(2, 4)} ${value.slice(4, 6)}:${value.slice(6, 8)}:${value.slice(8)}`;
    if (field.de === 12 && /^\d{6}$/.test(value)) return `${value} · ${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4)}`;
    if ([13, 15, 16, 17].includes(field.de) && /^\d{4}$/.test(value)) return `${value} · ${value.slice(0, 2)}/${value.slice(2)}`;
    if (field.de === 14 && /^\d{4}$/.test(value)) return `${value} · ${value.slice(2)}/${value.slice(0, 2)}`;
    if (field.de === 18 && MCC_DATABASE[value]) return `${value} · ${MCC_DATABASE[value].desc} / ${MCC_DATABASE[value].groupLabel}`;
    if (field.de === 22) {
      const modes: Record<string, string> = {
        '00': 'Não especificado', '01': 'Manual', '02': 'Tarja magnética', '05': 'Chip',
        '07': 'Por aproximação', '09': 'Comércio eletrônico', '10': 'Credencial armazenada',
        '79': 'Alternativa pela tarja', '80': 'Alternativa pelo chip', '91': 'Chip por aproximação',
      };
      return modes[value.slice(0, 2)] ? `${value} · ${modes[value.slice(0, 2)]}` : value;
    }
    if (field.de === 25) {
      const conditions: Record<string, string> = {
        '00': 'Normal', '01': 'Portador ausente', '02': 'Terminal não atendido',
        '05': 'Portador presente, cartão ausente', '06': 'Pré-autorização',
        '08': 'Pedido por telefone/e-mail', '51': 'Verificação de conta', '59': 'Comércio eletrônico', '71': 'Saque em caixa eletrônico',
      };
      return conditions[value] ? `${value} · ${conditions[value]}` : value;
    }
    if (field.de === 35) return this.parseTrack2(value);
    if (field.de === 39 && RESPONSE_CODES[value.slice(0, 2)]) {
      return `${value} · ${RESPONSE_CODES[value.slice(0, 2)].text}`;
    }
    if ([49, 50, 51].includes(field.de)) {
      const currency = CURRENCY_DETAILS[value];
      return currency ? `${value} · ${currency.code}: ${currency.name}` : CURRENCY_CODES[value] ? `${value} · ${CURRENCY_CODES[value]}` : value;
    }
    if (field.de === 52 && value.length >= 4) return `${value.slice(0, 2)}••••••${value.slice(-2)} · bloco PIN`;
    if (field.de === 55) {
      const tags = (field.tlv ?? []).map((item) => item.tag);
      if (tags.length > 0) return `${tags.length} elementos: ${tags.join(' ')}`;
      if (value.length > 8) return `${value.length / 2} bytes EMV`;
    }
    if (field.de === 70) {
      const codes: Record<string, string> = {
        '001': 'Entrada na rede', '002': 'Saída da rede', '003': 'Troca de chave',
        '101': 'Logon', '161': 'Conciliação', '162': 'Conciliação parcial',
        '163': 'Conciliação final', '301': 'Teste de eco',
      };
      return codes[value] ? `${value} · ${codes[value]}` : value;
    }
    if (field.de === 90 && value.length >= 42) return `MTI ${value.slice(0, 4)} · STAN ${value.slice(4, 10)} · data ${value.slice(10, 20)} …`;
    return value;
  }

  mtiDescription(): string {
    if (!this.result?.mti) return '';
    return MTI_DESCRIPTIONS[this.result.mti.raw] ?? this.result.mti.description.replace(/^Message Type /, 'Tipo de mensagem ');
  }

  mtiPartLabel(label: string): string {
    return label === 'Unknown' ? 'Desconhecido' : label;
  }

  displayError(message: string): string {
    const fixedMessages: Record<string, string> = {
      'Input too short. Minimum 4 characters for MTI.': 'Entrada muito curta. O MTI precisa de pelo menos 4 caracteres.',
      'Invalid characters detected. Only hex characters (0-9, A-F) are allowed.': 'Foram encontrados caracteres inválidos. Use apenas caracteres hexadecimais (0–9, A–F).',
      'Hex too short for primary bitmap (need 16 more hex chars / 8 bytes).': 'Hexadecimal curto demais para o bitmap primário (são necessários mais 16 caracteres hex, ou 8 bytes).',
      'Bit 1 indicates secondary bitmap but hex is too short.': 'O bit 1 indica um bitmap secundário, mas o conteúdo hexadecimal é curto demais.',
    };
    if (fixedMessages[message]) return fixedMessages[message];

    return message
      .replace(/^No spec for DE (\d+)\. Skipping\.$/, 'Não há especificação para o DE $1. Campo ignorado.')
      .replace(/^Ran out of data at DE (\d+)\.$/, 'Os dados terminaram antes do DE $1.')
      .replace(/^DE (\d+): Expected (\d+) hex chars but only (\d+) remain\.$/, 'DE $1: eram esperados $2 caracteres hex, mas restam apenas $3.')
      .replace(/^DE (\d+): Expected (\d+) hex chars for data but only (\d+) remain\.$/, 'DE $1: eram esperados $2 caracteres hex para os dados, mas restam apenas $3.')
      .replace(/^DE (\d+): Not enough data for LLVAR length prefix\.$/, 'DE $1: dados insuficientes para o prefixo de tamanho LLVAR.')
      .replace(/^DE (\d+): Invalid LLVAR length (.+) \(max (\d+)\)\.$/, 'DE $1: tamanho LLVAR $2 inválido (máximo $3).')
      .replace(/^DE (\d+): Not enough data for LLLVAR length prefix \(need 4 hex chars\)\.$/, 'DE $1: dados insuficientes para o prefixo LLLVAR (são necessários 4 caracteres hex).')
      .replace(/^DE (\d+): Invalid LLLVAR length (.+)\.$/, 'DE $1: tamanho LLLVAR $2 inválido.')
      .replace(/^DE (\d+): Parse error - (.+)$/, 'DE $1: erro ao interpretar os dados: $2')
      .replace(/^(\d+) unparsed hex characters remaining after field parsing\.$/, 'Restam $1 caracteres hex não interpretados após a leitura dos campos.');
  }

  displaySegmentLabel(label: string): string {
    if (label === 'Primary Bitmap') return 'Mapa de bits primário';
    if (label === 'Secondary Bitmap') return 'Mapa de bits secundário';
    if (label === 'Unparsed Data') return 'Dados não interpretados';
    return label;
  }

  responseSeverity(severity: string): string {
    return severity === 'success' ? 'success' : severity === 'warning' ? 'warning' : 'error';
  }

  binBrandLabel(value: string): string {
    return value.toUpperCase() === 'PRIVATE LABEL' ? 'Marca própria' : value;
  }

  binTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      CREDIT: 'Crédito',
      DEBIT: 'Débito',
      PREPAID: 'Pré-pago',
      CHARGE: 'Cobrança',
    };
    return labels[value.toUpperCase()] ?? value;
  }

  binCategoryLabel(value: string): string {
    const labels: Record<string, string> = {
      STANDARD: 'Padrão',
      CONSUMER: 'Pessoa física',
      BUSINESS: 'Empresarial',
      CORPORATE: 'Corporativo',
      PURCHASING: 'Compras',
    };
    return labels[value.toUpperCase()] ?? value;
  }

  async copyText(value: string, notice: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedNotice = notice;
      window.setTimeout(() => {
        if (this.copiedNotice === notice) this.copiedNotice = '';
      }, 2200);
    } catch (error) {
      console.error('Não foi possível copiar para a área de transferência.', error);
      this.copiedNotice = 'Falha ao copiar. Verifique a permissão do navegador.';
    }
  }

  async shareMessage(): Promise<void> {
    const cleaned = this.hexInput.replace(/\s/g, '');
    if (!cleaned) return;
    const url = `${window.location.origin}${window.location.pathname}#hex=${encodeURIComponent(cleaned)}`;
    await this.copyText(url, 'Link compartilhável copiado');
  }

  downloadJson(): void {
    if (!this.result) return;
    const fields: Record<string, unknown> = {};
    for (const field of this.result.fields) {
      fields[`DE${field.de}`] = {
        name: field.name,
        value: field.de === 2 ? this.maskPan(field.decodedValue) : this.displayValue(field),
        rawHex: field.rawHex,
        format: field.format,
      };
    }
    const data = {
      mti: this.result.mti?.raw,
      mtiDescription: this.mtiDescription(),
      primaryBitmap: this.result.primaryBitmap?.rawHex,
      fields,
      errors: this.result.errors.map((error) => this.displayError(error.message)),
    };
    this.downloadFile(JSON.stringify(data, null, 2), `iso8583_${this.result.mti?.raw ?? 'message'}.json`, 'application/json');
  }

  async copyDescription(): Promise<void> {
    if (!this.result) return;
    const lines = [
      'Mensagem ISO 8583',
      `MTI: ${this.result.mti?.raw ?? '????'} (${this.mtiDescription()})`,
      ...(this.result.primaryBitmap ? [`Mapa de bits: ${this.result.primaryBitmap.rawHex}`] : []),
      '---',
      ...this.result.fields.map((field) => `DE${field.de} ${field.name}: ${field.de === 2 ? this.maskPan(field.decodedValue) : this.displayValue(field)}`),
      ...(this.result.errors.length ? ['', 'Avisos:', ...this.result.errors.map((error) => `- ${this.displayError(error.message)}`)] : []),
    ];
    await this.copyText(lines.join('\n'), 'Texto copiado');
  }

  get panInfo(): BinInfo | null {
    const pan = this.result?.fields.find((field) => field.de === 2)?.decodedValue.replace(/\D/g, '');
    if (!pan) return null;
    for (const size of [8, 7, 6]) {
      const match = this.binMap.get(pan.slice(0, size));
      if (match) return match;
    }
    return null;
  }

  private decodeHexFromHash(): string {
    const match = window.location.hash.match(/^#hex=(.*)$/);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      console.error('O hash contém um hex compartilhado inválido.', error);
      return '';
    }
  }

  private async loadBinData(): Promise<void> {
    // A busca local por BIN só é feita quando a mensagem contém um PAN.
    if (this.binLoadStarted) return;
    this.binLoadStarted = true;
    this.binLoading = true;
    try {
      const response = await fetch(new URL('bin-list-data.csv', document.baseURI));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csv = await response.text();
      const rows = csv.split(/\r?\n/);
      const headers = this.parseCsvRow(rows[0] ?? '').map((value) => value.replace(/^\uFEFF/, '').trim());
      const indexes = ['BIN', 'Brand', 'Type', 'Category', 'Issuer', 'CountryName'].map((name) => headers.indexOf(name));
      if (indexes.some((index) => index < 0)) throw new Error('Cabeçalho CSV incompatível.');

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        if (!rows[rowIndex]) continue;
        const columns = this.parseCsvRow(rows[rowIndex]);
        const bin = columns[indexes[0]].trim();
        if (bin) {
          this.binMap.set(bin, {
            brand: columns[indexes[1]] || 'Desconhecida',
            type: columns[indexes[2]] || 'Desconhecido',
            category: columns[indexes[3]] || 'Desconhecida',
            issuer: columns[indexes[4]] || 'Desconhecido',
            country: columns[indexes[5]] || 'Desconhecido',
          });
        }
      }
    } catch (error) {
      console.error('Falha ao carregar a base local de BINs.', error);
      this.binError = 'Não foi possível carregar a base BIN local.';
    } finally {
      this.binLoading = false;
    }
  }

  private parseCsvRow(row: string): string[] {
    const columns: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      if (char === '"') {
        // Duas aspas dentro de um campo entre aspas representam uma aspa literal.
        if (quoted && row[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    columns.push(current.trim());
    return columns;
  }

  private parseTrack2(value: string): string {
    // A trilha 2 separa PAN, validade, código de serviço e dados adicionais por "=" ou "D".
    const match = value.match(/^([0-9]{1,19})(=|D)([0-9]{4})([0-9]{3})(.+)$/);
    if (!match) return value;
    const [, pan, , expiry, serviceCode, discretionary] = match;
    const masked = pan.length >= 8 ? `${pan.slice(0, 4)}••••${pan.slice(-4)}` : pan;
    return `PAN ${masked} · validade ${expiry.slice(2)}/${expiry.slice(0, 2)} · serviço ${serviceCode} · discricionário ${discretionary}`;
  }

  private downloadFile(content: string, filename: string, mime: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
