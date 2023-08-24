
var CADESCOM_CADES_BES = 1;
var CAPICOM_CURRENT_USER_STORE = 2;
var CAPICOM_MY_STORE = "My";
var CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
var CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
var CADESCOM_BASE64_TO_BINARY = 1;
var CADESCOM_CADES_X_LONG_TYPE_1 = 0x5d;
var CADESCOM_HASH_ALGORITHM_CP_GOST_3411 = 100;
CAPICOM_CERTIFICATE_FIND_TIME_VALID = 9;


function CopyObject(obj) 
{
    var copy = {};
    for (var key in obj) copy[key] = obj[key];
    return copy;
}
        
function HashCreate(ident, gost, dataToHesh, res, rej) 
{
    data64ToHesh = b64EncodeUnicode(dataToHesh);
    var dd = new Promise(function(resolve, reject)
    {
        cadesplugin.async_spawn(function *(args) {
            try 
            {
                // Создаем объект CAdESCOM.HashedData
                var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");

                // Алгоритм хэширования нужно указать до того, как будут переданы данные
                yield oHashedData.propset_Algorithm = gost;

                // Указываем кодировку данных
                // Кодировка должна быть указана до того, как будут переданы сами данные
                yield oHashedData.propset_DataEncoding = CADESCOM_BASE64_TO_BINARY;

                // Предварительно закодированные в BASE64 бинарные данные               

                // Передаем данные
                yield oHashedData.Hash(data64ToHesh);

                // Получаем хэш-значение
                var sHashValue = yield oHashedData.Value;
                // Это значение будет совпадать с вычисленным при помощи, например,
                // утилиты cryptcp от тех же исходных _бинарных_ данных.
                console.log(sHashValue);
                args[0]({ recid: ident, hash: sHashValue, message: "Created hesh."});
            }
            catch (err)
            {
                args[1]({ recid: ident, hash: null, message: "Failed to create hesh. Error: " + cadesplugin.getLastError(err)});
            }
        }, resolve, reject);
    });
    dd.then(res, rej);
}

function GetCertificateBySerial(certSerial, res, rej) 
{
    var dd = new Promise(function(resolve, reject)
    {        
        cadesplugin.async_spawn(function *(args) {
        try {
                var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE);

                var CertificatesObj = yield oStore.Certificates;
                var oCertificates = yield CertificatesObj.Find(CAPICOM_CERTIFICATE_FIND_TIME_VALID);

                var Count = yield oCertificates.Count;
                    
                if (Count == 0) { return args[2](null);}
                var rescert = null;
                for (var i = 1; i <= Count; i++) 
                {
                    var cert = yield oCertificates.Item(i);                        
                    var Serial = yield cert.SerialNumber;                        

                    if (Serial == args[0]) { rescert = cert; break;}
                }
                    
                yield oStore.Close();
                if (rescert) args[1](rescert); else args[2]('Certificate Not found');
            }
            catch (err)
            {
                args[2](cadesplugin.getLastError(err));
            }
        }, certSerial, resolve, reject);        
    });
    dd.then(res, rej);
}

function GetCertificateBySubjectName(certSubjectName, res, rej) 
{
    var dd = new Promise(function(resolve, reject)
    {        
        cadesplugin.async_spawn(function *(args) {
            try {
                var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
                    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

                var CertificatesObj = yield oStore.Certificates;
                var oCertificates = yield CertificatesObj.Find(CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME, certSubjectName);

                var Count = yield oCertificates.Count;
                if (Count == 0) { throw("Certificate not found: " + args[0]); }

                var oCertificate = yield oCertificates.Item(1);
                
                yield oStore.Close();
                args[1]({ result: true, certificate: oCertificate, message: '' });
            }
            catch (err)
            {
                args[2]({ result: false, certificate: null, message: "Certificate not found: " + cadesplugin.getLastError(err)});
            }
        }, certSubjectName, resolve, reject);        
    });
    dd.then(res, rej);
}

function SignDocuments(docs, res, rej) 
{
    if (docs.cnt >= docs.arr.length) rej("System error");
    var document = docs.arr[docs.cnt];
    
    if (document.type == 1) 
        dataToSign = b64EncodeUnicode(document.body);
        else 
        dataToSign = document.body.document;
    if (document.signature)
    {
        var dd = new Promise(function(resolve, reject)
        {        
            cadesplugin.async_spawn(function *(args) 
            {
                try 
                {
                    if (document.type == 1)
                    {
                        var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                        yield oSigner.propset_Certificate(args[0]);

                        var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                        yield oSignedData.propset_ContentEncoding = CADESCOM_BASE64_TO_BINARY; 
                        yield oSignedData.propset_Content(args[1]);
                        
                        var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES);
                        document.signature =  sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");
                    }
                    if (document.type == 0)
                    {
                        var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                        yield oSigner.propset_Certificate(args[0]);
                        
                        var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                        yield oHashedData.propset_Algorithm = CADESCOM_HASH_ALGORITHM_CP_GOST_3411;
                        yield oHashedData.SetHashValue(args[1]);
                        
                        var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                        yield oSignedData.propset_ContentEncoding = CADESCOM_BASE64_TO_BINARY;

                        var sSignedMessage = yield oSignedData.SignHash(oHashedData, oSigner, CADESCOM_CADES_BES);  
                        document.signature =  sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");               
                    }
                    
                    args[2](docs);
                }
                catch (err)
                {
                    args[3]("Failed to create signature. Error: " + cadesplugin.getLastError(err));
                }
            }, docs.certificate, dataToSign, resolve, reject);        
        });
        dd.then(res, rej);
    } else return res(docs);
}

function SignCreateBase64(certSubjectName, dataToSign, res, rej) 
{
    data64ToSign = b64EncodeUnicode(dataToSign);
    var dd = new Promise(function(resolve, reject)
    {
        cadesplugin.async_spawn(function *(args) {
            try {
                var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
                    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

                var CertificatesObj = yield oStore.Certificates;
                var oCertificates = yield CertificatesObj.Find(
                    CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME, certSubjectName);

                var Count = yield oCertificates.Count;
                if (Count == 0) {
                    throw("Certificate not found: " + args[0]);
                }
                var oCertificate = yield oCertificates.Item(1);
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(oCertificate);

                var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_ContentEncoding = CADESCOM_BASE64_TO_BINARY; 
                yield oSignedData.propset_Content(data64ToSign);

                var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES);

                var result = sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");

                yield oStore.Close();

                args[2](result);
            }
            catch (err)
            {
                args[3]("Failed to create signature. Error: " + cadesplugin.getLastError(err));
            }
        }, certSubjectName, data64ToSign, resolve, reject);
    });
    dd.then(res, rej);
}

function SignCreate(certSubjectName, dataToSign, res, rej) 
{
    var dd = new Promise(function(resolve, reject)
    {
        cadesplugin.async_spawn(function *(args) {
            try {
                var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
                    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

                var CertificatesObj = yield oStore.Certificates;
                var oCertificates = yield CertificatesObj.Find(
                    CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME, certSubjectName);

                var Count = yield oCertificates.Count;
                if (Count == 0) {
                    throw("Certificate not found: " + args[0]);
                }
                var oCertificate = yield oCertificates.Item(1);
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(oCertificate);

                var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_Content(dataToSign);

                var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES);

                var result = sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");

                yield oStore.Close();

                args[2](result);
            }
            catch (err)
            {
                args[3]("Failed to create signature. Error: " + cadesplugin.getLastError(err));
            }
        }, certSubjectName, dataToSign, resolve, reject);
    });
    dd.then(res, rej);
}

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

function SignVerify(type, ident, sSignedMessage, res, rej) 
{
    var dd = new Promise(
        function(resolve, reject)
        {
            cadesplugin.async_spawn(function *(args) 
            {                
                try {
                        var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                        var res;
                        console.log(type);
                        if (type == 0) 
                        {
                            var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                            yield oHashedData.propset_Algorithm = CADESCOM_HASH_ALGORITHM_CP_GOST_3411;
                            yield oHashedData.SetHashValue("7adddbddbb7cb0177a7f31135402ec7fc7e9250957bea23583c1bac0150629f5");
                            var sHashValue = yield oHashedData.Value;
                            console.log(sHashValue);
                            console.log(sSignedMessage);
                            res = yield oSignedData.VerifyHash(oHashedData, sSignedMessage, CADESCOM_CADES_BES);             
                        }
                        if (type == 1) res = yield oSignedData.VerifyCades(sSignedMessage, CADESCOM_CADES_BES);                                              
                    }
                catch (err)
                {
                    args[3]({ recid: args[0], valid: false, message: cadesplugin.getLastError(err)});
                }
                var Signers = yield oSignedData.Signers;
				
				var Item = yield Signers.Item(1);
                var Certificate = yield Item.Certificate;
                var isValidFunc = yield Certificate.IsValid();
                var subjectName = yield Certificate.SubjectName;   
                var issuerName = yield Certificate.IssuerName;  
                
                var obj = {};
                obj.recid = args[0];                
                obj.valid = yield isValidFunc.Result;
                obj.serial = yield Certificate.SerialNumber;
                obj.version = yield Certificate.Version;
                obj.todate = yield Certificate.ValidToDate;
                obj.fromdate = yield Certificate.ValidFromDate;
                obj.signingtime = yield Item.SigningTime;
                obj.subject = {};
                obj.subject.inn = GetCertInfoName(subjectName, 'ИНН');
                obj.subject.snils = GetCertInfoName(subjectName, 'СНИЛС');
                obj.subject.email = GetCertInfoName(subjectName, 'E');
                obj.subject.country = GetCertInfoName(subjectName, 'C');
                obj.subject.location = GetCertInfoName(subjectName, 'L');
                obj.subject.organization = GetCertInfoName(subjectName, 'O');
                obj.subject.secondname = GetCertInfoName(subjectName, 'SN');
                obj.subject.firstname = GetCertInfoName(subjectName, 'G');
                obj.subject.fullname = GetCertInfoName(subjectName, 'CN');
                obj.issuer = {};
                obj.issuer.ogrn = GetCertInfoName(issuerName, 'ОГРН');
                obj.issuer.inn = GetCertInfoName(issuerName, 'ИНН');
                obj.issuer.snils = GetCertInfoName(issuerName, 'СНИЛС');
                obj.issuer.email = GetCertInfoName(issuerName, 'E');
                obj.issuer.country = GetCertInfoName(issuerName, 'C');
                obj.issuer.state = GetCertInfoName(issuerName, 'S');
                obj.issuer.location = GetCertInfoName(issuerName, 'L');
                obj.issuer.organization = GetCertInfoName(issuerName, 'O');
                obj.issuer.fullname = GetCertInfoName(issuerName, 'CN');
                obj.issuer.street = GetCertInfoName(issuerName, 'STREET');
                obj.message = "Проверено успешно";
                args[2](obj);
            }, ident, sSignedMessage, resolve, reject);
        });
    dd.then(res, rej);
}

function b64EncodeUnicode(str) 
{
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function b64DecodeUnicode(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function DateToStr(date)
{
    var tdate = new Date(date);
    return tdate.getFullYear()+'.'+('0'+(tdate.getMonth()+1)).slice(-2)+'.'+('0'+tdate.getDate()).slice(-2)+
            ' '+tdate.getHours()+':'+('0'+tdate.getMinutes()).slice(-2)+':'+('0'+tdate.getSeconds()).slice(-2);
}

function ShowMessage(message)
{
    w2popup.open({
        title: 'Внимание',
        body: '<div class="w2ui-centered">' + message + '</div>'});
}

function ShowHistory(jumps)
{
    w2ui['historygrid'].jumps = jumps;
    w2ui['historygrid'].jumps_inx = [];
    for(var i = 0; i < jumps.length; i++)
            w2ui['historygrid'].jumps_inx[jumps[i]._id] = i;

    w2ui['historygrid'].clear();
    for (var i = 0; i < jumps.length; i++)
    {
        var obj = {};
        obj.recid = jumps[i]._id;
        obj.statefromname = jumps[i].statefrom.name;
        obj.statetoname = jumps[i].stateto.name;
        obj.canceled = jumps[i].canceled;
        if (jumps[i].canceled) obj.canceled = "Да"; else obj.canceled = "Нет"; 
        if (jumps[i].back) obj.back = "Да"; else obj.back = "Нет"; 
        if (!!jumps[i].signature[0]) obj.signature = "Есть"; else obj.signature = "Нет"; 
        obj.datetime = jumps[i].datetime;
        obj.creatorname = jumps[i].user.firstname + ' ' + jumps[i].user.middlename + ' ' + jumps[i].user.lastname;
        w2ui['historygrid'].add(obj);
    }
    w2popup.open({
        title   : 'История переходов',
        width   : 900,
        height  : 600,
        showMax : true,
        body    : '<div id="popuptop" style="position: absolute; left: 5px; top: 5px; right: 5px; bottom: 5px;"></div>',
        onOpen  : function (event) 
        {
            event.onComplete = function () 
            {
                w2ui['historylayout'].content('main', w2ui['historygrid']);
                $('#w2ui-popup #popuptop').w2render('historylayout');
                //w2ui['historylayout'].content('main', w2ui.form);
            };
        },
        onToggle: function (event) { 
            event.onComplete = function () {
                w2ui.layout.resize();
            }
        }
    });
}

function RefreshInsertButton()
{
    var jumps = w2ui['formcaptiongrid'].jumps;
    var states = w2ui['formcaptiongrid'].states;
    var states_inx = w2ui['formcaptiongrid'].states_inx;
    var states_arr = [];
    
    for (var i = 0; i < jumps.length; i++)
        if ((jumps[i].settings.caption_insert) && (jumps[i].settings.back == false)) 
            states_arr.push({ id: jumps[i].from, text: states[states_inx[jumps[i].from]].name });
    if (states_arr.length) w2ui['formcaptiongrid'].toolbar.enable('fcadd'); else w2ui['formcaptiongrid'].toolbar.disable('fcadd');
    w2ui['formcaptiongrid'].toolbar.get('fcadd').items = states_arr;
}

function RefreshButtonStatuses(recid)
{
    if (!recid) 
    {
        w2ui['formcaptiongrid'].toolbar.disable('fchst');
        w2ui['formcaptiongrid'].toolbar.disable('fcbwr');
        w2ui['formcaptiongrid'].toolbar.disable('fcfwd');
        w2ui['formcaptiongrid'].toolbar.disable('fcdel');
        w2ui['formcaptiongrid'].toolbar.disable('fcsav');
        w2ui['formdetailgrid'].toolbar.disable('fdadd');
        w2ui['formdetailgrid'].toolbar.disable('fddel');
        w2ui['formdetailgrid'].toolbar.disable('fdsav');
        w2ui['formfilegrid'].toolbar.disable('ffadd');
        w2ui['formfilegrid'].toolbar.disable('ffdel');
        w2ui['formfilegrid'].toolbar.disable('ffprv');
        w2ui['formfilegrid'].toolbar.disable('ffdwn');
        w2ui['formfilegrid'].toolbar.disable('ffsav');
        return;
    }
    var i = w2ui['formcaptiongrid'].captions_inx[recid];
    var caption = w2ui['formcaptiongrid'].captions[i];
    var states = w2ui['formcaptiongrid'].states;
    var states_inx = w2ui['formcaptiongrid'].states_inx;
                
    var settings = {};
    settings.caption_delete = false; 
    settings.detail_insert = false; 
    settings.detail_delete = false; 
    settings.attach_file = false; 
    settings.detach_file = false; 
    settings.download = false; 
    settings.sign_doc = false;
    settings.backward = false; 
    settings.forward = false; 
    settings.caption_edit_fields = false;
    settings.detail_edit_fields = false;
    settings.file_edit_fields = false;

    for (var i = 0; i < caption.jumpsright.length; i++)
    {
        if (caption.jumpsright[i].settings.back == false)
        {
            settings.forward = true;
            if (caption.jumpsright[i].settings.caption_delete) settings.caption_delete = true; 
            if (caption.jumpsright[i].settings.detail_insert) settings.detail_insert = true; 
            if (caption.jumpsright[i].settings.detail_delete) settings.detail_delete = true; 
            if (caption.jumpsright[i].settings.attach_file) settings.attach_file = true; 
            if (caption.jumpsright[i].settings.detach_file) settings.detach_file = true; 
            if (caption.jumpsright[i].settings.download_file) settings.download_file = true; 
            if (caption.jumpsright[i].settings.sign_doc) settings.sign_doc = true; 
            if (caption.jumpsright[i].caption_edit_fields.length) settings.caption_edit_fields = true; 
            if (caption.jumpsright[i].detail_edit_fields.length) settings.detail_edit_fields = true; 
            if (caption.jumpsright[i].file_edit_fields.length) settings.file_edit_fields = true; 
        } else settings.backward = true; 
    }
      
    w2ui['formcaptiongrid'].toolbar.enable('fchst');
    if (settings.backward) w2ui['formcaptiongrid'].toolbar.enable('fcbwr'); else w2ui['formcaptiongrid'].toolbar.disable('fcbwr');
    if (settings.forward) w2ui['formcaptiongrid'].toolbar.enable('fcfwd'); else w2ui['formcaptiongrid'].toolbar.disable('fcfwd');
    if (settings.caption_delete) w2ui['formcaptiongrid'].toolbar.enable('fcdel'); else w2ui['formcaptiongrid'].toolbar.disable('fcdel');
    if (settings.caption_edit_fields) w2ui['formcaptiongrid'].toolbar.enable('fcsav'); else w2ui['formcaptiongrid'].toolbar.disable('fcsav');
    if (settings.detail_insert) w2ui['formdetailgrid'].toolbar.enable('fdadd'); else w2ui['formdetailgrid'].toolbar.disable('fdadd');
    if (settings.detail_delete) w2ui['formdetailgrid'].toolbar.enable('fddel'); else w2ui['formdetailgrid'].toolbar.disable('fddel');
    if (settings.detail_edit_fields) w2ui['formdetailgrid'].toolbar.enable('fdsav'); else w2ui['formdetailgrid'].toolbar.disable('fdsav');
    if (settings.attach_file) w2ui['formfilegrid'].toolbar.enable('ffadd'); else w2ui['formfilegrid'].toolbar.disable('ffadd');
    if (settings.detach_file) w2ui['formfilegrid'].toolbar.enable('ffdel'); else w2ui['formfilegrid'].toolbar.disable('ffdel');
    if (settings.download_file) w2ui['formfilegrid'].toolbar.enable('ffprv'); else w2ui['formfilegrid'].toolbar.disable('ffprv');
    if (settings.download_file) w2ui['formfilegrid'].toolbar.enable('ffdwn'); else w2ui['formfilegrid'].toolbar.disable('ffdwn');
    if (settings.file_edit_fields) w2ui['formfilegrid'].toolbar.enable('ffsav'); else w2ui['formfilegrid'].toolbar.disable('ffsav');
    //if (settings.sign_doc) w2ui['formcaptiongrid'].toolbar.enable('fcsgn'); else w2ui['formcaptiongrid'].toolbar.disable('fcsgn');
       
    var states_arr = [];
    var arr_test_uniq = {};
    for (var i = 0; i < caption.jumpsright.length; i++)
        if (caption.jumpsright[i].settings.back == false)
        {            
            if (arr_test_uniq[caption.jumpsright[i].to] != true)
            {
                arr_test_uniq[caption.jumpsright[i].to] = true; 
                if (caption.jumpsright[i].settings.sign_doc)
                    states_arr.push({ id: caption.jumpsright[i].to, text: states[states_inx[caption.jumpsright[i].to]].name, icon: 'icon-menu-sign' });
                    else
                    states_arr.push({ id: caption.jumpsright[i].to, text: states[states_inx[caption.jumpsright[i].to]].name, icon: 'icon-menu-forward' });
            }
        }
    w2ui['formcaptiongrid'].toolbar.get('fcfwd').items = states_arr;
    if (states_arr.length) w2ui['formcaptiongrid'].toolbar.enable('fcfwd'); else w2ui['formfilegrid'].toolbar.disable('fcfwd');

    var states_arr = [];
    var arr_test_uniq = {};
    for (var i = 0; i < caption.jumpsright.length; i++)
    {
        var new_states = caption.jumpsright[i].file_next_states;
        
        for (var n = 0; n < new_states.length; n++)        
        {
            if (arr_test_uniq[new_states[n].state] != true)
            {
                arr_test_uniq[new_states[n].state] = true; 
                states_arr.push({ id: new_states[n].state, text: states[states_inx[new_states[n].state]].name, icon: 'icon-menu-forward' });
            }
        }
    }
    w2ui['formfilegrid'].toolbar.get('fffwd').items = states_arr;
    if (states_arr.length) w2ui['formfilegrid'].toolbar.enable('fffwd'); else w2ui['formfilegrid'].toolbar.disable('fffwd');
}             

var socket = io.connect('', {reconnect : false});
var lastuser = null;

socket.on('connect', function(message)
{ 
    if (w2ui.sidebar)
    { 
        if ((w2ui.sidebar.selected == 'manuals') && (w2ui['manualdirgrid']))
        {
            socket.emit('manuals_get_dirlist');               
        }
        if ((w2ui.sidebar.selected == 'chats'))
        {
            socket.emit('chats_get_list');               
        }
        if (w2ui.sidebar.selected == 'forms')
        {
            if (w2ui['formcaptiongrid']) w2ui['formcaptiongrid'].unlock();
            if (w2ui['formdetailgrid']) w2ui['formdetailgrid'].unlock();
            if (w2ui['formfilegrid']) w2ui['formfilegrid'].unlock();                       
        }
    }
});

socket.on('disconnect', function(message) 
{
    if (w2ui['manualdirgrid'])
    {
        //w2ui['manualdirgrid'].clear();
        w2ui['manualdirgrid'].lock('Связь потеряна', true);
    }
    if (w2ui['manualfilegrid'])
    {
        //w2ui['manualfilegrid'].clear();
        w2ui['manualfilegrid'].lock('Связь потеряна', true);
    }
    if (w2ui['formcaptiongrid'])
    {
        //w2ui['formcaptiongrid'].clear();
        w2ui['formcaptiongrid'].lock('Связь потеряна', true);
    }
    if (w2ui['formdetailgrid'])
    {
        //w2ui['formdetailgrid'].clear();
        w2ui['formdetailgrid'].lock('Связь потеряна', true);
    }
    if (w2ui['formfilegrid'])
    {
        //w2ui['formfilegrid'].clear();
        w2ui['formfilegrid'].lock('Связь потеряна', true);
    }
    /*var clist = document.getElementById("connlist");
    while (clist.hasChildNodes()) clist.removeChild(clist.firstChild);
    var mlist = document.getElementById("messlist");
    while (mlist.hasChildNodes()) mlist.removeChild(mlist.firstChild);
    var mbox = document.getElementById("messbox");
    mbox.disabled = true;
    var chlist = document.getElementById("selchatid");
    chlist.disabled = true;
    var dlist = document.getElementById("selchatdate");    
    dlist.disabled = true;*/

    setTimeout(reconnect, 1000);
});

socket.on('manuals_dirlist', function(dirlist)
{
    if (w2ui['manualdirgrid'])
    {
        w2ui['manualdirgrid'].selectNone();
        w2ui['manualdirgrid'].clear();
        for(var i = 0; i < dirlist.length; i++)
            w2ui['manualdirgrid'].add( { recid: dirlist[i]._id, dirname: dirlist[i].name } ); 
        w2ui['manualdirgrid'].unlock();             
    }
});

socket.on('manuals_filelist', function(filelist)
{
    if (w2ui['manualfilegrid'])
    {
        //console.log(w2ui['manualfilegrid']);
        w2ui['manualfilegrid'].clear();
        for(var i = 0; i < filelist.length; i++)
            w2ui['manualfilegrid'].add( { recid: filelist[i]._id, filenote: filelist[i].name, filesize: filelist[i].size, filedate:  filelist[i].datetime, filename: filelist[i].file} ); 
        w2ui['manualfilegrid'].unlock();             
    }
});

function reconnect()
{
    socket.once('error', function() {setTimeout(reconnect, 1000); });
    //socket.socket.connect();
}


socket.on('chat_changed', function(message)
{ 
    socket.emit('chat_join', {id: document.getElementById("selchatid").value, 
                        date: document.getElementById("selchatdate").value});
});

socket.on('chat_join', function(newUser)
{
    var clist = document.getElementById("connlist");
    var ret = 0;
    //console.log(clist.childElementCount);
    for (var i = 0; i < clist.childElementCount; i++)
    {
        if (clist.childNodes[i].getAttribute("id") == ('cu_'+newUser.id))
        {
            ret = 1;
            break;
        }
    }     
    if (ret == 0)
    {
        var li = document.createElement("li");
        li.setAttribute("id", "cu_" + newUser.id)
        li.classList.add("contact");
        li.innerHTML = '<div class="wrap">\
                            <span class="contact-status online"></span>\
                            <img src="file?type=users&id=' + newUser.avatar + '" alt="" />\
                            <div class="meta">\
                                <p class="name">'+newUser.firstname + ' ' + newUser.middlename + ' ' + newUser.lastname+'</p>\
                                <p class="preview">'+newUser.position+'</p>\
                            </div>\
                        </div>';
        document.getElementById("connlist").appendChild(li);
    }
});

socket.on('chat_connlist', function(connusers)
{
    var clist = document.getElementById("connlist");
    while (clist.hasChildNodes()) clist.removeChild(clist.firstChild);
                                        
    for (var i = 0; i < connusers.length; i++)
    {
        var li = document.createElement("li");
        li.setAttribute("id", "cu_" + connusers[i].userid)
        li.classList.add("contact");
        li.innerHTML = '<div class="wrap">\
                            <span class="contact-status online"></span>\
                            <img src="file?type=users&id=' + connusers[i].avatar + '" alt="" />\
                            <div class="meta">\
                                <p class="name">'+connusers[i].firstname + ' ' + connusers[i].middlename + ' ' + connusers[i].lastname+'</p>\
                                <p class="preview">'+connusers[i].position+'</p>\
                            </div>\
                        </div>';
        clist.appendChild(li);
    }
});

socket.on('chat_messlist', function(data)
{
    var mlist = document.getElementById("messlist");    
    while (mlist.hasChildNodes()) mlist.removeChild(mlist.firstChild);
    lastuser = null;
    var html;
    for (var i = 0; i < data.messlist.length; i++)
    {
        var li = document.createElement("li");
        //li.setAttribute("id", "cu_" + data.messlist[i].userid)
        if (data.my == data.messlist[i].creator)
           li.classList.add("sent");
        else
           li.classList.add("replies");
        
        if (lastuser != (data.messlist[i].firstname+data.messlist[i].middlename+data.messlist[i].lastname))
            html = '<img src="file?type=users&id=' + data.messlist[i].avatar + '" alt="" />'+
                    '<h6>' + data.messlist[i].firstname + ' ' + data.messlist[i].middlename + ' ' + data.messlist[i].lastname+'</h6>';
            else html = '';            
        html += '<p>' + data.messlist[i].text+'</p>';
        li.innerHTML = html;
        lastuser = data.messlist[i].firstname+data.messlist[i].middlename+data.messlist[i].lastname;
       
        mlist.appendChild(li);
        if (i == (data.messlist.length - 1)) li.scrollIntoView();        
    }
    
    //var mbox = document.getElementById("messbox");
    //mbox.disabled = false;    
});

socket.on('chat_datelist', function(data)
{   
    var dlist = document.getElementById("selchatdate");    
    while (dlist.hasChildNodes()) dlist.removeChild(dlist.firstChild);

    var exist = 0;
    for (var i = 0; i < data.list.length; i++)
    {
        if (data.current == data.list[i]._id) exist = 1;
        if (data.now != data.list[i]._id)
        {
            var opt = document.createElement("option");
            //opt.setAttribute("id", "cu_" + data.list[i].userid)
            //opt.classList.add("list-group-item");
            opt.value = data.list[i]._id
            opt.textContent = data.list[i]._id;
            if (data.current == data.list[i]._id) opt.selected = true;
            dlist.appendChild(opt);
        }
    }
    var opt = document.createElement("option");
    opt.value = "current";
    opt.textContent = "Текущая";
    if (data.current == data.now) opt.selected = true; 
    dlist.appendChild(opt); 
    var opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "Все";
    if (data.current == "all") opt.selected = true; 
    dlist.appendChild(opt);  
    if ((exist == 0) && (data.current != data.now) && (data.current != "all"))
    {
        var opt = document.createElement("option");
        opt.value = data.current;
        opt.textContent = data.current;
        opt.selected = true; 
        dlist.appendChild(opt);  
    }  
    
    dlist.disabled = false;
});

socket.on('chat_list', function(chatlist)
{    
    var chlist = document.getElementById("selchatid");    
    while (chlist.hasChildNodes()) chlist.removeChild(chlist.firstChild);
    
    for (var i = 0; i < chatlist.length; i++)
    {
        {
            var opt = document.createElement("option");
            //opt.setAttribute("id", "cu_" + data.chatlist[i].userid)
            //if (data.my == data.chatlist[i].userid) 
            //opt.classList.add("list-group-item");
            opt.value = chatlist[i]._id
            opt.textContent = chatlist[i].name;
            if (i == 0) opt.selected = true; 
            chlist.appendChild(opt);
        }
    }
    chlist.disabled = false;
    socket.emit('chat_join', {id: document.getElementById("selchatid").value, 
                        date: document.getElementById("selchatdate").value});
});

socket.on('chat_message', function(message)
{
    var currdate = document.getElementById("selchatdate").value;
    
    if ((currdate == 'all') || (currdate == 'current') || (currdate == message.datestr))
    {
        var li = document.createElement("li");
        if (message.my != 0) 
           li.classList.add("sent");
        else
           li.classList.add("replies");
        var html;
        if (lastuser != (message.firstname+message.middlename+message.lastname))
            html = '<img src="file?type=users&id=' + message.avatar + '" alt="" />'+
                    '<h6>' + message.firstname + ' ' + message.middlename + ' ' + message.lastname+'</h6>';
            else html = '';            
        html += '<p>' + message.text+'</p>';
        li.innerHTML = html;
        document.getElementById("messlist").appendChild(li);
        li.scrollIntoView();
    }
});

socket.on('chat_leave', function(oldUser)
{
    var clist = document.getElementById("connlist");
    
    var ret = 0;
    for (var i = 0; i < clist.childElementCount; i++)
    {
        if (clist.childNodes[i].getAttribute("id") == ('cu_'+oldUser.id))
        {
            clist.removeChild(clist.childNodes[i]);
            ret = 1;
            break;
        }
    }  
    if (ret == 0) console.log('not removeChild cu_'+oldUser.id);
});

socket.on('popup_message', function(message)
{  
    console.log(message);
    ShowMessage(message);
});

socket.on('form_list', function(formlist)
{    
    var frlist = document.getElementById("selformid");    
    while (frlist.hasChildNodes()) frlist.removeChild(frlist.firstChild);
    
    for (var i = 0; i < formlist.length; i++)
    {
        {
            var opt = document.createElement("option");
            //opt.setAttribute("id", "cu_" + data.formlist[i].userid)
            //if (data.my == data.formlist[i].userid) 
            //opt.classList.add("list-group-item");
            opt.value = formlist[i]._id
            opt.textContent = formlist[i].name;
            if (i == 0) opt.selected = true; 
            frlist.appendChild(opt);
        }
    }
    frlist.disabled = false;
    socket.emit('forms_get_template', document.getElementById("selformid").value);
});

socket.on('form_template', function(formtemplate)
{    
    if (w2ui['formcaptiongrid']) w2ui['formcaptiongrid'].destroy();
    if (w2ui['formdetailgrid']) w2ui['formdetailgrid'].destroy();
    if (formtemplate)
    {
        $('#formcaptiongrid').w2grid(
        { 
            name: 'formcaptiongrid',
            multiSelect: true, 
            multiSearch: false,                 
            method: 'GET', // need this to avoid 412 error on Safari
            show:
                {
                    selectColumn: false,
                    lineNumbers: true,
                    footer: true,
                    toolbar: true
                }, 
            columns: [                
                    { field: 'statename', caption: 'Состояние документа', size: '100px' },
                    { field: 'creatorname', caption: 'Автор', size: '100px' },
                    { field: 'datetime', caption: 'Дата', size: '100px' }
                ],   
            toolbar:{
                items: [
                            {type: "button", id: 'fcdet', icon: "icon-detail", tooltip: "Детали", text: "", disabled: false, onClick: function()
                                    {                                        
                                        if (w2ui['surface']) w2ui['surface'].toggle('preview', false);                          
                                    }
                            },                              
                            {type: "button", id: 'fcfil', icon: "icon-files", tooltip: "Файлы", text: "", disabled: false, onClick: function()
                                    { 
                                        if (w2ui['surface']) w2ui['surface'].toggle('right', false);                       
                                    }
                            },
                            {type: 'break' },
                            {type: 'menu', id: 'fcadd', icon: 'icon-plus', tooltip: "Добавить", disabled: true, items: []},
                            {type: "button", id: "fcdel", icon: "icon-minus", tooltip: "Удалить", text: "", disabled: true, onClick: function()
                                    {     
                                        var deleting = w2ui['formcaptiongrid'].getSelection();
                                        for (var i = 0; i < deleting.length; i++)
                                            socket.emit('forms_delete_caption', deleting[i]); 
                                    }
                            }, 
                            {type: "button", id: "fccnl", icon: "icon-delete", tooltip: "Отменить изменения", text: "", disabled: false, onClick: function()
                                    {     
                                        var changing = w2ui['formcaptiongrid'].getChanges();
                                        var captions = w2ui['formcaptiongrid'].captions;
                                        var captions_inx = w2ui['formcaptiongrid'].captions_inx;
                                        
                                        w2ui['formcaptiongrid'].save();
                                        for (var i = 0; i < changing.length; i++)
                                        {
                                            var capt = captions[captions_inx[changing[i].recid]];
                                            capt.recid = changing[i].recid;
                                            for (var key in changing[i]) if (capt[key] == undefined) capt[key] = '';
                                            w2ui['formcaptiongrid'].set(changing[i].recid, capt);           
                                        }
                                    }
                            },                             
                            {type: "button", id: 'fcsav', icon: "icon-accept", tooltip: "Сохранить изменения", text: "", disabled: true, onClick: function()
                                    {                                        
                                        var changing = w2ui['formcaptiongrid'].getChanges();
                                        for (var i = 0; i < changing.length; i++)
                                            socket.emit('forms_save_caption', changing[i]);                                        
                                    }
                            },
                            {type: 'break' }, 
                            {type: "button", id: "fcbwr", icon: "icon-undo", tooltip: "Назад", text: "", disabled: true, onClick: function()
                                    {     
                                        var changing = w2ui['formcaptiongrid'].getSelection();
                                        for (var i = 0; i < changing.length; i++)
                                            socket.emit('forms_backward_caption', changing[i]);
                                    }
                            },                              
                            {type: 'menu', id: 'fcfwd', icon: 'icon-redo', tooltip: "Вперед", disabled: true, items: []},                             
                            {type: "button", id: 'fchst', icon: "icon-history", tooltip: "История", text: "", disabled: true, onClick: function()
                                    {                                        
                                        var caption_ids = w2ui['formcaptiongrid'].getSelection();
                                        if (caption_ids.length)
                                            socket.emit('forms_get_dochistory', caption_ids[0]);                                        
                                    }
                            }
                        ]
                }, 
            onReload(event){ socket.emit('forms_get_template', formtemplate._id);},            
            columnGroups: formtemplate.groupscaption
        });
        if (w2ui['formcaptiongrid'])
        {
            w2ui['formcaptiongrid'].template = formtemplate;
            w2ui['formcaptiongrid'].toolbar.items[0].icon = "icon-refresh";
            w2ui['formcaptiongrid'].toolbar.items[0].tooltip = "Обновить";
            w2ui['formcaptiongrid'].toolbar.items[1].icon = "icon-collumns";
            w2ui['formcaptiongrid'].toolbar.items[1].tooltip = "Колонки";
            w2ui['formcaptiongrid'].refresh();
        }                  
        
        w2ui['formcaptiongrid'].on('toolbar', function(event)
        {
            if ((event.target.substring(0, 6) != "fcadd:") && (event.target.substring(0, 6) != "fcfwd:")) return;
            var newsate_id = event.target.substring(6);
            
            if (event.target.substring(0, 6) == "fcadd:")
            {                
                socket.emit('forms_insert_caption', formtemplate._id, newsate_id); 
            }

            if (event.target.substring(0, 6) == "fcfwd:")
            {
                var selected = w2ui['formcaptiongrid'].getSelection();
                if (!selected.length) return;
                if (selected.length != 1) return ShowMessage('Необходимо выбрать один документ');
                
                var captions = w2ui['formcaptiongrid'].captions;
                var captions_inx = w2ui['formcaptiongrid'].captions_inx;
                var details = w2ui['formdetailgrid'].details;
                
                var curstate = captions[captions_inx[selected[0]]].state;
                for (var i = 1; i < selected.length; i++)
                {
                    if (curstate != captions[captions_inx[selected[i]]].state) 
                        return ShowMessage('Выбраны документы в разном состоянии');
                }

                var curr_jump_rights = captions[captions_inx[selected[0]]].jumpsright;
                                            
                if (curr_jump_rights.length == 0) return ShowMessage('Нет прав ни на один переход');            
                if (curr_jump_rights.length)
                {
                    var need_eds = false;
                    var states = w2ui['formcaptiongrid'].states;
                    var states_inx = w2ui['formcaptiongrid'].states_inx;
                    var need_doc_eds = false;
                    var need_file_eds = false;
                    for (var n = 0; n < curr_jump_rights.length; n++)
                        if (String(curr_jump_rights[n].to) == String(newsate_id))
                        {
                            if (curr_jump_rights[n].settings.sign_doc) need_doc_eds = true;
                            if (curr_jump_rights[n].settings.sign_file) need_file_eds = true;
                        }
                    if (need_doc_eds || need_file_eds) need_eds = true;   

                    var docToMoveArray = [];
                    for (var i = 0; i < selected.length; i++)
                    {                        
                        var document = {};                        
                        var caption = captions[captions_inx[selected[i]]];
                        for (n = 0; n < caption.links.length; n++)
                        {
                            if (!caption.links[n].laststate)
                            {
                                var document = {};
                                document.type = 0;
                                document._id = caption.links[n].child;
                                document.curr_state = caption.state;
                                document.new_state = newsate_id;
                                document.body = {};
                                document.body.document = caption.links[n].cryptohash;  
                                document.body.move = {};
                                document.body.move.curr_state = caption.state;
                                document.body.move.curr_state_name = caption.statename;
                                document.body.move.new_state = newsate_id;
                                document.body.move.new_state_name = states[states_inx[newsate_id]].name;
                                
                                if (need_file_eds) document.signature = true; else document.signature = null;
                                docToMoveArray.push(document);              
                            }
                        }
                        document = {};
                        document.type = 1;
                        document._id = caption._id;
                        document.current_state = caption.state;
                        document.new_state = newsate_id;
                        
                        var doc = {};
                        doc.caption = caption;
                        doc.details = details;
                        
                        document.body = {};
                        document.body.move = {};
                        document.body.move.curr_state = caption.state;
                        document.body.move.curr_state_name = caption.statename;
                        document.body.move.new_state = newsate_id;
                        document.body.move.new_state_name = states[states_inx[newsate_id]].name;;
                        document.body.document = JSON.stringify(doc);

                        if (need_doc_eds) document.signature = true; else document.signature = null;
                        docToMoveArray.push(document);
                    }
                    
                    if (docToMoveArray.length)
                    {
                        w2ui['formcaptiongrid'].lock('', true);
                        function next(result)
                        {
                            if (result.arr[result.cnt].type == 1)
                            {
                                var files = [];
                                for (var n = result.from; n < result.cnt; n++) files.push(result.arr[n]);
                                socket.emit('forms_forward_caption', result.arr[result.cnt]._id, 
                                                                    result.arr[result.cnt].new_state, 
                                                                    result.arr[result.cnt],
                                                                    files);
                                result.from = result.cnt + 1;
                            }
                            result.cnt++;
                            if (result.cnt < result.arr.length)
                                SignDocuments(result, next, stop);
                                else
                                w2ui['formcaptiongrid'].unlock();  
                        }
                        function stop(error) 
                        { 
                            console.log(error); 
                            ShowMessage(error);
                            w2ui['formcaptiongrid'].unlock();  
                        } 
                        if (need_eds)   
                        {            
                            GetCertificateBySerial(w2ui['surface'].user.serial, function(certificate)
                            {
                                SignDocuments({ cnt: 0, from: 0, arr: docToMoveArray, certificate: certificate }, next, stop); 
                            }, stop);                        
                        } else SignDocuments({ cnt: 0, from: 0, arr: docToMoveArray, certificate: null }, next, stop); 
                    }
                }
            }
        });
        
        $('#formdetailgrid').w2grid(
        { 
            name: 'formdetailgrid',
            multiSelect: true,
            multiSearch: true,                 
            method: 'GET', // need this to avoid 412 error on Safari
            show:
                {
                    selectColumn: false,
                    lineNumbers: true,
                    footer: true,
                    toolbar: true
                }, 
            toolbar:{
                    items: [
                                {type: "button", id: "fdadd", icon: "icon-plus", tooltip: "Добавить", text: "", disabled: true, onClick: function()
                                        {   
                                            var caption_ids = w2ui['formcaptiongrid'].getSelection();                                     
                                            if (caption_ids.length)
                                                socket.emit('forms_insert_detail', caption_ids[0]); 
                                        }
                                    },
                                {type: "button", id: "fddel", icon: "icon-minus", tooltip: "Удалить", text: "", disabled: true, onClick: function()
                                        {     
                                            var deleting = w2ui['formdetailgrid'].getSelection();
                                            for (var i = 0; i < deleting.length; i++)
                                                socket.emit('forms_delete_detail', deleting[i]); 
                                        }
                                }, 
                                {type: "button", id: "fdcnl", icon: "icon-delete", tooltip: "Отменить изменения", text: "", disabled: false, onClick: function()
                                        {     
                                            var changing = w2ui['formdetailgrid'].getChanges();
                                            var details = w2ui['formdetailgrid'].details;
                                            var details_inx = w2ui['formdetailgrid'].details_inx;
                                            
                                            w2ui['formdetailgrid'].save();
                                            for (var i = 0; i < changing.length; i++)
                                            {
                                                var detl = details[details_inx[changing[i].recid]];
                                                detl.recid = changing[i].recid;
                                                for (var key in changing[i]) if (detl[key] == undefined) detl[key] = '';                                            
                                                w2ui['formdetailgrid'].set(changing[i].recid, detl);   
                                            }
                                        }
                                },                              
                                {type: "button", id: 'fdsav', icon: "icon-accept", tooltip: "Сохранить", text: "", disabled: true, onClick: function()
                                        {        
                                            var changing = w2ui['formdetailgrid'].getChanges();
                                            for (var i = 0; i < changing.length; i++)
                                                socket.emit('forms_save_detail', changing[i]);
                                        }
                                }                              
                            ]
                    }, 
            onReload(event)
            { 
                var caption_ids = w2ui['formcaptiongrid'].getSelection();
                if (caption_ids.length)
                    socket.emit('forms_get_details', caption_ids[0]);
            },
            columnGroups: formtemplate.groupsdetail
        });
        if (w2ui['formdetailgrid'])
        {
            w2ui['formdetailgrid'].toolbar.items[0].icon = "icon-refresh";
            w2ui['formdetailgrid'].toolbar.items[0].tooltip = "Обновить";
            w2ui['formdetailgrid'].toolbar.items[1].icon = "icon-collumns";
            w2ui['formdetailgrid'].toolbar.items[1].tooltip = "Колонки";
            w2ui['formdetailgrid'].refresh();
        } 
        if (formtemplate.fieldscaption)
        {
            w2ui['formcaptiongrid'].on('change', function(event){w2ui['formcaptiongrid'].toolbar.enable('fcsav');}); 
            w2ui['formcaptiongrid'].on('select', function(event) 
            { 
                RefreshButtonStatuses(event.recid);
                
                if (event.recid)
                {
                    w2ui['formdetailgrid'].clear();  
                    socket.emit('forms_get_details', event.recid); 
                    w2ui['formfilegrid'].clear();  
                    socket.emit('forms_get_files', event.recid);
                }
            });
            for (var i = 0; i < formtemplate.fieldscaption.length; i++)
            {
                w2ui['formcaptiongrid'].addColumn(CopyObject(formtemplate.fieldscaption[i]));
                //if (formtemplate.fieldscaption[i].hide) w2ui['formcaptiongrid'].toggleColumn(formtemplate.fieldscaption[i].field);
            }
            
            socket.emit('forms_get_captions', document.getElementById("selformid").value);  
        }
        if (formtemplate.fieldsdetail)
        {
            w2ui['formdetailgrid'].on('change', function(event){w2ui['formdetailgrid'].toolbar.enable('fdsav');}); 
            for (var i = 0; i < formtemplate.fieldsdetail.length; i++)
                w2ui['formdetailgrid'].addColumn(CopyObject(formtemplate.fieldsdetail[i])); 
            w2ui['formdetailgrid'].addColumn({ field: 'creatorname', caption: 'Автор', size: '100px' });
            w2ui['formdetailgrid'].addColumn({ field: 'datetime', caption: 'Дата', size: '100px' });                           
        }
    }     
});

socket.on('forms_get_dochistory', function(form_id, jumps)
{
    w2ui['historygrid'].datatype = 1;
    //w2ui['historygrid'].refresh();
    ShowHistory(jumps);
});

socket.on('forms_get_filehistory', function(form_id, jumps)
{    
    w2ui['historygrid'].datatype = 0;
    //w2ui['historygrid'].refresh();
    ShowHistory(jumps);
});

socket.on('form_captions', function(data)
{
    if (w2ui['formcaptiongrid'])
    {
        w2ui['formcaptiongrid'].clear();
        w2ui['formcaptiongrid'].captions = data.captions;
        w2ui['formcaptiongrid'].states = data.states;
        w2ui['formcaptiongrid'].jumps = data.jumps;
        w2ui['formcaptiongrid'].captions_inx = [];
        w2ui['formcaptiongrid'].states_inx = [];

        for(var i = 0; i < data.states.length; i++)
            w2ui['formcaptiongrid'].states_inx[data.states[i]._id] = i;

        for(var i = 0; i < data.captions.length; i++)
        {
            w2ui['formcaptiongrid'].captions_inx[data.captions[i]._id] = i;
            var obj = {};          
            obj.recid = data.captions[i]._id; 
            obj.statename = data.captions[i].statename;   
            obj.creatorname = data.captions[i].creatorname;   
            obj.datetime = data.captions[i].datetime;   
            for (var n = 0; n < data.fields.length; n++) obj[data.fields[n].field] = data.captions[i][data.fields[n].field];
            w2ui['formcaptiongrid'].add(obj); 
        }  
        RefreshInsertButton();          
    }
});

socket.on('form_details', function(data)
{
    if (w2ui['formdetailgrid'])
    {
        w2ui['formdetailgrid'].clear();
        w2ui['formdetailgrid'].details = data.details;
        w2ui['formdetailgrid'].details_inx = [];
        
        for(var i = 0; i < data.details.length; i++)
        {
            w2ui['formdetailgrid'].details_inx[data.details[i]._id] = i;
            var obj = {};          
            obj['recid'] = data.details[i]._id;  
            for (var n = 0; n < data.fields.length; n++) obj[data.fields[n].field] = data.details[i][data.fields[n].field];
            w2ui['formdetailgrid'].add(obj); 
        }           
    }
});

socket.on('forms_delete_caption', function(caption_id)
{
    if (w2ui['formcaptiongrid']) 
    {
        w2ui['formcaptiongrid'].remove(caption_id);
        var i = w2ui['formcaptiongrid'].captions_inx[caption_id];
        if (i != undefined) w2ui['formcaptiongrid'].captions[i] = undefined;
    }
});

socket.on('forms_save_caption', function(grid_caption, caption)
{
    if (w2ui['formcaptiongrid']) 
    {
        w2ui['formcaptiongrid'].save();
        w2ui['formcaptiongrid'].set(grid_caption.recid, grid_caption);
        if (caption) 
        {
            var i = w2ui['formcaptiongrid'].captions_inx[caption._id];
            if (i != undefined) 
            {
               /* if (String(w2ui['formcaptiongrid'].captions[i].state) != String(caption.state))
                {
                    w2ui['formdetailgrid'].clear();  
                    socket.emit('forms_get_details', caption._id); 
                    w2ui['formfilegrid'].clear();  
                    socket.emit('forms_get_files', caption._id);
                }*/
                w2ui['formcaptiongrid'].captions[i] = caption;
            }
            RefreshButtonStatuses(caption._id);
        }
    }
});
socket.on('forms_insert_caption', function(caption)
{
    if (w2ui['formcaptiongrid']) 
    {        
        var data = {};
        data.recid = caption._id;
        data.state = caption.state;
        data.statename = caption.statename;
        data.creator = caption.creator;
        data.creatorname = caption.creatorname;
        data.datetime = caption.datetime;
        w2ui['formcaptiongrid'].add(CopyObject(data));          
        w2ui['formcaptiongrid'].refresh();
        var i = w2ui['formcaptiongrid'].captions.length;
        w2ui['formcaptiongrid'].captions.push(CopyObject(caption));
        w2ui['formcaptiongrid'].captions_inx[caption._id] = i;
    }
});

socket.on('forms_delete_detail', function(detail_id)
{
    if (w2ui['formdetailgrid']) 
    {
        w2ui['formdetailgrid'].remove(detail_id); 
        var i = w2ui['formdetailgrid'].details_inx[detail_id];
        if (i != undefined) w2ui['formdetailgrid'].details[i] = undefined;
    }
});
socket.on('forms_save_detail', function(detail)
{
    if (w2ui['formdetailgrid']) 
    {
        w2ui['formdetailgrid'].save();
        w2ui['formdetailgrid'].set(detail.recid, detail);   
    }
});
socket.on('forms_insert_detail', function(detail)
{
    if (w2ui['formdetailgrid']) 
    {
        w2ui['formdetailgrid'].add(CopyObject(detail)); 
        w2ui['formdetailgrid'].refresh();
        var i = w2ui['formdetailgrid'].details.length;
        w2ui['formdetailgrid'].details.push(CopyObject(detail));
        w2ui['formdetailgrid'].details_inx[detail._id] = i;
    }
});

socket.on('forms_delete_file', function(form_id, links, file_id)
{
    if (w2ui['formfilegrid']) 
    {
        w2ui['formfilegrid'].remove(file_id); 
        var i = w2ui['formfilegrid'].files_inx[file_id];
        if (i != undefined) w2ui['formfilegrid'].files[i] = undefined;
    }
    if (w2ui['formcaptiongrid']) 
    {
        var captions_inx = w2ui['formcaptiongrid'].captions_inx;
        var n = captions_inx[form_id];
        w2ui['formcaptiongrid'].captions[n].links = links;
    }
});
socket.on('forms_save_file', function(file)
{
    if (w2ui['formfilegrid']) 
    {
        w2ui['formfilegrid'].save();
        w2ui['formfilegrid'].set(file.recid, file);   
    }
});

socket.on('form_files', function(files)
{
    if (w2ui['formfilegrid'])
    {
        w2ui['formfilegrid'].clear();
        w2ui['formfilegrid'].files = files;
        w2ui['formfilegrid'].files_inx = [];
        
        for(var i = 0; i < files.length; i++)
        {
            w2ui['formfilegrid'].files_inx[files[i].recid] = i;
            w2ui['formfilegrid'].add(CopyObject(files[i]));
        }           
    }
});

socket.on('manuals_filelist', function(filelist)
{
    if (w2ui['manualfilegrid'])
    {
        w2ui['manualfilegrid'].clear();
        for(var i = 0; i < filelist.length; i++)
            w2ui['manualfilegrid'].add( { recid: filelist[i]._id, filenote: filelist[i].name, filesize: filelist[i].size, filedate:  filelist[i].datetime, filename: filelist[i].file} ); 
        w2ui['manualfilegrid'].unlock();             
    }
});
