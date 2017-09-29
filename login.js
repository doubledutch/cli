const fs = require('fs')
const chalk = require('chalk')
const inquirer = require('inquirer')
const request = require('superagent')
const config = require('./config')
const { ddHome, ddConfig, fileExists, promisify, saveConfig } = require('./utils')

module.exports = function login(cmd, options) {
  let promise
  if (fileExists(ddConfig)) {
    let configJSON
    try { configJSON = JSON.parse(fs.readFileSync(ddConfig, 'utf8')) } catch (e) { configJSON = { username: '<unknown>' } }
    promise = inquirer.prompt([{ type: 'confirm', name: 'confirm', message: `Already authenticated as ${chalk.blue(configJSON.username)}. Overwrite?`, default: true }])
      .then(result => result.confirm && promptAndLogin())
  } else {
    promise = promptAndLogin()
  }

  promise
    .then(result => result.username && console.log(chalk.green(`logged in to DoubleDutch as ${result.username}`)))
    .catch(err => console.error(typeof err === 'string' ? chalk.yellow(err) : err))
}

function promptAndLogin() {
  return inquirer.prompt([
    { type: 'input', name: 'username', message: 'DoubleDutch username (email address):' },
    { type: 'password', name: 'password', message: 'password:' }
  ]).then(creds =>
    authenticate(creds).then(result => {
      try { fs.mkdirSync(ddHome) } catch(e) {}
      return saveConfig(creds.username, result)
    })
  )
}

function authenticate({username, password}) {
  return promisify(
    request.post(`${config.identity.rootUrl}/access/tokens`)
    .auth(config.identity.cli.identifier, config.identity.cli.secret)
    .type('form')
    .send({ grant_type: 'password', username, password })
  , 'end').catch(err => {
    if (err.status === 400) throw 'Incorrect username and/or password'
  }).then(res => res.body)
}