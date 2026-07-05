import { Hono } from 'hono'
import { renderer } from './renderer'
import {
  generatePlayers,
  randomCatastrophe,
  randomBunkerParams,
  randomEvent,
} from './data'

const app = new Hono()

app.use(renderer)

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------

// Сгенерировать полную новую игру: катастрофа + бункер + игроки
app.post('/api/game/new', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const count = Math.min(Math.max(Number(body?.playerCount) || 8, 4), 16)

  const catastrophe = randomCatastrophe()
  const bunker = randomBunkerParams()
  const players = generatePlayers(count)

  return c.json({ catastrophe, bunker, players })
})

// Перегенерировать одну характеристику одного игрока
app.post('/api/game/reroll', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const field = body?.field as string

  const {
    PROFESSIONS, AGE_GENDER, HEALTH, HOBBIES, PHOBIAS,
    TRAITS_POSITIVE, TRAITS_NEGATIVE, INVENTORY, EXTRA_INFO, pick,
  } = await import('./data')

  const map: Record<string, string[]> = {
    profession: PROFESSIONS,
    ageGender: AGE_GENDER,
    health: HEALTH,
    hobby: HOBBIES,
    phobia: PHOBIAS,
    traitPositive: TRAITS_POSITIVE,
    traitNegative: TRAITS_NEGATIVE,
    inventory: INVENTORY,
    extraInfo: EXTRA_INFO,
  }

  const list = map[field]
  if (!list) {
    return c.json({ error: 'unknown field' }, 400)
  }

  return c.json({ value: pick(list) })
})

// Новое случайное событие раунда
app.get('/api/game/event', (c) => {
  return c.json({ event: randomEvent() })
})

// Новая катастрофа (на случай если ведущий хочет пересоздать только её)
app.get('/api/game/catastrophe', (c) => {
  return c.json({ catastrophe: randomCatastrophe() })
})

// Новые параметры бункера
app.get('/api/game/bunker', (c) => {
  return c.json({ bunker: randomBunkerParams() })
})

// ---------------------------------------------------------------------
// Главная страница (SPA-оболочка)
// ---------------------------------------------------------------------

app.get('/', (c) => {
  return c.render(
    <div id="app">
      <div class="loading-screen" id="loading-screen">
        <div class="loading-content">
          <i class="fa-solid fa-radiation loading-icon"></i>
          <div class="loading-text">БУНКЕР</div>
        </div>
      </div>
    </div>
  )
})

export default app
