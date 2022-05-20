const express = require('express');
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb');
const { EJSON } = require('bson');

const handlers = require('./handlers');
const { initializeAuth, authRoutes, authenticate } = require('./auth');

/*
 * An error class for easier exception handling
 */
class ErrorWithStatus extends Error {
  constructor(statusCode, message) {
    super();
    this.statusCode = statusCode;
    this.message = message;
  }
}

/*
 * Handler to convert request body from extended json.
 *
 * An option would have been to use the deserialize() function of EJSON after using
 * bodyParser.json() to get an object. But that is less efficient. The internal implementation of
 * deserialize() calls JSON.stringify() on the passed in object and then calls EJSON.parse()
 * on the resulting string. We may as well get a string and parse it ourselves.
 */
function convertExtendedJson(req, res, next) {
  // body-parser gives a string if there is a body, or an empty {} if there is no body
  if (typeof req.body === 'string') {
    try {
      req.body = EJSON.parse(req.body, { relaxed: false });
    } catch (e) {
      throw new ErrorWithStatus(400, `Malformed JSON: ${e.message}`);
    }
  } else {
    req.body = null;
  }
  next();
}

/*
 * Common parameter handlers: id and collection
 */
function handleParamId(req, res, next, id) {
  if (ObjectId.isValid(id)) {
    req.id = ObjectId(id);
  } else if (!Number.isNaN(parseInt(id, 10))) {
    req.id = parseInt(id, 10);
  } else if (id.indexOf('\'') === 0) {
    // force number or object id to be interpreted as a string
    req.id = id.substring(1);
  } else {
    req.id = id;
  }
  next();
}

function handleParamCollection(req, res, next, collection) {
  req.collection = req.db.collection(collection);
  next();
}

/*
 * Middleware functions for validating the request body
 */
function needBody(req, res, next) {
  if (!req.body) {
    throw new ErrorWithStatus(400, 'Missing request body');
  }
  next();
}

function needBodyObject(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ErrorWithStatus(400, 'Request body must be an object');
  }
  next();
}

function needBodyArray(req, res, next) {
  if (!Array.isArray(req.body)) {
    throw new ErrorWithStatus(400, 'Request body must be an array');
  }
  next();
}

// Common error handler
function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = 500;
  if (err.statusCode) {
    // They have already filled the necessary info
    statusCode = err.statusCode;
  } else if (err.name === 'MongoError' || err.name === 'BulkWriteError') {
    // Must be a user error like dupicate key etc.
    statusCode = 400;
  } else if (err.message && err.message.startsWith('key')) {
    // Must be a user error like key cannot start with $
    statusCode = 400;
  } else {
    // Dunno. Could be our problem.
    statusCode = 500;
  }
  res.status(statusCode).send({
    status: 'error',
    statusCode,
    message: err.message,
  });
}

const object = '/:collection/:id';
const collection = '/:collection';

function readOnly(jwtKey) {
  const routes = express.Router();

  // Common handlers: bodyParser and our own EJSON middleware
  const limit = process.env.BODY_SIZE_LIMIT || '10mb';
  routes.use(bodyParser.text({ type: '*/*', limit }));
  routes.use(convertExtendedJson);

  if (jwtKey) {
    authRoutes(routes, jwtKey);
    routes.use(authenticate());
  }



  // Parameters
  routes.param('id', handleParamId);
  routes.param('collection', handleParamCollection);

  // Read routes
  routes.get(object, handlers.handleGetOne);
  routes.get(collection, handlers.handleGetMany);
  routes.get('/file/:collectionName/:object_id/:file/:type/:prop', handlers.handleGetOneFile);

  routes.use(handleError);
  return routes;
}

function all(jwtKey) {
  const routes = readOnly(jwtKey);
  // Create
  routes.post(object, [needBodyObject, handlers.handleCreateOne]);
  routes.post(collection, [needBody, handlers.handleCreateMany]);
  // Update and Replace
  routes.patch(object, [needBodyObject, handlers.handleUpdateOne]);
  routes.patch(collection, [needBodyArray, handlers.handleUpdateMany]);
  routes.put(object, [needBodyObject, handlers.handleReplaceOne]);
  routes.put(collection, [needBodyArray, handlers.handleReplaceMany]);
  // Delete
  routes.delete(object, handlers.handleDeleteOne);
  routes.delete(collection, handlers.handleDeleteMany);

  if (jwtKey) {
    authRoutes(routes, jwtKey);
  }

  routes.use(handleError);
  return routes;
}

module.exports = { readOnly, all, initializeAuth, authenticate };
