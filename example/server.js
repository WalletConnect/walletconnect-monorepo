const path = require('path')
const express = require('express')
const open = require('open')

const PORT = 8060
const ROOT_PATH = path.join(__dirname, '../')
const STATIC_PATH = path.join(ROOT_PATH, 'example/public')

const app = express()

app.use(express.static(ROOT_PATH))
app.use(express.static(STATIC_PATH, { index: ['index.html'] }))

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
  open(`http://localhost:${PORT}`)
})
