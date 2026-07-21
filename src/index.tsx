import { Hono } from 'hono'
import { renderer } from './renderer'
import { rooms } from './rooms'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

// ---------------------------------------------------------------------
// Multiplayer API (комнаты, игроки, голосование, чат)
// ---------------------------------------------------------------------

app.route('/api/room', rooms)

// ---------------------------------------------------------------------
// Главная страница (SPA-оболочка)
// ---------------------------------------------------------------------

app.get('/', (c) => {
  return c.render(
    <div id="app">
      <div class="loading-screen" id="loading-screen">
        <div class="loading-content">
          <div class="loading-ring">
            <i class="fa-solid fa-radiation loading-icon"></i>
          </div>
          <div class="loading-text">SHELTER</div>
          <div class="loading-subtext">сетевая игра на выживание</div>
          <div class="loading-bar"><div class="loading-bar-fill"></div></div>
        </div>
      </div>
    </div>
  )
})

export default app
