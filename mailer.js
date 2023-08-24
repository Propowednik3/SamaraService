const ref = require("ref");
const ffi = require("ffi");

var intPtr = ref.refType('int');
var uintPtr = ref.refType('uint');
var charPtr = ref.refType('char');
var charPtrPtr = ref.refType(charPtr);
var charType = ref.types.byte;


const Mailer = new ffi.Library('Mailer.dll', 
{
    "Init": ['int', [ charPtr, 'uint', charPtr, 'uint', charPtr, 'uint', charPtr, 'uint', charPtr, 'uint' ]],
    "SendMail": ['int', [ charPtr, 'uint', charPtr, 'uint', charPtr, 'uint', charPtr, 'uint' ]],
    "Free": ['int', [ 'void' ]]    
});

function Init(login, password, server, from, auth)
{
    var B_login = Buffer.from(login);
    var B_password = Buffer.from(password);
    var B_server = Buffer.from(server);
    var B_from = Buffer.from(from);
    var B_auth = Buffer.from(auth);
    return Mailer.Init(B_login, B_login.length, B_password, B_password.length, B_server, B_server.length, B_from, B_from.length, B_auth, B_auth.length);
}

function SendMail(ToAddr, CCAddr, MainText, BodyText, next)
{
    var B_ToAddr = Buffer.from(ToAddr);
    var B_CCAddr = Buffer.from(CCAddr);
    var B_MainText = Buffer.from(MainText);
    var BodyHtml = '<html>'+
                    '<head>'+
                        '<meta charset="utf-8">'+                        
                    '</head>'+
                    '<body>'+
                        '<div>'+
                            BodyText+
                        '</div>'+
                    '</body>'+
                    '</html>';
    var B_BodyText = Buffer.from(BodyHtml);    
    Mailer.SendMail.async(B_ToAddr, B_ToAddr.length, B_CCAddr, B_CCAddr.length, B_MainText, B_MainText.length, B_BodyText, B_BodyText.length, function(err, res)
    {
        if (err) throw err;
        next(res);
    });    
}


module.exports.Init = Init;
module.exports.SendMail = SendMail;

