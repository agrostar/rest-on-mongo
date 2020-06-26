# rest-on-mongo

[![npm version](https://badge.fury.io/js/rest-on-mongo.svg)](https://www.npmjs.com/package/rest-on-mongo)
[![downloads](https://img.shields.io/npm/dt/rest-on-mongo.svg)](https://npmjs.org/rest-on-mongo)

rest-on-mongo is a REST API layer over MongoDB.

## About

The need for a REST API interface to MongoDB came up when we wanted to access our MongoDB database directly from Google Sheets. The solutions out there were either using Stitch (a service provided by a hosted version of MongoDB) or using tools no longer maintained, or tools that did not support bulk updates and multiple databases. None of them worked for us. And we felt that this was such a common need that there *had* to be an open-source package for it.

So we built it.

### Upgrading from v1.x.x

v2.0 has breaking changes in the way BSON data types are handled. We no longer support automatic conversion of date-like strings to Date objects. The v1.0 functions for converting strings starting with a `$` character to specific data types are also no longer supported.

### Disclaimer

The API is really REST-_ish_ and not pure REST. The verbs supported are a little more than what pure REST would recommend. But the extra support is quite convenient as we found out.

## Installation
```
npm install rest-on-mongo
```

There are two ways to use rest-on-mongo. You can just run the built-in server (which should work for most needs, because it has lots of configuration options), or you can use it as a library and build your own server.

## Using the built-in server

After installation, just run:
```
npx rest-on-mongo
```

You will now have a full-fledged REST API server, using the default configuration: an unauthenticated server on port 8000 which will give you access to a database called `test` in a MongoDB instance running on the localhost.

### Try it out

Insert a document in a collection called `example` in the database `test`:
```
curl -X POST --data '{ "_id": 1, "value": "some value" }' http://localhost:8000/example
```

Read back the document from the collection:
```
curl http://localhost:8000/example/1
```
This will return the document `{ "_id": 1, "value": "some value" }` which was just inserted.

### Configuration

The server can be started in one of two modes:

   1. Single database (as in the above example), which can be accessed like `http://localhost:8000/collection/_id`
   1. Multiple databases, each under a prefix in the route, accessed like `http://localhost:8000/prefix/collection/_id`

All the configuration is in environment variables. You can set these using `export VAR=value` or, write the definitions in a file called `.env` since we use [dotenv](https://www.npmjs.com/package/dotenv).

| Variable name        | DBs      | Default               | Notes |
| -------------------- | -------- | --------------------- |------ |
| `AUTH_TOKEN`         | Any      | No auth               | Authentication token (or API Key) |
| `BASE`               | Any      |                       | The base endpoint for the API set, eg, `/api/v1` |
| `PORT`               | Any      | 8000                  | HTTP Port to start the server on |
| `SERVER`             | Single   | `mongodb://localhost` | MongoDB connection URI. |
| `DB`                 | Single   | `test`                | Name of the database |
| `READ_ONLY`          | Single   |                       | Exposes only GET methods |
| `PREFIXES`           | Multiple |                       | A comma separated list of prefixes |
| `SERVER_<prefix>`    | Multiple | `mongodb://localhost` | Connection URI for prefix `<prefix>` |
| `DB_<prefix>`        | Multiple | `test`                | Name of the database for prefix `<prefix>` |
| `READ_ONLY_<prefix>` | Multiple |                       | Exposes only GET methods for the database |

#### Example 1

Contents of the `.env` file:

```
AUTH_TOKEN=secret
PORT=3000
PREFIXES=localtest,localcontent,remotetest,remotecontent
# SERVER_localtest=mongodb://localhost
# DB_localtest=test
# SERVER_localcontent=mongodb://localhost
DB_localcontent=content
SERVER_remotetest=mongodb://user:password@db.example.com
# DB_remotetest=test
SERVER_remotecontent=mongodb://user:password@db.example.com
DB_remotecontent=content
```

This will configure a server in the multiple databases mode. Now, to access the `example` collection in the local `test` database, you will need to do the following:

```
curl -H 'Authorization: Bearer secret' http://localhost:3000/local-test/example/1
```
And, to access the same collection in the `content` database in the remote server, you would do:
```
curl -H 'Authorization: Bearer secret' http://localhost:3000/remote-content/example/1
```

#### Example 2

```
SERVER=mongodb://user:password@db.example.com
DB=content
BASE=/api/v1
READ_ONLY=yes
```

This will configure a server with no authentication in the single database mode, so no prefix is needed to select the database. But a standard base prefix `api/v1` is needed for all APIs. Further, HTTP methods other than GET will not be supported because `READ_ONLY` was set to `yes`.

In this mode, to get a document, this is what you would do:

```
curl http://localhost:8000/api/v1/example/1
```

#### Notes

   * If `PREFIXES` is defined, the variables `SERVER` and `DB` will be ignored, giving preference to the multiple database mode of operation.
   * Multiple prefixes can connect to the same server+database. Although supported, this is useless.
   * None of the environment variables are required. A server as in the Quick Start section above will be started if no environment variables are found.
   * Since the shell does not allow usage of the dash (`-`) character in environment variable names, you should use an `_` instead of `-` in the names where there is a dash in the prefix (which is indeed allowed).

## Using rest-on-mongo as a library

You may want to create your own server if you need something different from rest-on-mongo's built-in server. For example, you may already have a server and you'd like an additional router endpoint. Or, you may not like the default authorization mechanism, and you want to use your own.

rest-on-mongo exports three things:

1. `server`: The entire server, which can be used to start the server, or mount the middleware in your own app. Methods available are `server.start()` and `server.routes()`.
1. `restRoutes`: The REST routes, a lower level access to the REST handlers. Methods available are `restRoutes.all()` and `restRoutes.readOnly()`.
1. `tokenAuth`: An authentication middleware generator function. Pass a string to this function to obtain a function that authenticates against this string. An HTTP `Authorization` Header of type `Bearer` will be expected in all requests.

### Example: mimic the rest-on-mongo command line

To replicate the behaviour of the `rest-on-mongo` command-line, you could do the following:
```
const { server } = require('rest-on-mongo');
server.start();
```

### Example: add rest-on-mongo's REST APIs to an existing app

To mount the REST APIs in your own app (using the environment variables configuration), rather than start an independent server, you could do:
```
const { server } = require('rest-on-mongo');
const express = require('express');
const myApp = require('./app'); // Your app with its own handlers

const app = express();
app.use('/app', myApp); // mount your app on /app
app.use('/dbadmin', server.routes()); // mount rest-on-mongo on /dbadmin
```

### Example: do it yourself

To get an even lower level access to the REST routes, you could do:
```
const mongodb = require('mongodb');
const express = require('express');
const { restRoutes, tokenAuth } = require('rest-on-mongo');
const myApp = require('./app'); // Your app with its own handlers

const app = express();
app.use('/app', myApp); // mount your app on /app

// Authenticate using rest-on-mongo's default auth mechanism
app.use('/dbadmin', tokenAuth('somesecret'));

// Inject a database connection, this is required!
const client = new MongoClient('mongodb://db.example.com');
client.connect();
const db = client.db('mydatabase');
app.use('/dbadmin', (req, res, next) => {
  req.db = db;
  next();
}

// Install all the library's REST routes
app.use('/dbadmin', restRoutes.all());  // Or, use restRoutes.readOnly()

// Start the server
app.listen(8000, () => {
  console.log(`API server started on port 8000`);
});
```

## The REST APIs (or Routes)

### Quick Reference

| Method | Path             | Request body             | What it does             |
| ----   | ---------------- | ------------------------ | ------------------------ |
| POST   | /collection/_id  | `{...}`                  | Inserts a document at `_id` |
| POST   | /collection      | `{"_id": 1, ...}`        | Inserts a document with the given `_id` |
|        |                  | `{...}`                  | Inserts a document with an autogenerated `_id` |
|        |                  | `[{...}, ...]`           | Inserts many documents |
| GET    | /collection/_id  |                          | Gets a single document |
| GET    | /collection      |                          | Gets documents matching the query-string filter |
| PATCH  | /collection/_id  | `{...}`                  | Udates document at `_id` using MongoDB `$set` |
| PATCH  | /collection      | `[{"_id": 1, ...}, ...]` | Batch updates multiple documents |
| PUT    | /collection/_id  | `{...}`                  | Replaces document at `_id` |
| PUT    | /collection      | `[{"_id": 1, ...}, ...]` | Batch replaces multiple documents |
| DELETE | /collection/_id  |                          | Deletes document at `_id` |
| DELETE | /collection      |                          | Deletes objects matching the query-string filter |

### The `_id` parameter

The `_id` parameter will be used as is, as a string, except in the following cases:

   * The value happens to be a valid integer. In this case, parseInt will be used to convert it to an integer.
   * The value happens to be in the `ObjectId` format. In this case, `ObjectId()` will be used to convert it to a MongoDB `ObjectId`.
   * If the value starts with the single-quote character (`'`) the single-quote character will be stripped and the rest of the value will be used as a string. This is useful if you want to force an integer value to be used as a string.

### Common error responses

   * Except for the Create (POST) operation, When using the `collection/_id` way of identifying a document, if the document does not exist, an HTTP 404 (Not Found) error is returned.
   * For invalid requests (e.g., missing `_id` parameter in the request body), an HTTP 400 (Bad Request) error is returned. The response body will be a JSON with additional details.

### Create (POST)

Creates one or more objects. Specifying the primary key is optional, just like the MongoDB `insert` operation. A primary key will be generated if not specified.

Variants:

1. `collection/_id`, `{}`: Inserts a document (body) with primary key `_id` request body need not have it.
1. `collection`, `{}`: When the request body is an object, a single document is inserted. If the document contains an `_id`, it is used as the primary key, otherwise the primary key is generated just like the MongoDB `insert` command.
1. `collection`, `[]`, request body is an array: Each document is inserted using MongoDB `insertMany`. The primary key, `_id`, will be generated if not supplied.

Notes:
   * These methods will **not** update or replace an existing document with `_id`, if it exists. In other words, this is not an upsert operation. The operation will fail with a 400 HTTP status.
   * In a bulk operation, if any supplied `_id` document exists, the entire operation will fail.

Success response:

```
{
   "result" : {
      "ok" : 1,
   }
   "insertedCount" : 2,
   "insertedIds" : {
      "0" : 1,
      "1" : "5e635b1d7a189f6a101e67ad"
   },
}
```

Failure response (in case of a duplicate key):
```
{
  "status": "error",
  "error": {
    "code" : 11000,
    "errmsg" : "E11000 duplicate key error collection: test.test index: _id_ dup key: { _id: 1 }",
    "index" : 0
  }
}
```

### Read (GET)

Returns one ore more objects from a collection.

Variants:

1. `collection/_id`: Gets the single document.
1. `collection`, `[?<query>]`: We use [query-params-mongo](https://www.npmjs.com/package/query-params-mongo) for parsing the filter specification. Note that this has sorting and pagination support too. For the filter, the MongoDB filter can be specified directly in a parameter named `__filter`.

Returns:

   * Success: A single object or an array of objects, either of which can be empty.
   * Failure: In case of a single document request, a HTTP Status 404 is is returned if the object with the given ID is not found. In case of multiple document request, HTTP status 200 with an empty array is returned.

### Update (PATCH)

Updates one or more documents with changes specified as in MongoDB's `$set` operator. In case of multiple documents, each document's update specification needs to be specified differently. This is not the same as MongoDB's update command, It is, instead, a bulk write operation.

Variants:

1. `collection/_id`: Updates a single document using MongoDB `$set` operator using the request body.
1. `collection`: The request body must be an array of objects, each with an `_id` field. The rest of the object will be supplied to the `$set` operator.

Success response:
```
{
  result: {
    ok: 1
  },
  matchedCount: 0,
  modifiedCount: 0
}
```
Failure response (Missing IDs):
```
{
  status: 'error',
  statusCode: 400,
  message: 'Missing _id in update (index 0)'
}
```

### Replace (PUT)

Replaces one more more documents with the given document(s). This is also a bulk write operation like the Update (PATCH) operation.

Variants:

1. `collection/_id`: Replaces a single document identified by `_id` with the one given in the request body.
2. `collection`: The request body is expected to be an array of objects, with each object containing an `_id` field, which will identify the document and replace it with the given one. Non-existent documents will be created, as in an upsert operation.

Success response:
```
{
  result: {
    ok: 1,
    nModified: 0,
    nUpserted: 1
  },
  matchedCount: 0,
  modifiedCount: 1
}
```
Failure response (Missing IDs):
```
{
  status: 'error',
  statusCode: 400,
  message: 'Missing _id in update (index 0)'
}
```

### Delete (DELETE)

Deletes one or more documents. To delete multiple documents, an optional filter selects the documents to be deleted.

Variants:

1. `collection/_id`: Deletes a single document identified by `_id`.
1. `collection`, `[?<query>]`: Clears the entire collection or a filtered subset described by the filter in the query params. We use [query-params-mongo](https://www.npmjs.com/package/query-params-mongo) for parsing the query string to get a filter. Or, the MongoDB filter can be specified directly in a parameter named `__filter`.

Returns:

```
{
  result: {
    ok: 1
  },
  deletedCount: 1
}
```

## BSON data types

The request body is parsed using [mongodb-extjson](https://github.com/mongodb-js/mongodb-extjson/tree/v3.0.3), so data types that are native to MongoDB but not supported by the JSON format can also be specified. The [Extended JSON documentation](https://github.com/mongodb/specifications/blob/master/source/extended-json.rst) has a detailed specification of all the data types.

A few common ones are described here:

| Type     | Example                                               | Resulting Value |
| ---------| ----------------------------------------------------- | ---------------- |
| ObjectId | { "id": { "$oid: "5ecce33370eef71be8ba4b5a" }         | ObjectId("5ecce33370eef71be8ba4b5a") |
| Long     | { "n": { "$numberLong": "1584963168000" }             | NumberLong(1584963168000) |
| Date     | { "t": { "$date": "2020-01-01T12:13:14.123Z" }        | ISODate("2020-01-01T12:13:14.123Z") |
|          | { "d": { "$date": { "numberLong": "1593159811000" } } | ISODate("2020-06-26T08:23:31Z") |
