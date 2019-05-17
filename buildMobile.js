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
const {execSync} = require('child_process')
const exec = command => execSync(command, {stdio: 'inherit'})

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
  const bundleJSPath = `./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle.js`
  const bundle = fs.readFileSync(bundleJSPath, {encoding: 'utf8'})
  fs.unlinkSync(bundleJSPath)
  const firstDefine = bundle.indexOf('\n__d')
  fs.writeFileSync(`./build/bundle/index.${platform}.${config.baseBundleVersion}.manifest.bundle`, bundle.replace(/\/\/# sourceMappingURL\=.*/, ''))
}

async function previous(root, extensionName) {
  const tmp = `${process.env.TMPDIR}doubledutch-extension-${extensionName}`
  exec(`(mkdir ${tmp} && mkdir ${tmp}/mobile && mkdir ${tmp}/mobile/build && mkdir ${tmp}/mobile/build/bundle) || echo "Previously built. Reusing folder."`)

  // Link folders/files that we don't have to modify.  Copy and modify what we must.
  // Keep node_modules and package-lock.json for faster subsequent builds.
  const prevMobileFiles = fs.readdirSync(path.join(tmp, 'mobile'))
    .filter(x => !['node_modules', 'build', 'package-lock.json', 'yarn.lock'].includes(x))
  for (let i = 0; i < prevMobileFiles.length; ++i) {
    const x = prevMobileFiles[i]
    exec(`rm -rf ${path.join(tmp, 'mobile', x)}`)
  }

  const mobileFiles = fs.readdirSync(root)
    .filter(x => !['node_modules', '.babelrc', 'babel.config.js', 'build', 'package.json', 'package-lock.json', 'yarn.lock', 'yarn-error.log'].includes(x))
  for (let i = 0; i < mobileFiles.length; ++i) {
    const x = mobileFiles[i]
    exec(`cp -R ${path.join(root, x)} ${path.join(tmp, 'mobile', x)}`)
    if (x === 'index.js') {
      exec(`cp ${path.join(root, x)} ${path.join(tmp, 'mobile', 'index.ios.js')}`)
      exec(`cp ${path.join(root, x)} ${path.join(tmp, 'mobile', 'index.android.js')}`)
    }
  }

  const packageJSON = fs.readFileSync(path.join(root, 'package.json'), {encoding: 'utf8'})
  const modifiedPackageJSON = packageJSON
    .replace(/"@doubledutch\/rn\-client": "[^"]*"/, '"@doubledutch/rn-client": "4.x"')
    .replace(/"react": "[^"]*"/, '"react": "16.0.0-alpha.12"')
    .replace(/"react\-native": "[^"]*"/, '"react-native": "0.46.4"')
    .replace(/"react\-native\-camera": "[^"]*"/, '"react-native-camera": "0.10.0"')
    .replace(/"rn\-fetch\-blob": "[^"]*"/, '"react-native-fetch-blob": "0.10.8"')
    .replace(/"react\-native\-video": "[^"]*"/, '"react-native-video": "2.0.0"')
    .replace(/"react\-native\-youtube": "[^"]*"/, '"react-native-youtube": "1.1.0"')
    .replace(/"dependencies"\s*:\s*{/, '"dependencies": {\n    "babel-plugin-transform-runtime": "*",\n    "react-addons-update": "15.6.0",\n    "babel-preset-env": "1.6.x",\n    "babel-preset-react": "6.24.x",\n    "@doubledutch/cli": "1.7.x",')
  fs.writeFileSync(path.join(tmp, 'mobile', 'package.json'), modifiedPackageJSON, {encoding: 'utf8'})

    
  console.log(chalk.blue('installing mobile dependencies (0.46.4)...'))
  exec(`pushd ${tmp}/mobile && npm install && popd`)
  fs.writeFileSync(`${tmp}/mobile/buildPrevious.js`, `
    const buildMobile = require('@doubledutch/cli/buildMobile')
    buildMobile('ios', '${tmp}/mobile').then(() => {
      buildMobile('android', '${tmp}/mobile')
    })
  `, {encoding: 'utf8'})
  console.log(chalk.blue('bundling...'))
  exec(`pushd ${tmp}/mobile && node buildPrevious && popd`)
  exec(`mv ${tmp}/mobile/build/bundle/* ${path.join(root, '../build/bundle/')}`)
}

module.exports = { current, previous }