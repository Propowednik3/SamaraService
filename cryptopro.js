const ref = require("ref");
const ffi = require("ffi");
const Struct = require("ref-struct");

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

/*const DATA_BLOB = Struct({
    cbData: ref.types.uint32,
    pbData: ref.refType(ref.types.byte)
});
const PDATA_BLOB = new ref.refType(DATA_BLOB);

var intPtr = ref.refType('int');*/
var uintPtr = ref.refType('uint');
var charPtr = ref.refType('char');
var charPtrPtr = ref.refType(charPtr);
var charType = ref.types.byte;
const CERT_INFO = Struct({
                            Status: ref.types.int32,
                            Version: ref.types.uint32,
	                        Cextension: ref.types.uint32,
	                        Subject: charPtr,
                            SubjectLen: ref.types.uint32,
                            Issuer: charPtr,
                            IssuerLen: ref.types.uint32,
                            Serial: charPtr,
                            SerialLen: ref.types.uint32,
                            NotAfter: charPtr,
                            NotAfterLen: ref.types.uint32,
                            NotBefore: charPtr,
                            NotBeforeLen: ref.types.uint32,
                            Status: ref.types.uint32,
                            Message: charPtr,
                            MessageLen: ref.types.uint32,
                            Document: charPtr,
                            DocumentLen: ref.types.uint32
                        });

const PCERT_INFO = new ref.refType(CERT_INFO);

const Crypto = new ffi.Library('CryptoNode3.dll', 
{
  "HashCreate": ['int', [ ]],
  "HashDataAdd": ['int', [ 'uint', charPtr, 'uint' ]],
  "HashGetValue": ['int', [ 'uint', 'uint', charPtr, 'uint' ]],
  "HashClose": ['int', [ 'uint' ]],
  "HashSignCreate": ['int', [ 'int', charPtr, 'uint', charPtrPtr, uintPtr ]],
  "SignHashVerify": ['int', [ 'int', charPtr, 'uint', charPtr, 'uint' ]],
  "VerifyAttachedSign": ['int', [ 'int', charPtr, 'uint', PCERT_INFO ]],
  "VerifyDetachedSign": ['int', [ 'int', charPtr, 'uint', charPtr, 'uint' ]]
  //"CadesVerifySign": ['int', [ 'int',  charPtr, 'uint' ]],
  //"CadesCreateSign": ['int', [ charPtr, 'uint' ]]
});

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

function HashCreate()
{
    return Crypto.HashCreate(); 
}

function HashStrAdd(sessnum, data, datalen)
{
    let buff = Buffer.from(data);     
    return Crypto.HashDataAdd(sessnum, buff, datalen);
}

function HashDataAdd(sessnum, data)
{
    return Crypto.HashDataAdd(sessnum, data, data.length);
}

function HashGetValue(sessnum, typeBase64)
{
    var buff = new Buffer(charType.size * 192) ;
    var result = Crypto.HashGetValue(sessnum, typeBase64, buff, 192);
    if (result) 
    {
        var retData = ref.readCString(buff);
        return retData;
    }
    return "";
}

function HashClose(sessnum)
{
    return Crypto.HashClose(sessnum);
}

function HashSignCreate(data, datalen)
{
    let buff = Buffer.from(data);     
    var dataPtrPtr = ref.alloc(charPtrPtr);
    
    var datalen = ref.alloc('uint');
    
    var res = Crypto.HashSignCreate(1, buff, buff.length, dataPtrPtr, datalen);
    var ret = {};

    var outbuf = ref.reinterpret(dataPtrPtr.deref(), datalen.deref(), 0);

    outbuf.type = ref.types.CString;    
    ret.data = ref.readCString(outbuf, 0);
    ret.len = datalen.deref();
    return ret;
}

function SignHashVerify(hash, hashlen, sign, signlen)
{
    var hashbuff = Buffer.from(hash);     
    var signbuff = Buffer.from(sign); 
    
    var res = Crypto.SignHashVerify(1, hashbuff, hashbuff.length, signbuff, signbuff.length);
    
    return res;
}

function GetCertObject(res, cert_info)
{
    var ret = {};
    ret.status = res;
    ret.subject = {};
    ret.issuer = {};

    //ret.status = cert_info.Status;
    if (cert_info.MessageLen)
    {
        var messagebuf = ref.reinterpret(cert_info.Message, cert_info.NotMessageLen, 0);
        messagebuf.type = ref.types.CString;
        ret.message = ref.readCString(messagebuf, 0);
    }

    if (res < 0) return ret;

    ret.version = cert_info.Version;
    ret.cextension = cert_info.Cextension;

    if (cert_info.IssuerLen)
    {
        var issuerbuf = ref.reinterpret(cert_info.Issuer, cert_info.IssuerLen, 0);
        issuerbuf.type = ref.types.CString;
        ret.issuerinfo = ref.readCString(issuerbuf, 0);
    }

    if (cert_info.SubjectLen)
    {
        var subjectbuf = ref.reinterpret(cert_info.Subject, cert_info.SubjectLen, 0);
        subjectbuf.type = ref.types.CString;
        ret.subjectinfo = ref.readCString(subjectbuf, 0);
    }
    
    if (cert_info.SerialLen)
    {
        var serialbuf = ref.reinterpret(cert_info.Serial, cert_info.SerialLen, 0);
        serialbuf.type = ref.types.CString;
        ret.serial = ref.readCString(serialbuf, 0);
    }

    if (cert_info.NotAfterLen)
    {
        var notafterbuf = ref.reinterpret(cert_info.NotAfter, cert_info.NotAfterLen, 0);
        notafterbuf.type = ref.types.CString;
        ret.notafterinfo = ref.readCString(notafterbuf, 0);
    }

    if (cert_info.NotBeforeLen)
    {
        var notbeforebuf = ref.reinterpret(cert_info.NotBefore, cert_info.NotBeforeLen, 0);
        notbeforebuf.type = ref.types.CString;
        ret.notbeforeinfo = ref.readCString(notbeforebuf, 0);
    }

    if (cert_info.DocumentLen)
    {
        var documentbuf = ref.reinterpret(cert_info.Document, cert_info.DocumentLen, 0);
        documentbuf.type = ref.types.CString;
        ret.document = ref.readCString(documentbuf, 0);
        ret.decodeddocument = ref.readCString(Buffer.from(ret.document, 'base64'), 0);
    }

    ret.subject.inn = GetCertInfoName(ret.subjectinfo, OID_INN);
    ret.subject.snils = GetCertInfoName(ret.subjectinfo, OID_SNILS);
    ret.subject.email = GetCertInfoName(ret.subjectinfo, OID_EMAIL);
    ret.subject.ogrn = GetCertInfoName(ret.subjectinfo, OID_OGRN);
    ret.subject.department = GetCertInfoName(ret.subjectinfo, OID_DEPARTMENT);
    ret.subject.position = GetCertInfoName(ret.subjectinfo, OID_POSITION);
    ret.subject.country = GetCertInfoName(ret.subjectinfo, OID_COUNTRY);
    ret.subject.location = GetCertInfoName(ret.subjectinfo, OID_LOCATION);
    ret.subject.state = GetCertInfoName(ret.subjectinfo, OID_STATE);
    ret.subject.organization = GetCertInfoName(ret.subjectinfo, OID_ORGANIZATION);
    ret.subject.secondname = GetCertInfoName(ret.subjectinfo, OID_SECONDNAME);
    ret.subject.firstname = GetCertInfoName(ret.subjectinfo, OID_FIRSTNAME);
    ret.subject.fullname = GetCertInfoName(ret.subjectinfo, OID_FULLNAME);
    ret.subject.street = GetCertInfoName(ret.subjectinfo, OID_STREET);	   
    ret.issuer.ogrn = GetCertInfoName(ret.issuerinfo, OID_OGRN);
    ret.issuer.inn = GetCertInfoName(ret.issuerinfo, OID_INN);
    ret.issuer.snils = GetCertInfoName(ret.issuerinfo, OID_SNILS);
    ret.issuer.email = GetCertInfoName(ret.issuerinfo, OID_EMAIL);
    ret.issuer.country = GetCertInfoName(ret.issuerinfo, OID_COUNTRY);
    ret.issuer.state = GetCertInfoName(ret.issuerinfo, OID_STATE);
    ret.issuer.location = GetCertInfoName(ret.issuerinfo, OID_LOCATION);
    ret.issuer.organization = GetCertInfoName(ret.issuerinfo, OID_ORGANIZATION);
    ret.issuer.fullname = GetCertInfoName(ret.issuerinfo, OID_FULLNAME);
    ret.issuer.street = GetCertInfoName(ret.issuerinfo, OID_STREET);
    
    return ret;
}

function VerifyAttachedSign(itsBase64, sign, signlen)
{
    var signbuff = Buffer.from(sign); 
 
    cert_info = new CERT_INFO();
        
    var res = Crypto.VerifyAttachedSign(itsBase64, signbuff, signbuff.length, cert_info.ref());
	                        
    var ret = GetCertObject(res, cert_info);
    return ret;
}

function VerifyAttachedSignAsync(itsBase64, sign, signlen, next)
{
    var signbuff = Buffer.from(sign); 
 
    cert_info = new CERT_INFO();
        
    Crypto.VerifyAttachedSign.async(itsBase64, signbuff, signbuff.length, cert_info.ref(), function(err, res)
    {
        if (err) throw err;
        var ret = GetCertObject(res, cert_info);
        next(ret);
    });
    return 1;
}

function VerifyDetachedSign(itsBase64, doc, doclen, sign, signlen)
{
    var docbuff = Buffer.from(doc); 
    var signbuff = Buffer.from(sign); 
    
    var res = Crypto.VerifyDetachedSign(itsBase64, docbuff, docbuff.length, signbuff, signbuff.length);
    
    return res;
}

/*function CadesVerifySign(itsBase64, sign, signlen)
{
    var signbuff = Buffer.from(sign); 
    
    var res = Crypto.CadesVerifySign(itsBase64, signbuff, signbuff.length);
    
    return res;
}

function CadesCreateSign(doc, doclen)
{
    var docbuff = Buffer.from(doc); 
    var res = Crypto.CadesCreateSign(docbuff, docbuff.length);
    
    return res;
}
*/
function HashCreateAsync(next)
{
    return Crypto.HashCreate.Async(next);
}

function HashStrAddAsync(sessnum, data, datalen, next)
{
    let buff = Buffer.from(data);
    return Crypto.HashDataAdd.Async(sessnum, buff, datalen, next);
}

function HashDataAddAsync(sessnum, data, next)
{
    return Crypto.HashDataAdd.Async(sessnum, data, data.length, next);
}

function HashGetValueAsync(sessnum, typeBase64, next)
{
    var buff = new Buffer(charType.size * 128) ;
    var result = Crypto.HashGetValue.Async(sessnum, typeBase64, buff, 192, next);
    if (result) 
    {
        var retData = ref.readCString(buff);
        return retData;
    }
    return "";
}

function HashCloseAsync(sessnum, next)
{
    return Crypto.HashClose.Async(sessnum, next);
}

//var int3 = ref.types.void; // we don't know what the layout of "sqlite3" looks like
//var intPtr = ref.refType(int3);

//var outNumber = ref.alloc('int', 80); // allocate a 4-byte (32-bit) chunk for the output data
//outNumber = 80;
//console.log(Crypto.InitHashCalc(outNumber));
//console.log(outNumber.deref());
/*const Crypto = new ffi.Library('Crypt32', {
    "CryptUnprotectData": ['bool', [PDATA_BLOB, 'string', 'string', 'void *', 'string', 'int', PDATA_BLOB]],
    "CryptProtectData" : ['bool', [PDATA_BLOB, 'string', 'string', 'void *', 'string', 'int', PDATA_BLOB]]
});

function encrypt(plaintext) {
    let buf = Buffer.from(plaintext, 'utf16le');
    let dataBlobInput = new DATA_BLOB();
    dataBlobInput.pbData = buf;
    dataBlobInput.cbData = buf.length;
    let dataBlobOutput = ref.alloc(DATA_BLOB);
    let result = Crypto.CryptProtectData(dataBlobInput.ref(), null, null, null, null, 0, dataBlobOutput);    
    let outputDeref = dataBlobOutput.deref();
    let ciphertext = ref.reinterpret(outputDeref.pbData, outputDeref.cbData, 0);
    return ciphertext.toString('base64');
};

function decrypt(ciphertext) {
    let buf = Buffer.from(ciphertext, 'base64');
    let dataBlobInput = new DATA_BLOB();
    dataBlobInput.pbData = buf;
    dataBlobInput.cbData = buf.length;
    let dataBlobOutput = ref.alloc(DATA_BLOB);
    let result = Crypto.CryptUnprotectData(dataBlobInput.ref(), null, null, null, null, 0, dataBlobOutput);
    let outputDeref = dataBlobOutput.deref();
    let plaintext = ref.reinterpret(outputDeref.pbData, outputDeref.cbData, 0);
    return plaintext.toString('utf16le');
};

let text = "Test DLL";
let ciphertext = encrypt(text);
let plaintext = decrypt(ciphertext);

console.log("text:", text);
console.log("ciphertext:", ciphertext);
console.log("plaintext:", plaintext);*/

module.exports.HashCreate = HashCreate;
module.exports.HashStrAdd = HashStrAdd;
module.exports.HashDataAdd = HashDataAdd;
module.exports.HashGetValue = HashGetValue;
module.exports.HashClose = HashClose;
module.exports.HashSignCreate = HashSignCreate;
module.exports.SignHashVerify = SignHashVerify;
module.exports.VerifyAttachedSign = VerifyAttachedSign;
module.exports.VerifyDetachedSign = VerifyDetachedSign;
//module.exports.CadesVerifySign = CadesVerifySign;
//module.exports.CadesCreateSign = CadesCreateSign;

module.exports.HashCreateAsync = HashCreateAsync;
module.exports.HashStrAddAsync = HashStrAddAsync;
module.exports.HashDataAddAsync = HashDataAddAsync;
module.exports.HashGetValueAsync = HashGetValueAsync;
module.exports.HashCloseAsync = HashCloseAsync;
module.exports.VerifyAttachedSignAsync = VerifyAttachedSignAsync;