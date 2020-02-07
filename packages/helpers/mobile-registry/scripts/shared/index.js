const fs = require('fs')
const path = require('path')

const ROOT_DIRECTORY = path.join(__dirname, '../../')

const FILE_NAME = 'registry.json'

const FILE_PATH = path.join(ROOT_DIRECTORY, FILE_NAME)

function stat (filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, function (error, stat) {
      if (error) {
        return reject(error)
      }
      resolve(stat)
    })
  })
}

async function isFile (filePath) {
  const fileStat = await stat(filePath)
  return fileStat.isFile()
}

function isJson (fileName) {
  const ext = path.extname(fileName)
  return ext === '.json'
}
function formatJson (json) {
  return JSON.stringify(json, null, 2) + '\n'
}

async function writeFile (filePath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (err, res) => {
      if (err) {
        reject(err)
      }
      resolve(res)
    })
  })
}

module.exports = {
  ROOT_DIRECTORY,
  FILE_NAME,
  FILE_PATH,
  stat,
  isFile,
  isJson,
  formatJson,
  writeFile
}
