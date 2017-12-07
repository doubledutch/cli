'use strict'

const fs = require('fs')
const rimraf = require('rimraf')

const packager = require('../../packager.js')
const { version } = require('./package.json')

const bundleDir = `../${version}`

console.log(`\n\n**************************************\n  Creating base bundles in ${bundleDir}\n**************************************\n\n`)

rimraf.sync(bundleDir)
fs.mkdirSync(bundleDir)

const platforms = ['ios', 'android']

Promise.all(platforms.map(async platform => {
  const { metroBundle } = await packager({
    entry: './base.js',
    manifestOut: `${bundleDir}/base.${platform}.${version}.manifest`,
    out: `${bundleDir}/base.${platform}.${version}.bundle`,
    platform,
    root: process.cwd()
  })

  const bundle = fs.readFileSync(`${bundleDir}/base.${platform}.${version}.bundle.js`, {encoding: 'utf8'})
  fs.writeFileSync(`${bundleDir}/base.${platform}.${version}.bundle.js`, bundle.replace(/\nrequire\(.+\);?/g, `\n// DoubleDutch base bundle ${platform}.${version}\n`))

  fs.writeFileSync(`${bundleDir}/base.${platform}.${version}.sourcemap`, metroBundle.map)

  fs.renameSync(`${bundleDir}/base.${platform}.${version}.bundle.js`, `${bundleDir}/base.${platform}.${version}.bundle`)
  fs.renameSync(`${bundleDir}/base.${platform}.${version}.bundle.js.meta`, `${bundleDir}/base.${platform}.${version}.bundle.meta`)
})).then(() => {
  console.log(`\n\n**************************************\n  Done\n**************************************\n\n`)
})
