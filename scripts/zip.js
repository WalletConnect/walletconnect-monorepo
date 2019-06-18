const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const ROOT_DIR = path.join(__dirname, '../')

const PACKAGES_DIR = path.join(ROOT_DIR, './packages')
console.log('PACKAGES_DIR', PACKAGES_DIR)

const DIST_DIR = path.join(ROOT_DIR, './dist')

async function archiveDir (inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(archive.pointer() + ' total bytes')
      console.log(
        'archiver has been finalized and the output file descriptor has closed.'
      )
      resolve(true)
    })

    output.on('end', function () {
      console.log('Data has been drained')
      resolve(true)
    })

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        console.log('WARN:', err.message)
      } else {
        reject(err)
      }
    })
    // pipe archive data to the file
    archive.pipe(output)

    archive.directory(inputPath, false)

    archive.finalize()
  })
}

fs.readdir(PACKAGES_DIR, (err, files) => {
  if (err) {
    console.error('Could not list the directory.\n', err.message)
    process.exit(1)
  }

  files.forEach((file, index) => {
    console.log('file', file)
    const filePath = path.join(PACKAGES_DIR, file)

    fs.stat(filePath, async (error, stat) => {
      if (error) {
        console.error('Error stating file.', error)
        return
      }

      if (stat.isDirectory()) {
        console.log('filePath', filePath)
        const inputPath = path.join(filePath, '/lib')
        console.log('inputPath', inputPath)
        const outputPath = path.join(DIST_DIR, file + '.zip')
        try {
          await archiveDir(inputPath, outputPath)
        } catch (err) {
          console.error(err)
        }
      }
    })
  })
})
