require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/delete" from the project directory. If you want to
 * run selective tests, run "npx mocha test/delete --grep many".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Delete tests', () => {
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

  it('should delete one', async () => {
    // Prepare
    const doc = { _id: 'id-1', value: 4, untouched: 6 };
    await db.collection(collection).insertOne(doc);
    // Do
    const res = await request(app)
      .delete(`/${collection}/id-1`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.deletedCount).to.equal(1);
    // Check
    const after = await db.collection(collection).findOne();
    expect(after).to.be.null; // eslint-disable-line no-unused-expressions
  });

  it('should delete many with filter (query params)', async () => {
    // Prepare
    const before = [
      { _id: 'id-1', remove: true },
      { _id: 'id-2', remove: false },
      { _id: 'id-3', remove: true },
    ];
    await db.collection(collection).insertMany(before);
    // Do
    const res = await request(app)
      .delete(`/${collection}?remove=true`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    const removed = before.filter((x) => x.remove);
    const remaining = before.filter((x) => !x.remove);
    expect(res.body.deletedCount).to.equal(removed.length);
    // Check
    const after = await db.collection(collection).find().toArray();
    expect(after.length).to.equal(remaining.length);
    expect(after[0]).to.deep.equal(remaining[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(remaining.length);
  });

  it('should delete with many filter (mongo filter)', async () => {
    // Prepare
    const before = [
      { _id: 'id-1', remove: true },
      { _id: 'id-2', remove: false },
      { _id: 'id-3', remove: true },
    ];
    await db.collection(collection).insertMany(before);
    // Do
    const res = await request(app)
      .delete(`/${collection}`)
      .query({ __filter: '{"remove": true}' });
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    const removed = before.filter((x) => x.remove);
    const remaining = before.filter((x) => !x.remove);
    expect(res.body.deletedCount).to.equal(removed.length);
    // Check
    const after = await db.collection(collection).find().toArray();
    expect(after.length).to.equal(remaining.length);
    expect(after[0]).to.deep.equal(remaining[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(remaining.length);
  });

  it('should clear collection', async () => {
    // Prepare
    const before = [
      { _id: 'id-1' },
      { _id: 'id-2' },
      { _id: 'id-3' },
    ];
    await db.collection(collection).insertMany(before);
    // Do
    const res = await request(app)
      .delete(`/${collection}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    // Check
    const after = await db.collection(collection).findOne();
    expect(after).to.be.null; // eslint-disable-line no-unused-expressions
  });

  it('should fail to delete non-existent', async () => {
    const res = await request(app)
      .delete(`/${collection}/xxxx`);
    expect(res.statusCode).to.equal(404);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.deletedCount).to.equal(0);
  });
});
