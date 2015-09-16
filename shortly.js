var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
app.use(session({secret: 'abc', resave: false, saveUninitialized: true}));
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'saltedHash',
    session: false
  },
  function(username, password, cb) {
    db.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  }));

app.get('/', 
function(req, res) {
  if (req.session.username === undefined){
    res.redirect('login');
  }
  else {
    res.render('index');
  }
});

app.get('/logout',
function(req, res) {
  delete req.session.username;
  res.redirect('/');
});

app.get('/create', 
function(req, res) {
  if (req.session.username === undefined){
    res.redirect('login');
  }
  else {
    res.render('index');
  }
});

app.get('/links', 
function(req, res) {
  var username = req.session.username;
  if (username === undefined){
    res.redirect('login');
  }
  else {
    Links.reset().fetch().then(function(links) {
      util.findByUsername(username, function(user_id){
        var results = [];
        links.forEach(function(link){
          if (link.attributes.user_id === user_id){
            results.push(link);
          }
        });
        console.log(results);
        res.send(200, results);
      });
    });
  }
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  var username = req.session.username;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        util.findByUsername(username, function(user_id){
          var link = new Link({
            url: uri,
            title: title,
            user_id: user_id,
            base_url: req.headers.origin
          });
          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
      });
    }
  });
});

app.post('/signup', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  db.knex('users')
    .where('username', '=', username)
    .then(function(result){
      if (result[0] && result[0]['username']) {
        res.redirect('/');
      } else {
        bcrypt.hash(password, null, null, function(err, hash){
          if (!err) {
            new User({
              'username': username,
              'saltedHash': hash
            }).save();
            res.redirect('/');
          }
        });
      } 
    });
});

app.post('/login', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  db.knex('users')
    .where('username', '=', username)
    .then(function(result){
      if (!result[0] || !result[0]['username']) {
        console.log('username does not exist');
        res.redirect('/login');
      } else if (bcrypt.compareSync(password, result[0]['saltedHash'])){
        console.log('username exists, password matched');
        req.session.regenerate(function(){
          req.session.username = username;
          res.redirect('/');
        });
      } else {
        res.redirect('/login');
      }
    });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
