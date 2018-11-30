/*
 * Copyright 2018 DoubleDutch, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

const config = require('./config')
const packager = require('./packager')

module.exports = async function buildMobile(platform, root) {
  console.log(chalk.blue(`Building ${platform}`))
  const { metroBundle } = await packager({
    baseManifestFilename: path.join(__dirname, 'bundles', config.baseBundleVersion, `base.${platform}.${config.baseBundleVersion}.manifest`),
    entry: `./index.${platform}.js`,
    manifestOut: `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest`,
    out: `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`,
    platform,
    root,
  })

  // Remove the bundle prelude and `require` definition, which are in the base bundle
  const bundle = fs.readFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`, {encoding: 'utf8'})
  const firstDefine = bundle.indexOf('\n__d')
  fs.writeFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`, bundle.substring(firstDefine))

  fs.writeFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.sourcemap`, metroBundle.map)
  fs.renameSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`, `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`)
  fs.renameSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js.meta`, `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.meta`)
}
