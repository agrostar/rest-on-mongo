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

  it('should create one', async () => {
    const dateMillis = '1593159811000';
    const dateString = '2020-01-01T12:13:14.123Z';
    const toCreate = {
      _id: 'id-1',
      testNumber: 11,
      testLong: { $numberLong: '1584963168123123123' },
      testObjectId: { $oid: '5ec7cb151a1878fbefce4119' },
      testDateMillis: { $date: { $numberLong: dateMillis } },
      testDateString: { $date: dateString },
      testString: 'AgroStar',
      autoId: false,
    };
    // Do
    const res = await request(app)
      .post(`/${collection}`)
      .send(toCreate);
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.insertedCount).to.equal(1);
    // Check
    const created = await db.collection(collection).findOne({ _id: 'id-1' });
    expect(created.testObjectId).to.be.a('Object').and.have.property('_bsontype', 'ObjectID');
    assert(created.testLong.equals(Long.fromString('1584963168123123123')), 'Not a long');
    expect(created.testDateMillis.getTime())
      .to.equal(new Date(parseInt(dateMillis, 10)).getTime());
    expect(created.testDateString.getTime()).to.equal(new Date(dateString).getTime());
    // Cleanup
    await db.collection(collection).deleteOne({ _id: 'id-1' });
  });

  it('should create many', async () => {
    // Prepare
    const toCreateMany = [
      { _id: 'id-2', name: 'second', autoId: false },
      { _id: 'id-3', name: 'third', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    const res = await request(app)
      .post(`/${collection}`)
      .send(toCreateMany);
    // Do
    expect(res.statusCode).to.equal(200);
    expect(res.body.result.ok).to.equal(1);
    expect(res.body.insertedCount).to.equal(toCreateMany.length);
    // Check
    const docs = await db.collection(collection).find().toArray();
    expect(docs.length).to.equal(toCreateMany.length);
    expect(docs[0]).to.deep.equal(toCreateMany[0]);
    expect(docs[1]).to.deep.equal(toCreateMany[1]);
    // Cleanup
    await db.collection(collection).deleteMany({});
  });

  it('should fail to create duplicates', async () => {
    const toCreate = { _id: 1 };
    await db.collection(collection).insertOne(toCreate);
    const res = await request(app)
      .post(`/${collection}`)
      .send(toCreate);
    expect(res.statusCode).to.equal(400);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(1);
  });

  it('should fail to create empty', async () => {
    // Post without body
    const res = await request(app)
      .post(`/${collection}`);
    expect(res.statusCode).to.equal(400);
  });
});
