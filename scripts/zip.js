const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const { readDir, isDir, exists, verifyDir, verifyFile } = require('./common')

const ROOT_DIR = path.join(__dirname, '../')
const PACKAGES_DIR = path.join(ROOT_DIR, './packages')
const TARGET_DIR = path.join(ROOT_DIR, './zip')

async function isPackage (filePath) {
  return !!(
    (await isDir(filePath)) &&
    (await exists(path.join(filePath, 'package.json')))
  )
}

function getName (filePath) {
  return path.basename(filePath).replace(path.extname(filePath), '')
}

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
      console.warn('Data has been drained')
      resolve(true)
    })

    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        console.warn('WARN:', err.message)
      } else {
        reject(err)
      }
    })
    archive.pipe(output)

    archive.directory(inputPath, false)

    archive.finalize()
  })
}

async function zipPackage (filePath) {
  if (await isDir(filePath)) {
    const name = getName(filePath)
    const inputPath = path.join(filePath, 'lib')
    const outputPath = path.join(TARGET_DIR, name + '.zip')

    try {
      await archiveDir(inputPath, outputPath)
    } catch (err) {
      console.error(err)
    }
  }
}

async function zipDir (targetDir) {
  try {
    const packages = await readDir(targetDir)

    await Promise.all(
      packages.map(async packageDir => {
        if (['node_modules', 'lib', 'dist', 'test'].includes(packageDir)) {
          return
        }
        const filePath = path.join(targetDir, packageDir)
        if (await isPackage(filePath)) {
          return zipPackage(filePath)
        }
        return zipDir(filePath)
      })
    )
  } catch (err) {
    console.error('Could not list the directory.\n', err.message)
    process.exit(1)
  }
}

async function run () {
  await verifyDir(TARGET_DIR)
  await zipDir(PACKAGES_DIR)
}

run()
