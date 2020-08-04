require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('./restRoutes');
const tokenAuth = require('./tokenAuth');

const defaultUrl = 'mongodb://localhost';
const defaultDbName = 'test';
const defaultReadOnly = 'no';

function mountRoutes(app, mountPoint, urlParam, dbNameParam, readOnlyParam) {
  const url = urlParam || defaultUrl;
  const dbName = dbNameParam || defaultDbName;
  const readOnlyStr = readOnlyParam || defaultReadOnly;
  const readOnly = readOnlyStr.toLocaleLowerCase() !== 'no';

  console.log('Connecting to', url, dbName);
  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
  client.connect();
  const db = client.db(dbName);

  console.log(`Mounting API routes on ${mountPoint}`);
  app.use(mountPoint, (req, res, next) => {
    req.db = db;
    next();
  });
  app.use(mountPoint, readOnly ? restRoutes.readOnly() : restRoutes.all());
}

function routes() {
  const router = express.Router();

  if (process.env.AUTH_TOKEN) {
    console.log('Authentication enabled using', process.env.AUTH_TOKEN);
    router.use('/', tokenAuth(process.env.AUTH_TOKEN));
  }

  const base = process.env.BASE || '';
  if (process.env.PREFIXES) {
    const prefixes = process.env.PREFIXES.split(',');
    prefixes.forEach((prefix) => {
      const p = prefix.replace(/[-.:]/g, '_');
      const server = process.env[`SERVER_${p}`] || process.env.SERVER;
      const readOnly = process.env[`READ_ONLY_${p}`] || process.env.READ_ONLY;
      const db = process.env[`DB_${p}`] || prefix;
      mountRoutes(router, `${base}/${prefix}`, server, db, readOnly);
    });
  } else {
    mountRoutes(router, base || '/', process.env.SERVER, process.env.DB, process.env.READ_ONLY);
  }
  return router;
}

function start() {
  const app = express();

  app.get('/ping', (req, res) => {
    res.send({ status: 'OK' });
  });

  app.use(routes());

  try {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log(`API server started on port ${port}`);
    });
  } catch (err) {
    console.log('ERROR:', err);
  }
}

module.exports = { start, routes };
