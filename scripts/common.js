const fs = require('fs')

function statPath (path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, async (error, stat) => {
      if (error) {
        return reject(error)
      }
      resolve(stat)
    })
  })
}

function writeFile (path, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, (err, res) => {
      if (err) {
        reject(err)
      }
      resolve(res)
    })
  })
}

function createDir (path) {
  return new Promise((resolve, reject) => {
    fs.mkdir(path, err => {
      if (err) {
        return reject(err)
      }
      resolve(true)
    })
  })
}

function readDir (path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) {
        return reject(err)
      }
      resolve(files)
    })
  })
}

async function isDir (path) {
  const stat = await statPath(path)
  return stat.isDirectory()
}

async function isFile (path) {
  const stat = await statPath(path)
  return stat.isFile()
}

function exists (path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, err => {
      if (err) {
        if (err.code === 'ENOENT') {
          return resolve(false)
        } else {
          return reject(err)
        }
      }
      return resolve(true)
    })
  })
}

async function verifyDir (path) {
  let pathExists = await exists(path)
  if (!pathExists) {
    pathExists = await createDir(path)
  }
  return pathExists
}

async function verifyFile (path) {
  let pathExists = await exists(path)
  if (!pathExists) {
    pathExists = await writeFile(path, '')
  }
  return pathExists
}

module.exports = {
  statPath,
  writeFile,
  createDir,
  readDir,
  isDir,
  isFile,
  exists,
  verifyDir,
  verifyFile
}
