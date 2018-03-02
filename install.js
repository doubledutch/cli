const chalk = require('chalk')
const firebase = require('firebase')
const { authenticate, getCurrentExtension } = require('./utils')

module.exports = function install(eventID) {
  const extension = getCurrentExtension()
  if (!extension) return

  authenticate.eventAdmin()
    .then(() => firebase.database().ref(`installs/${extension}/events/${eventID}`).set(true))
    .catch(err => {
      if (err.code === 'PERMISSION_DENIED') throw `You do not have permission to install '${extension}' to event ${eventID}`
      throw err
    })
    .then(() => console.log(chalk.green(`Installed ${extension} to event ${eventID} ✨`)))
    .then(() => process.exit(0)) // firebase ref.set() is not releasing something, even after the Promise is resolved.
    .catch(err => console.error(typeof err === 'string' ? chalk.red(err) : err))
}
