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
  routes.post('/auth/register', async (req, res, next) => {
    // Parametrizar esto (username or password)
    const body = req.body;

    if (!body.email || !body.password) {
      return next(400);
    }
    console.log(body.email, body.password);
    const Users = req.db.collection('users');
    const oldUser = await Users.findOne({ email: body.email });
    console.log(oldUser);
    if(!oldUser){
      const salt = await bcrypt.genSalt(10);
      body.password = await bcrypt.hash(body.password, salt);
      const user = await Users.insertOne(body);
      console.log(user._id);
      const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
      return res.json({ token, user });
    }else{
      return next(500);
    }
    
  });
  routes.post('/auth/login', async (req, res, next) => {
    // Parametrizar esto (username or password)
    const { email, password } = req.body;
    if (!email || !password) {
      return next(400);
    }
    
    const Users = req.db.collection('users');
    
    const user = await Users.findOne({ email });
    if(!user){
        return next(403)
    }else{
      const match = await bcrypt.compare(password, user.password);
      
      console.log(match);
      if (match) {
        const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
        return res.json({ token, user });
      } else {
        return next(403); 
      }
    }
  });
}

module.exports.authenticate = () => {
    return [
        passport.authenticate('jwt', { session: false })
    ];
}