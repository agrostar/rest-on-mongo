require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const tokenAuth = require('../lib/tokenAuth');

/*
 * Run this script using "mocha test/handlers" from the project directory.
 */

/* global describe it before */

const app = express();
const authToken = 'somesecret';

describe('All auth tests', () => {
  before(async () => {
    app.use('/', tokenAuth(authToken));
  });

  it('should fail auth without auth header', async () => {
    const res = await request(app)
      .get('/');
    expect(res.statusCode).to.equal(401);
  });

  it('should fail auth with wrong auth header', async () => {
    const res = await request(app)
      .get('/')
      .set('Authorization', 'Bearer: xxx');
    expect(res.statusCode).to.equal(401);
  });

  it('should fail auth with correct token without Bearer', async () => {
    const res = await request(app)
      .get('/')
      .set('Authorization', authToken);
    expect(res.statusCode).to.equal(401);
  });

  it('should auth but 404', async () => {
    const res = await request(app)
      .get('/notfound')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).to.equal(404);
  });
});
