const path = require('path')

const { ROOT_DIR, execGitCmd } = require('./shared')

const LERNA_JSON = path.join(ROOT_DIR, 'lerna.json')

const { version } = require(LERNA_JSON)

async function commitVersion () {
  try {
    await execGitCmd(['add', '.'])
    await execGitCmd(['commit', '-am', `${version}`])
    console.log(`Committed version ${version} successfully`)
  } catch (error) {
    console.error(error)
    console.log(`Failed to commit version ${version}`)
  }
}

commitVersion()
