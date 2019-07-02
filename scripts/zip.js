const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const { getName, statPath, verifyDir, verifyFile } = require('./common')

const ROOT_DIR = path.join(__dirname, '../')
const PACKAGES_DIR = path.join(ROOT_DIR, './packages')
const DIST_DIR = path.join(ROOT_DIR, './dist')

function archiveDir (inputPath, outputPath) {
  return new Promise(async (resolve, reject) => {
    await verifyFile(outputPath)
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(
        `Archived ${getName(outputPath)} (${archive.pointer()} bytes)`
      )
      resolve(true)
    })

    output.on('end', function () {
      console.log('Data has been drained')
      resolve(true)
    })

    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        console.log('WARN:', err.message)
      } else {
        reject(err)
      }
    })
    archive.pipe(output)

    archive.directory(inputPath, false)

    archive.finalize()
  })
}

fs.readdir(PACKAGES_DIR, async (err, files) => {
  if (err) {
    console.error('Could not list the directory.\n', err.message)
    process.exit(1)
  }

  await verifyDir(DIST_DIR)

  files.forEach(async (file, index) => {
    const filePath = path.join(PACKAGES_DIR, file)

    const stat = await statPath(filePath)

    if (stat.isDirectory()) {
      const inputPath = path.join(filePath, '/lib')
      const outputPath = path.join(DIST_DIR, file + '.zip')
      try {
        await archiveDir(inputPath, outputPath)
      } catch (err) {
        console.error(err)
      }
    }
  })
})
