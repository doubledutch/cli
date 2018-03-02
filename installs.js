const chalk = require('chalk')
const firebase = require('firebase')
const request = require('superagent')
const { authenticate, getCurrentExtension, promisify } = require('./utils')
const {cms} = require('./config')

module.exports = function installs(cmd, options) {
  const extension = getCurrentExtension()
  if (!extension) return

  const tokens = cmd.tokens || {}
  authenticate.developer({quiet: true})
    .then(ddToken => {
      tokens.us = tokens.us || ddToken
    })
    .then(() => firebase.database().ref(`installs/${extension}/events`).once('value'))
    .catch(err => {
      if (err.code === 'PERMISSION_DENIED') throw `You do not have access to extension '${extension}'`
      throw err
    })
    .then(data => {
      const eventIds = Object.keys(data.val() || {})
      console.log('\nEvent ID,Region,Name,App,Start Date')
      return eventIds
    })
    .then(eventIds => Promise.all(eventIds.map(eventId =>
      cmsEventLookup(tokens, eventId).then(x => {
        console.log(`${x.Id},${x.region},${x.Name},${x.BundleName},${x.StartDate}`)
      }).catch(err => {
        console.log(eventId)
      })
    )))
    .then(() => process.exit(0)) // firebase ref.set() is not releasing something, even after the Promise is resolved.
    .catch(err => console.error(typeof err === 'string' ? chalk.red(err) : err) || process.exit(1))
}

function cmsEventLookup(tokens, eventId) {
  return cms.prioritizedRegions.reduce(
    (promise, region) => tokens[region] ? promise.catch(() => lookupIn(region)) : Promise.reject(),
    Promise.reject())

  function lookupIn(region) {
    return promisify(
      request.get(`${cms[region]}/api/applications/byid?id=${eventId}&currentApplicationId=${eventId}`)
      .set('authorization', `Bearer ${tokens[region]}`)
    , 'end')
    .then(res => {
      if (!res.ok) {
        throw {status: res.status}
      }
      return Object.assign(res.body, {region})
    })  
  }
}