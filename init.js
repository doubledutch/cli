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
const { removeSync } = require('fs-extra')
const path = require('path')
const { spawn } = require('child_process')
const chalk = require('chalk')
const inquirer = require('inquirer')
const { reactNativeVersion, reactVersion, baseBundleVersion } = require('./config')

module.exports = function init(cmd, options) {
  assertFolderEmpty()

  return inquirer.prompt([
    { type: 'confirm', name: 'mobile', default: true, message: 'Create a mobile template?' },
    { type: 'confirm', name: 'adminWeb', default: true, message: 'Create an admin web template?' },
    { type: 'confirm', name: 'attendeeWeb', default: false, message: 'Create an attendee web template?' }
  ]).then(buildSettings => {
    const projectName = path.parse(process.cwd()).name.replace(/[^a-zA-Z0-9]/g, '') // alphanumeric chars from folder name
    populateDir(projectName, buildSettings)

    console.log(chalk.green('Initializing project. This may take a few minutes...'))

    return new Promise((resolve, reject) => {
      spawn('./doubledutch.sh', [], {shell: true, stdio: 'inherit'}).on('exit', (code, signal) => {
        console.log('Finished creating project')
        fs.unlinkSync('./doubledutch.sh')
        fs.unlinkSync('./package-lock.json')
        removeSync('./node_modules')
        removeSync('./tmp')
        resolve()      
      })  
    })
  })  
}

function assertFolderEmpty() {
  if (fs.readdirSync('.').length) {
    console.log('The current folder is not empty.')
    process.exit(1)
  }
}

const makePackageJSON = (projectName) => `\
{
  "name": "${projectName}",
  "version": "0.0.1",
  "baseBundleVersion": "${baseBundleVersion}",
  "private": true,
  "scripts": {
    "start": "pushd mobile && npm run ios && popd && pushd web/admin && npm start && popd"
  },
  "dependencies": {
    "react": "${reactVersion}",
    "react-native": "${reactNativeVersion}",
    "react-native-cli": "^2.0.1"
  },
  "doubledutch": {
    "extension": true
  }
}
`

const nativeModules = ['react-native-camera@0.10.0', 'react-native-fetch-blob@0.10.8', 'react-native-video@2.0.0', 'react-native-youtube@1.0.1']
const makeLinks = () => nativeModules.map(makeLink).join('\n')
const makeLink = (module) =>
  `echo Adding ${module}...\n` + `npm install --save ${module}\n` + `echo Linking ${module}...\n` + `node node_modules/react-native/local-cli/cli.js link ${module}`

const doubledutchSH = (projectName, buildSettings) => `\
#!/usr/bin/env bash
if ! xcodebuild -checkFirstLaunchStatus ; then echo; echo "XCode EULA has not been accepted. Launch XCode and accept the license or run"; echo "xcodebuild -license accept"; echo; exit 1; fi
date
echo Initializing '${chalk.green(projectName)}'
npm install
echo ${chalk.green('Cloning extension-sample')}
git clone https://github.com/doubledutch/extension-sample.git tmp
rm -rf tmp/.git
shopt -s dotglob && mv tmp/* ./
${buildSettings.mobile ? `\
echo ${chalk.green('Initializing React Native project')}
pushd tmp
node ../node_modules/react-native-cli/index.js init ${projectName} --version react-native@${reactNativeVersion}
popd
mkdir mobile
mkdir mobile/ios
mv tmp/${projectName}/ios/* mobile/ios/
mkdir mobile/android
mv tmp/${projectName}/android/* mobile/android/
pushd mobile
sed -i '' 's/extension-sample/${projectName}/' package.json
sed -i '' 's/extension-sample/${projectName}/' index.ios.js
sed -i '' 's/extension-sample/${projectName}/' index.android.js
sed -i '' 's/extension-sample/${projectName}/' index.web.js
sed -i '' 's/extension-sample/${projectName}/' src/home-view.js
npm install
echo 'Fixing up xcode to use DD packager'
sed -i.bak s/node_modules\\\\/react-native\\\\/packager/node_modules\\\\/dd-rn-packager\\\\/react-native\\\\/packager/g ios/${projectName}.xcodeproj/project.pbxproj
sed -i.bak s/packager\\\\/launchPackager.command/..\\\\/dd-rn-packager\\\\/react-native\\\\/packager\\\\/launchPackager.command/g node_modules/react-native/React/React.xcodeproj/project.pbxproj
echo ${chalk.green('Installing mobile dependencies')}
npm install
${makeLinks()}
node ./node_modules/rnpm/bin/cli link
popd` : `echo ${chalk.yellow('mobile disabled')}; rm -rf mobile`}
${buildSettings.adminWeb ? `\
pushd web/admin
sed -i '' 's/extension-sample/${projectName}/' src/App.js
npm install
popd` : `echo ${chalk.yellow('web/admin disabled')}; rm -rf web/admin`}
${buildSettings.attendeeWeb ? `\
pushd web/attendee
npm install
popd` : `echo ${chalk.yellow('web/attendee disabled')}; rm -rf web/attendee`}
date
`

const fileExists = (pathName) => {
  try {
    fs.statSync(pathName);
    return true;
  } catch (e) {
    return false;
  }
}

const populateDir = (projectName, buildSettings) => {
  const permissionGeneral = { encoding: 'utf8', mode: 0o666 }
  const permissionExec = { encoding: 'utf8', mode: 0o777 }

  // Create package.json if it doesn't exist
  if (!fileExists('package.json')) {
    fs.appendFileSync(
      'package.json',
      makePackageJSON(projectName),
      permissionGeneral
    )
    console.info(`Created package.json`)
  } else {
    console.info('package.json already exists, not modifying it.')
  }

  if (!fileExists('doubledutch.sh')) {
    fs.appendFileSync(
      'doubledutch.sh',
      doubledutchSH(projectName, buildSettings),
      permissionExec
    )
    console.info(`Created doubledutch.sh`)
  } else {
    console.info('doubledutch.sh already exists; not modifying it.')
  }
}