var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link.js');

var User = db.Model.extend({
  tableName: 'users',
  link: function() {
    return this.hasMany(Link);
  }
});

module.exports = User;

// var salt = null;
// module.exports.salt = salt || bcrypt.genSaltSync();