const restRoutes = require('./lib/restRoutes');
const tokenAuth = require('./lib/tokenAuth');
const server = require('./lib/server');

module.exports = { server, restRoutes, tokenAuth };

if (require.main === module) {
  server.start();
}
