# Snake Vibe 3D — Plano da Versão 4.0

> Living Document — Última atualização: 2026-03-18

---

## Resumo Executivo

A versão 4.0 adiciona três pilares de experiência:

| # | Feature | Objetivo |
|---|---------|----------|
| 1 | **5 Sound Tracks em Loop** | Imersão sonora com músicas que alternam conforme o jogo progride |
| 2 | **Power Up de Vida (Loja no Menu)** | Monetização interna de moedas + decisão estratégica pré-rodada |
| 3 | **Multi-peças por Nível** | Progressão mais dinâmica: mais peças grow + peças shrink nos níveis altos |

---

## Feature 1 — Sound Tracks em Loop

### Objetivo de Design
Substituir a música sintetizada por osciladores (atual `startMusic()`) por **5 faixas de áudio reais** que tocam em loop e alternam conforme o nível progride, elevando a experiência sensorial.

### Mecânica

| Aspecto | Detalhe |
|---------|---------|
| Formato dos arquivos | `.mp3` (compatibilidade universal) ou `.ogg` (fallback) |
| Quantidade | 5 faixas |
| Comportamento | Cada faixa cobre uma faixa de níveis |
| Transição | Crossfade de ~1.5s ao trocar de faixa |
| Controle | Respeita toggle de som existente |

### Mapeamento Track → Nível

| Track | Arquivo | Níveis | Vibe |
|-------|---------|--------|------|
| 1 | `track_chill.mp3` | 1–2 | Ambient/Chill — introdução suave |
| 2 | `track_groove.mp3` | 3–4 | Synthwave leve — ritmo cresce |
| 3 | `track_drive.mp3` | 5–6 | Electro/Driving — tensão sobe |
| 4 | `track_intense.mp3` | 7–8 | Fast-paced neon beat |
| 5 | `track_boss.mp3` | 9+ | High-energy final — máxima intensidade |

### Onde Colocar os Arquivos de Áudio no Projeto

```
snake_game/
  public/
    audio/
      track_chill.mp3       ← Track 1 (níveis 1-2)
      track_groove.mp3      ← Track 2 (níveis 3-4)
      track_drive.mp3       ← Track 3 (níveis 5-6)
      track_intense.mp3     ← Track 4 (níveis 7-8)
      track_boss.mp3        ← Track 5 (níveis 9+)
```

> **Por que `public/audio/`?**
> - O Vite copia o conteúdo de `public/` diretamente para `dist/` no build
> - O Capacitor sincroniza `dist/` → `android/app/src/main/assets/public/`
> - Arquivos em `public/` são servidos na raiz: `/audio/track_chill.mp3`
> - Sem necessidade de import — carregados dinamicamente via `fetch()` ou `new Audio()`

### Implementação Técnica (Resumo)

```
Arquivo principal: src/game/SnakeGame.js

Alterações:
1. Nova constante SOUNDTRACK_MAP com mapeamento level → arquivo
2. Método loadSoundtracks() — pré-carrega os 5 AudioBuffer via Web Audio API
3. Refatorar startMusic() — usar AudioBufferSourceNode com loop=true
4. Novo método crossfadeTrack(trackIndex) — transição suave entre faixas
5. No levelUp dentro de updateLogic() — chamar crossfadeTrack quando a faixa muda
6. stopMusic() — fade out do source atual
```

### Fluxo de Carregamento

```
Constructor → boot() → onProgress callback
                         ↓
                   loadSoundtracks()  ← fetch + decodeAudioData para cada .mp3
                         ↓
                   startRun() → startMusic() → toca track 1
                         ↓
                   level up → verifica se muda faixa → crossfadeTrack()
```

### Recomendações de Áudio

- Duração ideal: **30–90 segundos** por faixa (loop seamless)
- Tamanho alvo: **< 500KB cada** (total ~2.5MB) para não inflar o APK
- Normalizar volume entre as faixas
- Garantir que o ponto de loop não tenha "click" (fade in/out no arquivo)
- Fontes gratuitas sugeridas: [Pixabay Music](https://pixabay.com/music/), [FreePD](https://freepd.com/), [OpenGameArt](https://opengameart.org/)

---

## Feature 2 — Power Up de Vida (Loja no Menu)

### Objetivo de Design
Dar utilidade real às moedas acumuladas. O jogador pode **comprar vidas extras** antes de iniciar uma rodada, criando decisão estratégica (gastar agora ou acumular).

### Mecânica

| Aspecto | Detalhe |
|---------|---------|
| Localização | Seção "Loja" no Menu Inicial (start-menu) |
| Recurso gasto | Moedas (coins) já existentes no perfil |
| Power up | **Extra Life** — sobrevive a 1 colisão |
| Máximo por rodada | 3 vidas extras |
| Custo | Progressivo: 1ª = 50, 2ª = 100, 3ª = 200 moedas |
| Visual in-game | Indicador de vidas no HUD (corações/ícones) |
| Ao usar | Flash visual + som especial + snake pisca mas não morre |

### Fluxo do Jogador

```
Menu Inicial
  └── Seção "Power Ups" (nova)
        ├── [Comprar Vida Extra] — Custo: 50 🪙  (mostra quantidade atual)
        ├── Vidas compradas: ❤️❤️ (visual)
        └── [Iniciar] (carrega vidas compradas para a rodada)

Durante o Jogo
  └── Colisão detectada
        ├── Se tem vida extra → consome 1, flash, continua jogando
        └── Se não tem → Game Over (comportamento atual)
```

### Dados (profileStore.js)

```javascript
// Adicionar ao DEFAULT_PROFILE:
powerUps: {
  extraLives: 0        // vidas compradas para próxima rodada
}

// Constantes de custo:
POWER_UP_COSTS = [50, 100, 200]  // custo da 1ª, 2ª, 3ª vida
MAX_EXTRA_LIVES = 3
```

### UI (index.html)

Nova seção dentro do `#start-menu > .panel`:

```html
<div class="powerup-shop">
  <h3 data-i18n="powerUpShop">Power Ups</h3>
  <div class="powerup-item">
    <span data-i18n="extraLife">Extra Life</span>
    <span id="lives-display">❤️ x0</span>
    <button id="buy-life-btn" class="secondary">
      <span data-i18n="buy">Buy</span> — <span id="life-cost">50</span> 🪙
    </button>
  </div>
</div>
```

### Implementação Técnica (Resumo)

```
Arquivos afetados:

1. src/game/config.js
   - POWER_UP_COSTS = [50, 100, 200]
   - MAX_EXTRA_LIVES = 3

2. src/game/profileStore.js
   - Adicionar powerUps ao DEFAULT_PROFILE
   - Adicionar sanitização no load/save

3. index.html
   - Nova seção powerup-shop no start-menu
   - Indicador de vidas no HUD

4. src/main.js
   - Lógica de compra: validar moedas, debitar, atualizar UI
   - Passar extraLives para o SnakeGame no startRun
   - Resetar extraLives compradas após iniciar rodada

5. src/game/SnakeGame.js
   - Nova propriedade this.extraLives
   - No updateLogic(), ao detectar colisão:
     if (this.extraLives > 0) → consumir vida, flash, reposicionar
     else → gameOver()
   - Novo método useExtraLife() com efeitos visuais
   - Atualizar HUD para mostrar vidas restantes

6. src/style.css
   - Estilização da loja e indicador de vidas

7. src/game/i18n.js
   - Novas chaves: powerUpShop, extraLife, buy, notEnoughCoins, lifeUsed, maxLives
```

### Comportamento ao Usar Vida

```
Colisão detectada
  ↓
extraLives > 0?
  ├── SIM:
  │   ├── extraLives--
  │   ├── playLifeUseSound() (som especial)
  │   ├── Flash visual (snake pisca 1s)
  │   ├── Invencibilidade temporária (1.5s)
  │   ├── Remover últimos 3 segmentos da snake (penalidade)
  │   ├── Atualizar HUD de vidas
  │   └── Continuar jogando
  │
  └── NÃO:
      └── gameOver() (comportamento atual)
```

---

## Feature 3 — Multi-peças por Nível

### Objetivo de Design
Tornar a progressão mais dinâmica e o grid mais vivo. Conforme o nível sobe, aparecem **múltiplas peças simultaneamente**, incluindo peças que **reduzem** o tamanho da snake (nova mecânica).

### Mecânica

| Aspecto | Detalhe |
|---------|---------|
| Peça Growth (atual) | Aumenta snake em +1 segmento, dá +1 ponto |
| Peça Shrink (nova) | Reduz snake em -2 segmentos, dá +2 pontos (bônus risco) |
| Spawn simultâneo | Vários food de uma vez no grid |
| Escala com nível | Mais peças conforme level sobe |
| Visual | Growth = cor atual (amarelo/tema) · Shrink = cor diferente (vermelho/roxo) + visual menor |

### Tabela de Spawn por Nível

| Nível | Growth Peças | Shrink Peças | Total no Grid |
|-------|-------------|-------------|---------------|
| 1     | 1           | 0           | 1             |
| 2     | 2           | 0           | 2             |
| 3     | 2           | 1           | 3             |
| 4     | 3           | 1           | 4             |
| 5     | 3           | 1           | 4             |
| 6     | 4           | 1           | 5             |
| 7     | 4           | 2           | 6             |
| 8+    | 5           | 2           | 7             |

### Configuração (config.js)

```javascript
export const FOOD_SCALING = [
  { growth: 1, shrink: 0 },  // level 1
  { growth: 2, shrink: 0 },  // level 2
  { growth: 2, shrink: 1 },  // level 3
  { growth: 3, shrink: 1 },  // level 4
  { growth: 3, shrink: 1 },  // level 5
  { growth: 4, shrink: 1 },  // level 6
  { growth: 4, shrink: 2 },  // level 7
  { growth: 5, shrink: 2 },  // level 8+ (repeat last)
];
```

### Implementação Técnica (Resumo)

```
Arquivos afetados:

1. src/game/config.js
   - Adicionar FOOD_SCALING array
   - SHRINK_AMOUNT = 2 (segmentos removidos pela peça shrink)
   - SHRINK_BONUS = 2 (pontos bônus por pegar shrink)

2. src/game/SnakeGame.js
   Refatoração do sistema de food:

   Estado atual:
     this.food = { x, z }         ← uma peça só
     this.foodMesh               ← um mesh só

   Estado novo:
     this.foods = []              ← array de { x, z, type: 'growth'|'shrink' }
     this.foodMeshes = []         ← array de meshes
     this.foodHalos = []          ← array de halos

   Métodos alterados:
   - spawnFood() → spawnFoods() — gera N peças baseado no nível
   - spawnSingleFood(type) — spawna uma peça individual
   - updateLogic() — checar colisão com TODOS os foods[]
     - growth: comportamento atual (cresce +1)
     - shrink: remove últimos N segmentos (mín 3 de tamanho)
   - Ao comer qualquer peça: re-spawnar apenas aquela peça

   Visual Shrink:
   - Geometria: OctahedronGeometry (diferente do Icosahedron do growth)
   - Cor: tema.shrinkFood (nova propriedade no theme)
   - Tamanho menor (scale 0.7)
   - Halo com cor diferente (vermelho/roxo)
   - Animação: rotação invertida

3. src/game/themes.js
   - Adicionar propriedades por tema:
     shrinkFood: 0xff0066,
     shrinkEmissive: 0xcc0044,
     shrinkHalo: 0xff4488

4. src/game/i18n.js
   - Novas chaves se necessário para tutorial/toast
```

### Fluxo de Jogo

```
startRun()
  └── spawnFoods()  ← gera foodCount baseado no FOOD_SCALING[level-1]
        ├── growth food × N (visual atual)
        └── shrink food × M (visual novo, menor, cor diferente)

updateLogic() — a cada tick:
  └── para cada food em this.foods:
        └── head coincide?
              ├── growth → score++, cresce snake, respawn esta peça
              └── shrink → score+=2, reduz snake, som diferente, respawn esta peça

levelUp:
  └── recalcular quantidade de peças
  └── spawnFoods() novamente (remove antigos, gera novos)
```

---

## Ordem de Implementação Sugerida

| Fase | Feature | Prioridade | Dependências |
|------|---------|------------|--------------|
| 1 | Sound Tracks (arquivos + player) | Alta | Nenhuma — independente |
| 2 | Multi-peças por nível | Alta | Nenhuma — independente |
| 3 | Power Up de Vida (loja + lógica) | Média | Depende do sistema de colisão estável |

> Fases 1 e 2 podem ser implementadas em paralelo.

---

## Impacto no APK

| Item | Estimativa |
|------|-----------|
| 5 MP3 (~500KB cada) | +2.5MB |
| Código novo (JS) | ~+3KB minificado |
| Assets visuais | Nenhum (gerados via Three.js) |
| **Total estimado** | ~+2.5MB |

---

## Checklist de Implementação

- [ ] Criar pasta `public/audio/` e adicionar 5 arquivos .mp3
- [ ] Implementar sistema de soundtrack com crossfade no SnakeGame.js
- [ ] Adicionar FOOD_SCALING ao config.js
- [ ] Refatorar spawnFood → spawnFoods (multi-peça)
- [ ] Criar peça shrink (visual + lógica)
- [ ] Adicionar shrink colors aos themes.js
- [ ] Adicionar POWER_UP_COSTS e MAX_EXTRA_LIVES ao config.js
- [ ] Adicionar powerUps ao profileStore.js
- [ ] Criar seção Power Up Shop no index.html
- [ ] Implementar lógica de compra no main.js
- [ ] Implementar uso de vida extra no SnakeGame.js (colisão → sobrevive)
- [ ] Adicionar indicador de vidas no HUD
- [ ] Adicionar chaves i18n para pt-BR, en-US, es-ES
- [ ] Estilizar novos elementos no style.css
- [ ] Atualizar version no package.json para 4.0.0
- [ ] Testar no emulador Android
- [ ] Build release + teste no device físico

---

## Variáveis de Versão

```
package.json:  "version": "0.3.0" → "0.4.0"
versionCode:   incrementar no android/app/build.gradle
versionName:   "4.0.0"
```

---

## Changelog

| Versão | Data | Alterações |
|--------|------|-----------|
| 4.0.0 | 2026-03-18 | Planejamento: Sound Tracks, Power Up de Vida, Multi-peças por nível |
