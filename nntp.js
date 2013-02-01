var net = require('net');
var when = require('when');

function NNTP (host, port) {
  this.host = host;
  this.port = port;
};

NNTP.prototype.connect = function () {
  var deferred = when.defer();
  var that = this;

  this.client = net.connect({host: this.host, port: this.port});

  this.client.once('data', function (data) {
    var response = that.createResponseFromString(data.toString());
    deferred.resolve(response);
  });

  return deferred.promise;
};

NNTP.prototype.group = function (group) {
  var deferred = when.defer();

  this.sendCommand('GROUP ' + group)
  .then(function (response) {
    var messageParts = response.message.split(' ');

    deferred.resolve({
      name:  messageParts[3],
      count: parseInt(messageParts[0]),
      first: parseInt(messageParts[1]),
      last:  parseInt(messageParts[2]),
    });
  });

  return deferred.promise;
};

NNTP.prototype.overviewFormat = function () {
  var deferred = when.defer();

  this.sendCommand('LIST OVERVIEW.FMT', true)
  .then(function (response) {
    var formatParts = response.buffer.split('\r\n'),
        format = {};

    for (i in formatParts) {
      if (formatParts[i].slice(-5, 5).toLowerCase() === ':full') {
        format[formatParts[i].slice(0, -5).toLowerCase()] = true;
      }
      else {
        format[formatParts[i].slice(0, -1).toLowerCase()] = false;
      }
    }

    deferred.resolve(format);
  });

  return deferred.promise;
};

NNTP.prototype.createResponseFromString = function (string) {
  var matches = /^(\d{3}) ([\S\s]+)$/g.exec(string.trim());
  if (!matches) {
    // @todo throw exception.
  }

  if (matches[1] < 100 || matches[1] >= 600) {
    // @todo throw exception.
  }

  return {
    'status': matches[1],
    'message': matches[2]
  }
};

NNTP.prototype.sendCommand = function (command, multiline) {
  var multiline = multiline || false;

  var deferred = when.defer();
  var that = this;

  this.client.once('data', function (data) {
    var response = that.createResponseFromString(data.toString());

    if (multiline) {
      var buffer = '';
      return that.client.on('data', function (data) {
        buffer += data.toString();

        if (!/\.\r\n$/.test(data.toString())) {
          return;
        }

        response.buffer = buffer.replace(/\r\n\.\r\n$/, '');
        that.client.removeAllListeners('data');

        deferred.resolve(response);
      });
    }

    deferred.resolve(response);
  });

  this.client.write(command + '\r\n');
  return deferred.promise;
};

var nntp = new NNTP('news.php.net', 119);
nntp.connect()
.then(function (response) {
  console.log('Successfully connected');
  return nntp.group('php.doc.nl');
})
.then(function (response) {
  return nntp.overviewFormat();
})
.then(function (format) {
  console.log(format);
});
