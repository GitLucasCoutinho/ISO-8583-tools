// Exemplos de mensagens ISO 8583 prontas para carregar na interface.
// Cada mensagem é montada em hexadecimal a partir de valores legíveis, para que
// qualquer campo possa ser conferido na tela.

export interface PresetMessage {
    id: string;
    name: string;
    mti: string;
    scenario: string;
    description: string;
    hex: string;
    highlights: string[];
}

// ─── Convenções de montagem ───────────────────────────────────────
//
// 1. Campos numéricos (tipo "n") usam BCD: dois dígitos por byte.
//    Quando a quantidade de dígitos é ímpar, completa-se com zero à esquerda,
//    o que acrescenta meio byte. Por isso o resultado sempre tem tamanho par
//    em caracteres hex.
//
// 2. Campos alfanuméricos (tipo "a") usam ASCII: um caractere por byte.
//    O tamanho é fixo e precisa ser respeitado, senão todos os campos
//    seguintes saem deslocados.
//
// 3. Campos variáveis (LLVAR) levam 2 dígitos decimais de tamanho antes do
//    valor. Os dois dígitos são escritos como caracteres, não em BCD, que é
//    a convenção usada pelo decodificador deste projeto.
//
// 4. Tamanhos LLLVAR (3 dígitos em BCD) não são usados nestes exemplos,
//    porque o decodificador ainda não trata esse caso. É o que impede
//    incluir DE 55 (dados do chip) por enquanto.

const hex2 = (n: number): string => n.toString(16).padStart(2, '0').toUpperCase();

// Monta o bitmap primário a partir da lista de DEs presentes.
function buildBitmap(fields: number[]): string {
    const bytes = new Uint8Array(8);
    for (const de of fields) {
        if (de < 1 || de > 64) {
            throw new Error(`DE ${de} não cabe no bitmap primário`);
        }
        bytes[(de - 1) >> 3] |= 0x80 >> ((de - 1) & 7);
    }
    return Array.from(bytes).map(hex2).join('');
}

// Bitmap duplo, para mensagens que precisam de DE acima de 64.
function buildDualBitmap(fields: number[]): string {
    const primarios = fields.filter((de) => de <= 64);
    const secundarios = fields.filter((de) => de > 64);

    if (secundarios.length === 0) {
        return buildBitmap(primarios);
    }

    // Bit 1 do bitmap primário avisa que existe um segundo bitmap.
    if (!primarios.includes(1)) {
        primarios.push(1);
    }

    const bytes = new Uint8Array(8);
    for (const de of secundarios) {
        if (de > 128) {
            throw new Error(`DE ${de} não cabe no bitmap secundário`);
        }
        bytes[(de - 65) >> 3] |= 0x80 >> ((de - 65) & 7);
    }

    return buildBitmap(primarios) + Array.from(bytes).map(hex2).join('');
}

// Numérico em BCD, com zero de preenchimento quando o tamanho é ímpar.
function bcd(value: string, size: number): string {
    if (value.length > size) {
        throw new Error(`Valor "${value}" excede o tamanho ${size} do campo numérico`);
    }
    const cheio = value.padStart(size, '0');
    return size % 2 === 0 ? cheio : '0' + cheio;
}

// Alfanumérico em ASCII, preenchido com espaços à direita até o tamanho do campo.
// O preenchimento é obrigatório: campo de tamanho fixo com menos caracteres
// desloca todos os campos seguintes da mensagem.
function ans(value: string, size: number): string {
    if (value.length > size) {
        throw new Error(`Campo alfanumérico de ${size} caracteres recebeu ${value.length}: "${value}"`);
    }
    return Array.from(value.padEnd(size, ' '))
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// PAN em LLVAR. O prefixo de tamanho é a quantidade de dígitos do cartão,
// e não a quantidade de bytes: 16 dígitos viram "16" seguido de 8 bytes em BCD.
function pan(numero: string): string {
    if (numero.length > 19) {
        throw new Error(`PAN com ${numero.length} dígitos excede o limite de 19`);
    }
    return String(numero.length).padStart(2, '0') + bcd(numero, numero.length);
}

// Dados binarios em LLLVAR. O prefixo tem 3 digitos decimais em BCD, o que ocupa
// 2 bytes, ou seja, 4 caracteres hex. Exemplo: 48 bytes viram "0048".
function lllvarBin(hexBody: string): string {
    const bytes = hexBody.length / 2;
    if (bytes > 999) {
        throw new Error(`Campo LLLVAR com ${bytes} bytes excede o limite de 999`);
    }
    return bcd(String(bytes).padStart(3, '0'), 4) + hexBody.toUpperCase();
}

// Sequencia TLV: tag, tamanho em um byte e valor.
function tlv(tags: Array<[string, string]>): string {
    return tags
        .map(([tag, valor]) => tag + hex2(valor.length / 2) + valor.toUpperCase())
        .join('');
}

// ─── Mensagens ────────────────────────────────────────────────────

// 1. Compra presencial no débito, por aproximação, em uma padaria de São Paulo.
function buildDebitContactless(): string {
    const mti = '0100';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 41, 42, 43, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4024007123456781') +
        bcd('000000', 6) +
        bcd('000000001890', 12) +
        bcd('1122143500', 10) +
        bcd('204417', 6) +
        bcd('143500', 6) +
        bcd('1122', 4) +
        bcd('2906', 4) +
        bcd('5499', 4) +
        bcd('071', 3) +
        bcd('00', 2) +
        ans('PDV01122', 8) +
        ans('PADARIASAOJORGE', 15) +
        ans('PADARIA SAO JORGE  PINHEIROS  SAO PA', 40) +
        bcd('986', 3)
    );
}

// 2. Resposta do emissor aprovando aquela compra.
function buildDebitApproved(): string {
    const mti = '0110';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 38, 39, 41, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4024007123456781') +
        bcd('000000', 6) +
        bcd('000000001890', 12) +
        bcd('1122143501', 10) +
        bcd('204417', 6) +
        bcd('143501', 6) +
        bcd('1122', 4) +
        ans('000000024417', 12) +
        ans('A7K2M1', 6) +
        ans('00', 2) +
        ans('PDV01122', 8) +
        bcd('986', 3)
    );
}

// 3. Resposta negando por saldo insuficiente.
function buildDebitDeclined(): string {
    const mti = '0110';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 38, 39, 41, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4024007123456781') +
        bcd('000000', 6) +
        bcd('000000001890', 12) +
        bcd('1122143800', 10) +
        bcd('204418', 6) +
        bcd('143800', 6) +
        bcd('1122', 4) +
        ans('000000024418', 12) +
        ans('      ', 6) +
        ans('51', 2) +
        ans('PDV01122', 8) +
        bcd('986', 3)
    );
}

// 4. Resposta negando por senha inválida, com o campo de erro do portador.
function buildPinRetry(): string {
    const mti = '0110';
    const fields = [2, 3, 4, 7, 11, 12, 13, 22, 37, 39, 41, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4024007123456781') +
        bcd('000000', 6) +
        bcd('000000001890', 12) +
        bcd('1122150200', 10) +
        bcd('204419', 6) +
        bcd('150200', 6) +
        bcd('1122', 4) +
        bcd('051', 3) +
        ans('000000024419', 12) +
        ans('55', 2) +
        ans('PDV01122', 8) +
        bcd('986', 3)
    );
}

// 5. Pré-autorização de hotel: reserva o valor de duas diárias.
function buildHotelPreAuth(): string {
    const mti = '0100';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 37, 41, 42, 43, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4111111111111111') +
        bcd('000000', 6) +
        bcd('000000148000', 12) +
        bcd('1122194000', 10) +
        bcd('310055', 6) +
        bcd('194000', 6) +
        bcd('1122', 4) +
        bcd('3012', 4) +
        bcd('7011', 4) +
        bcd('051', 3) +
        bcd('00', 2) +
        ans('000000004455', 12) +
        ans('HTLPOS01', 8) +
        ans('HOTELCOSTANEIRA', 15) +
        ans('HOTEL COSTANEIRA   FLORIANOPOLIS SC', 40) +
        bcd('986', 3)
    );
}

// 6. Captura da pré-autorização no check-out, com o mesmo STAN e o mesmo valor.
function buildHotelCapture(): string {
    const mti = '0220';
    const fields = [2, 3, 4, 7, 11, 12, 13, 22, 25, 38, 39, 41, 42, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4111111111111111') +
        bcd('000000', 6) +
        bcd('000000148000', 12) +
        bcd('1123110500', 10) +
        bcd('310055', 6) +
        bcd('110500', 6) +
        bcd('1123', 4) +
        bcd('051', 3) +
        bcd('06', 2) +
        ans('HT7890', 6) +
        ans('00', 2) +
        ans('HTLPOS01', 8) +
        ans('HOTELCOSTANEIRA', 15) +
        bcd('986', 3)
    );
}

// 7. Voucher de refeição em arranjo fechado: aceito apenas na rede credenciada.
function buildVoucherMeal(): string {
    const mti = '0100';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 41, 42, 43, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('6062822026071117') +
        bcd('000000', 6) +
        bcd('000000004280', 12) +
        bcd('1122121510', 10) +
        bcd('771204', 6) +
        bcd('121510', 6) +
        bcd('1122', 4) +
        bcd('2709', 4) +
        bcd('5812', 4) +
        bcd('071', 3) +
        bcd('00', 2) +
        ans('REFEI001', 8) +
        ans('CANTINADOCENTRO', 15) +
        ans('CANTINA DO CENTRO  CENTRO  CURITIBA', 40) +
        bcd('986', 3)
    );
}

// 8. Reversão por timeout: o terminal não recebeu resposta e desfaz a reserva.
function buildTimeoutReversal(): string {
    const mti = '0420';
    const fields = [2, 3, 4, 7, 11, 12, 13, 37, 39, 41, 42, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('5555666677778884') +
        bcd('000000', 6) +
        bcd('000000007350', 12) +
        bcd('1122201500', 10) +
        bcd('882310', 6) +
        bcd('201500', 6) +
        bcd('1122', 4) +
        ans('000000008823', 12) +
        ans('00', 2) +
        ans('POS99002', 8) +
        ans('POSTOSERRAAZUL', 15) +
        bcd('986', 3)
    );
}

// 9. Compra em e-commerce brasileiro: autorização e captura na mesma mensagem.
function buildEcommercePurchase(): string {
    const mti = '0200';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 41, 42, 43, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4556737586899855') +
        bcd('000000', 6) +
        bcd('000000034990', 12) +
        bcd('1122210312', 10) +
        bcd('551102', 6) +
        bcd('210312', 6) +
        bcd('1122', 4) +
        bcd('2808', 4) +
        bcd('5732', 4) +
        bcd('091', 3) +
        bcd('08', 2) +
        ans('ECOM0001', 8) +
        ans('LOJAVIRTUALBR1', 15) +
        ans('LOJA VIRTUAL BR   SAO PAULO     SP', 40) +
        bcd('986', 3)
    );
}

// 10. Devolução de mercadoria: transação financeira nova, com código 20.
function buildRefund(): string {
    const mti = '0200';
    const fields = [2, 3, 4, 7, 11, 12, 13, 22, 25, 37, 41, 42, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4556737586899855') +
        bcd('200000', 6) +
        bcd('000000034990', 12) +
        bcd('1124142000', 10) +
        bcd('553311', 6) +
        bcd('142000', 6) +
        bcd('1124', 4) +
        bcd('051', 3) +
        bcd('00', 2) +
        ans('000000055110', 12) +
        ans('ECOM0001', 8) +
        ans('LOJAVIRTUALBR1', 15) +
        bcd('986', 3)
    );
}

// 11. Consulta de saldo em caixa eletrônico de rede compartilhada.
function buildBalanceInquiry(): string {
    const mti = '0100';
    const fields = [2, 3, 7, 11, 12, 13, 14, 22, 25, 41, 42, 43, 49];

    return (
        mti +
        buildBitmap(fields) +
        pan('4024007112345672') +
        bcd('310000', 6) +
        bcd('1123172200', 10) +
        bcd('660021', 6) +
        bcd('172200', 6) +
        bcd('1123', 4) +
        bcd('2911', 4) +
        bcd('051', 3) +
        bcd('00', 2) +
        ans('ATM00024', 8) +
        ans('REDE24HORAS0001', 15) +
        ans('TERMINAL 24H  AV PAULISTA  SAO PAULO', 40) +
        bcd('986', 3)
    );
}

// 12. Echo de rede: teste de vida antes de liberar o terminal.
function buildNetworkEcho(): string {
    const mti = '0800';
    const fields = [7, 11, 70];

    return mti + buildDualBitmap(fields) + bcd('1123055900', 10) + bcd('000001', 6) + bcd('301', 3);
}

// 13. Sign-on do terminal na rede do adquirente.
function buildSignOn(): string {
    const mti = '0800';
    const fields = [7, 11, 70];

    return mti + buildDualBitmap(fields) + bcd('1123060100', 10) + bcd('000002', 6) + bcd('001', 3);
}

// 14. Fechamento de lote do dia na conciliação.
function buildBatchSettlement(): string {
    const mti = '0500';
    const fields = [7, 11, 12, 13, 41, 42, 49, 70];

    return (
        mti +
        buildDualBitmap(fields) +
        bcd('1123235959', 10) +
        bcd('999999', 6) +
        bcd('235959', 6) +
        bcd('1123', 4) +
        ans('PDV01122', 8) +
        ans('PADARIASAOJORGE', 15) +
        bcd('986', 3) +
        bcd('161', 3)
    );
}

// 15. Pre-autorizacao com cartao de chip: o DE 55 leva ARQC, TVR e AIP.
function buildChipPreAuth(): string {
    const mti = '0100';
    const fields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 37, 41, 42, 43, 49, 55];

    const icc = tlv([
        ['9F26', '2A7B19C4D5E6F708'],   // ARQC gerado pelo cartao
        ['9F27', '80'],                 // resultado: ARQC
        ['9F10', '06010A03A0000000'],   // dados de autorizacao do emissor
        ['9F36', '0021'],               // contador de transacao
        ['95', '0080040000'],           // resultado da verificacao do terminal
        ['82', '1980'],                 // parametros de interface
        ['9F34', '1F0200'],             // resultado do metodo de verificacao
    ]);

    return (
        mti +
        buildBitmap(fields) +
        pan('4111111111111111') +
        bcd('000000', 6) +
        bcd('000000148000', 12) +
        bcd('1122194000', 10) +
        bcd('310055', 6) +
        bcd('194000', 6) +
        bcd('1122', 4) +
        bcd('3012', 4) +
        bcd('7011', 4) +
        bcd('051', 3) +
        bcd('00', 2) +
        ans('000000004455', 12) +
        ans('HTLPOS01', 8) +
        ans('HOTELCOSTANEIRA', 15) +
        ans('HOTEL COSTANEIRA   FLORIANOPOLIS SC', 40) +
        bcd('986', 3) +
        lllvarBin(icc)
    );
}

// ─── Lista de mensagens ───────────────────────────────────────────

export const PRESET_MESSAGES: PresetMessage[] = [
    {
        id: 'debito-aproximacao',
        name: '☕ Débito por aproximação na padaria',
        mti: '0100',
        scenario:
            'O cliente encosta o cartão de débito na maquininha para pagar R$ 18,90 em uma padaria de Pinheiros. O terminal pergunta ao emissor se o cartão pode gastar esse valor. A moeda é 986 (real), e o MCC 5499 identifica padarias e confeitarias.',
        description: 'Solicitação de autorização presencial, cartão de débito, entrada por aproximação',
        hex: buildDebitContactless(),
        highlights: ['DE4 (valor: R$ 18,90)', 'DE22 (entrada 071 = contactless)', 'DE18 (MCC 5499 = padaria)'],
    },
    {
        id: 'debito-aprovado',
        name: '✅ Débito aprovado',
        mti: '0110',
        scenario:
            'O emissor, que é o banco onde o portador tem conta, responde aprovando. O DE 39 vem com 00, que na tabela de códigos de resposta significa "aprovada". O DE 38 traz o código de autorização que o lojista imprime no comprovante.',
        description: 'Resposta de autorização aprovada, com código de autorização',
        hex: buildDebitApproved(),
        highlights: ['DE39 (00 = aprovada)', 'DE38 (código de autorização A7K2M1)', 'DE37 (RRN para conciliação)'],
    },
    {
        id: 'debito-negado-saldo',
        name: '❌ Negada por saldo insuficiente',
        mti: '0110',
        scenario:
            'O emissor nega porque a conta não tem o valor disponível. O DE 39 vem com 51, e o DE 38 vem em branco, porque não existe código de autorização quando a transação é negada.',
        description: 'Resposta de autorização negada, código 51',
        hex: buildDebitDeclined(),
        highlights: ['DE39 (51 = saldo insuficiente)', 'DE38 vazio (sem autorização)', 'nenhum valor é reservado'],
    },
    {
        id: 'senha-invalida',
        name: '🔒 Negada por senha inválida',
        mti: '0110',
        scenario:
            'O portador digitou a senha errada. O código 55 indica senha inválida, e o portador tem um número limitado de tentativas antes de o cartão ser bloqueado por segurança.',
        description: 'Resposta de autorização negada, código 55',
        hex: buildPinRetry(),
        highlights: ['DE39 (55 = senha inválida)', 'DE22 (entrada com senha)', 'contagem de tentativas no emissor'],
    },
    {
        id: 'pre-autorizacao-hotel',
        name: '🏨 Pré-autorização de hotel',
        mti: '0100',
        scenario:
            'Na chegada, o hotel reserva R$ 1.480,00 referentes a duas diárias. Não é cobrança ainda: é uma reserva, que reduz o limite disponível do cartão até o check-out. O MCC 7011 identifica hotéis.',
        description: 'Solicitação de autorização para reserva de valor, sem captura',
        hex: buildHotelPreAuth(),
        highlights: ['DE4 (reserva de R$ 1.480,00)', 'DE18 (MCC 7011 = hotel)', 'DE37 (RRN que amarra a captura)'],
    },
    {
        id: 'captura-hotel',
        name: '🧾 Captura da pré-autorização no check-out',
        mti: '0220',
        scenario:
            'No check-out, o hotel conclui a reserva. O DE 25 igual a 06 avisa que esta mensagem fecha uma pré-autorização, e não é uma compra nova. O STAN é o mesmo da reserva, o que permite ao emissor casar as duas mensagens.',
        description: 'Aviso financeiro de conclusão de pré-autorização',
        hex: buildHotelCapture(),
        highlights: ['MTI 0220 (conclusão)', 'DE25 = 06 (pré-autorizada)', 'STAN idêntico ao da reserva'],
    },
    {
        id: 'chip-preauth',
        name: '💳 Pré-autorização com cartão de chip (DE 55)',
        mti: '0100',
        scenario:
            'A mesma reserva de hotel, agora com o cartão inserido no chip. O cartão gera um criptograma sobre os dados da transação, o ARQC, e o envia no DE 55. O emissor só aprova se conseguir validar esse criptograma, o que impede a mensagem de ser copiada e reapresentada.',
        description: 'Autorização com dados do chip em TLV: ARQC, TVR e AIP',
        hex: buildChipPreAuth(),
        highlights: ['DE55 (TLV com 7 elementos)', '9F26 (ARQC)', '95 (TVR)', '82 (AIP)'],
    },
    {
        id: 'voucher-refeicao',
        name: '🎫 Voucher de refeição em arranjo fechado',
        mti: '0100',
        scenario:
            'O cliente paga o almoço com voucher de refeição. Esse cartão só funciona na rede credenciada, porque pertence a um arranjo fechado, e não a uma bandeira aberta: é o caso do Sodexo, da Alelo e do VR. A autorização consulta o saldo do benefício, não o limite de crédito.',
        description: 'Autorização em arranjo fechado, consulta de saldo de benefício',
        hex: buildVoucherMeal(),
        highlights: ['arranjo fechado (private label)', 'DE4 (R$ 42,80 do benefício)', 'DE18 (MCC 5812 = restaurante)'],
    },
    {
        id: 'reversao-timeout',
        name: '↩️ Reversão por timeout',
        mti: '0420',
        scenario:
            'O posto abasteceu e o terminal não recebeu a resposta no prazo. Ficou a dúvida: o valor foi reservado? Para não arriscar cobrança em duplicidade, o terminal desfaz a transação com uma reversão.',
        description: 'Aviso de reversão: desfaz transação sem resposta',
        hex: buildTimeoutReversal(),
        highlights: ['MTI 0420 (reversão)', 'DE37 (RRN da transação original)', 'DE4 (R$ 73,50 desfeitos)'],
    },
    {
        id: 'ecommerce-compra',
        name: '🛒 Compra em loja virtual brasileira',
        mti: '0200',
        scenario:
            'A compra no site é autorizada e capturada na mesma mensagem. O DE 22 igual a 091 indica comércio eletrônico, e o DE 25 igual a 08 indica pedido remoto, sem cartão presente.',
        description: 'Transação financeira de e-commerce, autorização e captura juntas',
        hex: buildEcommercePurchase(),
        highlights: ['MTI 0200 (financeira)', 'DE22 (091 = e-commerce)', 'DE25 (08 = pedido remoto)'],
    },
    {
        id: 'devolucao',
        name: '💸 Devolução de mercadoria',
        mti: '0200',
        scenario:
            'O cliente devolveu o produto e recebe o valor de volta. Aqui é uma transação nova, com código de processamento 20, e o DE 37 traz o RRN da compra original para o emissor localizar o lançamento.',
        description: 'Transação financeira de devolução, código de processamento 20',
        hex: buildRefund(),
        highlights: ['DE3 (20 = devolução)', 'DE37 (RRN da compra original)', 'DE4 (R$ 349,90 devolvidos)'],
    },
    {
        id: 'consulta-saldo',
        name: '🏧 Consulta de saldo em caixa eletrônico',
        mti: '0100',
        scenario:
            'O portador consulta o saldo em um terminal de rede compartilhada. O código de processamento 30 diz ao emissor que não há cobrança, apenas informação. Por isso a mensagem não leva campo de valor.',
        description: 'Solicitação de autorização sem valor, apenas consulta',
        hex: buildBalanceInquiry(),
        highlights: ['DE3 (30 = consulta de saldo)', 'sem DE4 (nada é cobrado)', 'rede compartilhada de ATMs'],
    },
    {
        id: 'echo-rede',
        name: '📡 Echo de rede',
        mti: '0800',
        scenario:
            'Antes de liberar as transações, o terminal verifica se a rede está viva. O DE 70 igual a 301 é o teste de eco: o sistema responde confirmando que está no ar.',
        description: 'Gerenciamento de rede: teste de eco',
        hex: buildNetworkEcho(),
        highlights: ['MTI 0800 (gerenciamento de rede)', 'DE70 (301 = teste de eco)', 'DE70 fica no bitmap secundário'],
    },
    {
        id: 'sign-on',
        name: '🔑 Sign-on do terminal',
        mti: '0800',
        scenario:
            'Toda manhã a maquininha se apresenta à rede do adquirente antes de processar qualquer venda. O DE 70 igual a 001 é a entrada na rede, e a resposta traz as chaves usadas para proteger a transação.',
        description: 'Gerenciamento de rede: entrada do terminal na rede',
        hex: buildSignOn(),
        highlights: ['MTI 0800', 'DE70 (001 = sign-on)', 'troca de chaves na resposta'],
    },
    {
        id: 'fechamento-lote',
        name: '📊 Fechamento de lote do dia',
        mti: '0500',
        scenario:
            'Às 23h59 a maquininha fecha o lote, mandando a conciliação do dia. O sistema central compara os totais do terminal com os registros dele. Se bater, a liquidação segue; se não bater, pede conciliação detalhada.',
        description: 'Solicitação de conciliação: fechamento do lote diário',
        hex: buildBatchSettlement(),
        highlights: ['MTI 0500 (conciliação)', 'DE70 (161 = fechamento de lote)', 'total do dia é conferido antes de liquidar'],
    },
];

// ─── Cenários guiados ─────────────────────────────────────────────

export interface LearningScenario {
    id: string;
    title: string;
    icon: string;
    description: string;
    steps: string[];
    presetId: string;
}

export const LEARNING_SCENARIOS: LearningScenario[] = [
    {
        id: 'padaria',
        title: 'Café da manhã pago por aproximação',
        icon: '☕',
        description: 'Uma compra de R$ 18,90 no débito, do encostar do cartão até o comprovante impresso.',
        steps: [
            'O cliente encosta o cartão. O terminal faz a leitura por NFC e monta a mensagem 0100.',
            'O DE 22 igual a 071 registra que a entrada foi por aproximação, sem inserir o cartão.',
            'O adquirente encaminha a mensagem à bandeira, que a leva ao emissor.',
            'O emissor confere saldo, bloqueia o valor e responde 0110 com DE 39 igual a 00.',
            'O terminal mostra "Aprovada" e imprime o comprovante com o código de autorização.',
        ],
        presetId: 'debito-aproximacao',
    },
    {
        id: 'recusa',
        title: 'Cartão recusado no caixa',
        icon: '🚫',
        description: 'O que acontece quando o saldo não cobre a compra, e por que nenhum valor é reservado.',
        steps: [
            'O fluxo começa igual ao da aprovação: a mensagem 0100 vai ao emissor.',
            'O emissor verifica o saldo e encontra menos que os R$ 18,90 solicitados.',
            'A resposta vem com 0110 e DE 39 igual a 51, saldo insuficiente.',
            'O terminal mostra "Recusada" e nada é reservado no cartão.',
            'O lojista pode pedir outro meio de pagamento sem risco de cobrança dupla.',
        ],
        presetId: 'debito-negado-saldo',
    },
    {
        id: 'senha',
        title: 'Senha digitada errada',
        icon: '🔒',
        description: 'A diferença entre um cartão sem saldo e um cartão com senha errada, e o risco de bloqueio.',
        steps: [
            'O portador digita a senha no terminal, e o dado vai cifrado em campo próprio.',
            'O emissor compara a senha e responde com DE 39 igual a 55.',
            'Cada erro conta. Depois de algumas tentativas, o cartão é bloqueado por segurança.',
            'O valor não é reservado, então o portador não fica com limite comprometido.',
        ],
        presetId: 'senha-invalida',
    },
    {
        id: 'hotel',
        title: 'Check-in e check-out de hotel',
        icon: '🏨',
        description: 'Como uma reserva de valor vira cobrança só no fim da estadia, sem cobrar duas vezes.',
        steps: [
            'Na chegada, o hotel manda 0100 e reserva R$ 1.480,00, sem cobrar.',
            'O limite do portador fica reduzido enquanto a reserva está aberta.',
            'No check-out, o hotel manda 0220 com DE 25 igual a 06, indicando conclusão de pré-autorização.',
            'O STAN repetido permite ao emissor casar a reserva com a captura.',
            'O emissor libera a reserva e lança a cobrança definitiva, uma única vez.',
        ],
        presetId: 'pre-autorizacao-hotel',
    },
    {
        id: 'voucher',
        title: 'Almoço pago com voucher de refeição',
        icon: '🎫',
        description: 'Um arranjo fechado dentro de um mundo de bandeiras abertas.',
        steps: [
            'O portador usa o voucher, que só é aceito na rede credenciada do arranjo.',
            'A mensagem 0100 segue o mesmo padrão ISO 8583, mas o layout é do arranjo.',
            'A autorização consulta o saldo do benefício, não o limite de crédito.',
            'O MCC do restaurante define se o estabelecimento aceita aquele tipo de benefício.',
            'A liquidação acontece entre o arranjo e a rede credenciada, fora da bandeira.',
        ],
        presetId: 'voucher-refeicao',
    },
    {
        id: 'reversao',
        title: 'Deu timeout no posto: e agora?',
        icon: '↩️',
        description: 'Por que a reversão existe e o que ela evita quando a resposta não chega.',
        steps: [
            'O terminal abastece o carro e envia a autorização, mas a resposta não volta.',
            'Sem resposta, ninguém sabe se o valor foi reservado no cartão.',
            'O terminal envia 0420, uma reversão, referenciando a transação original.',
            'O emissor libera qualquer reserva feita por aquela transação.',
            'É a diferença entre um aborrecimento e uma cobrança indevida.',
        ],
        presetId: 'reversao-timeout',
    },
    {
        id: 'ecommerce',
        title: 'Compra em loja virtual',
        icon: '🛒',
        description: 'Como o e-commerce dispensa a captura separada e o que o DE 22 informa.',
        steps: [
            'O cliente digita os dados no site, ou usa um cartão salvo com tokenização.',
            'O gateway monta a mensagem 0200, que já é financeira.',
            'O DE 22 igual a 091 indica que o cartão não estava presente fisicamente.',
            'O DE 25 igual a 08 confirma pedido remoto.',
            'O emissor autoriza e captura no mesmo movimento, e a liquidação entra no lote do dia.',
        ],
        presetId: 'ecommerce-compra',
    },
    {
        id: 'devolucao',
        title: 'Devolução de produto comprado online',
        icon: '💸',
        description: 'Como o valor volta para o cartão, e por que não é uma reversão.',
        steps: [
            'O cliente devolve o produto e a loja inicia a devolução.',
            'A loja envia 0200 com código de processamento 20, que é uma transação nova.',
            'O DE 37 leva o RRN da compra original, para o emissor localizar o lançamento.',
            'O emissor credita o valor na fatura do portador.',
            'Na liquidação, a devolução é descontada do lote do lojista.',
        ],
        presetId: 'devolucao',
    },
    {
        id: 'saldo',
        title: 'Consulta de saldo no caixa eletrônico',
        icon: '🏧',
        description: 'Uma mensagem de autorização que não cobra nada.',
        steps: [
            'O portador escolhe "consultar saldo" no caixa eletrônico.',
            'O terminal monta 0100 com código de processamento 30.',
            'Como não há cobrança, a mensagem não leva campo de valor.',
            'O emissor responde com o saldo disponível, em campo próprio da resposta.',
            'O limite do cartão não é afetado.',
        ],
        presetId: 'consulta-saldo',
    },
    {
        id: 'conexao',
        title: 'A maquininha acorda e se apresenta',
        icon: '📡',
        description: 'O diálogo que acontece antes de qualquer venda: echo e sign-on.',
        steps: [
            'A maquininha liga e envia 0800 com DE 70 igual a 301, um teste de eco.',
            'A rede responde confirmando que está no ar.',
            'Em seguida vem o sign-on, com DE 70 igual a 001.',
            'A resposta traz as chaves que serão usadas para proteger as transações.',
            'Só depois disso a maquininha passa a aceitar venda.',
        ],
        presetId: 'echo-rede',
    },
    {
        id: 'lote',
        title: 'Fechamento do dia na loja',
        icon: '📊',
        description: 'O momento em que as transações do dia viram dinheiro a receber.',
        steps: [
            'A loja fecha e a maquininha reúne as transações aprovadas do dia.',
            'Envia 0500 com DE 70 igual a 161, pedindo a conciliação do lote.',
            'O sistema central compara os totais do terminal com os registros dele.',
            'Se bater, confirma; se não bater, pede conciliação detalhada.',
            'O valor líquido cai na conta do lojista no prazo do arranjo.',
        ],
        presetId: 'fechamento-lote',
    },
    {
        id: 'chip',
        title: 'Cartão de chip: o criptograma que prova a transação',
        icon: '💳',
        description: 'Por que o chip manda um criptograma em vez de só o número do cartão.',
        steps: [
            'O cartão é inserido no terminal, que envia o comando de leitura ao chip.',
            'O chip monta o ARQC criptografando valor, data, contador e dados do terminal.',
            'O terminal envia a mensagem com o ARQC no DE 55, junto do TVR e do AIP.',
            'O emissor recalcula o criptograma com a chave do cartão e compara.',
            'Se bater, autoriza. Se não bater, é sinal de mensagem adulterada ou copiada.',
        ],
        presetId: 'chip-preauth',
    },
];


