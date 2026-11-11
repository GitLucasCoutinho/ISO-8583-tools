# ISO tools

**[Abrir a ferramenta: isotools.netlify.app](https://isotools.netlify.app)**

Decodificador de mensagens ISO 8583 que roda no navegador. Você cola o hex, a
ferramenta mostra o MTI, os bitmaps, cada campo de dados com o valor interpretado
e os segmentos hexadecimais anotados, na mesma tela.

## O que a aplicação faz

- Decodifica MTI, bitmap primário e secundário, e os campos de 1 a 128.
- Anota os segmentos hexadecimais e sincroniza a seleção entre bitmap, tabela e régua.
- Interpreta os campos conhecidos: MCC, código de processamento, código de resposta,
  moeda, modo de entrada, trilha 2 e dados do chip.
- Valida o Luhn do PAN, mascara o número e consulta a base de BIN local.
- Exporta o resultado em JSON, copia o texto e gera link compartilhável.
- Traz 15 mensagens prontas e 12 cenários guiados para estudo.

Tudo é processado no cliente. A base de BIN só é carregada quando a mensagem tem
PAN, e nenhum dado da mensagem sai do navegador.

## Correções no decodificador

Esta é a parte que diferencia este projeto da base em que ele se inspirou.

### DE 55 lido como dados do chip, e não como texto

O campo 55 carrega os dados do cartão com chip em TLV, que é uma sequência de
tag, tamanho e valor. Na base original esse campo estava declarado como texto,
então o conteúdo era convertido para ASCII e virava caracteres ilegíveis.

Agora o campo é tratado como binário e o TLV é expandido em elementos
identificados, com nome para cada tag:

| Tag | Significado |
|---|---|
| 9F26 | Criptograma da aplicação (ARQC) |
| 9F27 | Resultado da criptografia |
| 9F10 | Dados de autorização do emissor (IAD) |
| 9F36 | Contador de transação (ATC) |
| 95 | Resultado da verificação do terminal (TVR) |
| 82 | Parâmetros de interface (AIP) |
| 9F34 | Resultado do método de verificação |

Na tela, o campo aparece com os elementos listados um a um, em vez de um bloco
de hex. O leitor de TLV aceita tag de um e de dois bytes, e não consome bytes
além do tamanho declarado.

### Mensagem desalinhada gera erro, e não valor inventado

Quando um campo vem com tamanho diferente do previsto, os seguintes saem
deslocados, e o erro aparece longe da causa. O decodificador compara o tamanho
esperado com o disponível, recusa o campo e informa a posição. Sem isso, uma
mensagem mal montada produzia valores plausíveis e errados.

### Campos de tamanho fixo validados na montagem

Ao gerar as mensagens de exemplo, cada campo alfanumérico é preenchido até o
tamanho exato e cada campo numérico recebe o preenchimento do decimal empacotado. Se um valor
não couber, a montagem falha na hora, em vez de gerar um hex que só quebra na
leitura.

## Mensagens de exemplo

| Mensagem | MTI | O que mostra |
|---|---|---|
| Débito por aproximação | 0100 | compra presencial, entrada 071, MCC 5499 |
| Débito aprovado | 0110 | código de autorização e RRN |
| Negada por saldo | 0110 | código 51, sem código de autorização |
| Negada por senha | 0110 | código 55 |
| Pré-autorização de hotel | 0100 | reserva de valor, MCC 7011 |
| Captura da pré-autorização | 0220 | conclusão com DE 25 igual a 06 e o mesmo STAN |
| Pré-autorização com chip | 0100 | DE 55 com ARQC, TVR e AIP |
| Voucher de refeição | 0100 | arranjo fechado, saldo de benefício |
| Reversão por timeout | 0420 | desfaz transação sem resposta |
| Compra em loja virtual | 0200 | e-commerce, entrada 091 |
| Devolução | 0200 | código de processamento 20 |
| Consulta de saldo | 0100 | código 30, sem valor |
| Echo de rede | 0800 | DE 70 igual a 301 |
| Sign-on | 0800 | DE 70 igual a 001 |
| Fechamento de lote | 0500 | DE 70 igual a 161 |

## Como rodar

Requer Node.js 20.19 ou superior.

```bash
npm install
npm start
```

Abra `http://localhost:4200`. Para compilar:

```bash
npm run build
```

## Docker

```bash
docker build -t iso-8583-tools .
docker run --rm -p 8080:80 iso-8583-tools
```

A imagem compila a aplicação em uma etapa Node.js e serve os arquivos estáticos
com Nginx. A aplicação fica disponível em `http://localhost:8080`.

## Base de BIN

`public/bin-list-data.csv` é a base aberta
[bin-list-data](https://github.com/venelinkochev/bin-list-data), de Venelin Kochev,
licenciada em CC-BY-4.0, sem alteração de conteúdo: 374.789 registros, 226 países,
18 mil emissores e 66 marcas, com as colunas originais preservadas.

São 26 MB, o que deixa o clone mais pesado. Se você prefere um repositório leve,
filtre por país no carregamento ou trabalhe com um recorte: o leitor aceita
qualquer arquivo com o mesmo cabeçalho.

BIN é o IIN, os primeiros dígitos do cartão. Identifica emissor, bandeira e país.
Não é número de cartão e não contém dado de portador.

Detalhes de atribuição, alterações feitas e como obter a base completa estão em
`NOTICE-bin-list.md`.

## Estrutura

- `src/app/app.component.*`: interface, régua hexadecimal e interações.
- `src/app/iso8583/parser.ts`: decodificador, incluindo o leitor de TLV do DE 55.
- `src/app/iso8583/fieldSpecs.ts`: especificação dos campos e tabelas de códigos.
- `src/app/iso8583/presets.ts`: mensagens de exemplo e cenários guiados.
- `src/app/iso8583/mccDatabase.ts`: base de MCC.
- `public/bin-list-data.csv`: base de BIN do recorte brasileiro.

## Limitações

- O DE 55 é exibido e listado, mas o criptograma não é validado contra uma chave:
  a ferramenta mostra os dados, não autentica a transação.
- Campos de dados proprietários, como DE 48 e DE 62, aparecem como hex, sem
  interpretação, porque o conteúdo varia por arranjo.
- Não há conexão com autorizador nem simulador de rede. O foco é entender a
  mensagem, não executar transação.

## Origem

A interface deste projeto foi escrita do zero em Angular. O que veio do
[ISO 8583 Parser Playground](https://github.com/siva-sub/ISO-8583-parser-playground),
projeto React com TypeScript e Mantine, sob licença MIT, foi o conhecimento de
domínio: a estrutura do decodificador, a especificação dos campos, a base de MCC
e as ideias das mensagens de exemplo.

| Parte | Origem |
|---|---|
| Interface, componentes e estilos | Angular, escritos do zero |
| Decodificador | derivado, portado e corrigido |
| Especificação dos campos | derivada, traduzida e ampliada |
| Mensagens e cenários | reescritos, com dados próprios |
| Leitor de TLV do DE 55 | original deste repositório |

Não há código React neste repositório. A licença MIT do projeto original e a
atribuição estão em `NOTICE-mit.md`.

## Licença

Código aberto, sob licença [MIT](LICENSE). Você pode usar, copiar, modificar e
distribuir, inclusive comercialmente, mantendo o aviso de copyright e a licença.

- Este repositório: MIT, copyright Lucas Coutinho.
- Partes derivadas do ISO 8583 Parser Playground: MIT, com o copyright original
  preservado em `NOTICE-mit.md`.
- Base de BIN em `public/bin-list-data.csv`: CC-BY-4.0, descrita em
  `NOTICE-bin-list.md`.

## Idioma e contexto

A interface e os cenários estão em português, com foco no mercado brasileiro:

- Moeda 986 (real) em todas as transações de exemplo.
- Estabelecimentos e cidades brasileiras nos cenários.
- Arranjo fechado de voucher de refeição, além das bandeiras abertas.
- Datas de novembro de 2026 nos exemplos.

O código, os nomes de tipos e as mensagens de erro do parser seguem em inglês,
para manter compatibilidade com o projeto de origem e facilitar a comparação.
