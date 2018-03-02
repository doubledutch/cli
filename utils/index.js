const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const request = require('superagent')
const config = require('../config')
const ddHome = resolveHome('~/.dd')
const ddConfig = path.join(ddHome, 'config.json')

module.exports = {
  authenticate: require('./authenticate'),
  ddHome,
  ddConfig,
  fileExists,
  firebase: require('./firebase'),
  getCurrentExtension: require('./getCurrentExtension'),
  promisify,
  requestAccessToken,
  saveConfig,
  yarn: require('./yarn')
}

function resolveHome(filepath) {
  if (filepath.startsWith('~')) {
    return path.join(process.env.HOME, filepath.slice(1))
  }
  return filepath
}

function promisify(fn, fnName = null) {
  return new Promise((resolve, reject) => {
    fnName ? fn[fnName](callback) : fn(callback)

    function callback(err, res) {
      if (err) return reject(err)
      resolve(res)
    }
  })
}

function saveConfig(username, tokenResponse) {
  const config = Object.assign({}, tokenResponse, {username})
  fs.writeFileSync(ddConfig, JSON.stringify(config))
  return config
}

function fileExists(pathName) {
  try {
    fs.statSync(pathName)
    return true
  } catch (e) {
    return false
  }
}

function requestAccessToken(username, refresh_token) {
  const invalidCredMessage = chalk.yellow('Invalid credentials') + '. Please run ' + chalk.blue('doubledutch login')
  return promisify(
    request.post(`${config.identity.rootUrl}/access/tokens`)
    .auth(config.identity.cli.identifier, config.identity.cli.secret)
    .type('form')
    .send({ grant_type: 'refresh_token', refresh_token: refresh_token })
  , 'end')
  .catch(err => {
    if ([400, 401].includes(err.status)) throw invalidCredMessage
  })
  .then(res => {
    if (!res.ok) throw invalidCredMessage
    return res.body
  })
  .then(result => {
    saveConfig(username, result)
    return result.access_token
  })
}