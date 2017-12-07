const fs = require('fs')
const { exec } = require('child_process')
const { removeSync } = require('fs-extra')
const path = require('path')
const request = require('superagent')
const chalk = require('chalk')
const config = require('./config')
const pkg = require('./package.json')
const { ddHome, ddConfig, fileExists, promisify, requestAccessToken, saveConfig } = require('./utils')
const DiffMatchPatch = require('diff-match-patch')
const firebaseUtils = require('./utils/firebase')
const packager = require('./packager')
const firebase = require('firebase')

const bundleBase = `https://firebasestorage.googleapis.com/v0/b/${config.firebase.storageBucket}/o/lib%2Fbundles%2F`

// TODO: Is this needed?
// const iosBaseBundle = `${bundleBase}base.ios.${config.baseBundleVersion}.bundle?alt=media`
// const androidBaseBundle = `${bundleBase}base.android.${config.baseBundleVersion}.bundle?alt=media`
const iosBaseManifest = `${bundleBase}base.ios.${config.baseBundleVersion}.manifest?alt=media`
const androidBaseManifest = `${bundleBase}base.android.${config.baseBundleVersion}.manifest?alt=media`

module.exports = function publish(cmd, options) {  
  if (!fileExists('package.json')) return console.log('This does not appear to be a doubledutch extension project. No package.json found.')
  const extensionPackageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (!extensionPackageJSON.doubledutch) return console.log('This does not appear to be the root folder of a DoubleDutch extension project. package.json does not have a doubledutch section.')

  if (!fileExists(ddConfig)) return console.log('You have not logged in to doubledutch. Please run ' + chalk.blue('dd login'))

  const configJSON = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))

  return publishBinary(configJSON, extensionPackageJSON)
    .then(result => console.log(result))
    .catch(err => console.error(err))
}

function publishBinary(accountConfig, packageJSON) {
  const extensionName = packageJSON.name
  if (!extensionName.match(/^[a-zA-Z0-9\-_]+$/)) {
    return Promise.reject(`Extension name in package.json (${extensionName}) is not valid. Letters, numbers, -, and _ are valid.`)
  }

  console.log(`Publishing extension ${chalk.green(extensionName)}@${chalk.green(packageJSON.version)} to DoubleDutch...`)

  // TODO - we should really just check the expiration of the token
  return requestAccessToken(accountConfig.username, accountConfig.refresh_token).then(accessToken => {    
    const dmp = new DiffMatchPatch()
    dmp.Diff_Timeout = 60

    removeSync('build/')
    removeSync('tmp/')

    if (!fs.existsSync('build')) {
      fs.mkdirSync('build');
    }
    if (!fs.existsSync('build/bundle')) {
      fs.mkdirSync('build/bundle');
    }
    if (!fs.existsSync('build/site')) {
      fs.mkdirSync('build/site');
    }
    if (!fs.existsSync('build/site/private')) {
      fs.mkdirSync('build/site/private');
    }
    if (!fs.existsSync('build/site/public')) {
      fs.mkdirSync('build/site/public');
    }
    if (!fs.existsSync('build/api')) {
      fs.mkdirSync('build/api');
    }
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp');
    }

    console.log(`Downloading iOS and Android base bundles (version ${chalk.blue(config.baseBundleVersion)})`) 
    function streamToFile(url, file) {
      return new Promise((resolve, reject) => {
        request.get(url).pipe(fs.createWriteStream(file)).on('finish', () => resolve(file))
      })
    }   
    // TODO: Are the 2 other bundle files needed?
    return Promise.all([
      streamToFile(iosBaseManifest, `tmp/base.ios.${config.baseBundleVersion}.manifest`),
      streamToFile(androidBaseManifest, `tmp/base.android.${config.baseBundleVersion}.manifest`)
    ])
    .then(() => {
      if (fs.existsSync('mobile')) {
        
        // Build each mobile platform with the metro bundler: https://github.com/facebook/metro
        const platforms = ['ios', 'android']
        return Promise.all(platforms.map(async platform => {
          const root = path.join(process.cwd(), 'mobile')
          console.log(chalk.blue(`Building ${platform}`))
          const { metroBundle } = await packager({
            baseManifestFilename: `./tmp/base.${platform}.${config.baseBundleVersion}.manifest`,
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
        }))
      } else {
        console.log(chalk.yellow('mobile folder not found. Skipping build.'))
      }
    })
    .then(() => {
      const commands = []

      if (fileExists('web/admin')) {
        commands.push(
          [`pushd web/admin && npm run build`, chalk.blue('Generating Admin web bundle')],
          [`cp -r web/admin/build/ build/site/private/`, chalk.blue('Copying Admin web bundle')]
        )
      } else {
        commands.push(
          [`echo skipping web/admin`, chalk.yellow('web/admin folder not found. Skipping build.')]
        )
      }

      if (fileExists('web/attendee')) {
        commands.push(
          [`pushd web/attendee && npm run build`, chalk.blue('Generating Attendee web bundle')],
          [`cp -r web/attendee/build/ build/site/public/`, chalk.blue('Copying Attendee web bundle')]
        )
      } else {
        commands.push(
          [``, chalk.yellow('web/attendee folder not found. Skipping build.')]
        )
      }

      commands.push(
        [`zip -r tmp/build.${config.baseBundleVersion}.zip build/`, chalk.blue('Generating zip')]
      )

      firebase.initializeApp(firebaseUtils.config)
      const promise = new Promise((resolve, reject) => {
        const runCommand = (idx) => {
          if (idx < commands.length) {
            console.log(`${commands[idx][1]}...`)
            if (commands[idx][0]) {
              exec(commands[idx][0].replace(/\n/g, ''), (err, stdout, stderr) => {
                if (err) {
                  console.error(err)
                }
                if (stderr) {
                  console.error(stderr)
                }
                runCommand(idx + 1)
              })
            } else {
              runCommand(idx + 1)
            }
          } else {
            resolve()
          }
        }

        runCommand(0)
      })

      const version = packageJSON.version
      const json = {
        cliVersion: pkg.version,
        version,
        reactNativeVersion: config.baseBundleVersion,
        mobileURL: `https://firebasestorage.googleapis.com/v0/b/bazaar-179323.appspot.com/o/extensions%2F${encodeURIComponent(extensionName)}%2F${encodeURIComponent(version)}%2Fmobile%2Findex.__platform__.0.46.4.manifest.bundle?module=${encodeURIComponent(extensionName)}&alt=media#plugin`
      }

      return promise
        .then(() => firebaseUtils.getDeveloperToken(accessToken))
        .then(firebaseToken => firebase.auth().signInWithCustomToken(firebaseToken))
        .then(user => user.getIdToken())
        .then(firebaseIdToken => {
          console.log('Done. Uploading binaries...')
          const location = `users/${firebase.auth().currentUser.uid}/staged/binaries/${extensionName}/${json.version}/build.zip`
          return new Promise((resolve, reject) => {
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
        })
    }).catch((err) => {
      console.log(typeof err === 'string' ? chalk.red(err) : err)
      process.exit(-1)
    })
  })
}

