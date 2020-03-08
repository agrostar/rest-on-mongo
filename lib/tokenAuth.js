function tokenAuth(authToken) {
  return function authenticateWithToken(req, res, next) {
    const tokenHeader = req.header('Authorization') || '';
    const userToken = tokenHeader.replace('Bearer ', '');
    if (tokenHeader.indexOf('Bearer ') === 0 && userToken === authToken) {
      next();
    } else {
      console.error(`Auth failure: expecting "Bearer: ${authToken}", got "${userToken}"`);
      res.status(401).send({ status: 'failed', message: 'Auth failure' });
    }
  };
}

module.exports = tokenAuth;
