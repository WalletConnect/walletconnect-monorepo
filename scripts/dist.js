// const fs = require('fs')
const path = require('path')

const {
  readDir,
  isDir,
  exists,
  verifyDir
  //  verifyFile
} = require('./common')

const ROOT_DIR = path.join(__dirname, '../')
const PACKAGES_DIR = path.join(ROOT_DIR, './packages')
const TARGET_DIR = path.join(ROOT_DIR, './zip')

async function isPackage (filePath) {
  return !!(
    (await isDir(filePath)) &&
    (await exists(path.join(filePath, 'package.json')))
  )
}

// function getName (filePath) {
//   return path.basename(filePath).replace(path.extname(filePath), '')
// }

async function zipPackage (filePath) {
  if (await isDir(filePath)) {
    // const name = getName(filePath)
    // const inputPath = path.join(filePath, 'dist')
    // const outputPath = path.join(TARGET_DIR, name + '.zip')

    try {
      // await archiveDir(inputPath, outputPath)
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
        if (['node_modules', 'dist', 'test'].includes(packageDir)) {
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
