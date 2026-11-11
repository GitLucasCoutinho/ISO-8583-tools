# Licença e atribuição

## Projeto original

O decodificador, a especificação dos campos, a base de MCC e as ideias das
mensagens de exemplo foram derivados do ISO 8583 Parser Playground:

- Autor: Siva Subramaniam
- Repositório: https://github.com/siva-sub/ISO-8583-parser-playground
- Licença: MIT

A interface deste repositório foi escrita do zero em Angular. O projeto original
é React com TypeScript e Mantine, e nenhum código React foi trazido para cá.

## Licença MIT

Copyright (c) 2025 Siva Subramaniam

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## O que é derivado e o que é original

| Parte | Origem |
|---|---|
| Interface, componentes e estilos | escritos em Angular, do zero |
| Decodificador ISO 8583 | derivado, portado para TypeScript/Angular e corrigido |
| Especificação dos campos e tabelas de códigos | derivada, traduzida e ampliada |
| Base de MCC | derivada |
| Mensagens de exemplo e cenários | reescritas, com dados e nomes próprios |
| Leitor de TLV do DE 55 | original deste repositório |
| Validação de tamanho na montagem | original deste repositório |

## Alterações neste derivado

- DE 55 lido como dados binários, com expansão dos elementos TLV
- verificação de tamanho dos campos, com erro explícito em mensagem desalinhada
- validação de tamanho na montagem das mensagens de exemplo
- mensagens e cenários próprios, no contexto brasileiro

## Base de BIN

O arquivo `public/bin-list-data.csv` tem licença própria, CC-BY-4.0. Veja
`NOTICE-bin-list.md`.
