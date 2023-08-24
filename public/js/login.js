var CAPICOM_CURRENT_USER_STORE = 2;
var CAPICOM_MY_STORE = "My";
var CADESCOM_CADES_BES = 1;
var CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
var CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
var CADESCOM_BASE64_TO_BINARY = 1;
var CADESCOM_CADES_X_LONG_TYPE_1 = 0x5d;
var CADESCOM_HASH_ALGORITHM_CP_GOST_3411 = 100;
CAPICOM_CERTIFICATE_FIND_TIME_VALID = 9;


(function( $ ) {
    // constants
    var SHOW_CLASS = 'show',
        HIDE_CLASS = 'hide',
        ACTIVE_CLASS = 'active';
    
    $( '.tabs' ).on( 'click', 'li a', function(e){
      e.preventDefault();
      var $tab = $( this ),
           href = $tab.attr( 'href' );
    
       $( '.active' ).removeClass( ACTIVE_CLASS );
       $tab.addClass( ACTIVE_CLASS );
    
       $( '.show' )
          .removeClass( SHOW_CLASS )
          .addClass( HIDE_CLASS )
          .hide();
      
        $(href)
          .removeClass( HIDE_CLASS )
          .addClass( SHOW_CLASS )
          .hide()
          .fadeIn( 550 );
    });
  })( jQuery );

var form = document.getElementById('login');
form.addEventListener('submit', function(e)
{
    e.preventDefault();   
    var el = document.getElementById('errorlabel1');
    el.innerText = "";

    var login = document.getElementById("logname");
    var pass = document.getElementById("logpass");
    //var cid = document.getElementById("logcaptid");
    //var cval = document.getElementById("logcaptval");
    
    var xmlhttp = getXmlHttp(); // Создаём объект XMLHTTP
    xmlhttp.onreadystatechange = function()
    { 
        if (xmlhttp.readyState == 4) 
        {
            if (xmlhttp.status == 200)
            {
                var res = JSON.parse(xmlhttp.responseText);      
                window.location.href = res.url;
            }
            if ((xmlhttp.status == 400) || (xmlhttp.status == 500))
            {
                var el = document.getElementById('errorlabel1');
                var res = JSON.parse(xmlhttp.responseText);                
                el.innerText = res.message;
                alert(res.message);                
                return true;
            }
        }
    };
    xmlhttp.open('POST', '/login', true); // Открываем асинхронное соединение
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded'); 
    //xmlhttp.send('cid='+ encodeURIComponent(cid.value)+'&cval='+encodeURIComponent(cval.value)+'&username='+encodeURIComponent(login.value) + '&password=' + encodeURIComponent(pass.value)); // Отправляем POST-запрос    
    xmlhttp.send('username='+encodeURIComponent(login.value) + '&password=' + encodeURIComponent(pass.value)); // Отправляем POST-запрос    
});

var form = document.getElementById('logsignform');
form.addEventListener('submit', function(e)
{ 
    e.preventDefault();    
    var e = document.getElementById("logsigns");
    var serial = e.options[e.selectedIndex].value;
    GetCertificateBySerial(serial, function(certificate)
    {
        function printerror(error)
        {
            console.log(error);
            var el = document.getElementById('errorlabel2');
            el.innerText = error; 
            alert(res.message);   
            if (res.url != '') window.location.href = res.url;
        }
        var date = new Date();
        var dateval = String(date.getTime());
        SignDocument({ type: 1, body: String(dateval), certificate: certificate }, function(result)
        {
            SendSign('/loginsign', encodeURIComponent(result));             
        }, printerror);
    }, printerror);
});

var form = document.getElementById('logreset');
form.addEventListener('submit', function(e)
{
    e.preventDefault();   
    var el = document.getElementById('errorlabel3');
    el.innerText = "";

    var email = document.getElementById("resetmail");
    var pass = document.getElementById("resetpass");
    var cid = document.getElementById("rescaptid");
    var cval = document.getElementById("rescaptval");
    
    var xmlhttp = getXmlHttp(); // Создаём объект XMLHTTP
    xmlhttp.onreadystatechange = function()
    { 
        if (xmlhttp.readyState == 4) 
        { 
            if(xmlhttp.status == 200)
            {
                var res = JSON.parse(xmlhttp.responseText);
                alert(res.message);
                window.location.href = res.url;
            }
            if ((xmlhttp.status == 400) || (xmlhttp.status == 500))
            {
                var el = document.getElementById('errorlabel3');
                var res = JSON.parse(xmlhttp.responseText);
                el.innerText = res.message;
                alert(res.message);
                return true;
            }
        }
    };
    xmlhttp.open('POST', '/loginreset', true); // Открываем асинхронное соединение
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded'); 
    xmlhttp.send('cid='+ encodeURIComponent(cid.value)+'&cval='+encodeURIComponent(cval.value)+'&email='+encodeURIComponent(email.value) + '&pass=' + encodeURIComponent(pass.value)); // Отправляем POST-запрос    
});

var form = document.getElementById('signup');
form.addEventListener('submit', function(e)
{
    e.preventDefault();   
    var el = document.getElementById('errorlabel4');
    el.innerText = "";

    var login = document.getElementById("newname");
    var pass = document.getElementById("newpass");
    var email = document.getElementById("newmail");
    var cid = document.getElementById("newcaptid");
    var cval = document.getElementById("newcaptval");
    
    var xmlhttp = getXmlHttp();
    xmlhttp.onreadystatechange = function()
    { 
        if (xmlhttp.readyState == 4) 
        {
            if (xmlhttp.status == 200)
            {
                var res = JSON.parse(xmlhttp.responseText);
                alert(res.message);        
                window.location.href = res.url;
            }
            if ((xmlhttp.status == 400) || (xmlhttp.status == 500))
            {
                var el = document.getElementById('errorlabel4');
                var res = JSON.parse(xmlhttp.responseText);                
                el.innerText = res.message;
                alert(res.message);                
                return true;
            }
        }
    };
    xmlhttp.open('POST', '/signup', true);
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded'); 
    xmlhttp.send('cid='+ encodeURIComponent(cid.value)+'&cval='+encodeURIComponent(cval.value)+'&username='+encodeURIComponent(login.value) + '&password=' + encodeURIComponent(pass.value) + '&email=' + encodeURIComponent(email.value));
});
    
function getXmlHttp() 
{
    var xmlhttp;
    try 
    {
        xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
    } 
    catch (e) 
    {
        try 
        {
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        } 
        catch (E) 
        {
            xmlhttp = false;
        }
    }
    if (!xmlhttp && typeof XMLHttpRequest!='undefined') 
    {
        xmlhttp = new XMLHttpRequest();
    }
    return xmlhttp;
}

function SendSign(action, signature)
{        
    var el = document.getElementById('errorlabel2');
    el.innerText = "";
        
    var xmlhttp = getXmlHttp(); // Создаём объект XMLHTTP
    xmlhttp.onreadystatechange = function()
    { 
        if (xmlhttp.readyState == 4) 
        { 
            if(xmlhttp.status == 200)
            {
                var res = JSON.parse(xmlhttp.responseText);
                window.location.href = res.message;
            }
            if ((xmlhttp.status == 400) || (xmlhttp.status == 500))
            {
                var el = document.getElementById('errorlabel2');
                var res = JSON.parse(xmlhttp.responseText);
                el.innerText = res.message;
                return true;
            }
        }
    };
    xmlhttp.open('POST', action, true); // Открываем асинхронное соединение
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');        
    xmlhttp.send('signature='+signature); // Отправляем POST-запрос    
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

    function b64DecodeUnicode(str) 
    {
        // Going backwards: from bytestream, to percent-encoding, to original string.
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
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
                    if (rescert) args[1](rescert); else args[2]('Not found');
                }
                catch (err)
                {
                    args[2](cadesplugin.getLastError(err));
                }
            }, certSerial, resolve, reject);        
        });
        dd.then(res, rej);
    }

    function HashCreate(gost, dataToHesh, res, rej) 
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
                    args[0]({hash: sHashValue, message: "Created hesh."});
                }
                catch (err)
                {
                    args[1]({hash: null, message: "Failed to create hesh. Error: " + cadesplugin.getLastError(err)});
                }
            }, resolve, reject);
        });
        dd.then(res, rej);
    }

    function SignDocument(params, res, rej) 
    {
        if (params.type == 1)
            dataToSign = b64EncodeUnicode(params.body);
            else dataToSign = params.body;
        var dd = new Promise(function(resolve, reject)
        {        
            cadesplugin.async_spawn(function *(args) 
            {
                try 
                {
                    var signature = null;
                    if (params.type == 1)
                    {
                        var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                        yield oSigner.propset_Certificate(args[0]);

                        var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                        yield oSignedData.propset_ContentEncoding = CADESCOM_BASE64_TO_BINARY; 
                        yield oSignedData.propset_Content(args[1]);                   
                                
                        var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES);
                        signature =  sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");
                    }
                    if (params.type == 0)
                    {
                        var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                        yield oSigner.propset_Certificate(args[0]);
                            
                        var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                        yield oHashedData.propset_Algorithm = CADESCOM_HASH_ALGORITHM_CP_GOST_3411;
                        yield oHashedData.SetHashValue(args[1]);
                            
                        var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                        yield oSignedData.propset_ContentEncoding = CADESCOM_BASE64_TO_BINARY;

                        var sSignedMessage = yield oSignedData.SignHash(oHashedData, oSigner, CADESCOM_CADES_BES);  
                        signature =  sSignedMessage.replace(new RegExp("\\r?\\n", "g"), "");               
                    }
                    args[2](signature);
                }
                catch (err)
                {
                    args[3](cadesplugin.getLastError(err));
                }
            }, params.certificate, dataToSign, resolve, reject);        
        });
        dd.then(res, rej);
    }

    function FoundCertInStore_Async(res, rej) 
    {
        var clist = document.getElementById("logsigns");
        while (clist.hasChildNodes()) clist.removeChild(clist.firstChild);

        var dd = new Promise(function(resolve, reject)
        {
            cadesplugin.async_spawn(function *(args) 
            {           
                try 
                {     
                    var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                    yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE);

                    var CertificatesObj = yield oStore.Certificates;
                    var Certificates = yield CertificatesObj.Find(CAPICOM_CERTIFICATE_FIND_TIME_VALID);
                    var certCnt = yield Certificates.Count;
                    if(certCnt==0)
                    {
                        oStore.Close();
                        args[1](true);
                    }

                    var first = 1;
                    for (var i = 1; i <= certCnt; i++) 
                    {
                        var cert = yield Certificates.Item(i);                        
                        var Serial = yield cert.SerialNumber;
                        var dateObj = new Date();
                        var ValidToDate = new Date(yield cert.ValidToDate);
                        var IsValid = yield cert.IsValid();
                        IsValid = yield IsValid.Result;
                        var HasPrivateKey = yield cert.HasPrivateKey();
                        var subjectName = yield cert.SubjectName;   
                        var secondname = GetCertInfoName(subjectName, 'SN');
                        var firstname = GetCertInfoName(subjectName, 'G');
                        

                        if ((IsValid) && (dateObj<ValidToDate) && (HasPrivateKey && IsValid))
                        {
                            var clist = document.getElementById("logsigns");
                            var opt = document.createElement("option");
                            opt.value = Serial;
                            opt.textContent = secondname + ' ' + firstname + ' ('+ ValidToDate + ')';
                            if (first) opt.selected = true;
                            clist.appendChild(opt);                            
                            
                            if (first) first = false;                                              
                        }
                    }
                    oStore.Close();
                    args[0](true);

                }
                catch (err)
                {
                    console.log(cadesplugin.getLastError(err))
                    args[1](false);
                }

            }, resolve, reject);
        });
        dd.then(res, rej);   
    }
cadesplugin.then(function () 
{
    FoundCertInStore_Async(function(){}, function(){console.log("false");});
}, function(error) { console.log(error);});
