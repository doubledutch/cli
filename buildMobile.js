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
const promisedExec = require('promised-exec')

const config = require('./config')
const packager = require('./packager')

async function current(platform, root) {
  console.log(chalk.blue(`Building ${platform}`))
  await packager.build({
    baseManifestFilename: path.join(__dirname, 'bundles', config.baseBundleVersion, `base.${platform}.${config.baseBundleVersion}.manifest`),
    entry: `./index.js`,
    manifestOut: `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest`,
    out: `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`,
    platform,
    root,
  })

  // Remove the bundle prelude and `require` definition, which are in the base bundle
  const bundle = fs.readFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`, {encoding: 'utf8'})
  const firstDefine = bundle.indexOf('\n__d')
  fs.writeFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`, bundle.substring(firstDefine))

  fs.renameSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`, `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`)
}

async function previous(root) {
  const tmp = `${process.env.TMPDIR}doubledutch-mobile`
  await promisedExec(`rm -rf ${tmp}`)
  await promisedExec(`mkdir ${tmp}`)
  await promisedExec(`cp -r ${root.replace(' ', '\\ ')} ${tmp} && cp ${tmp}/mobile/index.js ${tmp}/mobile/index.ios.js && cp ${tmp}/mobile/index.js ${tmp}/mobile/index.android.js && rm ${tmp}/mobile/.babelrc`)
  await promisedExec(`mkdir ${tmp}/mobile/build && mkdir ${tmp}/mobile/build/bundle`)
  console.log(chalk.blue('temporarily installing previous versions of packages...'))
  await promisedExec(`pushd ${tmp}/mobile && yarn remove @doubledutch/rn-client react react-native react-native-camera rn-fetch-blob react-native-video react-native-youtube ; yarn add @doubledutch/rn-client@4.x babel-plugin-transform-runtime react@16.0.0-alpha.12 react-addons-update@15.6.0 react-native@0.46.4 react-native-camera@0.10.0 react-native-fetch-blob@0.10.8 react-native-video@2.0.0 react-native-youtube@1.1.0 babel-preset-env@1.6.x babel-preset-react@6.24.x @doubledutch/cli@1.7.x && popd`)
  fs.writeFileSync(`${tmp}/mobile/buildPrevious.js`, `
    const buildMobile = require('@doubledutch/cli/buildMobile')
    buildMobile('ios', '${tmp}/mobile').then(() => {
      buildMobile('android', '${tmp}/mobile')
    })
  `, {encoding: 'utf8'})
  console.log(chalk.blue('bundling...'))
  await promisedExec(`pushd ${tmp}/mobile && node buildPrevious && popd`)
  await promisedExec(`mv ${tmp}/mobile/build/bundle/* ${path.join(root, '../build/bundle/')}`)
}

module.exports = { current, previous }