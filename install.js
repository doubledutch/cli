const fs = require('fs')
const chalk = require('chalk')
const config = require('./config')
const firebase = require('firebase')
const firebaseUtils = require('./utils/firebase')
const { ddHome, ddConfig, fileExists, promisify, requestAccessToken, saveConfig } = require('./utils')

module.exports = function install(eventID) {
  const accountConfig = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))
  if (!fileExists('package.json')) return console.log('This does not appear to be a doubledutch extension project. No package.json found.')
  const extensionPackageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (!extensionPackageJSON.doubledutch) return console.log('This does not appear to be the root folder of a DoubleDutch extension project. package.json does not have a doubledutch section.')
  const extension = extensionPackageJSON.name

  // TODO - we should really just check the expiration of the token
  process.stdout.write('Authenticating... ⏳  ')
  firebase.initializeApp(firebaseUtils.config)
  return requestAccessToken(accountConfig.username, accountConfig.refresh_token)
  .then(access_token => firebaseUtils.getAdminToken(access_token, eventID))
  .then(firebaseToken => firebase.auth().signInWithCustomToken(firebaseToken))
  .then(() => clearAndLog('Authenticated ⭐'))
  .then(() => firebase.database().ref(`installs/${extension}/events/${eventID}`).set(true))
  .catch(err => {
    if (err.code === 'PERMISSION_DENIED') throw `You do not have permission to install '${extension}' to event ${eventID}`
    throw err
  })
  .then(() => console.log(chalk.green(`Installed ${extension} to event ${eventID} ✨`)))
  .then(() => process.exit(0)) // firebase ref.set() is not releasing something, even after the Promise is resolved.
  .catch(err => console.error(typeof err === 'string' ? chalk.red(err) : err))
}

function clearAndLog(text) {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  console.log(text)
}