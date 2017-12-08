'use strict'

const fs = require('fs')
const rimraf = require('rimraf')

const packager = require('../../packager.js')
const { baseBundleVersion } = require('../../config')

const bundleDir = `../${baseBundleVersion}`

console.log(`\n\n**************************************\n  Creating base bundles in ${bundleDir}\n**************************************\n\n`)

rimraf.sync(bundleDir)
fs.mkdirSync(bundleDir)

const platforms = ['ios', 'android']

Promise.all(platforms.map(async platform => {
  const { metroBundle } = await packager({
    entry: './base.js',
    manifestOut: `${bundleDir}/base.${platform}.${baseBundleVersion}.manifest`,
    out: `${bundleDir}/base.${platform}.${baseBundleVersion}.bundle`,
    platform,
    root: process.cwd()
  })

  const bundle = fs.readFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, {encoding: 'utf8'})
  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, bundle.replace(/\nrequire\(.+\);?/g, `\n// DoubleDutch base bundle ${platform}.${baseBundleVersion}\n`))

  fs.writeFileSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.sourcemap`, metroBundle.map)

  fs.renameSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js`, `${bundleDir}/base.${platform}.${baseBundleVersion}.bundle`)
  fs.renameSync(`${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.js.meta`, `${bundleDir}/base.${platform}.${baseBundleVersion}.bundle.meta`)
})).then(() => {
  console.log(`\n\n**************************************\n  Done\n**************************************\n\n`)
})
