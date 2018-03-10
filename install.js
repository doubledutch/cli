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

const chalk = require('chalk')
const firebase = require('firebase')
const { authenticate, getCurrentExtension } = require('./utils')

module.exports = function install(eventID) {
  const extension = getCurrentExtension()
  if (!extension) return

  authenticate.eventAdmin()
    .then(() => firebase.database().ref(`installs/${extension}/events/${eventID}`).set(true))
    .catch(err => {
      if (err.code === 'PERMISSION_DENIED') throw `You do not have permission to install '${extension}' to event ${eventID}`
      throw err
    })
    .then(() => console.log(chalk.green(`Installed ${extension} to event ${eventID} ✨`)))
    .then(() => process.exit(0)) // firebase ref.set() is not releasing something, even after the Promise is resolved.
    .catch(err => console.error(typeof err === 'string' ? chalk.red(err) : err))
}
