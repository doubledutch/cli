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
const { spawn } = require('child_process')
const chalk = require('chalk')

module.exports = function init(cmd, options) {
  assertFolderEmpty()

  chalk.blue('Cloning sample extension v2...')
  return new Promise(resolve => {
    spawn('git clone https://github.com/doubledutch/extension-sample.git --branch v2 --single-branch .', [], {shell: true, stdio: 'inherit'}).on('exit', () => {
      chalk.blue('Removing .git history')
      spawn('rm -rf .git', [], {shell: true, stdio: 'inherit'}).on('exit', () => {
        chalk.green('Sample project initialized 🌻')
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
