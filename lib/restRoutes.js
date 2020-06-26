const express = require('express');
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb');
const EJSON = require('mongodb-extjson');

const handlers = require('./handlers');

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
 * Handler to convert request body from extended json
 */
function convertExtendedJson(req, res, next) {
  // body-parser gives a string if there is a body, or an empty {} if there is no body
  if (typeof req.body === 'string') {
    req.body = EJSON.parse(req.body);
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
  if (!err.statusCode || err.statusCode === 500) {
    console.error(err);
  }
  const { statusCode, message } = err;
  res.status(statusCode || 500).send({
    status: 'error',
    statusCode,
    message,
  });
}

const object = '/:collection/:id';
const collection = '/:collection';

function readOnly() {
  const routes = express.Router();

  // Common handlers
  routes.use(bodyParser.text({ type: '*/*' }));
  routes.use(convertExtendedJson);

  // Parameters
  routes.param('id', handleParamId);
  routes.param('collection', handleParamCollection);

  // Read routes
  routes.get(object, handlers.handleGetOne);
  routes.get(collection, handlers.handleGetMany);

  routes.use(handleError);
  return routes;
}

function all() {
  const routes = readOnly();
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

  routes.use(handleError);
  return routes;
}

module.exports = { readOnly, all };
