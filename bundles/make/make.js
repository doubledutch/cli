'use strict'

// These are only included to make react native patch version changes backward compatible.
// These arrays should be empty when creating a completely new bundle version that should not be
// backward compatible with any previous version.
// 0.59.3 ==> 0.59.4 backward compatibility.
const skipIds = {android: [104], ios: [108]}

const fs = require('fs')
const rimraf = require('rimraf')

const { build } = require('../../packager.js')
const { baseBundleVersion } = require('../../config')

const bundleDir = `../${baseBundleVersion}`

const baseModuleId = 1000

console.log(`\n\n**************************************\n  Creating base bundles in ${bundleDir}\n**************************************\n\n`)

rimraf.sync(bundleDir)
fs.mkdirSync(bundleDir)

const platforms = ['ios', 'android']

Promise.all(platforms.map(async platform => {
  const manifest = { modules: {} }
  let id = 1

  function processModuleFilter(m, i) {
    if (m.path === `${__dirname}/base.js`) return true

    const isExcluded = [
      '__prelude__',
      `require-${__dirname}/base.js`,
      'source-map',
    ].includes(m.path) || m.path.endsWith('/node_modules/metro/src/lib/polyfills/require.js')

    if (!isExcluded) {
      const path = m.path.replace(`${__dirname}/node_modules/`, '')
      if (!manifest.modules[path]) {
        manifest.modules[path] = {id}
        ++id
        while (skipIds[platform].includes(id) || id === baseModuleId) {
          ++id
        }
      }
    }

    return !['source-map'].includes(m.path)
  }

  function createModuleIdFactory() {
    return path => {
      if (path === `${__dirname}/base.js`) return baseModuleId

      const sourcePath = path.replace(__dirname + '/node_modules/', '')
      if (manifest.modules[sourcePath]) {
        return manifest.modules[sourcePath].id
      }

      // Not expected to be serialized, since it is not in the created base manifest.
      return 1000000000
    }
  }

  const metroBundle = await build({
    entry: './base.js',
    out: `${bundleDir}/base.${platform}.${baseBundleVersion}.bundle`,
    platform,
    root: process.cwd(),
    processModuleFilter,
    createModuleIdFactory
  })

  manifest.modules.__BASE__ = { id: baseModuleId }
  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.manifest`, JSON.stringify(manifest, null, 2))

  const bundle = fs.readFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, {encoding: 'utf8'})

  const bundleJS = `// DoubleDutch base bundle ${platform}.${baseBundleVersion}\n\n`
    + massageBundle(bundle.replace(/\n__r\(1000000000\);?/g, '\n'))

  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, bundleJS)

  fs.renameSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, `${bundleDir}/base.${platform}.${baseBundleVersion}.manifest.bundle`)
})).then(() => {
  console.log(`\n\n**************************************\n  Done\n**************************************\n\n`)
})

function massageBundle(bundle) {
  return bundle.replace('{return self}', '{return typeof self==="undefined"?null:self}')
}