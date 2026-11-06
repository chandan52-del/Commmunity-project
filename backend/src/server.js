import { createApp } from './app.js'

const PORT = Number(process.env.PORT ?? 5000)
const app = createApp()

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}/api`)
})
