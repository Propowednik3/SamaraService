/*process.on('unhandledRejection', (reason, p) => 
    {
        console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', err => 
    {
        console.error(err, 'Uncaught Exception thrown');
        process.exit(1);
    });*/

 
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var express = require('express');
var http = require('http');
//var https = require('https');
//const HttpError = require('./error').HttpError;
var app = express();

var bCrypt = require('bcrypt-nodejs');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var sessionStore = new MongoStore({ url: config.mongodb.url + config.mongodb.database });
//var gridFS = require('gridfs-stream');
//var connect = require('connect');
var cookieParser = require('cookie-parser');
var socket = require('./socket/socket');

var bodyParser = require('body-parser');
var async = require('async');
var path = require('path');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var MongoDB = require('mongodb');
var MongoClient = MongoDB.MongoClient;
var ObjectId = MongoDB.ObjectID;
var multer = require('multer');
const { Readable } = require('stream');
var mailer = require('./mailer');
var cryptopro = require('./cryptopro');
var captchapng = require('captchapng');
    
mailer.Init(config.mailer.login, config.mailer.password, config.mailer.server, config.mailer.from_address, config.mailer.auth);

var db, db_users, db_workplaces, db_chats, db_chatdetails, db_chatsessions, db_manuals, db_manualdetails, db_links, gridFiles, db_states, db_captchas;
/*
var sslOptions = {
    //ca: fs.readFileSync("cert.pem"),
    //requestCert: true,
    //ca: fs.readFileSync('/etc/ssl/certs/ca.crt'),
    //rejectUnauthorized: false ,
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};*/

//app.use(bodyParser.json);
//app.use(bodyParser.urlencoded);
app.use(cookieParser());
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
                store: sessionStore,
                secret: config.session.secret,
                key: config.session.key,
                resave: false,
                saveUninitialized: true,
                cookie: config.session.cookie
              }));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done)
{
   //console.log('serializeUser ' + user);
   done(null, user._id);
});

passport.deserializeUser(function(id, done)
{
   //console.log('deserializeUser ' + id);
   db_users.findOne({ '_id' : ObjectId(id)}, function (err, user)
                 {
                    if (err) return done(err);
                    //if (!user) console.log('User Not Found with id '+id);
                      //else console.log('User Found with id '+id);
                    done(err, user);
                 });
});

var createHash = function(password)
{
  return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

var isValidPassword = function(user, password)
{
  return bCrypt.compareSync(password, user.password);
}

app.engine('ejs', require('ejs-locals'));
app.set('views', __dirname + '/templates');
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));


app.get('/logout', function (req, res)
      {
        //console.log('GET "/logout"');
        req.logout();
        res.redirect('/login');
      });

app.post('/signup', bodyParser.urlencoded({ extended: true }), function(req, res)
{
    if ((req.body.username == undefined) || (req.body.password == undefined) || (req.body.email == undefined) || 
        (req.body.username == "") || (req.body.password == "") || (req.body.email == ""))
        return res.status(400).json({message: 'Не верные учетные данные', url: '/login'});
    
    var nowdate = new Date();
    nowdate = Date(nowdate.getTime() - config.pass_signup_interval);
        
    db_users.deleteMany({ passtime: { $lte: nowdate } } , function(err)
    {
        if (err) throw err;
        db_users.find({ $or: [
                                { login_upper : req.body.username.toUpperCase() }, 
                                { email_upper : req.body.email.toUpperCase() }
                            ]}).toArray(function(err, users)
        {
            if (err) throw err;

            for (var i = 0; i < users.length; i++)
            {
                if ((users[i].changecode == "") && (users[i].login_upper == req.body.username.toUpperCase())) 
                    return res.status(400).json({message: 'Пользователь с таким логином уже существует', url: ''});
                if ((users[i].changecode == "") && (users[i].email_upper == req.body.email.toUpperCase())) 
                    return res.status(400).json({message: 'Пользователь с такой почтой уже существует', url: ''});
            }
            if (users.length) return res.status(400).json({message: 'Пользователь с такими данными уже регистрируется', url: ''});
            
            signup(req.body.username, req.body.password, req.body.email);
        });
    });   
    
    function signup(login, password, email)
    {
        var newUser = {};
        newUser.login = login;
        newUser.login_upper = login.toUpperCase();        
        newUser.newpass = createHash(password);
        newUser.email = email;
        newUser.email_upper = email.toUpperCase();        
        newUser.firstname = login;
        newUser.middlename = "";
        newUser.lastname = "";
        newUser.passtime = new Date();            
        newUser.changecode = createHash(newUser.email.substring(0, 6) + newUser.passtime.getTime());
            
        var codestr = "/signupaccept?username="+encodeURIComponent(login) + '&code=' +encodeURIComponent(newUser.changecode);
        var url = "http://" + config.ex_hostname + ":" + config.ex_port + codestr
        if (config.ex_port == "") url = "http://" + config.ex_hostname + codestr; 
    
        mailer.SendMail(email, email, 'Подтверждение регистрации',  
                                        '<p>Подтверждение регистрации для логина:'+ login + '</p>'+
                                        '<p>Для подтверждения перейдите по ссылке или по кнопке:</p>' +
                                        '<p><a href="'+url+'">Confirm</a></p>', function(ressend)
        {
            if (!ressend) return res.status(500).json({message: 'Не удалось отправить письмо для подтверждения регистрации', url : ''});
            db_users.insertOne(newUser, function(err)
            {
                if (err) throw err;
                   return res.status(200).json({message: 'Письмо отправлено', url: '/login'});
            }); 
        });
    }
});

function getCaptchaImg(num)
{
    var p = new captchapng(80,30,parseInt(num)); // width,height,numeric captcha
    p.color(0,0,0,0);  // First color: background (red, green, blue, alpha)
    p.color(255, 104, 21, 255); // Second color: paint (red, green, blue, alpha)
    var img = p.getBase64();
    var imgbase64 = new Buffer(img,'base64');
    return imgbase64;
}

app.get('/login', function (req, res)
{
    if (req.isAuthenticated()) return res.redirect('/');

   /* db_captchas.find({}, {}, function(err, cursor)
    {
        if (err) throw(err);
        cursor.count(function (e, count) 
        {
            if (count > config.captcha_max_count)
            {
                db_captchas.findAndModify({
                                    query: {},
                                    sort: { 'timestamp': 1 },
                                    limit: count - config.captcha_max_count,
                                    remove: true));
            }
        });
    });*/
     
   /* var secretnum = Math.random()*900000+100000;
    var valicode = new Buffer(getCaptchaImg(secretnum)).toString('base64'); 

    res.render('login', { 'id_code' : hash , 'valicode' : valicode });*/
    res.sendFile(__dirname + "/public/login.html");
});

app.post('/login', bodyParser.urlencoded({ extended: true }), function (req, res)
{
    /*console.log(req.body);
    var hashsess = cryptopro.HashCreate();
    var data = new Buffer.from(String(req.body.cval));
    cryptopro.HashDataAdd(hashsess, data);
    var hash = cryptopro.HashGetValue(hashsess, true);
    cryptopro.HashClose(hashsess);     
    console.log(hash);*/

    if (!config.enabledLoginManual) return res.status(400).json({message: 'Функция отключена'});
    
    if ((req.body.username == undefined) || (req.body.password == undefined) || (req.body.username == "") || (req.body.password == ""))
        return res.status(500).json({message: 'Не верные учетные данные', url: '/login'});
    
    db_users.findOne({ 'login' : req.body.username }, function(err, user)
    {
        if (err) throw(err);
        if (!user) return res.status(500).json({message: 'Пользователь не найден', url: '/login'});
        
        if (!isValidPassword(user, req.body.password))
            return res.status(500).json({message: 'Пользователь не найден', url: '/login'});
        
        req.login(user, function(err) 
        {
            if (err) throw(err); 
            return res.status(200).json({message: 'Пользователь найден', url: '/'}); 
        });
    });
});

function AcceptNewPassword(req, res)
{
    db_users.findOne({ login_upper : req.query.username.toUpperCase(), changecode: req.query.code }, function(err, user)
    {
        if (err) return done(err);
        if (!user) return res.status(500).json({message: 'Не действительный запрос'});
        var nowdate = new Date();
        if (user.passtime == undefined) user.passtime = new Date(0);
        var diffdate = nowdate.getTime() - user.passtime.getTime();        
        if (diffdate > config.pass_confirm_interval) 
            return res.status(500).json({message: 'Запрос уже просрочен, попробуйте создать новый'});        
        
        db_users.updateOne({ _id : user._id }, { $set: { password: user.newpass, changecode: "" }}, function(err, user)
        {
            if (err) throw(err);
                return res.redirect('/');
        });        
    });
}

app.get('/signupaccept', function (req, res)
{
    if (!config.enabledSignUpManual) return res.status(500).json({message: 'Функция отключена'});

    if (req.isAuthenticated()) return res.redirect('/');
    
    if ((req.query.username == undefined) || (req.query.code == undefined) || (req.query.username == "") || (req.query.code == ""))
        return res.status(500).json({message: 'Не верный запрос'});
    
    AcceptNewPassword(req, res, config.pass_signup_interval);    
});

app.get('/passrefresh', function (req, res)
{
    if (!config.enabledResetPassword) return res.status(500).json({message: 'Функция отключена'});

    if (req.isAuthenticated()) return res.redirect('/');
    
    if ((req.query.username == undefined) || (req.query.code == undefined) || (req.query.username == "") || (req.query.code == ""))
        return res.status(500).json({message: 'Не верный запрос'});
    
    AcceptNewPassword(req, res, config.pass_confirm_interval);
});
            

app.post('/loginreset', bodyParser.urlencoded({ extended: true }), function (req, res) 
{
    if (!config.enabledResetPassword) return res.status(500).json({message: 'Функция отключена'});
    
    db_users.findOne({ email : req.body.email }, function(err, user)
    {
        if (err) return done(err);
        if (!user) return res.status(500).json({message: 'Указанная почта не найдена'});
        var nowdate = new Date();
        if (user.passtime == undefined) user.passtime = new Date(0);
        var diffdate = nowdate.getTime() - user.passtime.getTime();
        nowdate.setTime(user.passtime.getTime() + config.pass_reset_interval);
        if (diffdate < config.pass_reset_interval) 
            return res.status(500).json({message: 'Запрос уже выполнялся, попробуйте позднее ('+ nowdate +')'});        
        
        var changecode = createHash(user.password.substring(0, 6) + nowdate.getTime());

        var codestr = "/passrefresh?username="+encodeURIComponent(user.login) + '&code=' +encodeURIComponent(changecode);
        var url = "http://" + config.ex_hostname + ":" + config.ex_port + codestr
        if (config.ex_port == "") url = "http://" + config.ex_hostname + codestr; 

        mailer.SendMail(req.body.email, req.body.email, 'Сброс пароля',  
                        '<p>Сброс пароля для логина:'+ user.login + '</p>'+
                        '<p>Для подтверждения смены пароля перейдите по ссылке:</p>' +
                        '<p><a href="'+url+'">Confirm</a></p>', function(ressend)
        {
            if (!ressend) 
            {
                return res.status(500).json({message: 'Не удалось отправить'});
            } 
            else 
            {
                db_users.updateOne({ email : req.body.email }, 
                                        { $set: { passtime: new Date(), 
                                                    newpass: createHash(req.body.pass), 
                                                    changecode: changecode }}, function(err, user)
                {
                    if (err) throw(err);
                    return res.status(200).json({message: 'Письмо отправлено', url: '/'});
                });                    
            }
        });        
    });
});

app.post('/loginsign', bodyParser.urlencoded({ extended: true }), function (req, res) 
{
    if (!config.enabledLoginCrypto) return res.status(400).json({message: 'Функция отключена'});
    
    if (!req.body.signature) return res.status(400).json({message: 'Отсутствует подпись'});
    cryptopro.VerifyAttachedSignAsync(1, req.body.signature, req.body.signature.length, function(vsign)
    {  
        if (vsign.status == 0) return res.status(400).json({message: 'Ошибочная подпись'});
        if (vsign.status < 0) return res.status(400).json({message: 'Неудалось проверить подпись: ' + vsign.message});
        if ((config.ogrn_control) && (vsign.subject.ogrn != config.cert_orgn))
            return res.status(400).json({message: 'Подпись чужого удостоверяющего центра'});
        var signtime = Number(vsign.decodeddocument);
        var currdate = new Date();
        var curr_ms = currdate.getTime();
        if (curr_ms > signtime) signtime = curr_ms - signtime; else signtime = signtime - curr_ms;
        if (signtime > 10000) return res.status(400).json({message: 'Ошибка времени подписи, проверьте системное время'});

        db_users.findOne({ certificate : vsign.serial }, function(err, user)
        {
            if (err) return done(err);
            if (user)
            {
                req.body.username = user.login;
                req.login(user, function(err) 
                {
                    if (err) throw(err); 
                    return res.status(200).json({message: '/'});
                });
            }
            else
            {
                if (!config.enabledSignUpCrypto)
                    return res.status(400).json({message: 'Пользователь с этой ЭП не зарегистрирован в системе', url: '/login'});

                db_users.findOne({ email : vsign.subject.email.toLowerCase() }, function(err, user)
                {
                    if (err) return done(err);
                    if (user)
                        return res.status(400).json({message: 'Адрес почты занят, если произошла смена ключа то обновите его в личном кабинете', url: ''});
                    
                    var date = new Date();
                    var newUser = {};
                    newUser.login = vsign.subject.email;
                    newUser.login_upper = vsign.subject.email.toUpperCase();                     
                    newUser.password = createHash(date.getTime);
                    newUser.password = createHash(newUser.password);
                    newUser.firstname = vsign.subject.firstname;
                    newUser.middlename = vsign.subject.secondname.substring(0, vsign.subject.secondname.search(' '));
                    newUser.lastname = vsign.subject.secondname.substring(vsign.subject.secondname.search(' ') + 1);
                    newUser.email = vsign.subject.email;
                    newUser.email_upper = vsign.subject.email.toUpperCase();                     
                    newUser.certificate = vsign.serial;
                    newUser.passtime = new Date();

                    db_users.insertMany([ newUser ], function(err, resusers)
                    {
                        if (err) return done(err);
                        if (resusers.insertedCount != 1) return res.status(500).json({message: 'Ошибка регистрации, обратитесь к администратору системы', url: '' });
                        db_groups.updateOne({_id : ObjectId(config.all_group)}, { $addToSet: { users : resusers.ops[0]._id } }, function(err)
                        {
                            if (err) throw err;   
                            req.login(resusers.ops[0], function(err) 
                            {
                                if (err) throw(err); 
                                return res.status(200).json({message: 'Регистрация прошла успешно', url: '/'});
                            });
                        });                        
                    });
                });
            }
        });

        //return res.status(200).json({message: 'Ok'});
    });
});

app.post('/', function (req, res)
{
  console.log('app.post');
  console.log(req);
});

app.get('/', function (req, res)
    {
        //console.log('GET "/"');
        if (req.isAuthenticated())
        {
            //console.log(req.user.login);
            socket.get_workplaces(req.user._id, function(workplaces)
            {
                res.render("main", {user : req.user, workplaces : workplaces});
            });
        }
        else res.redirect('/login');
    });
 
app.get('/chats', function (req, res)
    {
        //console.log('GET "/chats"');
        if (req.isAuthenticated())
        {
            //console.log(JSON.stringify(req.user));
            db_workplaces.find({attachedusers : ObjectId(req.user._id)}).sort({name : 1}).toArray(function(err, workplaces)
              { 
                  if (err) throw err;
                  res.render("chat", {user : req.user,
                                          workplaces : workplaces});
              });
        }
        else res.redirect('/login');
    }); 

/*app.get('/main', function (req, res)
              {
                //console.log('GET "/main"');
                res.sendFile(__dirname + "/public/main.html");
              });*/

  
app.get('/manuals', function (req, res)
    {
        if (req.isAuthenticated())
        {
            if ((!req.query.id) || (req.query.id.length != 24)) return res.sendStatus(404);

            db_manualdetails.findOne({_id : ObjectId(req.query.id)}, function(err, file)
            { 
                if (err) throw err;
                if (!file) return res.sendStatus(404);
                
                socket.get_groups_from_user(req.user._id, function(mygroups)
                {
                      if (mygroups.length)
                      {
                          db_manuals.findOne({ _id: file.parent, groups: {  $in : mygroups }}, function(err, manuallist)
                          {
                              if (err) throw err;
                              if (manuallist) res.sendFile(file.path + '\\' + file.file, { root: config.manualpath });
                              else res.sendStatus(403);
                          });
                      }
                });
            });
        }
        else res.redirect('/login');
    });

function LoadFilePipe(req, res)
{
  var type = req.body.type;
  // Covert buffer to Readable Stream
  const readableTrackStream = new Readable();
  readableTrackStream.push(req.file.buffer);
  readableTrackStream.push(null);

  let bucket = new MongoDB.GridFSBucket(db, {bucketName: type });

  let uploadStream = bucket.openUploadStream(req.file.originalname, {contentType: req.file.mimetype});
  let id = uploadStream.id;
  readableTrackStream.pipe(uploadStream);
 
  uploadStream.on('error', function() { return res.status(500).json({ message: "Error uploading file" }); });
  uploadStream.on('finish', function() 
  { 
      if (req.body.type == 'users')
      {      
        db_users.updateMany({_id: ObjectId(req.body.docid)}, { $set: {avatar: count }}, function(err, ret)
        {
            if (err) 
            {
              ret.status(500).json({message: err});     
              return err;
            }
            if (ret.result.n == 1)
              res.status(200).json({message: 'OK'});
              else res.status(500).json({message: 'Error update user'});
        });                           
      }
      if (req.body.type == 'forms')
      {
        var nd = new Date();
        //var hash = '92CD0CB36B10BFB88DEF198F80B7D2E667DBDA064D346405C25EEF77FFE375D7';
        var hash = '7adddbddbb7cb0177a7f31135402ec7fc7e9250957bea23583c1bac0150629f5';
        db_formcaptions.findOne({ _id: ObjectId(req.body.docid) }, function(err, caption)
        {    
            if (err) throw err;
            if (!caption) return;
            db_links.insertMany([{ parent: caption._id, child: id, state: caption.state, type: 0, laststate: false, creator: ObjectId(req.user._id), datetime: nd, note: '', cryptohash: hash }], function(err, ret)
            {
                if (err) 
                {
                    res.status(500).json({message: 'Ну удалось привязать файл'});     
                    throw err;
                }
                if (ret.insertedCount == 1)
                {
                    db_states.findOne({ _id: caption.state }, function(err, state)
                    { 
                        if (err) throw err;
                        if (!state) return res.status(500).json({message: 'Не удалось определить состояние файла'});
                        var sd = {};
                        sd.link = ret.ops[0];
                        sd.grid = {};
                        sd.grid.recid = id;
                        sd.grid.statename = state.name;
                        sd.grid.filename = req.file.originalname;
                        sd.grid.mimetype = req.file.mimetype;
                        sd.grid.filesize = req.file.size;
                        sd.grid.filedate = ret.ops[0].datetime;
                        sd.grid.filenote = ret.ops[0].note;
                        sd.grid.state = state;
                        res.status(200).json(sd);
                    });
                } else res.status(500).json({message: 'Error insert link'});            
            });
        });
      }
  });
}

function LoadFile(req, res)
{
  var type = req.body.type;

  var hashsess = cryptopro.HashCreate();
  //console.log('HashCreate');

  // Covert buffer to Readable Stream
  const readableTrackStream = new Readable();
  var data;
  readableTrackStream.push(req.file.buffer);
  readableTrackStream.push(null);
  
  let bucket = new MongoDB.GridFSBucket(db, {bucketName: type });
  
  let uploadStream = bucket.openUploadStream(req.file.originalname, {contentType: req.file.mimetype});
  let id = uploadStream.id;
  readableTrackStream.pipe(uploadStream);
  readableTrackStream.on('data', function(data) 
  { 
      //console.log('HashBuffAdd ' + data.length);
      cryptopro.HashDataAdd(hashsess, data);
  });
  
 /* var sess = cryptopro.HashCreate();
var res = cryptopro.HashDataAdd(sess, 'abracadabra\0', 120);
var res = cryptopro.HashDataAdd(sess, 'abracadabra\0', 120);
var HashValue = cryptopro.HashGetValue(sess, true);
var res = cryptopro.HashClose(sess);
  console.log('HashClose result ' + res);*/

 
  uploadStream.on('error', function() { return res.status(500).json({ message: "Error uploading file" }); });
  uploadStream.on('finish', function() 
  { 
    //console.log('finish');
      if (req.body.type == 'users')
      {      
        db_users.updateMany({_id: ObjectId(req.body.docid)}, { $set: {avatar: count }}, function(err, ret)
        {
            if (err) 
            {
              ret.status(500).json({message: err});     
              return err;
            }
            if (ret.result.n == 1)
              res.status(200).json({message: 'OK'});
              else res.status(500).json({message: 'Error update user'});
        });                           
      }
      if (req.body.type == 'forms')
      {
        var nd = new Date();
        //var hash = '92CD0CB36B10BFB88DEF198F80B7D2E667DBDA064D346405C25EEF77FFE375D7';
        
        var hash = cryptopro.HashGetValue(hashsess, true);
        cryptopro.HashClose(hashsess);
        //console.log(hash);
        //var hash = '7adddbddbb7cb0177a7f31135402ec7fc7e9250957bea23583c1bac0150629f5';
        db_formcaptions.findOne({ _id: ObjectId(req.body.docid) }, function(err, caption)
        {    
            if (err) throw err;
            if (!caption) return;
            db_links.insertMany([{ parent: caption._id, child: id, state: caption.state, type: 0, laststate: false, creator: ObjectId(req.user._id), datetime: nd, note: '', cryptohash: hash }], function(err, ret)
            {
                if (err) 
                {
                    res.status(500).json({message: 'Ну удалось привязать файл'});     
                    throw err;
                }
                if (ret.insertedCount == 1)
                {
                    db_states.findOne({ _id: caption.state }, function(err, state)
                    { 
                        if (err) throw err;
                        if (!state)
                        {
                            res.status(500).json({message: 'Не удалось определить состояние файла'});     
                            return;
                        }
                        var sd = {};
                        sd.link = ret.ops[0];
                        sd.grid = {};
                        sd.grid.recid = id;
                        sd.grid.statename = state.name;
                        sd.grid.filename = req.file.originalname;
                        sd.grid.mimetype = req.file.mimetype;
                        sd.grid.filesize = req.file.size;
                        sd.grid.filedate = ret.ops[0].datetime;
                        sd.grid.filenote = ret.ops[0].note;
                        sd.grid.state = state;
                        res.status(200).json(sd);
                    });
                } else res.status(500).json({message: 'Error insert link'});            
            });
        });
      }
  });
}

app.post('/file', function (req, res)
{
    const storage = multer.memoryStorage();
      const upload = multer({ storage: storage, limits: {fields: 10, fileSize: 6000000, files: 2, parts: 20 }});
      upload.single('file')(req, res, function(err) 
      {
        if (err) return res.status(400).json({ message: "Upload Request Validation Failed" });
        
        if(!req.body) return res.status(400).json({ message: "No body" });
        if(!req.body.type) return res.status(400).json({ message: "No type in request body" });
        if (!req.body.docid) return res.status(400).json({ message: "No docid in request body" });
        if (req.body.docid.length != 24) return res.status(400).json({ message: "Wrong docid in request body" });
        
        var table = req.body.type;
        if ((table != "users") && (table != "forms")) return res.status(400).json({ message: "Unknown type file"});
        
        if (req.file)
        {
          socket.test_rigth_upload_file(table, ObjectId(req.body.docid), req.user, function(result)
          {
              if (result) LoadFile(req, res);
              else return res.status(415).json({ message: "Error uploading, no access" });
          });
            
        } else return res.status(500).json({ message: "Error uploading, empty file" });
      });
});

app.get('/file', function (req, res) 
{
      if (req.isAuthenticated())
      {        
          if (!req.query.type) return res.status(404).json({ message: "Need param type file"});
          if ((req.query.type != "users") && (req.query.type != "forms")) return res.status(404).json({ message: "Wrong param type file"});
          if (!req.query.id) return res.status(404).json({ message: "Need param id file"});
          if (req.query.id.length != 24) return res.status(404).json({ message: "Wrong param id file"});
          
          socket.test_rigth_download_file(req.query.type, ObjectId(req.query.id), req.user, function(result)
          {
              if (result)
              {
                var bucket = new MongoDB.GridFSBucket(db, {bucketName: req.query.type });
                bucket.openDownloadStream(ObjectId(req.query.id)).pipe(res); 
              }
              else return res.status(415).json({ message: "Error downloading, no access" });
          });
      }
});
 
MongoClient.connect(config.mongodb.url, { useNewUrlParser: true }, function(err, client)
{
  if (err) throw err;
  db = client.db(config.mongodb.database);
  db_users = db.collection('users');
  db_groups = db.collection('groups');
  db_workplaces = db.collection('workplaces');
  db_chats = db.collection('chatcaptions');
  db_chatdetails = db.collection('chatdetails');
  db_chatsessions = db.collection('chatsessions');  
  db_manuals = db.collection('manualcaptions');
  db_manualdetails = db.collection('manualdetails');
  db_formtemplates = db.collection('formtemplates');
  db_formcaptions = db.collection('formcaptions');
  db_formdetails = db.collection('formdetails');
  db_links = db.collection('links');
  db_states = db.collection('states');
  db_captchas = db.collection('captchas');
  db_Bucket = new MongoDB.GridFSBucket(db);

  db_chatsessions.deleteMany({}, function(err) {if (err) throw err;});

  var nowdate = new Date();
  nowdate = Date(nowdate.getTime() - config.pass_signup_interval);    
  db_users.deleteMany({ passtime: { $lte: nowdate } } , function(err) {if (err) throw err;});
  

  //db_files = db.collection('filestorage');
  //gridFiles = gridFS(db, MongoClient); 
  //gridFiles.mongo = MongoDB;
  //gridST = GridStore(db, 'files', 'w');
  //gridFiles = new GridFS(db);
  
  //var server = http.createServer(app);
  //server.listen(config.port);

  var http_serv = http.createServer(app).listen(config.port);
  //var https_serv = https.createServer(sslOptions, app).listen(8443)
  
  
  socket.init(config, http_serv, sessionStore, MongoDB, db);
   
});

console.log("Server started: " + config.port);
