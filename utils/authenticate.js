const fs = require('fs')
const firebase = require('firebase')
const firebaseUtils = require('./firebase')

module.exports = {
  eventAdmin(eventID, extension, opts) {
    return authenticate(opts, access_token => firebaseUtils.getAdminToken(access_token, eventID, extension))
  },
  developer(opts) {
    return authenticate(opts, access_token => firebaseUtils.getDeveloperToken(access_token))
  }
}

function authenticate({quiet}, getFirebaseToken /* access_token => Promise(firebaseToken) */) {
  const { ddConfig, requestAccessToken } = require('./index')
  const accountConfig = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))
  // TODO - we should really just check the expiration of the token
  !quiet && process.stdout.write('Authenticating... ⏳  ')
  firebase.initializeApp(firebaseUtils.config)
  let access_token
  return requestAccessToken(accountConfig.username, accountConfig.refresh_token)
    .then(ddToken => access_token = ddToken)
    .then(getFirebaseToken)
    .then(firebaseToken => firebase.auth().signInWithCustomToken(firebaseToken))
    .then(() => !quiet && clearAndLog('Authenticated ⭐'))
    .then(() => access_token)
}

function clearAndLog(text) {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  console.log(text)
}
