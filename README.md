# Avaliador PWA — 2ª Feira GLOBE Brasil 2026

Aplicação estática para avaliação por QR Code, preparada para uso offline, Cloudflare Pages e Google Apps Script. A logo oficial `assets/logo.svg` é usada no cabeçalho.

## Dados oficiais

`data/trabalhos.json` e `data/criterios.json` foram gerados a partir do XLSX oficial. O importador em `scripts/import-data.ps1` lê diretamente o pacote XLSX, preservando acentos, células e números originais, e valida total e IDs compostos.

```powershell
npm run import:data
```

Resultado esperado: 134 trabalhos (37 Oral, 88 Pôster, 9 Online), sem IDs duplicados, e sete critérios com descrições. Os IDs levam a modalidade, por exemplo `ORAL-052` e `POSTER-052`. `data/avaliadores.json` está intencionalmente vazio: adicione somente os avaliadores confirmados, usando objetos `{ "id": "AV-001", "name": "Nome confirmado", "institution": "Instituição", "active": true }`.

## Executar e verificar

Sirva a pasta por HTTP local para que Fetch, IndexedDB e Service Worker funcionem:

```powershell
npx http-server . -p 8000
```

Abra `http://localhost:8000/?trabalho=ORAL-052`. `npm test` executa os testes automatizados de dados, IDs, critérios e validação/cálculo de notas. Para recalcular os dados após alterações na planilha, rode o importador e depois `npm test`.

## Uso offline e sincronização

O avaliador precisa abrir o app conectado pelo menos uma vez para que o Service Worker armazene a interface e os JSONs oficiais. Cada avaliação recebe UUID e é gravada no IndexedDB antes do envio. Estados locais: `pending`, `syncing`, `synced` e `error`. O app tenta sincronizar na abertura, ao retornar a conexão e pelo botão manual; conserva o registro até confirmação explícita do Apps Script.

Configure a URL implantada do Apps Script em `config.js`:

```js
window.GLOBE_CONFIG = { appsScriptUrl: 'https://script.google.com/macros/s/ID_DA_IMPLANTACAO/exec' };
```

Sem o endpoint, gravação offline continua funcionando, mas não há envio central. O acesso ao painel `/admin.html` usa uma chave inserida pelo administrador no momento do acesso e validada pelo Apps Script. Configure `ADMIN_KEY` em **Apps Script → Configurações do projeto → Propriedades do script**; não salve a chave em `config.js`.

## Google Apps Script / Google Sheets

1. Crie uma planilha Google dedicada. Em **Extensões → Apps Script**, substitua o conteúdo por `backend/Code.gs` e crie um arquivo HTML chamado `ImportDialog`, copiando `backend/ImportDialog.html`.
2. Execute `initializeSheets()` no editor e autorize a criação das abas `TRABALHOS`, `AVALIADORES`, `CRITERIOS` e `AVALIACOES`. A função aplica o visual institucional verde, título mesclado, cabeçalho destacado, filtros, linhas congeladas, larguras de coluna e validação das sete notas. A linha 1 é o título e a linha 2 contém os cabeçalhos; os dados começam na linha 3. Se encontrar o cabeçalho antigo na linha 1, a inicialização o move para baixo antes de aplicar o novo estilo.
3. Na planilha, recarregue a página e escolha **Feira GLOBE → Importar cadastro oficial (JSON)**. Selecione `data/trabalhos.json` e `data/criterios.json` da pasta do projeto. A importação valida 134 trabalhos, IDs únicos, distribuição 37/88/9 e sete critérios; adiciona apenas IDs ausentes e mantém os registros existentes. Não há nomes de avaliadores no XLSX e nenhum foi inventado.
4. Defina a propriedade de script `ADMIN_KEY` com uma chave longa e exclusiva.
5. **Implantar → Nova implantação → App da Web**. Executar como proprietário; acesso: qualquer pessoa. A URL `/exec` é pública para gravação de avaliações, mas ações administrativas exigem a chave.
6. Copie a URL `/exec` para `config.js`, publique e faça ensaio controlado. A API responde `ok: true` com o mesmo `submissionId` somente após gravar/confirmar; repetição do UUID retorna duplicado sem criar nova linha.
7. Ao alterar `backend/Code.gs`, crie uma nova versão da implantação do App da Web para que as ações de cadastro entrem em vigor.

O endpoint foi implementado com `text/plain` para evitar preflight CORS e respostas JSON positivas são obrigatórias. A confirmação real entre navegador/Cloudflare e implantação GAS depende do endpoint publicado e precisa ser validada no ambiente final; não é possível afirmar esse ensaio sem credenciais/implantação externa.

## QR Codes

Instale dependências e forneça a URL final do Pages:

```powershell
npm install
$env:PUBLIC_URL = 'https://seu-dominio.pages.dev/'
npm run generate:qrcodes
```

Gera `qrcodes/orais/`, `qrcodes/posteres/`, `qrcodes/online/`, `qrcodes/trabalhos.csv` e `qrcodes/imprimir.html`. A página de impressão tem título e número em cada cartão. O destino padrão `SEU-DOMINIO` é apenas um placeholder; não imprima antes de definir `PUBLIC_URL`.

Depois de cadastrar trabalhos pelo painel, use **Baixar cadastro completo para gerar QR Codes** e informe esse JSON em `WORKS_FILE` ao executar o gerador, para incluir os novos IDs nos PNGs e na página de impressão.

## Cloudflare Pages

1. Envie o conteúdo do repositório para GitHub.
2. No Cloudflare, **Workers & Pages → Create → Pages → Connect to Git**.
3. Preset `None`; build command vazio; diretório de saída `/`.
4. Confirme HTTPS e teste `/`, `/admin.html`, recarga com `?trabalho=ORAL-052` e o Service Worker. O projeto não usa rotas de servidor próprias, então as páginas estáticas funcionam sem redirects adicionais.
5. Atualize `PUBLIC_URL` e regenere QR Codes se usar domínio próprio.

## Escopo administrativo e segurança

O painel exige chave validada no backend para retornar dados e oferece filtros por modalidade/avaliador, contagens por trabalho, notas/comentários, exportação CSV e classificação consolidada. A classificação ordena pela média dos totais das avaliações recebidas (máximo 28), atribui a mesma posição em caso de empate e acompanha a quantidade de avaliações. Também permite cadastrar trabalhos (ID composto, número, modalidade, título, escola, horário e local) e avaliadores (nome e instituição; ID UUID gerado automaticamente e situação ativa). O Apps Script valida a chave, campos, limites e duplicidade do ID antes de gravar nas abas centrais.

Após cadastro, os dados entram no catálogo central; o PWA consulta o catálogo publicado ao abrir com internet e guarda a versão mais recente localmente para uso offline posterior. Se estiver offline, novos cadastros só ficam disponíveis depois que o aparelho sincronizar o catálogo. A chave deve ser distribuída somente à administração e trocada em caso de exposição. Não inclua segredos no frontend. Dados locais offline pertencem ao perfil do navegador/aparelho; faça sincronização e confirmação antes de limpar os dados do navegador.

## Configuração ainda necessária

- Cadastro verdadeiro dos avaliadores, com instituição e situação ativa.
- Planilha Google central, carga inicial das três abas de cadastro e implantação do Apps Script.
- `ADMIN_KEY` e URL `/exec` em propriedades/configuração externa.
- Domínio Cloudflare Pages e URL pública antes de produzir os QR Codes.
- Teste ponta a ponta do CORS/redirect do Google Apps Script com a implantação final.
