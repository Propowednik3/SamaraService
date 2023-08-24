const net = require("net");

const OID_INN           = '1.2.643.3.131.1.1';
const OID_SNILS         = '1.2.643.100.3';
const OID_EMAIL         = '1.2.840.113549.1.9.1';
const OID_OGRN          = '1.2.643.100.1';
const OID_DEPARTMENT    = '2.5.4.11';
const OID_POSITION      = '2.5.4.12';
const OID_COUNTRY       = '2.5.4.8';
const OID_LOCATION      = '2.5.4.7';
const OID_STATE         = '2.5.4.6';
const OID_ORGANIZATION  = '2.5.4.10';
const OID_SECONDNAME    = '2.5.4.42';
const OID_FIRSTNAME     = '2.5.4.4';
const OID_FULLNAME      = '2.5.4.3';
const OID_STREET        = '2.5.4.9';


function GetCertInfoName(dataStr, param)
{
    var result = "";
    var n = dataStr.indexOf(param + '=');
    if (n == -1) return "";
    var sector = false;
    var sect_exist = false
    for (var i = n; i < dataStr.length; i++)
    {
        if (dataStr[i] == '"')
        { 
            if (sector) sector = false; 
            else 
            {
                sector = true; 
                sect_exist = true;
            }
        }
        if ((sector == false) && (dataStr[i] == ','))
        {
            if (!sect_exist)
                result = dataStr.substring(n + param.length + 1, i);
                else
                result = dataStr.substring(n + param.length + 2, i - 1);
            break;
        }
        if ((sector == false) && (i == (dataStr.length - 1)))
        {
            if (!sect_exist)
                result = dataStr.substring(n + param.length + 1);
                else
                result = dataStr.substring(n + param.length + 2, i);
            break;
        }
    }
    return result;
}

function VerifyAttachedSign(itsBase64, sign, signlen, next)
{        
    var JsonRes = "";
    var JsonLen = 0;
    var firstpack = 1;
    var client = new net.Socket();
    client.connect(8989, '127.0.0.1', function() 
    {
        var buff = new Buffer(20);
        var type = 1;
        buff.writeInt32LE(type, 0);
        buff.writeInt32LE(itsBase64, 4);
        buff.writeInt32LE(signlen, 8);
        buff.writeInt32LE(2, 12);
        buff.writeInt32LE(3, 16);

        client.write(buff);
        client.write(sign);
        //var ret = GetCertObject(res, cert_info);
    });

    client.on('data', function(data) 
    {
        if (firstpack)
        {
            console.log(data);
            JsonLen = data.readInt32LE(0);
            console.log(JsonLen);
            if (data.length > 4)
            {
                JsonRes += data.toString('utf8', 4);
            }
            firstpack = 0;
        }
        else
        {
            console.log('>>>>>>>>>>>>   ');
            console.log(data.toString('utf8', 0));
            console.log('>>>>>>>>>>>>   ');
            JsonRes += data.toString('utf8', 0);
        }
        console.log("Recved " + data.length + '  '+ JsonLen +'  ' + JsonRes.length);
        
        if (JsonRes.length >= JsonLen)
        {
            console.log('Loaded: ' + JsonRes);
            client.destroy(); // kill client after server's response
        }
    });

    client.on('close', function() 
    {
	    console.log('Connection closed');
    });

    client.on('error', function(ex) 
    {
	    console.log('Connection error ' + ex.errno);
    });

    return 1;
}

/*module.exports.HashCreate = HashCreate;
module.exports.HashStrAdd = HashStrAdd;
module.exports.HashDataAdd = HashDataAdd;
module.exports.HashGetValue = HashGetValue;
module.exports.HashClose = HashClose;
module.exports.HashSignCreate = HashSignCreate;
module.exports.SignHashVerify = SignHashVerify;*/
module.exports.VerifyAttachedSign = VerifyAttachedSign;