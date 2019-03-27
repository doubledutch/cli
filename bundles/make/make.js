'use strict'

const fs = require('fs')
const rimraf = require('rimraf')

const { build } = require('../../packager.js')
const { baseBundleVersion } = require('../../config')

const bundleDir = `../${baseBundleVersion}`

const reserveModuleIdsUpTo = 1000

console.log(`\n\n**************************************\n  Creating base bundles in ${bundleDir}\n**************************************\n\n`)

rimraf.sync(bundleDir)
fs.mkdirSync(bundleDir)

const platforms = ['ios', 'android']

Promise.all(platforms.map(async platform => {
  const manifest = { modules: {} }
  let id = 1

  function processModuleFilter(m, i) {
    const isExcluded = [
      '__prelude__',
      `require-${__dirname}/base.js`,
      'source-map',
      `${__dirname}/base.js`,
    ].includes(m.path) || m.path.endsWith('/node_modules/metro/src/lib/polyfills/require.js')

    if (!isExcluded) {
      const path = m.path.replace(`${__dirname}/node_modules/`, '')
      if (!manifest.modules[path]) {
        manifest.modules[path] = {id: id++}
      }
    }

    return ![`${__dirname}/base.js`, 'source-map'].includes(m.path)
  }

  function createModuleIdFactory() {
    return path => {
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

  if (id <= reserveModuleIdsUpTo) manifest.modules.__PLACEHOLDER__ = { id: reserveModuleIdsUpTo }
  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.manifest`, JSON.stringify(manifest, null, 2))

  const bundle = fs.readFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, {encoding: 'utf8'})
  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, `// DoubleDutch base bundle ${platform}.${baseBundleVersion}\n\n` + bundle.replace(/\n__r\(.+\);?/g, '\n'))

  fs.renameSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, `${bundleDir}/base.${platform}.${baseBundleVersion}.bundle`)
})).then(() => {
  console.log(`\n\n**************************************\n  Done\n**************************************\n\n`)
})
