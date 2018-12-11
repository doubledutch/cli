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
const promisedExec = require('promised-exec')
const chalk = require('chalk')
const { removeSync } = require('fs-extra')

const { getCurrentExtension } = require('./utils')

const oldBaseBundleVersion = '0.46.4'
const baseBundleVersion = '0.57.5'

module.exports = function upgradeReactNative() {
  doUpgrade()
  .catch(err => console.error(err))
}
async function doUpgrade() {
  const extension = getCurrentExtension()
  if (!extension) return

  console.log(`${chalk.red(`React Native ${oldBaseBundleVersion}`)} ==> ${chalk.green(`React Native ${baseBundleVersion}`)}`)

  console.log(chalk.red('removing mobile/ios folder...'))
  removeSync('mobile/ios')

  console.log(chalk.red('removing mobile/android folder...'))
  removeSync('mobile/android')

  console.log(chalk.red('removing unsupported mobile/web folder...'))
  removeSync('mobile/web')

  console.log(chalk.green('adding .babelrc file...'))
  fs.writeFileSync(path.join(process.cwd(), 'mobile/.babelrc'), '{\n  "presets": ["module:metro-react-native-babel-preset"]\n}\n')

  console.log(chalk.green('adding .watchmanconfig file...'))
  fs.writeFileSync(path.join(process.cwd(), 'mobile/.watchmanconfig'), '{}\n')

  console.log(chalk.blue("+ AppRegistry.registerComponent('section')..."))
  if (fs.existsSync(path.join(process.cwd(), 'mobile/index.ios.js'))) {
    replaceInFile(path.join(process.cwd(), 'mobile/index.ios.js'), /AppRegistry.registerComponent\('.*',\s*\(\)\s*=>\s*HomeView\)/, "$&\nAppRegistry.registerComponent('section', () => HomeView)")
    fs.renameSync(path.join(process.cwd(), 'mobile/index.ios.js'), path.join(process.cwd(), 'mobile/index.js'))
  }

  const del = fileName => fs.existsSync(path.join(process.cwd(), fileName)) && fs.unlinkSync(path.join(process.cwd(), fileName))

  console.log(chalk.red('removing mobile/index.*.js'))
  del('mobile/index.android.js')
  del('mobile/index.bazaar.js')
  del('mobile/index.rnweb.js')
  del('mobile/index.web.js')

  console.log(chalk.blue('updating mobile/package.json scripts...'))
  replaceInFile(path.join(process.cwd(), 'mobile/package.json'), /"start": ".*"/, '"start": "(sleep 5 ; echo ; echo ===================== ; echo Launch the DoubleDutch Simulator to connect. See https://github.com/doubledutch/simulator#doubledutch-extension-simulator ; echo ===================== ) & react-native start --port 8081"')
  replaceInFile(path.join(process.cwd(), 'mobile/package.json'), /"clean": ".*"/, '"clean": "watchman watch-del-all && rm -rf node_modules && rm -rf /tmp/metro-bundler-cache-* && rm -rf /tmp/haste-map-react-native-packager-* && (yarn || npm i)"')
  replaceInFile(path.join(process.cwd(), 'mobile/package.json'), /\s*"ios": "[^"]*",?\n/, '\n')
  replaceInFile(path.join(process.cwd(), 'mobile/package.json'), /\s*"android": "[^"]*",?\n/, '\n')
  replaceInFile(path.join(process.cwd(), 'mobile/package.json'), /("scripts"\s*:\s*{[^}]*),(\s*})/, '$1$2')

  console.log(chalk.blue('updating root package.json...'))
  replaceInFile(path.join(process.cwd(), 'package.json'), /"baseBundleVersion"\s*:\s*"[0-9\.]*"/, `"baseBundleVersion": "${baseBundleVersion}"`)
  replaceInFile(path.join(process.cwd(), 'package.json'), /"start"\s*:\s*"[^"]*"/, `"start": "pushd mobile && npm start && popd && pushd web/admin && npm start && popd"`)
  replaceInFile(path.join(process.cwd(), 'package.json'), /"dependencies"\s*:\s{[^}]*},?\s*/, '')

  // NOTE: These versions must be updated when we move to a new base bundle / React Native version.

  console.log(chalk.blue('updating @doubledutch/rn-client to 5.0.1-alpha'))
  await promisedExec('pushd mobile && yarn remove @doubledutch/rn-client && yarn add @doubledutch/rn-client@5.0.1-alpha ; popd')
  console.log(chalk.blue('removing babel-plugin-transform-runtime'))
  await promisedExec('pushd mobile && yarn remove babel-plugin-transform-runtime ; popd')
  console.log(chalk.blue('updating react & react-native'))
  await promisedExec('pushd mobile && yarn remove react react-native && yarn add react@16.6.1 react-native@0.57.5 ; popd')
  console.log(chalk.blue('updating react-native-camera'))
  await promisedExec('pushd mobile && yarn remove react-native-camera && yarn add react-native-camera@1.4.3 ; popd')
  console.log(chalk.blue('updating react-native-video'))
  await promisedExec('pushd mobile && yarn remove react-native-video && yarn add react-native-video@3.2.1 ; popd')
  console.log(chalk.blue('updating react-native-youtube'))
  await promisedExec('pushd mobile && yarn remove react-native-youtube && yarn add react-native-youtube@1.1.0 ; popd')
  console.log(chalk.blue('updating react-native-fetch-blob to rn-fetch-blob'))
  await promisedExec('pushd mobile && yarn remove react-native-fetch-blob && yarn add rn-fetch-blob@0.10.13 ; popd')

  console.log(chalk.blue('updating devDependencies'))
  await promisedExec('pushd mobile && yarn remove babel-eslint babel-preset-env babel-preset-react && yarn add --dev babel-jest@23.6.0 jest@23.6.0 metro-react-native-babel-preset@0.50.0 react-test-renderer@16.6.1 ; popd')

  console.log(chalk.green('DONE!  ') + chalk.blue(`Mobile project upgraded to React Native ${baseBundleVersion}`))
}

function replaceInFile(fileName, from, to) {
  const data = fs.readFileSync(fileName, 'utf8')
  const result = data.replace(from, to)
  if (result !== data) {
    fs.writeFileSync(fileName, result, {encoding:'utf8'})
    console.log(`${chalk.gray(fileName)} ${chalk.green(to)}`)
  }
}
