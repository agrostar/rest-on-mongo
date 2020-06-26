require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/update" from the project directory. If you want to
 * run selective tests, run "npx mocha test/update --grep many".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Update tests', () => {
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

  it('should update one', async () => {
    // Prepare
    const doc = { _id: 'id-1', value: 4, untouched: 6 };
    await db.collection(collection).insertOne(doc);
    // Do
    const update = { value: 5, new: 7 };
    const res = await request(app)
      .patch(`/${collection}/${doc._id}`)
      .send(update);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(1);
    // Check
    const updated = await db.collection(collection).findOne({ _id: doc._id });
    expect(updated.value).to.equal(update.value);
    expect(updated.new).to.equal(update.new);
    expect(updated.untouched).to.equal(doc.untouched);
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: doc._id });
    expect(result.deletedCount).to.equal(1);
  });

  it('should update many', async () => {
    // Prepare
    const toInsertMany = [
      { _id: 'id-1', value: 1, updated: false },
      { _id: 'id-2', value: 2, updated: false },
    ];
    await db.collection(collection).insertMany(toInsertMany);
    // Do
    const toUpdateMany = [
      { _id: 'id-1', updated: true, new: 1 },
      { _id: 'id-2', updated: true, new: 2 },
    ];
    const res = await request(app)
      .patch(`/${collection}`)
      .send(toUpdateMany);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(toUpdateMany.length);
    // Check
    const updated = await db.collection(collection).find().toArray();
    expect(updated.length).to.equal(toUpdateMany.length);
    expect(updated[0].update).to.equal(toUpdateMany[0].update);
    expect(updated[1].new).to.equal(toUpdateMany[1].new);
    expect(updated[0].value).to.equal(toInsertMany[0].value); // original, untouched
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(toInsertMany.length);
  });

  it('should fail to update many non-array', async () => {
    const update = { _id: 1, value: 1 };
    const res = await request(app)
      .patch(`/${collection}`)
      .send(update);
    expect(res.statusCode).to.equal(400);
    expect(res.body.status).to.equal('error');
  });

  it('should fail to update many without _id', async () => {
    const toUpdateManyNoId = [
      { _id: 'id-2', update: 4, updated: true },
      { update: 5, updated: true },
    ];
    const res = await request(app)
      .patch(`/${collection}`)
      .send(toUpdateManyNoId);
    expect(res.statusCode).to.equal(400);
    expect(res.body.status).to.equal('error');
  });

  it('should fail to update one non-existent', async () => {
    const update = { testNumber: 1.6 };
    const res = await request(app)
      .patch(`/${collection}/xxxx`)
      .send(update);
    expect(res.statusCode).to.equal(404);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(0);
  });

  it('should fail to update one non-object', async () => {
    const array = [
      { _id: 'id-1', update: 1, updated: true },
      { _id: 'id-2', update: 2, updated: true },
    ];
    const res = await request(app)
      .patch(`/${collection}/id-1`)
      .send(array);
    expect(res.statusCode).to.equal(400);
    expect(res.body.status).to.equal('error');
  });
});
