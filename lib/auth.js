require('dotenv').config();
const passport = require('passport');
const passportJWT = require('passport-jwt');
const AnonymousStrategy = require('passport-anonymous').Strategy;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const {OAuth2Client} = require('google-auth-library');
const sendEmail = require('../services/send-email');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * 
charactersLength));
 }
 return result;
}




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

  routes.post('/auth/verifygoogle', 
  async (req, res) => {
    const ticket = await client.verifyIdToken({
      idToken: req.body.token,
      requiredAudience: GOOGLE_CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    console.log("GOOGLE VERIFY");
    console.log(payload);
    console.log(userid);
    if(payload){
      const Users = req.db.collection('users');
      const oldUser = await Users.findOne({ email: payload.email });
      console.log(oldUser);
      if(!oldUser){
        const body = {};
        const salt = await bcrypt.genSalt(10);
        body.password = await bcrypt.hash(makeid(10), salt);
        body.email = payload.email;
        body.name = payload.name;
        const newuser = await Users.insertOne(body);
        const responseUser = await Users.findOne({_id: newuser.insertedId});
        console.log(responseUser);
        const token = jwt.sign({ id: responseUser._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
        return res.json({ token, user: responseUser });
      }else{
        const token = jwt.sign({ id: oldUser._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
        // res.send(JSON.stringify({ token, user: oldUser }));
        return res.json({ token, user: oldUser });
      }
    }
    // res.send({ payload, userid });

    // If request specified a G Suite domain:
    // const domain = payload['hd'];

  });
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
      const responseUser = await Users.findOne({_id: user.insertedId});
      console.log(responseUser);
      const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
      return res.json({ token, user: responseUser });
    }else{
      return next(500);
    }
    
  });
  routes.get('/auth/activate/:email/:app?', async function (req, res) { // /:user_id/:prop
    // res.send('hello world')
    console.log("email");
    console.log(req.params.email);
    const db = req.db;
    const collection = db.collection('users');
    let recovery_hash = parseInt(Math.random() * 1000000);
    const response = await collection.updateOne({ email: req.params.email }, { $set: { activation_code: recovery_hash } });
    const { result, matchedCount, modifiedCount } = response;
    if (matchedCount !== 1) {
      console.log("here");
      res.send('www');
      res.status(405);
    } else {
      console.log("sendEmail");
      sendEmail(req.params.email, 'Activacion de cuenta ' + req.params.app + '.', "El código de activacion es: " + recovery_hash);
      res.send({ result, matchedCount, modifiedCount });
    }
  });
  routes.get('/auth/validate_activation/:recovery_hash', async (req, res, next) => {
    // Parametrizar esto (username or password)
    const recovery_hash = req.params.recovery_hash;
    if (!recovery_hash) {
      return next(400);
    }
    const Users = req.db.collection('users');
    
    const user = await Users.findOne({ activation_code: parseInt(recovery_hash, 10) });
    console.log(user);
    if(!user){
      return res.json({valid: false});
    }else{
      user.activation_code = null;
      const token = jwt.sign({ id: user._id }, jwtKey, { expiresIn: 60 * 60 * 4 });
      await Users.updateOne({ _id: user._id }, {$set: { "activation_code": null, active: true }});
      return res.json({valid: true, token});
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
    
    const user = await Users.findOne({ recovery_hash: parseInt(recovery_hash, 10) });
    console.log(user);
    if(!user){
      return next(403)
    }else{
      user.recovery_hash = null;
      await Users.updateOne({ _id: user._id }, {$set: { "recovery_hash": null }});
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