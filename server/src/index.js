import { serverConfig } from './config.js'
import app from './app.js'

app.listen(serverConfig.port, () => {
  console.log(`Atlas relay listening on http://localhost:${serverConfig.port}`)
})
