var cookieParser = require('cookie-parser');
var ObjectId = require('mongodb').ObjectID;
var Long = require('mongodb').Long;
var cookie = require('cookie');
var cryptopro = require('../cryptopro');

var db_users,db_workplaces, db_chats,db_chatdetails, db_chatsessions,db_manuals, db_manualdetails;
var db_formtemplates,db_formcaptions,db_formdetails, db_links, db_groups, db_jumps, db_states;
var db_docstatehistory, db_signs, db_filestatehistory;

function merge_arrays_unique(arr1, arr2)
{
    var keystore = {}; // объект для коллекции
    var arr3 = [];
    for (var i = 0; i < arr1.length; i++) 
        if (!keystore[arr1[i]]) 
        {
            arr3.push(arr1[i]); 
            keystore[arr1[i]] = true;                
        }
    for (var i = 0; i < arr2.length; i++) 
        if (!keystore[arr2[i]]) 
        {
            arr3.push(arr2[i]); 
            keystore[arr2[i]] = true;                
        }
    return arr3;
}

function merge_arrays_common(arr1, arr2)
{
    var keystore = {}; // объект для коллекции
    var arr3 = [];
    for (var i = 0; i < arr1.length; i++) 
        if (!keystore[arr1[i]]) keystore[arr1[i]] = true;
    for (var i = 0; i < arr2.length; i++) 
        if (keystore[arr2[i]]) arr3.push(arr2[i]);
    return arr3;
}

function get_groups_from_user(user_id, next)
{
    db_users.aggregate([
                    { $match: { _id : user_id }},
                    { $lookup:
                        {
                            from: 'groups',
                            localField: '_id',
                            foreignField: 'users',
                            as: 'groups'
                        }
                    },                    
                    {$addFields: { groupids : "$groups._id"}}
                    ]).toArray(function(err, mygroups) 
        {
            if (err) throw err;
            if ((mygroups.length) && (mygroups[0].groupids.length))
            {
                next(mygroups[0].groupids);
            }
            else next([]);
        });
}

function get_users_from_groups(groups, next)
{ 
    db_groups.aggregate([
            { $match: {_id: {  $in : groups }}},
            { $lookup:
                {
                    from: 'users',
                    localField: 'users',
                    foreignField: '_id',
                    as: 'users'
                } 
            },
            { $unwind: '$users'},
            { $project : { 
                _id: 0,                        
                userids : "$users._id" }}  
            ]).toArray(function(err, users) 
        {
            if (err) throw err;
            
            var keystorage = {};
            var arr = [];
            for (var i = 0; i < users.length; i++)
            {
                if (!keystorage[users[i].userids])
                {
                    arr.push(users[i].userids);
                    keystorage[users[i].userids] = true;
                }
            }
            next(arr);
        });
}

function get_jumps_from_groups(scheme_id, groups, next)
{
    db_jumps.find({parent: scheme_id, rights: { $in : groups } }).toArray(function(err, jumps)
    {
        if (err) throw err;
            
        var keystorage = {};
        var arr = [];
        for (var i = 0; i < jumps.length; i++)
        {
            if (!keystorage[jumps[i]._id])
            {
                arr.push(jumps[i]._id);
                keystorage[jumps[i]._id] = true;
            }
        }            
        next(arr);
    });
}

function get_template(id, mygroups, next)
{
    db_formtemplates.findOne({_id : id , rightgroups: {  $in : mygroups } },  function(err, template)
    {
        if (err) throw err;
        next(template);
    });
}

function get_workplaces(user_id, next)
{
    get_groups_from_user(user_id, function(mygroups)
    {
        if (!mygroups.length) return next([]);
        db_workplaces.find({groups: {  $in : mygroups } }).sort({name : 1}).toArray(function(err, workplaces)
        {
            if (err) throw err;
            next(workplaces);
        });
    });
}

function get_templates(mygroups, next)
{
    db_formtemplates.find({rightgroups: {  $in : mygroups } }).toArray(function(err, templates)
    {
        if (err) throw err;
        next(templates);
    });
}

function get_forms(template_id, user_id, mygroups, form_id, load_details, next)
{
    var form_filter = {};
    if (form_id) form_filter = { _id : form_id };
    get_template(template_id, mygroups, function(template)
    {
        if (!template) return;
        get_jumps_from_groups(template.scheme, mygroups, function(myjumps)
        {
            var friendgroups = merge_arrays_common(mygroups, template.friendgroups);                
            get_users_from_groups(friendgroups, function(friends)
            {
                db_formcaptions.aggregate([
                                { $match: 
                                    { $and: [
                                                form_filter, 
                                                { parent : template_id }, 
                                                { $or: [
                                                        {creator: user_id},
                                                        {creator: {  $in : friends }}                                        
                                                        ]
                                                }
                                            ]
                                    }
                                },
                                { $lookup:
                                    {
                                        from: 'states',
                                        localField: 'state',
                                        foreignField: '_id',
                                        as: 'states'
                                    }
                                },                        
                                { $addFields: { statename : "$states.name"}},
                                { $unwind: "$statename"},
                                { $lookup:
                                    {
                                        from: 'users',
                                        localField: 'creator',
                                        foreignField: '_id',
                                        as: 'creatoruser'
                                    }
                                },                        
                                { $addFields: { creatorname : "$creatoruser.login"}},                                
                                { $unwind: "$creatorname"},
                                { $lookup:
                                    {
                                        from: 'jumps',
                                        localField: 'state',
                                        foreignField: 'from',
                                        as: 'jumps'
                                    }
                                },
                                { $unwind : "$statename" }, 
                                { $lookup:
                                    {
                                        from: 'links',
                                        localField: '_id',
                                        foreignField: 'parent',
                                        as: 'links'
                                    }
                                },                               
                                {$addFields: {
                                                jumpsright: 
                                                {                                                        
                                                    "$filter": {
                                                                    "input": "$jumps",
                                                                    "as": "comp",
                                                                    "cond":  { $setIsSubset: [['$$comp._id'], myjumps] }                                                                  }
                                                                }
                                                }                                                    
                                            }                                            
                                ]).toArray(function(err, captions) 
                    {
                        if (err) throw err;
                        for (var i = 0; i < captions.length; i++) captions[i].creatoruser = false;
                        if (load_details && form_id)
                        {
                            db_formdetails.find({parent: form_id}).sort({_id : 1}).toArray(function(err, details)
                            {
                                if (err) throw err;
                                next(template, captions, details);
                            });
                        } else next(template, captions, null);
                    }); 
            });
        });
    });            
}

function get_files(form_id, next)
{
    db_links.aggregate([
            { $match: { parent : form_id }},
            { $lookup:
                {
                    from: 'forms.files',
                    localField: 'child',
                    foreignField: '_id',
                    as: 'file'
                }
            },
            { $unwind : "$file" },
            { $lookup:
                {
                    from: 'filestatehistory',
                    localField: 'state',
                    foreignField: 'parent',
                    as: 'history'
                }
            },
            { $lookup:
                {
                    from: 'states',
                    localField: 'state',
                    foreignField: '_id',
                    as: 'state'
                }
            },                                                
            { $unwind : "$state" },
            { $project : { 
                _id: 0,
                note: 1,
                state: 1,
                statename: "$state.name", 
                recid : "$file._id", 
                filename : "$file.filename", 
                filesize : "$file.length", 
                filedate : "$file.uploadDate",
                mimetype : "$file.contentType" }}
            ]).sort({uploadDate : 1}).toArray(function(err, files) 
            {
                if (err) throw err;
                next(files);                
            });
}

function get_form_states(template_id, next)
{
    db_formtemplates.findOne({ _id: template_id }, function(err, template)
    {
        if (err) throw err;
        if (!template) return next([]);
        db_jumps.aggregate([
            { $match: {parent: template.scheme}},
            { $lookup:
                {
                    from: 'states',
                    localField: 'from',
                    foreignField: '_id',
                    as: 'states_from'
                }
            },                        
            { $addFields: { state_from_id : "$states_from._id", state_from_name : "$states_from.name"}},
            { $unwind: "$state_from_id"}, { $unwind: "$state_from_name"},            
            { $lookup:
                {
                    from: 'states',
                    localField: 'to',
                    foreignField: '_id',
                    as: 'states_to'
                }
            },                    
            { $addFields: { state_to_id : "$states_to._id", state_to_name : "$states_to.name"}},
            { $unwind: "$state_to_id"}, { $unwind: "$state_to_name"}
            ]).toArray(function(err, state_jumps) 
        {
            if (err) throw err;
            if (!state_jumps) next([]);
            var states_arr = [];
            for (var i = 0; i < state_jumps.length; i++)
            {
                states_arr.push(state_jumps[i].state_from_id);
                states_arr.push(state_jumps[i].state_to_id);
            }
            db_states.find({ _id : { $in : states_arr}}).sort({ name : 1}).toArray(function(err, states)
            {
                if (err) throw err;
                next(states);
            });            
        });
    });    
}

function test_rigth_upload_file(doc_type, doc_id, user, next)
{
    var work = false;                                       
    
    if ((doc_type == "users") && (user.rights.admin))
    {
        work++;
        db_users.findOne({ _id: doc_id }, function(err, users)
        {
            if (err) throw err;
            if (users) return next(true); 
            return next(false);
        });
    }
    
    if (doc_type == "forms")
    {
        work++;
        db_formcaptions.findOne({_id: doc_id}, function(err, formcaption)
        {
            if (err) throw err;    
            if (!formcaption) return next(false);
            get_groups_from_user(user._id, function(mygroups)
            {
                if (!mygroups.length) return next(false);
                get_template(formcaption.parent, mygroups, function(template)
                {
                    if (!template) return next(false); 
                    get_forms(template._id, user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                    {
                        if (!caption.length) return next(false);
                        for (var i = 0; i < caption[0].jumpsright.length; i++)
                        {
                            if (caption[0].jumpsright[i].settings.attach_file)
                            {
                                return next(true);
                            }
                        }
                    });
                });
            });   
        });
    }
    if (!work) return next(false);
}

function test_rigth_download_file(doc_type, file_id, user, next)
{
    var work = false;                                       
    
    if (doc_type == "users")
    {
        work++;
        db_users.findOne({ avatar: file_id }, function(err, users)
        {
            if (err) throw err;
            if (users) return next(true); 
            return next(false);
        });
    }
    
    if (doc_type == "forms")
    {
        work++;
        db_links.findOne({child: file_id}, function(err, link)
        {
            if (err) throw err;    
            if (!link) return next(false);
            db_formcaptions.findOne({_id: link.parent}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return next(false);
                get_groups_from_user(user._id, function(mygroups)
                {
                    if (!mygroups.length) return next(false);
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return next(false);
                        get_forms(template._id, user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return next(false);
                            for (var i = 0; i < caption[0].jumpsright.length; i++)
                            {
                                if (caption[0].jumpsright[i].settings.download_file)
                                {
                                    return next(true);
                                }
                            }
                            return next(false);
                        });
                    });
                });   
            });
        });
    }
    if (!work) return next(false);
}

function get_form_history(form_id, next)
{
    db_docstatehistory.aggregate([
                { $match: {parent: form_id}},
                { $lookup:
                    {
                        from: 'signatures',
                        localField: 'sign',
                        foreignField: '_id',
                        as: 'signature'
                    }
                },
                { $lookup:
                    {
                        from: 'states',
                        localField: 'from',
                        foreignField: '_id',
                        as: 'statefrom'
                    }
                },
                { $lookup:
                    {
                        from: 'states',
                        localField: 'to',
                        foreignField: '_id',
                        as: 'stateto'
                    }
                },
                { $lookup:
                    {
                        from: 'users',
                        localField: 'creator',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: "$statefrom"}, { $unwind: "$stateto"}, { $unwind: "$user"}
            ]).sort({ datetime : 1}).toArray(function(err, jumps)
    {
        for (var i = 0; i < jumps.length; i++)
        {
            jumps[i].user.login = null;
            jumps[i].user.login_upper = null;
            jumps[i].user.password = null;
            jumps[i].user.email = null;
            jumps[i].user.email_upper = null;
        }
        next(jumps);
    });
}

function get_file_history(file_id, next)
{
    db_filestatehistory.aggregate([
                { $match: {parent: file_id}},
                { $lookup:
                    {
                        from: 'signatures',
                        localField: 'sign',
                        foreignField: '_id',
                        as: 'signature'
                    }
                },
                { $lookup:
                    {
                        from: 'states',
                        localField: 'from',
                        foreignField: '_id',
                        as: 'statefrom'
                    }
                },
                { $lookup:
                    {
                        from: 'states',
                        localField: 'to',
                        foreignField: '_id',
                        as: 'stateto'
                    }
                },
                { $lookup:
                    {
                        from: 'users',
                        localField: 'creator',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: "$statefrom"}, { $unwind: "$stateto"}, { $unwind: "$user"}
            ]).sort({ datetime : 1}).toArray(function(err, jumps)
    {
        for (var i = 0; i < jumps.length; i++)
        {
            jumps[i].user.login = null;
            jumps[i].user.login_upper = null;
            jumps[i].user.password = null;
            jumps[i].user.email = null;
            jumps[i].user.email_upper = null;
        }
        next(jumps);
    });
}

function socket_init(config, server, sessionStore, MongoDB, db)
{
    db_users = db.collection('users');
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
    db_groups = db.collection('groups');
    db_jumps = db.collection('jumps');
    db_states = db.collection('states');
    db_docstatehistory = db.collection('docstatehistory');
    db_signs = db.collection('signatures');
    db_filestatehistory = db.collection('filestatehistory');

    var io = require('socket.io').listen(server);
    //io.set('origins', 'localhost:*');
    io.use(function (socket, callback)
    {
        var handshake = socket.request;
        handshake.cookies = cookie.parse(handshake.headers.cookie || '');
        var sidCookie = handshake.cookies[config.session.key];
        var sid = cookieParser.signedCookie(sidCookie, config.session.secret);
        socket.request.sid = sid;

        sessionStore.load(sid, function(err, session)
        {
            if (err) return callback(Error('sessionStore error'));
            if (arguments.length < 2)
            {
                // no session
                //console.log('no session');
                return callback(Error('no session'));
            }
            else
            {
                //console.log('exist session '+ arguments.length +'  '+ session.passport.user);
                db_users.findOne({'_id' : ObjectId(session.passport.user)}, function(err, user)
                {
                    if (err) return callback(err);

                    if (!user) {return callback(Error('no user'));}
                    socket.request.user = user;
                    callback();
                });
            }
        });
    });

    io.on('connection', function(socket)
    {
        if (!socket.request.user) {console.log('no user'); return;}
        var userid = socket.request.user._id;
        socket.request.user.chatid = null;
        //console.log(JSON.stringify(socket.request.user));
        //console.log('connected ' + userid);

        //socket.broadcast.emit('join', login);
        
        socket.on('forms_get_list', function()
        {
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                get_templates(mygroups, function(templates)
                {
                    if (!templates.length) return;
                    
                    socket.emit('form_list', templates);
                });
            });
        });
        socket.on('forms_get_template', function(template_id)
        {
            if ((!template_id) || (template_id.length != 24)) return;
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                get_template(ObjectId(template_id), mygroups, function(template)
                {
                    if (!template) return;
                    
                    socket.emit('form_template', template);
                });   
            });
        });
        socket.on('forms_get_captions', function(template_id)
        {
            if ((!template_id) || (template_id.length != 24)) return;
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                get_forms(ObjectId(template_id), socket.request.user._id, mygroups, null, false, function(formtemlate, formcaptions)
                {
                    //if (!formcaptions.length) return;
                    get_form_states(formtemlate._id, function(states)
                    {  
                        db_jumps.find({ parent : formtemlate.scheme,  rights : { $in : mygroups }}).toArray(function(err, jumps)
                        {                      
                            var data = {};
                            data.fields = formtemlate.fieldscaption;
                            data.captions = formcaptions;
                            data.states = states;
                            data.jumps = jumps;
                            socket.emit('form_captions', data);
                        });
                    });                    
                });
            });
        });

        socket.on('forms_get_details', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template)  return;
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, true, function(formtemlate, caption, details)
                        {
                            if (!caption.length || (!details)) return;
                            
                            var data = {};
                            data.fields = formtemlate.fieldsdetail;
                            data.details = details;
                            socket.emit('form_details', data);
                        });
                    });
                });   
            });      
        });

        socket.on('forms_forward_caption', function(form_id, newstate_id, docsign, files)
        {
            if ((!form_id) || (form_id.length != 24) || (!newstate_id) || (newstate_id.length != 24) || (!files) || (!Array.isArray(files))) return;
            db_states.findOne({_id: ObjectId(newstate_id)}, function(err, newstate)
            {
                if (err) throw err; 
                if (!newstate) return;
                db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
                {
                    if (err) throw err;    
                    if (!formcaption) return;
                    get_groups_from_user(socket.request.user._id, function(mygroups)
                    {
                        if (!mygroups.length) return;
                        get_template(formcaption.parent, mygroups, function(template)
                        {
                            if (!template) return;
                            get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, true, function(formtemlate, caption, details)
                            {
                                if (!caption.length) return; 
                                
                                var next_jumpsright = null;
                                for (var i = 0; i < caption[0].jumpsright.length; i++)
                                    if ((String(caption[0].jumpsright[i].to) == String(newstate._id)) && (caption[0].jumpsright[i].settings.back == false))
                                    {
                                        next_jumpsright = caption[0].jumpsright[i];
                                        break;
                                    }                              
                                if (!next_jumpsright) return socket.emit('popup_message', 'Нет прав на переход');
                                
                                var cnt = 0;
                                for (var i = 0; i < caption[0].links.length; i++) if (!caption[0].links[i].laststate) cnt++;
                                
                                if (files.length != cnt) return socket.emit('popup_message', 'Расхождение в количестве прикрепленных документов: ' + caption[0]._id + ', пропущен в обработке');
                                
                                var arr = [];
                                for (var i = 0; i < caption[0].links.length; i++) 
                                    arr[caption[0].links[i].child] = true;                                
                                for (var i = 0; i < files.length; i++)
                                    if (!arr[files[i]._id]) return socket.emit('popup_message', 'Прикрепленный документ изменился: ' + caption[0]._id + ', пропущен в обработке');
                                
                                if (next_jumpsright.settings.sign_file)
                                {
                                    for (var i = 0; i < files.length; i++)
                                    {
                                        if (!files[i].signature) 
                                            return socket.emit('popup_message', 'Прикрепленный документ не подписан:' + files[i]._id);
                                        var vsign = cryptopro.VerifyAttachedSign(1, docsign.signature, docsign.signature.length);
                                        //var vsign = cryptopro.SignHashVerify(files[i].body.document, files[i].body.document.length, files[i].signature, files[i].signature.length);
                                        //console.log('file '+vsign);
                                        if (vsign.status != 1) return socket.emit('popup_message', 'Прикрепленный документ имеет ошибочную подпись ' + files[i]._id + ' ' + vsign.message);
                                        if (vsign.serial != socket.request.user.certificate) 
                                            return socket.emit('popup_message', 'Прикрепленный документ имеет чужую подпись ' + files[i]._id);
                                        if ((config.ogrn_control) && (vsign.subject.ogrn != config.cert_orgn)) 
                                            return socket.emit('popup_message', 'Прикрепленный документ имеет подпись чужой организации ' + files[i]._id);
                                    }
                                }
                                
                                if (next_jumpsright.settings.sign_doc)
                                {
                                    if (!docsign.signature) return socket.emit('popup_message', 'Документ не подписан:' + caption[0]._id);
                                    //cryptopro.CadesCreateSign(docsign.body.document, docsign.body.document.length);
                                    //var vsign = cryptopro.CadesVerifySign(1, docsign.signature, docsign.signature.length);
                                    //console.log(vsign);
                                    var vsign = cryptopro.VerifyAttachedSign(1, docsign.signature, docsign.signature.length);
                                    //var vsign = cryptopro.VerifyDetachedSign(1, docsign.body.document, docsign.body.document.length, docsign.signature, docsign.signature.length);
                                    //console.log(vsign);                                    
                                    if (vsign.status == 0) return socket.emit('popup_message', 'Документ имеет ошибочную подпись ' + caption[0]._id + ' ' + vsign.message);
                                    if (vsign.status < 0) return socket.emit('popup_message', 'Неудалось проверить подпись ' + caption[0]._id + ' ' + vsign.message);
                                    if (vsign.serial != socket.request.user.certificate) 
                                        return socket.emit('popup_message', 'Документ имеет чужую подпись ' + caption[0]._id);
                                    if ((config.ogrn_control) && (vsign.subject.ogrn != config.cert_orgn)) 
                                        return socket.emit('popup_message', 'Документ имеет подпись чужой организации ' + caption[0]._id);
                                }  

                                next_jumpsright.file_next_states.push(newstate._id);
                                
                                var arr_files_to_work = [];
                                files_inx = [];
                                for (var i = 0; i < files.length; i++) files_inx[files[i]._id] = i;
                                
                                for (var i = 0; i < caption[0].links.length; i++) 
                                {
                                    var n = files_inx[caption[0].links[i].child];
                                    if ((String(caption[0].links[i].state) == String(caption[0].state)) && (!caption[0].links[i].laststate))
                                    {
                                        arr_files_to_work.push(files[n]);
                                        arr_files_to_work[arr_files_to_work.length - 1].link_id = caption[0].links[i]._id;
                                    }
                                }
                                
                                if ((next_jumpsright.controlscript) && (typeof next_jumpsright.controlscript == 'function'))
                                {
                                    var res = next_jumpsright.controlscript(formtemlate, caption, details);
                                    if (res && (res.resultcode == 0))
                                    {
                                        return socket.emit('popup_message', res.resultmessage);
                                    }
                                }
                                
                                if ((next_jumpsright.beforescript) && (typeof next_jumpsright.beforescript == 'function'))
                                {
                                    return next_jumpsright.beforescript(formtemlate, caption, details, finish_jump);
                                } else finish_jump(formtemlate, caption, details);

                                function finish_jump(formtemlate, caption, details)
                                {    
                                    function InsertLinkSigns(docs, next)
                                    {
                                        if (docs.cnt >= docs.arr.length) return next(docs);
                                        var document = docs.arr[docs.cnt];
                                        
                                        db_signs.insertMany([{document: document.body, signature : document.signature, creater: socket.request.user._id, datetime: new Date()}], function(err, res)
                                        {
                                            if (err) throw err;
                                            if (res.insertedCount != 1) return;
                                            db_filestatehistory.insertOne({ parent: ObjectId(document._id), 
                                                                            from: caption[0].state, 
                                                                            to: newstate._id, 
                                                                            back: false, 
                                                                            canceled: false,
                                                                            sign: res.ops[0]._id, 
                                                                            datetime: new Date(), 
                                                                            creator: socket.request.user._id},
                                                                            function(err)
                                            {
                                                if (err) throw err;                                                
                                                db_links.updateMany({_id: document.link_id}, { $set: { state: newstate._id }},  function(err, res)
                                                {
                                                    if (err) throw err;
                                                    if (res.result.n != 1) return;
                                                    
                                                    docs.cnt++;
                                                    if (docs.cnt < docs.arr.length) return InsertLinkSigns(docs, next);
                                                        else return next(docs);
                                                });
                                            });
                                        });
                                    }
                                    InsertLinkSigns({ cnt: 0, arr: arr_files_to_work }, function(result)
                                    {
                                        db_signs.insertMany([{document: docsign.body, signature : docsign.signature, creater: socket.request.user._id, datetime: new Date()}], function(err, res)
                                        {
                                            if (res.insertedCount != 1) return;
                                            db_docstatehistory.insertOne({ parent: caption[0]._id, 
                                                                                    from: caption[0].state, 
                                                                                    to: newstate._id, 
                                                                                    back: false, 
                                                                                    sign: res.ops[0]._id,
                                                                                    canceled: false, 
                                                                                    datetime: new Date(), 
                                                                                    creator: socket.request.user._id},
                                                                                    function(err)
                                            {
                                                if (err) throw err;
                                                db_formcaptions.updateOne({ _id: caption[0]._id}, 
                                                                                        { $set : { state: newstate._id}}, 
                                                    function(err)
                                                    {
                                                        if (err) throw err;                                                        
                                                        get_forms(formtemlate._id, socket.request.user._id, mygroups, caption[0]._id, true, function(formtemlate, newcaption, newdetails)
                                                        {
                                                            var clnt_capt = {};
                                                            clnt_capt.recid = newcaption[0]._id;
                                                            clnt_capt.statename = newstate.name;
                                                            socket.emit('forms_save_caption', clnt_capt, newcaption[0]);                                                            
                                                            
                                                            var data = {};
                                                            data.fields = formtemlate.fieldsdetail;
                                                            data.details = newdetails;
                                                            socket.emit('form_details', data);    
                                                            
                                                            get_files(newcaption[0]._id, function(files)
                                                            {
                                                                socket.emit('form_files', files);
                                                            });
                                                                        
                                                            if ((next_jumpsright.afterscript) && (typeof next_jumpsright.afterscript == 'function'))
                                                            {
                                                                next_jumpsright.afterscript(formtemlate, caption, details);
                                                            }
                                                        });
                                                    });
                                            });
                                        });
                                    });
                                }
                            });
                        });
                    }); 
                });
            });
        });
        socket.on('forms_forward_file', function(form_id, newstate_id, filesign)
        {
            if ((!form_id) || (form_id.length != 24) || (!newstate_id) || (newstate_id.length != 24) || (!filesign) || (typeof filesign != 'object')) return;
            db_states.findOne({_id: ObjectId(newstate_id)}, function(err, newstate)
            {
                if (err) throw err; 
                if (!newstate) return;
                db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
                {
                    if (err) throw err;    
                    if (!formcaption) return;
                    get_groups_from_user(socket.request.user._id, function(mygroups)
                    {
                        if (!mygroups.length) return;
                        get_template(formcaption.parent, mygroups, function(template)
                        {
                            if (!template) return;
                            get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, true, function(formtemlate, caption, details)
                            {
                                if (!caption.length) return; 
                                
                                var next_state = null;
                                var need_file_eds = false;

                                for (var n = 0; n < caption[0].jumpsright.length; n++)
                                    for (var i = 0; i < caption[0].jumpsright[n].file_next_states.length; i++)
                                        if (String(caption[0].jumpsright[n].file_next_states[i].state) == String(newstate_id)) 
                                        {
                                            need_file_eds = caption[0].jumpsright[n].file_next_states[i].sign_file;
                                            next_state = caption[0].jumpsright[n].file_next_states[i].state;
                                        }

                                if (!next_state) return socket.emit('popup_message', 'Нет прав на переход');
                                
                                if (caption[0].links.length == 0) return socket.emit('popup_message', 'Расхождение в количестве прикрепленных документов: ' + caption[0]._id + ', пропущен в обработке');
                                
                                var curr_link = null;
                                for (var i = 0; i < caption[0].links.length; i++) 
                                    if (caption[0].links[i].child == filesign._id)
                                        curr_link = caption[0].links[i];
                                
                                if (!curr_link) return socket.emit('popup_message', 'Прикрепленный документ изменился: ' + caption[0]._id + ', пропущен в обработке');
                                if (curr_link.laststate) return socket.emit('popup_message', 'Прикрепленный документ уже в конечном состоянии: ' + caption[0]._id);
                                
                                if (need_file_eds)
                                {
                                    if (!filesign.signature)
                                            return socket.emit('popup_message', 'Прикрепленный документ не подписан:' + files[i]._id);
                                    console.log(filesign.document);
                                    console.log(filesign.signature);
                                    var vsign = cryptopro.SignHashVerify(1, filesign.document, filesign.document.length, filesign.signature, filesign.signature.length);
                                    console.log(vsign);
                                }

                                function savesign(doc, next)
                                {
                                    db_signs.insertMany([{document: filesign.body, signature : filesign.signature, creater: socket.request.user._id, datetime: new Date()}], function(err, res)
                                    {
                                        if (err) throw err;
                                        if (res.insertedCount != 1) return;
                                        return next(doc, res.ops[0]._id);
                                    });
                                }
                                if (need_file_eds) savesign(filesign, finish_jump); else finish_jump(filesign, null);

                                function finish_jump(filesign, sign)
                                {
                                    db_filestatehistory.insertOne({ parent: ObjectId(filesign._id), 
                                                                            from: caption[0].state, 
                                                                            to: newstate._id, 
                                                                            back: false, 
                                                                            canceled: false,
                                                                            sign: sign, 
                                                                            datetime: new Date(), 
                                                                            creator: socket.request.user._id},
                                                                            function(err)
                                    {
                                        if (err) throw err;                                                
                                        db_links.updateMany({_id: curr_link._id}, { $set: { state: newstate._id, laststate : true }},  function(err, res)
                                        {
                                            if (err) throw err;
                                            if (res.result.n != 1) return;
                                            get_forms(template._id, socket.request.user._id, mygroups, caption[0]._id, false, function(formtemlate, newcaption, newdetails)
                                            {
                                                var clnt_capt = {};
                                                clnt_capt.recid = newcaption[0]._id;
                                                socket.emit('forms_save_caption', clnt_capt, newcaption[0]);          

                                                get_files(formcaption._id, function(files)
                                                {
                                                    socket.emit('form_files', files);
                                                });
                                            });
                                        });
                                    });
                                }
                            });
                        });
                    }); 
                });
            });
        });       

        socket.on('forms_backward_caption', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;
                if (!formcaption) return;  
                db_docstatehistory.find({ parent: formcaption._id, back: false, canceled : false}).sort({ datetime: -1 }).toArray(function (err, history)
                {
                    if (err) throw err; 
                    if (!history.length) return socket.emit('popup_message', 'Документ '+ formcaption._id + ', не изменен');
                    db_states.findOne({_id: history[0].from }, function(err, newstate)
                    {
                        if (err) throw err;   
                        if (!newstate) return socket.emit('popup_message', 'Документ '+ formcaption._id + ', ошибка истории'); 
                    
                        get_groups_from_user(socket.request.user._id, function(mygroups)
                        {
                            if (!mygroups.length) return;
                            get_template(formcaption.parent, mygroups, function(template)
                            {
                                if (!template) return;
                                get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, true, function(formtemlate, caption, details)
                                {
                                    if (!caption.length) return;
                                    var links = caption[0].links;
                                    var jumpright = null;
                                    for (var i = 0; i < caption[0].jumpsright.length; i++)
                                    {
                                        if ((String(caption[0].jumpsright[i].to) == String(newstate._id)) && (caption[0].jumpsright[i].settings.back == true))
                                        {
                                            jumpright = caption[0].jumpsright[i];
                                            break;
                                        }
                                    }
                                    if (!jumpright) return socket.emit('popup_message', 'Нет прав на переход');
                                    
                                    if ((jumpright.controlscript) && (typeof jumpright.controlscript == 'function'))
                                    {
                                        var res = jumpright.controlscript(formtemlate, caption, details);
                                        if (res && (res.resultcode == 0))
                                        {
                                            return socket.emit('popup_message', res.resultmessage);
                                        }
                                    }
                                    if ((jumpright.beforescript) && (typeof jumpright.beforescript == 'function'))
                                    {
                                        return jumpright.beforescript(formtemlate, caption, details, finish_jump);
                                    } else finish_jump(formtemlate, caption, details);

                                    function finish_jump(formtemlate, caption, details)
                                    {
                                        var arr_links = [];
                                        for (var i = 0; i < links.length; i++)
                                            if (String(caption[0].state) == String(links[i].state) && (!links[i].laststate))
                                                arr_links.push(links[i]);
                                        
                                        function UpdateLinks(docs, next)
                                        {
                                            if (docs.cnt >= docs.arr.length) return next(docs);
                                            var link = docs.arr[docs.cnt];
                                            
                                            db_filestatehistory.find({ parent: link.child, back: false, canceled : false}).sort({ datetime: -1 }).toArray(function (err, filehist)
                                            {
                                                if (err) throw err;  
                                                                                          
                                                if (!filehist.length) return;
                                                db_filestatehistory.updateMany( { _id : filehist[0]._id }, { $set : { canceled: true }}, function(err, res)
                                                {
                                                    if (err) throw err;
                                                    if (res.result.n != 1) return;                                                
                                                    db_filestatehistory.insertOne({ parent: link.child, 
                                                                                            from: caption[0].state, 
                                                                                            to: newstate._id, 
                                                                                            back: true, 
                                                                                            sign: null, 
                                                                                            canceled: false,
                                                                                            datetime: new Date(), 
                                                                                            creator: socket.request.user._id},
                                                                                            function(err)
                                                    {
                                                        if (err) throw err;                                                
                                                        db_links.updateMany({ _id: link._id }, { $set: { state: newstate._id }},  function(err, res)
                                                        {
                                                            if (err) throw err;
                                                            if (res.result.n != 1) return;
                                                            
                                                            docs.cnt++;
                                                            if (docs.cnt < docs.arr.length) return UpdateLinks(docs, next);
                                                                else return next(docs);
                                                        });
                                                    });
                                                });
                                            });
                                        }
                                        UpdateLinks({ cnt: 0, arr: arr_links }, function(result)
                                        {    
                                            db_docstatehistory.insertOne({ parent: caption[0]._id, 
                                                                                    from: caption[0].state, 
                                                                                    to: newstate._id, 
                                                                                    back: true, 
                                                                                    sign: null, 
                                                                                    canceled : false,
                                                                                    datetime: new Date(), 
                                                                                    creator: socket.request.user._id}, function(err)                                                
                                            {
                                                if (err) throw err;
                                                db_formcaptions.updateMany({ _id: caption[0]._id}, { $set : { state: newstate._id }}, function(err, res)                                                        
                                                {
                                                    if (err) throw err;
                                                    if (res.result.n != 1) return console.log('Error update db_formcaptions ' + caption[0]._id );
                                                    db_docstatehistory.updateMany({ _id: history[0]._id}, { $set : { canceled: true }}, function(err)  
                                                    {  
                                                        if (err) throw err;
                                                        if (res.result.n != 1) return console.log('Error update db_docstatehistory ' + history[0]._id );
                                                                
                                                        get_forms(formtemlate._id, socket.request.user._id, mygroups, caption[0]._id, true, function(formtemlate, newcaption, newdetails)
                                                        {
                                                            var clnt_capt = {};
                                                            clnt_capt.recid = newcaption[0]._id;
                                                            clnt_capt.statename = newstate.name;
                                                            socket.emit('forms_save_caption', clnt_capt, newcaption[0]);

                                                            var data = {};
                                                            data.fields = formtemlate.fieldsdetail;
                                                            data.details = newdetails;
                                                            socket.emit('form_details', data);

                                                            get_files(newcaption[0]._id, function(files)
                                                            {
                                                                socket.emit('form_files', files);
                                                            });

                                                            if ((jumpright.afterscript) && (typeof jumpright.afterscript == 'function'))
                                                            {
                                                                jumpright.afterscript(formtemlate, caption, details);
                                                            }
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    }
                                });
                            });
                        });
                    }); 
                });
            });
        });

        socket.on('forms_get_filehistory', function(form_id, file_id)
        {
            if ((!form_id) || (form_id.length != 24) || (!file_id) || (file_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return; 
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return; 
                            get_file_history(ObjectId(file_id), function(jumps)
                            {
                                socket.emit('forms_get_filehistory', form_id, jumps);
                            });
                        });
                    });
                });
            });
        });

        socket.on('forms_get_dochistory', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return; 
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return; 
                            get_form_history(caption[0]._id, function(jumps)
                            {
                                socket.emit('forms_get_dochistory', form_id, jumps);
                            });
                        });
                    });
                });
            });
        });
        
        socket.on('forms_get_files', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return;
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return;
                            get_files(formcaption._id, function(files)
                            {
                                if (!files) return;
                                socket.emit('form_files', files);
                            });
                        });
                    });
                });   
            });
        });
        socket.on('forms_delete_caption', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return; 
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return; 
                            for (var i = 0; i < caption[0].jumpsright.length; i++)
                            {
                                if (caption[0].jumpsright[i].settings.caption_delete)
                                {
                                    db_formdetails.deleteMany({ parent: formcaption._id }, function(err, res)
                                    {
                                        if (err) throw err;                                                        
                                        db_formcaptions.deleteMany({ _id: formcaption._id }, function(err, res)
                                        {
                                            if (err) throw err;
                                            if (res.result.n == 1)
                                                    socket.emit('forms_delete_caption', formcaption._id);
                                        });
                                    });
                                    break;
                                }
                            }
                        });
                    });
                });
            });
        });
        socket.on('forms_save_caption', function(form_data)
        {
            if ((!form_data) || (!form_data.recid) || (form_data.recid.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_data.recid)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return;
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return; 
                            if (caption[0].jumpsright.length) return;
                            
                            var fld_accessed = {};
                            var fld_return = {};
                            var fld_count = 0;
                            for (var i = 0; i < caption[0].jumpsright.length; i++)
                            {
                                var fields = caption[0].jumpsright[i].caption_edit_fields;
                                var fld_store = {};                                                        
                                for (var n = 0; n < fields.length; n++) fld_store[fields[n]] = true;
                                for (var key in form_data)
                                {
                                    if (fld_store[key]) 
                                    {
                                        fld_accessed[key] = form_data[key];
                                        fld_return[key] = form_data[key];
                                        fld_count++;
                                    }
                                }
                            }
                            for (var key in new_detail_data)
                            {
                                if (fld_return[key] == undefined) 
                                {
                                    if (formcaption[key])
                                        fld_return[key] = formcaption[key];
                                        else fld_return[key] = '';
                                }
                            }
                            fld_return.recid = formcaption._id;
                            if (fld_count)
                            {
                                db_formcaptions.updateMany({_id: formcaption._id}, { $set: fld_accessed },  function(err, res)
                                {
                                    if (err) throw err;
                                    if (res.result.n == 1)
                                        socket.emit('forms_save_caption', fld_return, null);
                                        else
                                        {
                                            formcaption.recid = formcaption._id;
                                            socket.emit('forms_save_caption', formcaption, null);
                                        }
                                });  
                            }
                            else socket.emit('forms_save_caption', fld_return, null);
                        });
                    });
                });   
            });              
        });
        socket.on('forms_insert_caption', function(template_id, state_id)
        {
            if ((!template_id) || (template_id.length != 24)) return;
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                get_template(ObjectId(template_id), mygroups, function(template)
                {
                    if (!template) return; 
                    db_jumps.find({parent: template.scheme, rights: { $in : mygroups } }).toArray(function(err, jumps)
                    {
                        if (err) throw err;
                        var state = null;
                        for (var i = 0; i < jumps.length; i++)
                        {
                            if ((jumps[i].settings.caption_insert) && (jumps[i].settings.back == false) && (String(jumps[i].from) == String(state_id)))
                            {
                                state = jumps[i].from;
                                break;
                            } 
                        }
                        if (state)
                        {
                            db_formcaptions.insertMany([{ parent: template._id, state: state, creator: socket.request.user._id, datetime: new Date() }],  function(err, res)
                            {
                                if (err) throw err;
                                if (res.insertedCount == 1)
                                {
                                    get_forms(template._id, socket.request.user._id, mygroups, res.ops[0]._id, false, function(formtemlate, caption)
                                    {
                                        if (!caption.length) return;
                                        socket.emit('forms_insert_caption', caption[0]);
                                    });
                                }
                            });     
                        } else socket.emit('popup_message', 'Нет прав');
                    });
                }); 
            });    
        });

        socket.on('forms_delete_detail', function(detail_id)
        {
            if ((!detail_id) || (detail_id.length != 24)) return;
            db_formdetails.findOne({_id: ObjectId(detail_id)}, function(err, formdetail)
            {
                if (err) throw err;
                if (!formdetail) return;
                db_formcaptions.findOne({_id: formdetail.parent}, function(err, formcaption)
                {
                    if (err) throw err;    
                    if (!formcaption) return;
                    get_groups_from_user(socket.request.user._id, function(mygroups)
                    {
                        if (!mygroups.length) return;
                        get_template(formcaption.parent, mygroups, function(template)
                        {
                            if (!template) return; 
                            get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                            {
                                if (!caption.length) return;
                                for (var i = 0; i < caption[0].jumpsright.length; i++)
                                {
                                    if (caption[0].jumpsright[i].settings.detail_delete)
                                    {
                                        db_formdetails.deleteMany({ _id: formdetail._id }, function(err, res)
                                        {
                                            if (err) throw err;                                                        
                                            if (res.result.n == 1)
                                                socket.emit('forms_delete_detail', formdetail._id);
                                        });
                                        break;
                                    }
                                }
                            });
                        });
                    });   
                });
            });                 
        });
        socket.on('forms_save_detail', function(new_detail_data)
        {
            if ((!new_detail_data) || (!new_detail_data.recid) || (new_detail_data.recid.length != 24)) return;
            db_formdetails.findOne({_id: ObjectId(new_detail_data.recid)}, function(err, formdetail)
            {
                if (err) throw err;
                if (!formdetail) return;
                db_formcaptions.findOne({_id: formdetail.parent}, function(err, formcaption)
                {
                    if (err) throw err;    
                    if (!formcaption) return;
                    get_groups_from_user(socket.request.user._id, function(mygroups)
                    {
                        if (!mygroups.length) return;
                        get_template(formcaption.parent, mygroups, function(template)
                        {
                            if (!template) return;
                            get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                            {
                                if (!caption.length) return; 
                                if (!caption[0].jumpsright.length) return;
                                
                                var fld_accessed = {};
                                var fld_return = {};
                                var fld_count = 0;
                                for (var i = 0; i < caption[0].jumpsright.length; i++)
                                {
                                    var fields = caption[0].jumpsright[i].detail_edit_fields;
                                    var fld_store = {};                                                        
                                    for (var n = 0; n < fields.length; n++) fld_store[fields[n]] = true;
                                    for (var key in new_detail_data)
                                    {
                                        if (fld_store[key]) 
                                        {
                                            fld_accessed[key] = new_detail_data[key];
                                            fld_return[key] = new_detail_data[key];
                                            fld_count++;
                                        }
                                    }
                                }                                                            
                                for (var key in new_detail_data)
                                {
                                    if (fld_return[key] == undefined) 
                                    {
                                        if (formdetail[key])
                                            fld_return[key] = formdetail[key];
                                            else fld_return[key] = '';
                                    }
                                }
                                fld_return.recid = formdetail._id;
                                if (fld_count)
                                {
                                    db_formdetails.updateMany({_id: formdetail._id}, { $set: fld_accessed },  function(err, res)
                                    {
                                        if (err) throw err;
                                        if (res.result.n == 1)
                                            socket.emit('forms_save_detail', fld_return);
                                            else
                                            {
                                                formdetail.recid = formdetail._id;
                                                socket.emit('forms_save_detail', formdetail);
                                            }
                                    });
                                }
                                else socket.emit('forms_save_detail', fld_return);
                            });
                        }); 
                    });   
                });
            });               
        });
        socket.on('forms_insert_detail', function(form_id)
        {
            if ((!form_id) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return;
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return;
                            for (var i = 0; i < caption[0].jumpsright.length; i++)
                            {
                                if (caption[0].jumpsright[i].settings.detail_insert)
                                {
                                    db_formdetails.insertMany([{parent: formcaption._id, creator: socket.request.user._id, datetime: new Date()}],  function(err, res)
                                    {
                                        if (err) return err;
                                        if (res.insertedCount == 1)
                                        {
                                            res.ops[0].recid = res.ops[0]._id;
                                            socket.emit('forms_insert_detail', res.ops[0]);
                                        }
                                    });   
                                    break;
                                }
                            }
                        });
                    });
                });   
            });         
        });
        socket.on('forms_delete_file', function(form_id, file_id)
        {
            if ((!file_id) || (!form_id) || (file_id.length != 24) || (form_id.length != 24)) return;
            db_formcaptions.findOne({_id: ObjectId(form_id)}, function(err, formcaption)
            {
                if (err) throw err;    
                if (!formcaption) return;
                get_groups_from_user(socket.request.user._id, function(mygroups)
                {
                    if (!mygroups.length) return;
                    get_template(formcaption.parent, mygroups, function(template)
                    {
                        if (!template) return;
                        get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                        {
                            if (!caption.length) return;
                            for (var i = 0; i < caption[0].jumpsright.length; i++)
                            {
                                if (caption[0].jumpsright[i].settings.detach_file)
                                {
                                    db_filestatehistory.find({ parent: ObjectId(file_id) }).toArray(function(err, filehistory)
                                    {
                                        if (filehistory.length != 0) return;
                                        db_links.deleteMany({ parent: formcaption._id, child : ObjectId(file_id) }, function(err, res)
                                        {
                                            if (err) throw err;
                                            if (res.result.n == 1)
                                            {
                                                bucket = new MongoDB.GridFSBucket(db, {bucketName: 'forms'});
                                                bucket.delete(ObjectId(file_id));
                                                
                                                db_links.find({ parent: formcaption._id }).toArray(function(err, links)
                                                {
                                                    if (err) throw err;
                                                    socket.emit('forms_delete_file', formcaption._id, links, file_id);    
                                                });                                                
                                            }
                                        });
                                    }); 
                                    break;
                                }
                            }
                        });
                    });
                });   
            });              
        });
        socket.on('forms_save_file', function(form_id, file_data)
        {
            if ((!file_data) || (!file_data.recid) || (file_data.recid.length != 24) || (!form_id) || (form_id.length != 24)) return;
            db_links.findOne({parent: ObjectId(form_id), child: ObjectId(file_data.recid)}, function(err, link)
            {
                if (err) throw err;
                if (!link) return;
                db_formcaptions.findOne({_id: link.parent}, function(err, formcaption)
                {
                    if (err) throw err;    
                    if (!formcaption) return;
                    get_groups_from_user(socket.request.user._id, function(mygroups)
                    {
                        if (!mygroups.length) return;
                        get_template(formcaption.parent, mygroups, function(template)
                        {
                            if (!template) return;
                            get_forms(template._id, socket.request.user._id, mygroups, formcaption._id, false, function(formtemlate, caption)
                            {
                                if (!caption.length) return;
                                if (!caption[0].jumpsright.length) return;
                                
                                var fld_accessed = {};
                                var fld_return = {};
                                var fld_count = 0;
                                for (var i = 0; i < caption[0].jumpsright.length; i++)
                                {
                                    var fields = caption[0].jumpsright[i].file_edit_fields;
                                    var fld_store = {};                                                        
                                    for (var n = 0; n < fields.length; n++) fld_store[fields[n]] = true;
                                    for (var key in file_data)
                                    {                    
                                        if (fld_store[key]) 
                                        {
                                            fld_accessed[key] = file_data[key];
                                            fld_return[key] = file_data[key];
                                            fld_count++;
                                        }
                                    }
                                }
                                for (var key in file_data)
                                {
                                    if (fld_return[key] == undefined) 
                                    {
                                        if (link[key])
                                            fld_return[key] = link[key];
                                               else fld_return[key] = '';
                                    }
                                }
                                fld_return.recid = link.child;
                                                                
                                if (fld_count)
                                {
                                    db_links.updateMany({_id: link._id}, { $set: fld_accessed },  function(err, res)
                                    {
                                        if (err) throw err;
                                        if (res.result.n == 1)
                                            socket.emit('forms_save_file', fld_return);
                                            else
                                            {
                                                link.recid = link.child;
                                                socket.emit('forms_save_file', link);
                                            }
                                    });  
                                }
                                else socket.emit('forms_save_file', fld_return);
                            });
                        });
                    });
                });
            });
        });

        socket.on('manuals_get_dirlist', function()
        {
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                db_manuals.find({groups: {  $in : mygroups }}, { projection: { _id: 1, name: 1, note : 1 } }).sort({name : 1}).toArray(function(err, manuallist)
                {
                    if (err) throw err;
                    socket.emit('manuals_dirlist', manuallist);
                });
            });
        });

        socket.on('manuals_get_filelist', function(id)
        {
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                db_manuals.findOne({ _id: ObjectId(id), groups: {  $in : mygroups }}, function(err, manuallist)
                {
                    if (err) throw err;
                    db_manualdetails.find({parent: manuallist._id}, { projection: { _id: 1, name: 1, note: 1, file: 1, datetime: 1, size: 1 } }).sort({name : 1}).toArray(function(err, manuallist)
                    {
                        if (err) throw err;
                        socket.emit('manuals_filelist', manuallist);
                    });
                });
            });
        });

        socket.on('chats_get_list', function()
        {
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                db_chats.find({ $or: [
                                            {creator: socket.request.user._id},
                                            {groups: {  $in : mygroups }}                                        
                                            ]
                                    }, { projection: { _id: 1, name: 1 } }).sort({name : 1}).toArray(function(err, chatlist)
                {
                    if (err) throw err;
                    socket.emit('chat_list', chatlist);
                });
            });
        });

        socket.on('chat_join', function(params)
        {
            if ((!params.id) || (params.id.length != 24)) return;
            var room = 'room_'+ params.id;                    
            var sid = socket.request.sid;

            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                db_chats.findOne({ $and: [
                                                {$or: [
                                                    {creator: socket.request.user._id},
                                                    {groups: {  $in : mygroups }}                                        
                                                    ]
                                                },
                                                { _id: ObjectId(params.id)}
                                            ]
                                    }, 
                                    function(err, chat)
                {
                    if (err) throw err;
                    if (!chat) 
                    {
                        socket.disconnect(true);
                        return;
                    }
                    
                    socket.request.user.chatid = chat._id; 
                    if (params.date == "current")
                    {
                        var tdate = new Date;
                        socket.request.user.chatdate = tdate.getFullYear() + '-' + ('0'+(tdate.getMonth()+1)).slice(-2) +'-' + ('0'+tdate.getDate()).slice(-2);
                    } else socket.request.user.chatdate = params.date;

                    socket.join(room); 
                    
                    db_chatsessions.findOne({chatid : chat._id, sessionid : sid}, function(err, sess)
                    {
                        if (err) throw err;
                        if (!sess)
                        {
                            var nowdate = new Date;
                            db_chatsessions.insertOne({ chatid: chat._id, sessionid : sid, expires: nowdate, userid: userid, count: 1}, function(err)
                            {
                                if (err) throw err;  
                            });
                        }
                        else
                        {
                            var count = sess.count + 1;
                            db_chatsessions.updateOne({_id : sess._id}, { $set: {"count": count }}, function(err)
                            {
                                if (err) throw err;   
                            });
                        }
                    });
                    
                    var newUser = {};
                    newUser.my = 0;
                    newUser.id = socket.request.user._id;
                    newUser.firstname = socket.request.user.firstname;
                    newUser.middlename = socket.request.user.middlename;
                    newUser.lastname = socket.request.user.lastname;
                    newUser.position = socket.request.user.position;
                    newUser.avatar = socket.request.user.avatar;
                    socket.broadcast.to(room).emit('chat_join', newUser);

                    db_chatsessions.aggregate([
                                { $match: { chatid : chat._id }},
                                { $lookup:
                                {
                                    from: 'users',
                                    localField: 'userid',
                                    foreignField: '_id',
                                    as: 'user'
                                }
                                },
                                { $unwind : "$user" },
                                { $project : { 
                                    _id: 0,
                                    userid : "$user._id", 
                                    firstname : "$user.firstname", 
                                    middlename : "$user.middlename", 
                                    lastname : "$user.lastname",
                                    avatar : "$user.avatar",
                                    position : "$user.position" }}
                                ]).sort({expires : 1}).toArray(function(err, connusers) 
                        {
                            if (err) throw err;
                            socket.emit('chat_connlist', connusers);
                            newUser.my = 1;   
                            socket.emit('chat_join', newUser);
                        }); 
                            
                    var reqdate1 = "2000-01-01T00:00:00";
                    var reqdate2 = "2100-01-01T23:59:59";
                    if (socket.request.user.chatdate != "all")
                    {
                        reqdate1 = socket.request.user.chatdate +'T00:00:00';
                        reqdate2 = socket.request.user.chatdate +'T23:59:59';
                    }
                            
                    db_chatdetails.aggregate([
                                { $match:  
                                    {
                                        parent : chat._id,
                                        datetime :{
                                            $gte: new Date(reqdate1),
                                            $lte: new Date(reqdate2)
                                        }                                    
                                    } 
                                },
                                { $lookup:
                                    {
                                        from: 'users',
                                        localField: 'creator',
                                        foreignField: '_id',
                                        as: 'user'
                                    }
                                },
                                { $unwind : "$user" },
                                { $project : 
                                    { 
                                        _id: 0,
                                        datetime : 1,
                                        text : 1,
                                        creator: 1,
                                        firstname : "$user.firstname", 
                                        middlename : "$user.middlename", 
                                        lastname : "$user.lastname",
                                        avatar : "$user.avatar" }
                                }
                                ]).sort({datetime : 1}).toArray(function(err, chatdetails)
                        {
                            if (err) throw err;
                            var data = {};
                            data.my = socket.request.user._id;
                            data.messlist = chatdetails;
                            socket.emit('chat_messlist', data); 
                        }); 

                    db_chatdetails.aggregate([
                                { $match:  {parent : chat._id} },
                                { $project : 
                                        { 
                                            _id: 0,
                                            date: { $dateToString: { format: "%Y-%m-%d", date: "$datetime" } }
                                        }
                                },
                                { $group: 
                                    {
                                        _id: "$date",
                                        count: {$sum: 1}
                                    }
                                }
                                ]).sort({_id : 1}).toArray(function(err, chatdates)
                        {
                            if (err) throw err;
                            var data = {};
                            data.current = socket.request.user.chatdate;
                            var tdate = new Date;
                            data.now = tdate.getFullYear()+'-'+('0'+(tdate.getMonth()+1)).slice(-2)+'-'+('0'+tdate.getDate()).slice(-2);
                            data.list = chatdates;
                            socket.emit('chat_datelist', data); 
                        });  
                });
            });
        });

        socket.on('chat_message', function(message)
        {
            if (socket.request.user.chatid == null) return;
            
            get_groups_from_user(socket.request.user._id, function(mygroups)
            {
                if (!mygroups.length) return;
                db_chats.findOne({ $and: [
                                                    {$or: [
                                                        {creator: socket.request.user._id},
                                                        {groups: {  $in : mygroups }}                                        
                                                        ]
                                                    },
                                                    { _id: socket.request.user.chatid}
                                                ]
                                        },
                                        { projection: { _id: 1, name: 1 } }, function(err, chatlist)
                    {
                        if (err) throw err;                        
                        if (!chatlist)
                        {
                            socket.disconnect(true);
                            return;
                        }
                        
                        var room = 'room_'+ socket.request.user.chatid;
                        var fullmess = {};
                        fullmess.datetime = new Date;
                        fullmess.datestr = fullmess.datetime.getFullYear()+'-'+('0'+(fullmess.datetime.getMonth()+1)).slice(-2)+'-'+('0'+fullmess.datetime.getDate()).slice(-2);
                        fullmess.text = message;
                        fullmess.firstname = socket.request.user.firstname;
                        fullmess.middlename = socket.request.user.middlename;
                        fullmess.lastname = socket.request.user.lastname;
                        fullmess.avatar = socket.request.user.avatar;
                        socket.emit('chat_message', fullmess); 
                        socket.broadcast.to(room).emit('chat_message', fullmess); 
                        db_chatdetails.insertOne({ parent: socket.request.user.chatid, 
                                                    datetime: fullmess.datetime, 
                                                    text: fullmess.text, 
                                                    creator: socket.request.user._id}, function(err)
                            {
                                if (err) throw err;  
                            });
                    });
            });
        });

        function sock_disconnect(changed_id)
        {
            //console.log('disconnected ' + userid + " from chat "+ socket.request.user.chatid);
            var id = socket.request.user.chatid; 
            var sid = socket.request.sid;
            var room = 'room_'+ socket.request.user.chatid;
            socket.leave(room);

            db_chatsessions.findOne({chatid : ObjectId(id), sessionid : sid}, function(err, sess)
            {
                if (err) throw err;
                if (!sess) return;
                
                var oldUser = {};
                oldUser.id = socket.request.user._id;
                oldUser.firstname = socket.request.user.firstname;
                oldUser.middlename = socket.request.user.middlename;
                oldUser.lastname = socket.request.user.lastname;
                oldUser.position = socket.request.user.position;

                if (sess.count <= 1)
                {
                    var nowdate = new Date;
                    db_chatsessions.deleteMany({_id : sess._id}, function(err)
                    {
                        if (err) throw err;  
                        socket.broadcast.to(room).emit('chat_leave', oldUser);
                        if (changed_id) socket.emit('chat_changed', oldUser);                  
                    });
                }
                else
                {
                    var count = sess.count - 1;
                    db_chatsessions.updateOne({_id : sess._id}, { $set: {"count": count }}, function(err, sess)
                    {
                        if (err) throw err;  
                        if (changed_id) socket.emit('chat_changed', oldUser);   
                    });
                }
            });            
        }
        socket.on('disconnect', function() { if (socket.request.user.chatid != null) sock_disconnect(false);});
        socket.on('chat_changed', function() { sock_disconnect(true); });
    });
}



module.exports.init = socket_init;
module.exports.test_rigth_upload_file = test_rigth_upload_file;
module.exports.test_rigth_download_file = test_rigth_download_file;
module.exports.get_groups_from_user = get_groups_from_user;
module.exports.get_workplaces = get_workplaces;