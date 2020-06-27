require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/replace" from the project directory. If you want to
 * run selective tests, run "npx mocha test/replace --grep many".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Replace tests', () => {
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

  it('should replace one', async () => {
    // Prepare
    const orig = { _id: 'id-1', value: 10, old: 2 };
    await db.collection(collection).insertOne(orig);
    // Do
    const changes = {
      _id: 'id-1', value: 100, new: 1,
    };
    const res = await request(app)
      .put(`/${collection}/${orig._id}`)
      .send(changes);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(1);
    // Check
    const replaced = await db.collection(collection).findOne({ _id: orig._id });
    expect(replaced.value).to.equal(changes.value);
    expect(replaced.new).to.equal(changes.new);
    expect(replaced.old).to.be.undefined; // eslint-disable-line no-unused-expressions
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: orig._id });
    expect(result.deletedCount).to.equal(1);
  });

  it('should replace many', async () => {
    // Prepare
    const orig = [
      { _id: 'id-1', value: 10, old: 1 },
      { _id: 'id-2', value: 20, old: 2 },
    ];
    await db.collection(collection).insertMany(orig);
    // Do
    const changes = [
      { _id: 'id-1', value: 100, new: true },
      { _id: 'id-2', value: 200, new: true },
    ];
    const res = await request(app)
      .put(`/${collection}`)
      .send(changes);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(changes.length);
    // Check
    const replaced = await db.collection(collection).find().toArray();
    expect(replaced.length).to.equal(changes.length);
    expect(replaced[0].value).to.equal(changes[0].value);
    expect(replaced[1].new).to.equal(changes[1].new);
    expect(replaced[0].old).to.be.undefined; // eslint-disable-line no-unused-expressions
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(orig.length);
  });

  it('should upsert when not existent', async () => {
    // Prepare
    const orig = [
      { _id: 'id-1', value: 10, old: 1 },
      { _id: 'id-2', value: 20, old: 2 },
    ];
    await db.collection(collection).insertMany(orig);
    // Do
    const changes = [
      { _id: 'id-1', value: 100, new: true },
      { _id: 'id-3', value: 300, new: true },
    ];
    const res = await request(app)
      .put(`/${collection}`)
      .send(changes);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.result.nModified).to.equal(1);
    expect(res.body.result.nUpserted).to.equal(1);
    // Check
    const replaced = await db.collection(collection).find().toArray();
    expect(replaced.length).to.equal(changes.length + 1);
    expect(replaced[0]).to.deep.equal(changes[0]);
    expect(replaced[1]).to.deep.equal(orig[1]);
    expect(replaced[2]).to.deep.equal(changes[1]);
  });

  it('should fail to replace non-existent', async () => {
    const changes = {
      _id: 'id-1', value: 100, new: 1,
    };
    const res = await request(app)
      .put(`/${collection}/xxxx`)
      .send(changes);
    expect(res.statusCode).to.equal(404);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.modifiedCount).to.equal(0);
  });

  it('should fail to replace many non-array', async () => {
    const changes = {
      _id: 'id-1', value: 100, new: 1,
    };
    const res = await request(app)
      .put(`/${collection}`)
      .send(changes);
    expect(res.statusCode).to.equal(400);
    expect(res.body.status).to.equal('error');
  });

  it('should fail to replace many without _id', async () => {
    const changes = [
      { _id: 'id-1', update: 4, updated: true },
      { update: 5, updated: true },
    ];
    const res = await request(app)
      .put(`/${collection}`)
      .send(changes);
    expect(res.statusCode).to.equal(400);
    expect(res.body.status).to.equal('error');
  });
});
