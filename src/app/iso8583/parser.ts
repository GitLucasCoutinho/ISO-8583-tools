// Mecanismo de leitura e decodificação de mensagens ISO 8583.
import { FIELD_SPECS, MTI_VERSION, MTI_CLASS, MTI_FUNCTION, MTI_ORIGIN, MTI_DESCRIPTIONS } from './fieldSpecs';

export interface MTIInfo {
    raw: string;
    version: { code: string; label: string };
    messageClass: { code: string; label: string };
    function: { code: string; label: string };
    origin: { code: string; label: string };
    description: string;
}

export interface TlvItem {
    tag: string;
    name: string;
    length: number;
    valueHex: string;
    value: string;
}
export interface ParsedField {
    de: number;
    name: string;
    rawHex: string;
    decodedValue: string;
    length: number;
    format: string;
    type: string;
    category: string;
    startPos: number; // Posição inicial, em caracteres hexadecimais.
    endPos: number;   // Posição final, em caracteres hexadecimais.
    description?: string;
    tlv?: TlvItem[];
}

export interface BitmapInfo {
    rawHex: string;
    binary: string;
    activeFields: number[];
    hasSecondary: boolean;
    startPos: number;
    endPos: number;
}

export interface ParseResult {
    success: boolean;
    mti: MTIInfo | null;
    primaryBitmap: BitmapInfo | null;
    secondaryBitmap: BitmapInfo | null;
    fields: ParsedField[];
    errors: ParseError[];
    hexSegments: HexSegment[];
}

export interface ParseError {
    message: string;
    position?: number;
    field?: number;
}

export interface HexSegment {
    hex: string;
    label: string;
    category: string;
    startPos: number;
    endPos: number;
    de?: number;
}

// Cada dígito hexadecimal representa exatamente quatro bits.
function hexToBinary(hex: string): string {
    return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
}

// Converte pares de dígitos hexadecimais em caracteres ASCII legíveis.
function hexToAscii(hex: string): string {
    let ascii = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code >= 32 && code <= 126) {
            ascii += String.fromCharCode(code);
        } else {
            ascii += '.';
        }
    }
    return ascii;
}

// Interpreta os quatro dígitos do MTI, aceitando as codificações BCD e ASCII.
export function decodeMTI(mtiHex: string): MTIInfo {
    // O MTI pode ocupar 2 bytes em BCD ou 4 bytes quando os dígitos estão em ASCII.
    let mtiStr = mtiHex;

    // Quatro dígitos ASCII codificados em hexadecimal ocupam oito caracteres hex.
    if (mtiHex.length >= 8) {
        const ascii = hexToAscii(mtiHex.substring(0, 8));
        if (/^\d{4}$/.test(ascii)) {
            mtiStr = ascii;
        }
    }

    // Em BCD, os quatro dígitos já aparecem diretamente como quatro caracteres hex.
    if (mtiStr.length === 4 && /^[0-9]{4}$/.test(mtiStr)) {
        // O MTI já está normalizado.
    } else if (mtiStr.length >= 4) {
        mtiStr = mtiStr.substring(0, 4);
    }

    const digits = mtiStr.split('');

    return {
        raw: mtiStr,
        version: { code: digits[0], label: MTI_VERSION[digits[0]] || 'Unknown' },
        messageClass: { code: digits[1], label: MTI_CLASS[digits[1]] || 'Unknown' },
        function: { code: digits[2], label: MTI_FUNCTION[digits[2]] || 'Unknown' },
        origin: { code: digits[3], label: MTI_ORIGIN[digits[3]] || 'Unknown' },
        description: MTI_DESCRIPTIONS[mtiStr] || `Message Type ${mtiStr}`,
    };
}

// Transforma cada bit ligado no número do campo de dados correspondente.
export function decodeBitmap(hexStr: string): { activeFields: number[]; binary: string } {
    const binary = hexToBinary(hexStr);
    const activeFields: number[] = [];

    for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') {
            activeFields.push(i + 1);
        }
    }

    return { activeFields, binary };
}

// Lê uma mensagem na ordem do protocolo: MTI, bitmaps e campos indicados por eles.
// Nomes dos elementos mais comuns dos dados do chip.
const TLV_TAGS: Record<string, string> = {
    '4F': 'AID da aplicacao',
    '50': 'Nome da aplicacao',
    '57': 'Trilha 2 equivalente',
    '5A': 'PAN',
    '5F2D': 'Idioma preferido',
    '82': 'Parametros de interface (AIP)',
    '84': 'Nome do arquivo dedicado',
    '8A': 'Codigo de resposta da autorizacao',
    '95': 'Resultado da verificacao do terminal (TVR)',
    '9F07': 'Uso permitido da aplicacao',
    '9F08': 'Versao da aplicacao',
    '9F10': 'Dados de autorizacao do emissor (IAD)',
    '9F1E': 'Numero de serie do leitor',
    '9F26': 'Criptograma da aplicacao (ARQC)',
    '9F27': 'Resultado da criptografia',
    '9F34': 'Resultado do metodo de verificacao',
    '9F36': 'Contador de transacao (ATC)',
};

// Le uma sequencia TLV: tag, tamanho e valor. Aceita tag de um ou dois bytes.
export function decodeTlv(hexStr: string): TlvItem[] {
    const items: TlvItem[] = [];
    let pos = 0;

    while (pos + 4 <= hexStr.length) {
        const primeiroByte = parseInt(hexStr.substring(pos, pos + 2), 16);
        // Tag de dois bytes tem os bits 5 e 6 do primeiro byte ligados.
        const doisBytes = (primeiroByte & 0x1f) === 0x1f;
        const tagHex = hexStr.substring(pos, pos + (doisBytes ? 4 : 2));
        pos += doisBytes ? 4 : 2;

        if (pos + 2 > hexStr.length) {
            break;
        }

        const tamanho = parseInt(hexStr.substring(pos, pos + 2), 16);
        pos += 2;

        if (pos + tamanho * 2 > hexStr.length) {
            break;
        }

        const valueHex = hexStr.substring(pos, pos + tamanho * 2).toUpperCase();
        pos += tamanho * 2;

        items.push({
            tag: tagHex,
            name: TLV_TAGS[tagHex] || 'Elemento nao catalogado',
            length: tamanho,
            valueHex,
            value: tamanho <= 8 ? valueHex : `${tamanho} bytes`,
        });
    }

    return items;
}
export function parseISO8583(inputHex: string): ParseResult {
    const errors: ParseError[] = [];
    const fields: ParsedField[] = [];
    const hexSegments: HexSegment[] = [];

    // Espaços e quebras de linha não fazem parte do conteúdo hexadecimal da mensagem.
    const hex = inputHex.replace(/[\s\n\r]/g, '').toUpperCase();

    if (!hex || hex.length < 4) {
        return {
            success: false,
            mti: null,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields: [],
            errors: [{ message: 'Input too short. Minimum 4 characters for MTI.' }],
            hexSegments: [],
        };
    }

    // Recuse caracteres inválidos antes de tentar interpretar os campos.
    if (!/^[0-9A-F]+$/i.test(hex)) {
        return {
            success: false,
            mti: null,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields: [],
            errors: [{ message: 'Invalid characters detected. Only hex characters (0-9, A-F) are allowed.' }],
            hexSegments: [],
        };
    }

    let pos = 0;

    // 1. O MTI ocupa os primeiros dois bytes (quatro caracteres hex em BCD).
    const mtiHex = hex.substring(pos, pos + 4);
    const mti = decodeMTI(mtiHex);
    hexSegments.push({
        hex: mtiHex,
        label: `MTI: ${mti.raw}`,
        category: 'mti',
        startPos: pos,
        endPos: pos + 4,
    });
    pos += 4;

    if (pos + 16 > hex.length) {
        return {
            success: true,
            mti,
            primaryBitmap: null,
            secondaryBitmap: null,
            fields,
            errors: [{ message: 'Hex too short for primary bitmap (need 16 more hex chars / 8 bytes).', position: pos }],
            hexSegments,
        };
    }

    // 2. O bitmap primário tem 8 bytes; cada bit aponta a presença de um campo.
    const primaryBitmapHex = hex.substring(pos, pos + 16);
    const primaryDecoded = decodeBitmap(primaryBitmapHex);
    const primaryBitmap: BitmapInfo = {
        rawHex: primaryBitmapHex,
        binary: primaryDecoded.binary,
        activeFields: primaryDecoded.activeFields.filter(f => f >= 2 && f <= 64),
        hasSecondary: primaryDecoded.binary[0] === '1',
        startPos: pos,
        endPos: pos + 16,
    };
    hexSegments.push({
        hex: primaryBitmapHex,
        label: 'Primary Bitmap',
        category: 'bitmap',
        startPos: pos,
        endPos: pos + 16,
    });
    pos += 16;

    // 3. O primeiro bit do bitmap primário indica se há mais 64 campos no secundário.
    let secondaryBitmap: BitmapInfo | null = null;
    let allActiveFields = [...primaryBitmap.activeFields];

    if (primaryBitmap.hasSecondary) {
        if (pos + 16 > hex.length) {
            errors.push({ message: 'Bit 1 indicates secondary bitmap but hex is too short.', position: pos });
        } else {
            const secondaryBitmapHex = hex.substring(pos, pos + 16);
            const secondaryDecoded = decodeBitmap(secondaryBitmapHex);
            secondaryBitmap = {
                rawHex: secondaryBitmapHex,
                binary: secondaryDecoded.binary,
                activeFields: secondaryDecoded.activeFields.map(f => f + 64),
                hasSecondary: false,
                startPos: pos,
                endPos: pos + 16,
            };
            hexSegments.push({
                hex: secondaryBitmapHex,
                label: 'Secondary Bitmap',
                category: 'bitmap',
                startPos: pos,
                endPos: pos + 16,
            });
            allActiveFields = [...allActiveFields, ...secondaryBitmap.activeFields];
            pos += 16;
        }
    }

    // 4. Os campos são lidos em ordem crescente, conforme os bits ativos dos bitmaps.
    for (const fieldNum of allActiveFields) {
        const spec = FIELD_SPECS[fieldNum];

        if (!spec) {
            // Sem especificação do campo, não é seguro adivinhar seu tamanho.
            errors.push({ message: `No spec for DE ${fieldNum}. Skipping.`, field: fieldNum });
            continue;
        }

        if (pos >= hex.length) {
            errors.push({ message: `Ran out of data at DE ${fieldNum}.`, position: pos, field: fieldNum });
            break;
        }

        const fieldStartPos = pos;
        let fieldHex = '';
        let fieldValue = '';
        let fieldLength = 0;

        try {
            if (spec.format === 'FIXED') {
                // Campos FIXED dispensam prefixo; o tamanho vem da especificação do campo.
                let hexLen: number;
                if (spec.type === 'b') {
                    hexLen = spec.maxLength * 2; // Dados binários: maxLength é medido em bytes.
                } else if (spec.type === 'n' || spec.type === 'x+n') {
                    // Números em BCD ocupam dois dígitos por byte.
                    hexLen = spec.maxLength;
                    // Para quantidade ímpar de dígitos, há um nibble de preenchimento.
                    if (spec.maxLength % 2 !== 0) {
                        hexLen = spec.maxLength + 1; // Ajusta a leitura para um número par de nibbles.
                    }
                } else {
                    // AN/ANS/Z: cada caractere ocupa um byte.
                    hexLen = spec.maxLength * 2;
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = hexLen / 2;

                // BCD e binário permanecem em hexadecimal; os demais tipos são convertidos em texto.
                if (spec.type === 'n' || spec.type === 'x+n') {
                    fieldValue = fieldHex;
                } else if (spec.type === 'b') {
                    fieldValue = fieldHex;
                } else {
                    fieldValue = hexToAscii(fieldHex);
                }

            } else if (spec.format === 'LLVAR') {
                // LLVAR começa com um byte BCD que informa a quantidade de caracteres.
                if (pos + 2 > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Not enough data for LLVAR length prefix.`, position: pos, field: fieldNum });
                    break;
                }
                const lenStr = hex.substring(pos, pos + 2);
                const dataLen = parseInt(lenStr, 10);
                pos += 2;

                if (isNaN(dataLen) || dataLen < 0 || dataLen > spec.maxLength) {
                    errors.push({ message: `DE ${fieldNum}: Invalid LLVAR length ${lenStr} (max ${spec.maxLength}).`, position: pos - 2, field: fieldNum });
                    continue;
                }

                // Números são compactados em BCD; binário e texto ocupam dois caracteres hex por byte.
                let hexLen: number;
                if (spec.type === 'n') {
                    hexLen = dataLen % 2 === 0 ? dataLen : dataLen + 1;
                } else {
                    hexLen = dataLen * 2;
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars for data but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = lenStr + hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = lenStr + hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = dataLen;

                if (spec.type === 'n' || spec.type === 'b') {
                    fieldValue = hex.substring(pos - hexLen, pos);
                } else {
                    fieldValue = hexToAscii(hex.substring(pos - hexLen, pos));
                }

            } else if (spec.format === 'LLLVAR') {
                // LLLVAR usa dois bytes BCD (quatro caracteres hex) para informar até três dígitos de tamanho.
                if (pos + 4 > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Not enough data for LLLVAR length prefix (need 4 hex chars).`, position: pos, field: fieldNum });
                    break;
                }
                const lenStr = hex.substring(pos, pos + 4);
                const dataLen = parseInt(lenStr, 10);
                pos += 4;

                if (isNaN(dataLen) || dataLen < 0 || dataLen > spec.maxLength) {
                    errors.push({ message: `DE ${fieldNum}: Invalid LLLVAR length ${lenStr}.`, position: pos - 4, field: fieldNum });
                    continue;
                }

                let hexLen: number;
                if (spec.type === 'n') {
                    hexLen = dataLen % 2 === 0 ? dataLen : dataLen + 1;
                } else {
                    hexLen = dataLen * 2;
                }

                if (pos + hexLen > hex.length) {
                    errors.push({ message: `DE ${fieldNum}: Expected ${hexLen} hex chars for data but only ${hex.length - pos} remain.`, position: pos, field: fieldNum });
                    fieldHex = lenStr + hex.substring(pos);
                    pos = hex.length;
                } else {
                    fieldHex = lenStr + hex.substring(pos, pos + hexLen);
                    pos += hexLen;
                }
                fieldLength = dataLen;

                if (spec.type === 'n' || spec.type === 'b') {
                    fieldValue = hex.substring(pos - hexLen, pos);
                } else {
                    fieldValue = hexToAscii(hex.substring(pos - hexLen, pos));
                }
            }
        } catch (e) {
            errors.push({ message: `DE ${fieldNum}: Parse error - ${(e as Error).message}`, position: pos, field: fieldNum });
            continue;
        }

        fields.push({
            de: fieldNum,
            name: spec.name,
            rawHex: fieldHex,
            decodedValue: fieldValue,
            length: fieldLength,
            format: spec.format,
            type: spec.type,
            category: spec.category,
            startPos: fieldStartPos,
            endPos: pos,
            description: spec.description,
            tlv: fieldNum === 55 && spec.format === 'LLLVAR' ? decodeTlv(fieldValue) : undefined,
        });

        hexSegments.push({
            hex: fieldHex,
            label: `DE ${fieldNum}: ${spec.name}`,
            category: spec.category,
            startPos: fieldStartPos,
            endPos: pos,
            de: fieldNum,
        });
    }

    // Qualquer dado após o último campo ativo é sinalizado para inspeção.
    if (pos < hex.length) {
        const remaining = hex.substring(pos);
        errors.push({ message: `${remaining.length} unparsed hex characters remaining after field parsing.`, position: pos });
        hexSegments.push({
            hex: remaining,
            label: 'Unparsed Data',
            category: 'error',
            startPos: pos,
            endPos: hex.length,
        });
    }

    return {
        success: errors.filter(e => !e.message.includes('No spec') && !e.message.includes('unparsed')).length === 0,
        mti,
        primaryBitmap,
        secondaryBitmap,
        fields,
        errors,
        hexSegments,
    };
}
