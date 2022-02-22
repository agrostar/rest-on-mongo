require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const restRoutes = require('./restRoutes');
const tokenAuth = require('./tokenAuth');

const defaultUrl = 'mongodb://localhost';
const defaultDbName = 'test';
const defaultReadOnly = 'no';

async function mountRoutes(app, mountPoint, urlParam, dbNameParam, readOnlyParam) {
  const url = urlParam || defaultUrl;
  const dbName = dbNameParam || defaultDbName;
  const readOnlyStr = readOnlyParam || defaultReadOnly;
  const readOnly = readOnlyStr.toLocaleLowerCase() !== 'no';

  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);

  if (process.env.DISABLE_CORS === 'true') {
    app.use(cors());
  }
  app.use(mountPoint, (req, res, next) => {
    req.db = db;
    req.client = client;
    next();
  });
  app.use(mountPoint, readOnly ? restRoutes.readOnly() : restRoutes.all());
  console.log(`Route: ${mountPoint} -> ${url}/${dbName}`);
}

async function routes() {
  const router = express.Router();

  if (process.env.AUTH_TOKEN) {
    router.use('/', tokenAuth(process.env.AUTH_TOKEN));
  } else {
    console.log('WARNING: Authentication disabled, this is UNSAFE!');
  }

  if (!process.env.PREFIXES) {
    await mountRoutes(router, '/', process.env.SERVER, process.env.DB, process.env.READ_ONLY);
    return router;
  }

  const prefixesStr = process.env.PREFIXES;

  let prefixes = [];
  if (prefixesStr.indexOf('*') !== -1) {
    // If it is like a,b,c*x,y,z, then we do cartesian product of a,b,c and x,y,z
    const [serversStr, dbsStr] = prefixesStr.split('*');
    const servers = serversStr.split(',');
    const dbs = dbsStr.split(',');
    servers.forEach((server) => {
      prefixes = prefixes.concat(dbs.map((db) => `${server}/${db}`));
    });
  } else {
    prefixes = prefixesStr.split(',');
  }

  const promises = prefixes.map(async (prefix) => {
    // Since env variable names cannot have special characters we use _ in place of them
    const splChars = /[-./:]/g;

    // Hierarchy of preference for "server/db" kind of prefixes:
    //  env.SERVER_prefixEnv,    env.SERVER_serverEnv,    env.SERVER
    //  env.DB_prefixEnv,        env.DB_dbEnv,            db
    //  env.READ_ONLY_prefixEnv, env.READ_ONLY_serverEnv, env.READ_ONLY_dbEnv, env.READ_ONLY
    const prefixEnv = prefix.replace(splChars, '_');
    let db = prefix;
    let serverEnv = prefixEnv;
    let dbEnv = prefixEnv;
    if (prefix.indexOf('/') !== -1) {
      const [s, d] = prefix.split('/', 2);
      db = d;
      serverEnv = s.replace(splChars, '_');
      dbEnv = d.replace(splChars, '_');
    }
    const server = process.env[`SERVER_${prefixEnv}`]
      || process.env[`SERVER_${serverEnv}`]
      || process.env.SERVER;
    db = process.env[`DB_${prefixEnv}`]
      || process.env[`DB_${dbEnv}`]
      || db;
    const readOnly = process.env[`READ_ONLY_${prefixEnv}`]
      || process.env[`READ_ONLY_${serverEnv}`]
      || process.env[`READ_ONLY_${dbEnv}`]
      || process.env.READ_ONLY;

    return mountRoutes(router, `/${prefix}`, server, db, readOnly);
  });

  await Promise.all(promises);
  return router;
}

const pingRouter = express.Router().get('/ping', (req, res) => {
  res.send({ status: 'OK' });
});

async function start() {
  const app = express();

  const base = process.env.BASE || '/';

  app.use(base, pingRouter);

  try {
    const r = await routes();
    app.use(base, r);
  } catch (e) {
    console.log('Unable to mount routes:', e);
    return;
  }

  // 404
  app.use((req, res) => {
    res.status(404).send({ status: 404 });
  });

  try {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log(`API server started on port ${port} on ${base}`);
    });
  } catch (err) {
    console.log('ERROR:', err);
  }
}

module.exports = { start, routes };
