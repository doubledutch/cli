const fs = require('fs')

module.exports = function getCurrentExtension() {
  const { fileExists } = require('./index')
  if (!fileExists('package.json')) {
    console.log('This does not appear to be a doubledutch extension project. No package.json found.')
    return null
  }
  const extensionPackageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (!extensionPackageJSON.doubledutch) {
    console.log('This does not appear to be the root folder of a DoubleDutch extension project. package.json does not have a doubledutch section.')
    return null
  }
  
  const extension = extensionPackageJSON.name
  return extension
}
