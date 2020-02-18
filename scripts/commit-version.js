const path = require('path')

const { ROOT_DIR, execGitCmd } = require('./common')

const LERNA_JSON = path.join(ROOT_DIR, 'lerna.json')

const { version } = require(LERNA_JSON)

async function commitVersion () {
  try {
    await execGitCmd(['add', '.'])
    await execGitCmd(['commit', '-am', `${version}`])
  } catch (error) {
    console.error(error)
  }
}

commitVersion()
