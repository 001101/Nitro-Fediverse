import NitroDatasource from "./NitroDatasource"
import ActivityPub from './ActivityPub'
import express from 'express'
import fs from 'fs'
const app = express()

const routes = require('./routes'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    http = require('http'),
    basicAuth = require('express-basic-auth')
const dotenv = require('dotenv')
let sslOptions

dotenv.config()

try {
  sslOptions = {
    key: fs.readFileSync(process.env.PRIVKEY_PATH),
    cert: fs.readFileSync(process.env.CERT_PATH)
  }
} catch(err) {
  if (err.errno === -2) {
    console.log('No SSL key and/or cert found, not enabling https server')
  } else {
    console.log(err)
  }
}

const datasource = new NitroDatasource(process.env.DOMAIN)
const ap = new ActivityPub(process.env.DOMAIN || 'localhost', process.env.PORT || 4100, datasource)

app.set('ap', ap)
export default ap
app.set('domain', process.env.DOMAIN || 'localhost')
app.set('port', process.env.PORT || 4100)
app.set('port-https', process.env.PORT_HTTPS || 8443)
app.use(bodyParser.json({type: 'application/activity+json'})) // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })) // support encoded bodies

// basic http authorizer
let basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true
})

function asyncAuthorizer(username, password, cb) {
  let isAuthorized = false
  const isPasswordAuthorized = username === process.env.USER
  const isUsernameAuthorized = password === process.env.PASS
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized
  if (isAuthorized) {
    return cb(null, true)
  }
  else {
    return cb(null, false)
  }
}

app.get('/', (req, res) => res.send('Hello World!'))

// admin page
app.options('/api', cors())
app.use('/api', cors(), routes.api)
app.use('/api/admin', cors({ credentials: true, origin: true }), basicUserAuth, routes.admin)
app.use('/admin', express.static('public/admin'))
app.use('/.well-known/webfinger', cors(), routes.webfinger)
app.use('/users', cors(), routes.user)
app.use('/api/inbox', cors(), routes.inbox)

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))
})
