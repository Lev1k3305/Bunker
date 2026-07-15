import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SHELTER — сетевая игра на выживание</title>
        <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
        <meta name="description" content="SHELTER — сетевая игра на выживание: генератор персонажей, катастроф и параметров убежища, каждый игрок со своего устройства." />

        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        {/* Font Awesome */}
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />

        {/* Стили */}
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>
        {children}

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  )
})
