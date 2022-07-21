const passport = require('passport');
const passportJWT = require('passport-jwt');
const AnonymousStrategy = require('passport-anonymous').Strategy;
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
  passport.use(new AnonymousStrategy());
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
  routes.post('/auth/updatePassword',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
      const Users = req.db.collection('users');
      let user = await Users.findOne({ _id: ObjectId(req.user.id) });
      const body = req.body;
      console.log(body.password);
      if(user){
        const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
        const salt = await bcrypt.genSalt(10);
        body.password = await bcrypt.hash(body.password, salt);
        let result = await Users.updateOne({_id: user._id}, {$set: {"password": body.password}});
        modified_user = await Users.findOne({ _id: ObjectId(req.user.id) });
        return res.json({ token, user: modified_user });
      }
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
    console.log(user, email);
    if(!user){
      return next(403)
    }else{
      const match = await bcrypt.compare(password, user.password);
      console.log(match, user.password, password);
      
      if (match) {
        const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
        return res.json({ token, user });
      } else {
        return next(403); 
      }
    }
  });
  routes.get('/auth/validate_recovery_hash/:recovery_hash', async (req, res, next) => {
    // Parametrizar esto (username or password)
    const recovery_hash = req.params.recovery_hash;
    if (!recovery_hash) {
      return next(400);
    }
    const Users = req.db.collection('users');
    
    const user = await Users.findOne({ recovery_hash: recovery_hash });
    console.log(user);
    if(!user){
      return next(403)
    }else{
      user.recovery_hash = null;
      user.save();
      const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 4 });
      return res.json({ token });
    }
  });
}

module.exports.authenticate = (options) => {
  return [
     function(req, res, next) {
        if (req.url.indexOf('/file/') === 0 || req.url.indexOf('/auth/password_recovery') === 0) {
          next();
        } else if (typeof process?.env?.EXCLUDE === 'string') {
          const splitted =  process?.env?.EXCLUDE.split(' ');
          if (Array.isArray(splitted) && !!splitted.find(s => req.url.indexOf(s) >= 0)) { // === '/users?type=chef') {
            next();
          } else {
            passport.authenticate('jwt', { session: false })(req, res, next);
          }
        } else {
          passport.authenticate('jwt', { session: false })(req, res, next);
        }
      } 
  ];
}