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
const promisedExec = require('promised-exec')
const { removeSync } = require('fs-extra')
const path = require('path')
const request = require('superagent')
const chalk = require('chalk')
const config = require('./config')
const pkg = require('./package.json')
const { ddConfig, fileExists, requestAccessToken } = require('./utils')
const DiffMatchPatch = require('diff-match-patch')
const firebaseUtils = require('./utils/firebase')
const buildMobile = require('./buildMobile')
const firebase = require('firebase')

module.exports = function publish(cmd, options) {
  if (!fileExists('package.json')) return console.log('This does not appear to be a doubledutch extension project. No package.json found.')
  const extensionPackageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (!extensionPackageJSON.doubledutch) return console.log('This does not appear to be the root folder of a DoubleDutch extension project. package.json does not have a doubledutch section.')

  if (!fileExists(ddConfig)) return console.log('You have not logged in to doubledutch. Please run ' + chalk.blue('dd login'))

  const configJSON = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))

  return publishBinary(configJSON, extensionPackageJSON, cmd)
    .then(result => {
      if (!cmd.apiOnly) {
        Object.keys(result).forEach(key => console.log(chalk.green(`  ${key}: ${result[key]}`)))
      }
      process.exit(0)
    })
    .catch(err => console.error(err))
}

async function publishBinary(accountConfig, packageJSON, cmd) {
  const extensionName = packageJSON.name
  if (!extensionName.match(/^[a-zA-Z0-9\-_]+$/)) {
    throw `Extension name in package.json (${extensionName}) is not valid. Letters, numbers, -, and _ are valid.`
  }

  const dmp = new DiffMatchPatch()
  dmp.Diff_Timeout = 60

  if (!cmd.skipBuild) {
    removeSync('build/')

    fs.mkdirSync('build')
    fs.mkdirSync('build/bundle');
    fs.mkdirSync('build/site')
    fs.mkdirSync('build/site/private')
    fs.mkdirSync('build/site/public')
    fs.mkdirSync('build/api')
  }

  removeSync('tmp/')
  fs.mkdirSync('tmp');

  try {
    console.log(chalk.blue(`Authenticating as ${accountConfig.username}...`))
    // TODO - we should really just check the expiration of the token
    firebase.initializeApp(firebaseUtils.config)
    const accessToken = await requestAccessToken(accountConfig.username, accountConfig.refresh_token)
    const firebaseToken = await firebaseUtils.getDeveloperToken(accessToken)
    const userCredential = await firebase.auth().signInWithCustomToken(firebaseToken)
    const { user } = userCredential
    const firebaseIdToken = await user.getIdToken()
    console.log(chalk.blue('Authenticated ✔️'))

    if (!(await isExtensionNewOrOwnedBy(extensionName, user))) {
      // This is also checked on the server, but we should fail fast.
      throw `Access denied. The extension name '${extensionName}' is already taken. If you are trying to publish a new extension, please run 'doubledutch init' with a different name.`
    }
  
    if (!cmd.force && !cmd.apiOnly && await isAlreadyPublished(extensionName, packageJSON.version)) {
      throw `${extensionName}@${packageJSON.version} is already published. Please publish a new version.`
    }
  
    if (cmd.apiOnly) {
      console.log(`Publishing cloud functions ONLY for extension ${chalk.green(extensionName)} to DoubleDutch...`)
    } else {
      console.log(`Publishing extension ${chalk.green(extensionName)}@${chalk.green(packageJSON.version)} to DoubleDutch...`)
    }

    if (!cmd.skipBuild && !cmd.apiOnly) {
      if (fs.existsSync('mobile')) {
        await promisedExec('pushd mobile && yarn && popd')
        // Build each mobile platform with the metro bundler: https://github.com/facebook/metro
        const root = path.join(process.cwd(), 'mobile')
        await buildMobile.current('ios', root)
        if (!cmd.iosOnly) {
          await buildMobile.current('android', root)

          prevs = packageJSON.doubledutch.previousBaseVersions
          if (!prevs || (prevs.length && prevs.includes('0.46.4'))) {
            console.log(chalk.blue('building for 0.46.4...'))
            await buildMobile.previous(root, extensionName)
          }
        }
      } else {
        console.log(chalk.yellow('mobile folder not found. Skipping build.'))
      }
    }

    const commands = []

    if (!cmd.skipBuild) {
      if (!cmd.apiOnly && !cmd.iosOnly) {
        if (fileExists('web/admin')) {
          commands.push(
            [`pushd web/admin && yarn && npm run build && popd`, chalk.blue('Generating Admin web bundle')],
            [`cp -r web/admin/build/ build/site/private/`, chalk.blue('Copying Admin web bundle')]
          )
        } else {
          commands.push(
            [`echo skipping web/admin`, chalk.yellow('web/admin folder not found. Skipping build.')]
          )
        }
      }

      // if (fileExists('web/attendee')) {
      //   commands.push(
      //     [`pushd web/attendee && npm run build && popd`, chalk.blue('Generating Attendee web bundle')],
      //     [`cp -r web/attendee/build/ build/site/public/`, chalk.blue('Copying Attendee web bundle')]
      //   )
      // } else {
      //   commands.push(
      //     [``, chalk.yellow('web/attendee folder not found. Skipping build.')]
      //   )
      // }

      if (!cmd.iosOnly) {
        if (fileExists('api')) {
          commands.push(
            [`pushd api && yarn && npm run build && popd`, chalk.blue('Generating API bundle')],
          )
        } else {
          commands.push(
            [`echo skipping api`, chalk.yellow('api folder not found. Skipping build.')]
          )        
        }
      }
    }

    commands.push(
      [`zip -r tmp/build.${config.baseBundleVersion}.zip build/`, chalk.blue('Generating zip')]
    )

    for (let i = 0; i < commands.length; ++i) {
      const command = commands[i]
      console.log(`${command[1]}...`)
      if (command[0]) {
        await promisedExec(command[0].replace(/\n/g, ''))
      }      
    }

    const version = packageJSON.version
    const json = {
      extension: extensionName,
      version,
      reactNativeVersion: config.baseBundleVersion,
      cliVersion: pkg.version,
    }

    console.log('Done. Uploading binaries...')
    const location = `users/${firebase.auth().currentUser.uid}/staged/binaries/${extensionName}/${json.version}/build.zip`
    const uploadResult = await new Promise((resolve, reject) => {
      request.post(`https://firebasestorage.googleapis.com/v0/b/${config.firebase.storageBucket}/o?name=${encodeURIComponent(location)}`)
      .attach('metadata', Buffer.from(JSON.stringify({name: location, contentType: 'application/octet-stream'}), 'utf8'))
      .attach(location, `tmp/build.${config.baseBundleVersion}.zip`)
      .set('x-goog-upload-protocol', 'multipart')
      .set('x-firebase-storage-version', 'webjs/4.3.1')
      .set('authorization', `Firebase ${firebaseIdToken}`)
      .end((err, res) => {
        if (err) reject(err)
        if (!res.ok) reject(`Failed to upload binary: ${res.statusText}`)
        resolve(json)
      })
    })
    console.log('Done')
    return uploadResult
  } catch (err) {
    console.log(typeof err === 'string' ? chalk.red(err) : err)
    process.exit(-1)
  }
}

async function isAlreadyPublished(extension, version) {
  return await firebase.database().ref(`extensions/${extension}/versions/${version.replace(/\./g,'-')}`).once('value')
  .then(data => data.val() !== null)
}

async function isExtensionNewOrOwnedBy(extension, user) {
  return await firebase.database().ref(`extensions/${extension}/owners`).once('value')
  .then(data => {
    const owners = data.val()
    return (
      owners == null        // New extension with no ownership claimed yet...
      || !!owners[user.uid] // ... or the current user is an owner.
    )
  })
}
