require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/read" from the project directory. If you want to
 * run selective tests, run "npx mocha test/read --grep filter".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Read tests', () => {
  before(async () => {
    client = new MongoClient(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    app.use('/', (req, res, next) => {
      req.db = db;
      next();
    });
    await db.collection(collection).deleteMany({});
    app.use(restRoutes.all());
  });
  after(() => {
    client.close();
  });

  it('should get one', async () => {
    // Prepare
    const doc = { _id: 'id-1', testNumber: 1.1, testString: 'string-to-test' };
    await db.collection(collection).insertOne(doc);
    // Do
    const res = await request(app)
      .get(`/${collection}/id-1`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.testNumber).to.equal(doc.testNumber);
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: doc._id });
    expect(result.deletedCount).to.equal(1);
  });

  it('should get one - object ID', async () => {
    // Prepare
    const doc = { testNumber: 2.1, name: 'auto id' };
    const createResult = await db.collection(collection).insertOne(doc);
    const { insertedId } = createResult;
    // Do
    const res = await request(app)
      .get(`/${collection}/${insertedId}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.name).to.equal(doc.name);
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: insertedId });
    expect(result.deletedCount).to.equal(1);
  });

  it('should get many unfiltered', async () => {
    // Prepare
    const docs = [
      { _id: 'id-1', name: 'first', autoId: false },
      { _id: 'id-2', name: 'second', autoId: false },
    ];
    await db.collection(collection).insertMany(docs);
    // Do
    const res = await request(app)
      .get(`/${collection}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.length).to.equal(docs.length);
    expect(res.body[0]).to.deep.equal(docs[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(docs.length);
  });

  it('should get many filtered by query params', async () => {
    // Prepare
    const docs = [
      { _id: 'id-1', name: 'first', autoId: false },
      { _id: 'id-2', name: 'second', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    await db.collection(collection).insertMany(docs);
    // Do
    const res = await request(app)
      .get(`/${collection}?autoId=false`);
    expect(res.statusCode).to.equal(200);
    const filtered = docs.filter((x) => x.autoId === false);
    expect(res.body.length).to.equal(filtered.length);
    expect(res.body[0]).to.deep.equal(filtered[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(docs.length);
  });

  it('should get many filtered by mongo filter)', async () => {
    // Prepare - intentionally create a number value as a string
    const numString = '123456';
    const docs = [
      { _id: 'id-1', name: numString },
      { _id: 'id-2', name: 'third', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    await db.collection(collection).insertMany(docs);
    // Do
    const res = await request(app)
      .get(`/${collection}`)
      .query({ __filter: `{"name": "${numString}" }` });
    expect(res.statusCode).to.equal(200);
    expect(res.body.length).to.equal(docs.filter((x) => x.name === numString).length);
    expect(res.body[0]._id).to.equal(docs[0]._id);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(docs.length);
  });
});
