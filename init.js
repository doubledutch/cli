const fs = require('fs')
const { removeSync } = require('fs-extra')
const path = require('path')
const { spawn } = require('child_process')
const chalk = require('chalk')
const inquirer = require('inquirer')
const { reactNativeVersion, reactVersion, baseBundleVersion } = require('./config')
const { enforceYarnInstallation } = require('./utils/yarn')

module.exports = function init(cmd, options) {
  assertFolderEmpty()

  return inquirer.prompt([
    { type: 'confirm', name: 'mobile', default: true, message: 'Create a mobile template?' },
    { type: 'confirm', name: 'adminWeb', default: true, message: 'Create an admin web template?' },
    { type: 'confirm', name: 'attendeeWeb', default: false, message: 'Create an attendee web template?' }
  ]).then(buildSettings => {
    const projectName = path.parse(process.cwd()).name
    populateDir(projectName, buildSettings)

    console.log(chalk.green('Initializing project. This may take a few minutes...'))

    return new Promise((resolve, reject) => {
      spawn('./doubledutch.sh', [], {shell: true, stdio: 'inherit'}).on('exit', (code, signal) => {
        console.log('Finished creating project')
        fs.unlinkSync('./doubledutch.sh')
        fs.unlinkSync('./yarn.lock')
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
    "start": "react-native start",
    "run" : "node_modules/react-native/local-cli/cli.js run-ios"
  },
  "dependencies": {
    "react": "${reactVersion}",
    "react-native": "${reactNativeVersion}",
    "react-native-cli": "^2.0.1"
  },
  "devDependencies": {
  },
  "doubledutch": {
    "feature": true
  }
}
`

const nativeModules = ['react-native-camera', 'react-native-fetch-blob', 'react-native-video', 'react-native-youtube']
const makeLinks = () => nativeModules.map(makeLink).join('\n')
const makeLink = (module) =>
  `echo Adding ${module}...\n` + `yarn add ${module}\n` + `echo Linking ${module}...\n` + `node node_modules/react-native/local-cli/cli.js link ${module}`

const doubledutchSH = (projectName, buildSettings) => `\
#!/usr/bin/env bash
date
echo Initializing '${chalk.green(projectName)}'
yarn
echo ${chalk.green('Cloning feature-sample')}
git clone https://github.com/doubledutch/feature-sample.git tmp
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
sed -i '' 's/feature-sample/${projectName}/' package.json
sed -i '' 's/feature-sample/${projectName}/' index.ios.js
sed -i '' 's/feature-sample/${projectName}/' index.android.js
sed -i '' 's/feature-sample/${projectName}/' index.web.js
sed -i '' 's/feature-sample/${projectName}/' src/home-view.js
yarn
echo 'Fixing up xcode to use DD packager'
sed -i.bak s/node_modules\\\\/react-native\\\\/packager/node_modules\\\\/dd-rn-packager\\\\/react-native\\\\/packager/g ios/${projectName}.xcodeproj/project.pbxproj
sed -i.bak s/packager\\\\/launchPackager.command/..\\\\/dd-rn-packager\\\\/react-native\\\\/packager\\\\/launchPackager.command/g node_modules/react-native/React/React.xcodeproj/project.pbxproj
echo ${chalk.green('Installing mobile dependencies')}
yarn
${makeLinks()}
popd` : `echo ${chalk.yellow('mobile disabled')}; rm -rf mobile`}
${buildSettings.adminWeb ? `\
pushd web/admin
yarn
popd` : `echo ${chalk.yellow('web/admin disabled')}; rm -rf web/admin`}
${buildSettings.attendeeWeb ? `\
pushd web/attendee
yarn
popd` : `echo ${chalk.yellow('web/attendee disabled')}; rm -rf web/attendee`}
date
`

const makeFeatureJSON = (projectName, buildSettings) => `\
{
  "name": "${projectName}",
  "version": "0.0.1",
  "baseBundleVersion": "${baseBundleVersion}",
  "description": "Description for ${projectName}",
  "components": {
    "mobile": {
      "enabled": ${buildSettings.mobile},
      "build": true
    },
    "adminWeb": {
      "enabled": ${buildSettings.adminWeb},
      "build": true,
      "customURL": ""
    },
    "attendeeWeb": {
      "enabled": ${buildSettings.attendeeWeb},
      "build": true,
      "customURL": ""
    }
  }
}
`

const gitignore = () => `\
node_modules
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