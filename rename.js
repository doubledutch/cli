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
const child_process = require('child_process')
const chalk = require('chalk')

const { getCurrentExtension } = require('./utils')

module.exports = function rename(name) {
  const extension = getCurrentExtension()
  if (!extension) return

  if (!name || !name.match(/^[a-z_0-9]+$/)) return console.error('Only alphanumeric and underscore lowercase names are allowed.')

  console.log(`${chalk.red(extension)} ==> ${chalk.green(name)}`)

  updateInFiles('.js', "FirebaseConnector(client, '__EXTENSION__')")
  updateInFiles('.js', "('__EXTENSION__', ")
  updateInFiles('.pbxproj', 'path = __EXTENSION__/')
  updateInFiles('.pbxproj', '/* __EXTENSION__ */')
  updateInFiles('.pbxproj', '__EXTENSION__.app/__EXTENSION__')
  updateInFiles('.pbxproj', '__EXTENSION__.app')
  updateInFiles('.pbxproj', '__EXTENSION__Tests')
  updateInFiles('.pbxproj', '__EXTENSION__/Info.plist;')
  updateInFiles('.pbxproj', ' __EXTENSION__;')
  updateInFiles('.pbxproj', '__EXTENSION__-tvOS')
  updateInFiles('.pbxproj', '"__EXTENSION__"')
  updateInFiles('.pbxproj.bak', 'path = __EXTENSION__/')
  updateInFiles('.pbxproj.bak', '/* __EXTENSION__ */')
  updateInFiles('.pbxproj.bak', '__EXTENSION__.app/__EXTENSION__')
  updateInFiles('.pbxproj.bak', '__EXTENSION__.app')
  updateInFiles('.pbxproj.bak', '__EXTENSION__Tests')
  updateInFiles('.pbxproj.bak', '__EXTENSION__/Info.plist;')
  updateInFiles('.pbxproj.bak', ' __EXTENSION__;')
  updateInFiles('.pbxproj.bak', '__EXTENSION__-tvOS')
  updateInFiles('.pbxproj.bak', '"__EXTENSION__"')
  updateInFiles('.xcscheme', '"__EXTENSION__"')
  updateInFiles('.xcscheme', '__EXTENSION__.app')
  updateInFiles('.xcscheme', '__EXTENSION__.xcodeproj')
  updateInFiles('.xcscheme', '__EXTENSION__-tvOS')
  updateInFiles('.xcscheme', '__EXTENSION__Tests')
  updateInFiles('.m', '__EXTENSION__Tests')
  updateInFiles('LaunchScreen.xib', 'text="__EXTENSION__"')
  updateInFiles('AppDelegate.m', 'moduleName:@"__EXTENSION__"')
  updateInFiles('.plist', '<string>__EXTENSION__</string>')
  updateInFiles('strings.xml', '<string name="app_name">__EXTENSION__</string>')
  updateInFiles('.xml', '"com.__EXTENSION__"')
  updateInFiles('.java', 'package com.__EXTENSION__;')
  updateInFiles('MainActivity.java', 'return "__EXTENSION__";')
  updateInFiles('.gradle', "rootProject.name = '__EXTENSION__'")
  updateInFiles('.gradle', '"com.__EXTENSION__"')
  updateInFiles('BUCK', '"com.__EXTENSION__"')
  updateInFiles('package.json', '"name": "__EXTENSION__"')

  console.log(chalk.blue(`Updated to ${chalk.green(name)}.  Cleaning...`))
  child_process.spawnSync('npm', ['run', 'clean'], {cwd: path.join(process.cwd(), 'mobile'), stdio: 'inherit'})
  console.log(`${chalk.red(extension)} ==> ${chalk.green(name)} rename completed`)


  function updateInFiles(fileExt, search) {
    const from = globalRegExp(search.replace(/__EXTENSION__/g, extension))
    const to = search.replace(/__EXTENSION__/g, name)
    recurse(process.cwd(), fileExt, search)
  
    function recurse(dir, fileExt, search) {
      fs.readdirSync(dir).forEach(file => {
        let filePath = path.join(dir, file)

        // Rename files/directories
        if (file.includes(extension)) {
          const oldPath = filePath
          filePath = path.join(dir, file.replace(extension, name))
          fs.renameSync(oldPath, filePath)
        }

        if (fs.statSync(filePath).isDirectory()) {
          if (!file.startsWith('.') && !['node_modules', 'build'].includes(file)) {
            recurse(filePath, fileExt, search)
          }
        } else if (file.endsWith(fileExt)) {
          replaceInFile(filePath, from, to)
        }
      })
    }
  }  
}

function replaceInFile(fileName, from, to) {
  const data = fs.readFileSync(fileName, 'utf8')
  const result = data.replace(from, to)
  if (result !== data) {
    fs.writeFileSync(fileName, result, {encoding:'utf8'})
    console.log(`${chalk.gray(fileName)} ${chalk.green(to)}`)
  }
}

function escapeRegExp(str) {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
}
function globalRegExp(str) {
  return new RegExp(escapeRegExp(str), 'g')
}
