const fs = require('fs')
const path = require('path')
const ddHome = resolveHome('~/.dd')
const ddConfig = path.join(ddHome, 'config.json')

module.exports = {
  ddHome,
  ddConfig,
  fileExists,
  firebase: require('./firebase'),
  promisify,
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
  const config = { ...tokenResponse, username }
  fs.writeFileSync(ddConfig, config)
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
