require('dotenv').config();
const { expect, assert } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient, Long } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/create" from the project directory. If you want to
 * run selective tests, run "npx mocha test/create --grep many".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Create tests', () => {
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

  it('should create one with id', async () => {
    const dateMillis = '1593159811000';
    const dateString = '2020-01-01T12:13:14.123Z';
    const longString = '1584963168123123000';
    const _id = 'id-1';
    const doc = {
      testNumber: 11,
      testLong: { $numberLong: longString },
      testObjectId: { $oid: '5ec7cb151a1878fbefce4119' },
      testDateMillis: { $date: { $numberLong: dateMillis } },
      testDateString: { $date: dateString },
      testString: 'AgroStar',
      autoId: false,
    };
    // Do
    const res = await request(app)
      .post(`/${collection}/${_id}`)
      .send(doc);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.insertedCount).to.equal(1);
    // Check
    const created = await db.collection(collection).findOne({ _id });
    expect(created.testObjectId).to.be.a('Object').and.have.property('_bsontype', 'ObjectID');
    assert(created.testLong.equals(Long.fromString(longString)), 'Not a long');
    expect(created.testDateMillis.getTime())
      .to.equal(new Date(parseInt(dateMillis, 10)).getTime());
    expect(created.testDateString.getTime()).to.equal(new Date(dateString).getTime());
    // Cleanup
    await db.collection(collection).deleteOne({ _id });
  });

  it('should create one as object', async () => {
    // Prepare
    const doc = { value: 100 };
    const res = await request(app)
      .post(`/${collection}`)
      .send(doc);
    // Do
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.insertedCount).to.equal(1);
    // Check
    const docs = await db.collection(collection).find().toArray();
    expect(docs.length).to.equal(1);
    expect(docs[0].value).to.equal(doc.value);
    // Cleanup
    await db.collection(collection).deleteOne({ _id: docs[0]._id });
  });

  it('should create many', async () => {
    // Prepare
    const docs = [
      { _id: 'id-2', name: 'second', autoId: false },
      { _id: 'id-3', name: 'third', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    const res = await request(app)
      .post(`/${collection}`)
      .send(docs);
    // Do
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.insertedCount).to.equal(docs.length);
    // Check
    const created = await db.collection(collection).find().toArray();
    expect(created.length).to.equal(docs.length);
    expect(created[0]).to.deep.equal(docs[0]);
    expect(created[1]).to.deep.equal(docs[1]);
    // Cleanup
    await db.collection(collection).deleteMany({});
  });

  it('should fail to create duplicates', async () => {
    const doc = { _id: 1, value: 100 };
    await db.collection(collection).insertOne(doc);
    const res = await request(app)
      .post(`/${collection}`)
      .send(doc);
    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.have.string('duplicate');
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: doc._id });
    expect(result.deletedCount).to.equal(1);
  });

  it('should fail to create duplicate - at ID', async () => {
    // Prepare
    const doc = { value: 100 };
    const _id = 1;
    await db.collection(collection).insertOne({ _id });
    // Do
    const res = await request(app)
      .post(`/${collection}/${_id}`)
      .send(doc);
    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.have.string('duplicate');
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id });
    expect(result.deletedCount).to.equal(1);
  });

  it('should fail to create duplicate - many', async () => {
    // Prepare
    const existing = { _id: 1, value: 100 };
    await db.collection(collection).insertOne(existing);
    // Do
    const adding = [
      { _id: 1, value: 200 },
      { _id: 2, value: 300 },
    ];
    const res = await request(app)
      .post(`/${collection}`)
      .send(adding);
    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.have.string('duplicate');
    // Check
    const created = await db.collection(collection).findOne({ _id: 2 });
    expect(created).to.be.null; // eslint-disable-line no-unused-expressions
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(1);
  });

  it('should fail to create without body', async () => {
    const res = await request(app)
      .post(`/${collection}`);
    expect(res.statusCode).to.equal(400);
  });

  it('should handle invalid JSON gracefully', async () => {
    const malFormedJSON = '{ _id: 1 }';
    const res = await request(app)
      .post(`/${collection}`)
      .send(malFormedJSON);
    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.have.string('JSON');
  });
});
