# MoLIC Connector

Plugin do Figma para desenhar **falas de transição** de diagramas MoLIC que ficam ligadas às cenas: quando você move uma cena, a seta acompanha. As setas podem ser retas, ortogonais (em cotovelo) ou curvas.

> *A Figma plugin for drawing connected transition utterances in MoLIC interaction diagrams (Semiotic Engineering / HCI). Arrows stay attached to scenes and can be straight, orthogonal or curved.*

## O que ele faz

- Liga dois elementos quaisquer (cena, processo do sistema, ponto de abertura ou de encerramento, acesso ubíquo) com uma seta de origem para destino.
- **Fala de transição**: linha contínua. **Fala de recuperação de ruptura**: linha tracejada.
- Rótulo no formato da notação: `u:` ou `d:` seguido da fala e, se houver, uma linha `precond:` acima.
- Não deixa criar seta sem fala, porque na MoLIC uma fala de transição sempre indica quem fala.
- Três rotas: **reta**, **ortogonal** (cotovelo com cantos arredondados) e **curva** (Bézier).
- **Pontos de conexão**: por padrão, o lado de saída e o de chegada são escolhidos pela posição das caixas. Também dá para fixar o lado e a posição exata ao longo dele (de 0% a 100%), por exemplo para várias falas saírem do mesmo ponto de uma cena.
- O rótulo usa a cor de fundo da página, então a linha parece "passar por trás" do texto.
- Com o plugin aberto, as setas se redesenham sozinhas quando as cenas são movidas ou redimensionadas. Com ele fechado, use **Redesenhar todas as setas da página** ao reabrir.
- **Edição em lote**: selecione uma ou várias setas para mudar tipo, rota, pontos de conexão ou texto, ou para **inverter a direção**. Em lote, só os campos que você alterar são aplicados; os que diferem entre as setas aparecem como "vários".
- Se uma seta não puder ser redesenhada (por exemplo, porque a cena de origem foi apagada), o plugin diz o motivo e seleciona a seta com problema.
- Cada seta ganha o botão **Editar fala MoLIC** no painel lateral do Figma.

## Instalar a partir do GitHub

A pasta `dist/` já vem compilada no repositório, então não é preciso instalar o Node.js só para usar o plugin.

1. Baixe o repositório uma vez, num lugar fixo: `git clone https://github.com/USUARIO/molic-connector.git` (ou **Code → Open with GitHub Desktop**).
2. No Figma desktop: **Plugins → Development → Import plugin from manifest…** e escolha o `manifest.json` dessa pasta. Isso só é feito uma vez.
3. Para atualizar: `git pull` (ou **Fetch origin → Pull** no GitHub Desktop) e reabra o plugin. O Figma lê os arquivos da pasta toda vez que o plugin abre, então não é preciso importar de novo.

## Como usar

1. Abra o plugin (Plugins → MoLIC Connector).
2. Clique na cena de **origem** e depois, com **Shift**, na de **destino**.
3. Escolha o tipo, quem fala, a fala, a precondição (opcional) e a rota.
4. Clique em **Conectar**.

Para escolher de onde a seta sai ou onde chega, clique na borda da caixinha **Saída** ou **Chegada** e ajuste a posição com o controle deslizante. Clicar no centro da caixinha volta ao modo automático.

Para editar, selecione uma ou mais setas, altere os campos e clique em **Aplicar**. Se a direção sair trocada, use **Inverter direção**.

## Notação implementada

| Elemento | Representação no plugin |
| --- | --- |
| Fala de transição | seta contínua com `u:` ou `d:` |
| Fala de recuperação de ruptura | seta tracejada com `u:` ou `d:` |
| Precondição | linha `precond:` acima da fala |

As cenas, os processos do sistema e os pontos de abertura e encerramento continuam sendo seus próprios componentes; o plugin cuida apenas das setas.

Alguns materiais escrevem a precondição como `pre:`. O plugin usa `precond:`, como no material do site Engenharia Semiótica listado abaixo.

## Desenvolvimento

Para alterar o código, é preciso o [Node.js](https://nodejs.org) 22 ou mais recente. Depois de mudar algo em `src/`, rode `npm run build` e inclua a pasta `dist/` no commit.

```bash
npm install
npm run build   # verifica os tipos e gera dist/code.js e dist/ui.html
npm test        # testes da geometria das rotas
```

No Figma desktop: **Plugins → Development → Import plugin from manifest…** e escolha o `manifest.json` desta pasta. Depois de cada alteração, rode `npm run build` e reabra o plugin.

### Estrutura

```
manifest.json        configuração do plugin
src/code.ts          lógica que roda no Figma (cria e atualiza as setas)
src/geometry.ts      cálculo das rotas, sem dependência do Figma (testável)
src/ui.html          interface do plugin
test/                testes de geometry.ts
```

Cada seta é um grupo com dois filhos: um vetor (a linha) e um frame (o rótulo). Se uma dessas partes for apagada, o plugin a recria ao redesenhar. Os ids da origem e do destino e as opções escolhidas ficam guardados no próprio grupo (`pluginData`), por isso o plugin consegue redesenhar tudo depois.

## Publicar na Comunidade do Figma

1. Rode `npm run build`.
2. No Figma desktop, abra **Plugins → Manage plugins** e escolha **Publish** no MoLIC Connector.
3. Prepare um ícone (128 × 128 px), uma imagem de capa (1920 × 1080 px), uma descrição e uma imagem de exemplo.
4. O Figma atribui um id definitivo ao plugin. Substitua `molic-connector-dev` no `manifest.json` por esse id.

## Referências

- MACHADO, G. *(MoLIC) Modelagem da Interação*. Engenharia Semiótica. Disponível em: <https://engenharia-semiotica.figma.site/molic>.
- SERG – Semiotic Engineering Research Group. *MoLIC: modelagem da interação* (slides de INF1403, PUC-Rio). Disponível em: <https://www.inf.puc-rio.br/~inf1403/docs/alberto2012-1/18_molic.pdf>.
- Manual de MoLIC indicado pelo SERG (página de publicações de Simone D. J. Barbosa). Disponível em: <https://www-di.inf.puc-rio.br/~simone/publications/07_12_silva.pdf>.
- SILVA, B. S. *MoLIC Segunda Edição: revisão de uma linguagem para modelagem da interação humano-computador*. Dissertação (Mestrado) – PUC-Rio, 2005.
- BARBOSA, S. D. J.; SILVA, B. S.; SILVEIRA, M. S.; GASPARINI, I.; DARIN, T.; BARBOSA, G. D. J. *Interação humano-computador e experiência do usuário*. Autopublicação, 2021. ISBN 978-65-00-19677-1.
- DE SOUZA, C. S.; LEITÃO, C. F. *Semiotic Engineering Methods for Scientific Research in HCI*. Morgan & Claypool, 2009.
- DE SOUZA, C. S. *The Semiotic Engineering of Human-Computer Interaction*. Cambridge, MA: MIT Press, 2005.

## Licença

MIT. Veja [LICENSE](LICENSE).
