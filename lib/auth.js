const passport = require('passport');
const passportJWT = require('passport-jwt');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports.initializeAuth = (app, jwtKey) => {
  // Configura passport para que utilice JWT
  passport.use(new passportJWT.Strategy(
    {
      secretOrKey: jwtKey,
      jwtFromRequest: passportJWT.ExtractJwt.fromExtractors([
        passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
        passportJWT.ExtractJwt.fromUrlQueryParameter('token'), // opcional
      ]),
    },
    (jwt_payload, done) => {
      done(null, jwt_payload);
    }
  ));

  // Inicializa passport
  app.use(passport.initialize());
}


module.exports.authRoutes = (routes, jwtKey) => {
  routes.get('/auth/session',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
      const Users = req.db.collection('users');
      const user = await Users.findOne({ _id: ObjectId(req.user.id) });
      res.json(user);
    }
  );

  routes.post('/auth/login', async (req, res, next) => {
    // Parametrizar esto (username or password)
    const { email, password } = req.body;

    if (!email || !password) {
      return next(400);
    }

    const Users = req.db.collection('users');

    const user = await Users.findOne({ email });

    const match = await bcrypt.compare(password, user.password);

    if (match) {
      const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
      return res.json({ token });
    } else {
      return next(403);
    }
  });
}

module.exports.authenticate = () => {
    return [
        passport.authenticate('jwt', { session: false })
    ];
}