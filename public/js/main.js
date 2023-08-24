const headHeight = 70;
const sideBarwidth = 200;
const bottomHeight = 70;
const bodyHeight = window.innerHeight - headHeight - bottomHeight - 40;            

function DateToStr(date)
{
    var tdate = new Date(date);
    return tdate.getFullYear()+'.'+('0'+(tdate.getMonth()+1)).slice(-2)+'.'+('0'+tdate.getDate()).slice(-2)+
            ' '+tdate.getHours()+':'+('0'+tdate.getMinutes()).slice(-2)+':'+('0'+tdate.getSeconds()).slice(-2);
}

function getXmlHttp() 
{
    var xmlhttp;
    try {
      xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
    } catch (e) {
    try {
      xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    } catch (E) {
      xmlhttp = false;
    }
    }
    if (!xmlhttp && typeof XMLHttpRequest!='undefined') {
      xmlhttp = new XMLHttpRequest();
    }
    return xmlhttp;
}

function upload(file) {

    var xhr = new XMLHttpRequest();
  
    // обработчик для закачки
    xhr.upload.onprogress = function(event) {
      console.log(event.loaded + ' / ' + event.total);
    }
  
    // обработчики успеха и ошибки
    // если status == 200, то это успех, иначе ошибка
    xhr.onload = xhr.onerror = function() {
      if (this.status == 200) {
        console.log("success");
      } else {
        console.log("error " + this.status);
      }
    };
  
    xhr.open("POST", "/file", true);
    xhr.send(file);  
  }

function SendFile() 
{
    var el = document.getElementById('actid');
    var form_data = new FormData(el);
    var xmlhttp = getXmlHttp(); // Создаём объект XMLHTTP
    xmlhttp.onreadystatechange = function() 
    { // Ждём ответа от сервера
      if (xmlhttp.readyState == 4) 
      { // Ответ пришёл
        if(xmlhttp.status == 200) 
        { // Сервер вернул код 200 (что хорошо)
            var res = JSON.parse(xmlhttp.responseText);
            var row = {};
            if (res) 
            {
                //row.filename = res.
                if (w2ui['formfilegrid']) 
                {
                    w2ui['formfilegrid'].add(CopyObject(res.grid));
                    w2ui['formfilegrid'].refresh();
                    var i = w2ui['formfilegrid'].files.length;
                    res.grid._id = res.grid.recid;
                    w2ui['formfilegrid'].files.push(CopyObject(res.grid));
                    w2ui['formfilegrid'].files_inx[res.grid.recid] = i;
                }
                if (w2ui['formcaptiongrid'])
                {                    
                    var captions_inx = w2ui['formcaptiongrid'].captions_inx;
                    w2ui['formcaptiongrid'].captions[captions_inx[res.link.parent]].links.push(res.link);
                }
            }
        }
      }
      if (w2ui['formfilegrid']) w2ui['formfilegrid'].unlock();
    };
    xmlhttp.open('POST', '/file', true); // Открываем асинхронное соединение
    xmlhttp.send(form_data); // Отправляем POST-запрос    
}

function AttachFile(form_id, type)
{
    var fl_form = document.createElement("FORM");
    fl_form.name='flForm';
    fl_form.method='POST';
    fl_form.action='/file';
    fl_form.append('type', type);

    var tb=document.createElement('INPUT');
    tb.id="fileinput" 
    tb.type='FILE';
    tb.name='file';
    tb.enctype="multipart/form-data"
    fl_form.appendChild(tb);
    
    tb.onchange = function () 
                        { 
                            fl_form.submit();
                            var xmlhttp = getXmlHttp(); // Создаём объект XMLHTTP
                            xmlhttp.open('POST', '', true); // Открываем асинхронное соединение
                            xmlhttp.send(fl_form); // Отправляем POST-запрос
                            xmlhttp.onreadystatechange = function() 
                            { // Ждём ответа от сервера
                                if (xmlhttp.readyState == 4) 
                                { // Ответ пришёл
                                    if(xmlhttp.status == 200) 
                                    { // Сервер вернул код 200 (что хорошо)
                                    console.log(xmlhttp.responseText); // Выводим ответ сервера
                                    }
                                } else console.log(xmlhttp.responseText);
                            };
                        };
    tb.onkeyup = function (tb){ tb.target.blur();  tb.target.focus();  }

    tb.click();

   /* <form id="actid" action="/file" method="post" enctype="multipart/form-data">\
                        <input id="fileinput" type="file" name="file" style="width:200px; display:none;"
                                            <input id="fileinput" type="file" name="file"/>\
                                            <input type="submit"/>\
                                        </form>*/
}

function workplaceClick(event)
{
    if ((w2ui.sidebar.lastselected != undefined) && (w2ui.sidebar.lastselected == event.target)) return;
    w2ui.sidebar.lastselected = event.target;
    
    w2ui['surface'].html('main',  '');
    w2ui['surface'].html('right',  '');
    
    if (event.target != 'manuals')
    {
        if (w2ui['manualdirgrid']) w2ui['manualdirgrid'].destroy();
        if (w2ui['manualfilegrid']) w2ui['manualfilegrid'].destroy();
    }

    if (event.target != 'forms')
    {
        if (w2ui['formcaptiongrid']) w2ui['formcaptiongrid'].destroy();
        if (w2ui['formdetailgrid']) w2ui['formdetailgrid'].destroy();
        if (w2ui['formfilegrid']) w2ui['formfilegrid'].destroy();
    }

    if (event.target == 'manuals')
    {
        w2ui['surface'].hide('preview');
        w2ui['surface'].show('right');
        w2ui['surface'].html('main',  '<div id="manualdirgrid" style="position: absolute; left: 0px; width: 100%; height: '+bodyHeight+'px;"></div>');
        w2ui['surface'].html('right',  '<div id="manualfilegrid" style="position: absolute; left: 0px; width: 100%; height: '+bodyHeight+'px;"></div>');
        
        $('#manualdirgrid').w2grid(
        { 
            name: 'manualdirgrid',
            multiSelect: false, 
            method: 'GET', // need this to avoid 412 error on Safari
            show:
                {
                    selectColumn: false,                    
                    lineNumbers: true
                },
            columns: [                
                { field: 'dirname', caption: 'Раздел', size: '100%' }
            ]
        }); 
        w2ui['manualdirgrid'].selectNone();
        w2ui['manualdirgrid'].on('select', function(event) { socket.emit('manuals_get_filelist', event.recid); });
        
        $('#manualfilegrid').w2grid(
            { 
                name: 'manualfilegrid',
                multiSelect: false, 
                multiSearch: false,
                method: 'GET', // need this to avoid 412 error on Safari
                show:
                    {
                        selectColumn: false,
                        lineNumbers: true,
                        footer: true
                    },
                columns: [                
                    { field: 'filenote', caption: 'Файл', size: '70%' },
                    { field: 'filesize', caption: 'Размер', size: '15%' },
                    { field: 'filedate', caption: 'Дата', size: '15%' },
                    { field: 'filename', caption: 'Файл', size: '0%' }                    
                ]
            });
        w2ui['manualfilegrid'].toggleColumn('filename');
        
        w2ui['manualfilegrid'].on('dblClick', function(event) 
        {
            var downloadLink = document.createElement("a");
            downloadLink.href = 'manuals?id='+event.recid;
            downloadLink.download = w2ui['manualfilegrid'].get(event.recid).filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);            
        });

        socket.emit('manuals_get_dirlist'); 
    }
    
    if (event.target == 'chats')
    {
        w2ui['surface'].hide('preview');
        w2ui['surface'].show('right');        
        w2ui['surface'].html('main',  '<div id="framemess">\
                                            <div class="contentchat">\
                                                <div class="selector">  \
                                                    <select disabled id="selchatid" style="width: 68%">\
                                                    </select>        \
                                                    <select disabled  id="selchatdate" style="width: 30%">\
                                                        <option selected value="current">Текущая</option>\
                                                    </select>\
                                                </div>\
                                                <div class="messages">\
                                                    <ul id="messlist">\
                                                    </ul>\
                                                </div>\
                                                <div class="message-input">\
                                                    <div class="wrap">\
                                                        <textarea id="messbox" style="resize: none;" placeholder="Напечатать сообщение..."></textarea>\
                                                </div>\
                                            </div>\
                                        </div>');
        w2ui['surface'].html('right',  '<div id="framemess">\
                                            <div id="sidepanel">\
                                                <div id="profile">\
                                                    <div class="wrap">\
                                                        <p>Подключенные:</p>\
                                                    </div>\
                                                </div>\
                                                <div id="contacts">\
                                                    <ul id="connlist">\
                                                    </ul>\
                                                </div>\
                                                <div id="bottom-bar">\
                                                    <button id="addcontact"><i class="fa fa-user-plus fa-fw" aria-hidden="true"></i> <span>Add contact</span></button>\
                                                    <button id="settings"><i class="fa fa-cog fa-fw" aria-hidden="true"></i> <span>Settings</span></button>\
                                                </div>\
                                            </div>\
                                        </div>');
        
        var el = document.getElementById("selchatid");
        el.onchange = function () { socket.emit('chat_changed');}
        el.onkeyup = function (e){ e.target.blur();  e.target.focus();  }
                                        
        var el = document.getElementById("selchatdate");
        el.onchange = function () { socket.emit('chat_changed'); }
        el.onkeyup = function (e) { e.target.blur(); e.target.focus();}
        
        document.getElementById("messbox").addEventListener('keydown', function(ev)
        {
            var key = ev.which || ev.keyCode;
            if (key === 13) 
            { 
                ev.preventDefault();
                var message = document.getElementById("messbox").value;
                document.getElementById("messbox").value = '';
                if (message != '') socket.emit('chat_message', message); 
            }                                          
        });
        socket.emit('chats_get_list');   
    }

    if (event.target == 'forms')
    {
        w2ui['surface'].hide('right');
        w2ui['surface'].hide('preview');
        w2ui['surface'].hide('right');
        
        w2ui['surface'].html('main',  '<div><select disabled id="selformid" style="width: 98%"></select></div>\
                                        <div id="formcaptiongrid" style="position: absolute; left: 0px; width: 100%; height: 92%;"></div>');
        w2ui['surface'].html('preview',  '<div class="w2ui-field" style="width: 98%;"></div>\
                                          <div id="formdetailgrid" style="position: absolute; left: 0px; width: 100%; height: 95%;"></div>');
        /*w2ui['surface'].html('bottom',  '<form id="actid" action="/file" method="post" enctype="multipart/form-data">\
                                            <input id="fileinput" type="file" name="file"/>\
                                            <input type="submit"/>\
                                        </form>\
                                        <div><input type="button" value="/file" onclick="summa(\'/file\')" /></div>\
                                        <div><input type="button" value="/filek" onclick="summa(\'/filek\')" /></div>');
                                        
                                        
                                        */
        w2ui['surface'].html('right',  '<iframe id=fileframe name="iframe1" style="display:none;"></iframe>\
                                        <form id="actid" action="/file" method="post" enctype="multipart/form-data" target="iframe1">\
                                        <input id="fileinput" type="file" name="file" style="display:none;"/>\
                                        <input id="filetype" type="text" name="type" style="display:none;"/>\
                                        <input id="fileparent" type="text" name="docid" style="display:none;"/></form>\
                                        <div id="formfilegrid" style="position: absolute; left: 0px; width: 100%; height: 95%;"></div>');        
        $('#formfilegrid').w2grid(
        { 
                name: 'formfilegrid',
                multiSelect: false, 
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
                        { field: 'statename', caption: 'Состояние', size: '150px' },
                        { field: 'filename', caption: 'Имя', size: '150px' },
                        { field: 'note', caption: 'Примечание', size: '150px', editable: { type: 'text' } },
                        { field: 'filesize', caption: 'Размер', size: '150px' },
                        { field: 'filedate', caption: 'Дата', size: '150px' },
                        { field: 'mimetype', caption: 'Тип', size: '150px' }  
                    ],                 
                toolbar:
                    {
                    items: [
                                {type: "button", id: "ffadd", icon: "icon-plus", tooltip: "Добавить", text: "", disabled: true, onClick: function()
                                        { 
                                            var caption_ids = w2ui['formcaptiongrid'].getSelection();  
                                            if (caption_ids.length)
                                            {
                                                var el = document.getElementById("filetype");
                                                el.value = 'forms';
                                                el = document.getElementById("fileparent");
                                                el.value = caption_ids[0];
                                                el = document.getElementById("fileinput");
                                                el.click(); 
                                            }                                           
                                        }
                                },
                                {type: "button", id: "ffdel", icon: "icon-minus", tooltip: "Удалить", text: "", disabled: true, onClick: function()
                                        {     
                                            var caption_ids = w2ui['formcaptiongrid'].getSelection();  
                                            if (caption_ids.length)
                                            {
                                                var deleting = w2ui['formfilegrid'].getSelection();
                                                for (var i = 0; i < deleting.length; i++)
                                                    socket.emit('forms_delete_file', caption_ids[0], deleting[i]); 
                                            }
                                        }
                                }, 
                                {type: "button", id: "ffcnl", icon: "icon-delete", tooltip: "Отменить изменения", text: "", disabled: false, onClick: function()
                                        {     
                                            var changing = w2ui['formfilegrid'].getChanges();
                                            var files = w2ui['formfilegrid'].files;
                                            var files_inx = w2ui['formfilegrid'].files_inx;
                                            
                                            w2ui['formfilegrid'].save();
                                            for (var i = 0; i < changing.length; i++)
                                            {
                                                var file = files[files_inx[changing[i].recid]];
                                                file.recid = changing[i].recid;
                                                for (var key in changing[i]) if (file[key] == undefined) file[key] = '';
                                                w2ui['formfilegrid'].set(changing[i].recid, file);   
                                            }
                                        }
                                },                              
                                {type: "button", id: 'ffsav', icon: "icon-accept", tooltip: "Сохранить", text: "", disabled: true, onClick: function()
                                        {        
                                            var caption_ids = w2ui['formcaptiongrid'].getSelection();  
                                            if (caption_ids.length) 
                                            {
                                                var changing = w2ui['formfilegrid'].getChanges();
                                                for (var i = 0; i < changing.length; i++)
                                                    socket.emit('forms_save_file', caption_ids[0], changing[i]);
                                            }
                                        }
                                },  
                                {type: 'break' },                             
                                {type: "button", id: 'ffprv', icon: "icon-preview", tooltip: "Просмотр", text: "", disabled: true, onClick: function()
                                        {        
                                            var file_ids = w2ui['formfilegrid'].getSelection();
                                            if (file_ids.length)
                                            {
                                                var downloadLink = document.createElement("a");
                                                downloadLink.href = 'file?type=forms&id='+file_ids[0];
                                                downloadLink.target = "_blank";
                                                var row = w2ui['formfilegrid'].get(file_ids[0]);
                                                downloadLink.type = row.mimetype;
                                                //downloadLink.download = row.filename;
                                                document.body.appendChild(downloadLink);
                                                downloadLink.click();
                                                document.body.removeChild(downloadLink); 
                                            }
                                        }
                                },                              
                                {type: "button", id: 'ffdwn', icon: "icon-download", tooltip: "Сохранить", text: "", disabled: true, onClick: function()
                                        {        
                                            var file_ids = w2ui['formfilegrid'].getSelection();
                                            if (file_ids.length)
                                            {
                                                var downloadLink = document.createElement("a");
                                                downloadLink.href = 'file?type=forms&id='+file_ids[0];
                                                downloadLink.target = "_blank";
                                                var row = w2ui['formfilegrid'].get(file_ids[0]);
                                                downloadLink.type = row.mimetype;
                                                downloadLink.download = row.filename;
                                                document.body.appendChild(downloadLink);
                                                downloadLink.click();
                                                document.body.removeChild(downloadLink);
                                            }
                                        }
                                },    
                                {type: 'break' },                              
                                {type: 'menu', id: 'fffwd', icon: 'icon-redo', tooltip: "Вперед", disabled: true, items: []},
                                {type: "button", id: 'ffhst', icon: "icon-history", tooltip: "История", text: "", disabled: false, onClick: function()
                                        {                                        
                                            var caption_ids = w2ui['formcaptiongrid'].getSelection();  
                                            if (caption_ids.length) 
                                            {
                                                var file_ids = w2ui['formfilegrid'].getSelection();
                                                if (file_ids.length)
                                                    socket.emit('forms_get_filehistory', caption_ids[0], file_ids[0]);
                                            }                                        
                                        }
                                }
                            ]
                    }, 
                onReload: function (event)
                { 
                    var captions_ids = w2ui['formcaptiongrid'].getSelection();
                    if (captions_ids.length) 
                        socket.emit('forms_get_files', captions_ids[0]);
                }
        });
        if (w2ui['formfilegrid'])
        {
            w2ui['formfilegrid'].toolbar.items[0].icon = "icon-refresh";
            w2ui['formfilegrid'].toolbar.items[0].tooltip = "Обновить";
            w2ui['formfilegrid'].toolbar.items[1].icon = "icon-collumns";
            w2ui['formfilegrid'].toolbar.items[1].tooltip = "Колонки";
            w2ui['formfilegrid'].refresh();
        } 
        
        w2ui['formfilegrid'].on('toolbar', function(event)
        {
            if (event.target.substring(0, 6) != "fffwd:") return;
            var newsate_id = event.target.substring(6);

            if (event.target.substring(0, 6) == "fffwd:")
            {
                var capt_selected = w2ui['formcaptiongrid'].getSelection();
                if (!capt_selected.length) return;
                if (capt_selected.length != 1) return ShowMessage('Необходимо выбрать один документ');
                var file_selected = w2ui['formfilegrid'].getSelection();
                if (!file_selected.length) return;
                if (file_selected.length != 1) return ShowMessage('Необходимо выбрать один файл');
                
                var captions = w2ui['formcaptiongrid'].captions;
                var captions_inx = w2ui['formcaptiongrid'].captions_inx;
        
                var files = w2ui['formfilegrid'].files;
                var files_inx = w2ui['formfilegrid'].files_inx;
                
                var curstate = files[files_inx[file_selected[0]]].state._id;
                for (var i = 1; i < file_selected.length; i++)
                {
                    if (curstate != files[files_inx[file_selected[i]]].state._id) 
                        return ShowMessage('Выбраны документы в разном состоянии');
                }

                var curr_jump_rights = captions[captions_inx[capt_selected[0]]].jumpsright;
                                            
                if (curr_jump_rights.length == 0) return ShowMessage('Нет прав ни на один переход');                            
                
                var states = w2ui['formcaptiongrid'].states;
                var states_inx = w2ui['formcaptiongrid'].states_inx;
                var need_file_eds = false;
                
                for (var n = 0; n < curr_jump_rights.length; n++)
                    for (var i = 0; i < curr_jump_rights[n].file_next_states.length; i++)
                            if (String(curr_jump_rights[n].file_next_states[i].state) == String(newsate_id)) 
                                need_file_eds = curr_jump_rights[n].file_next_states[i].sign_file;
                
                var docToMoveArray = [];
                var document = {};                        
                
                for (n = 0; n < file_selected.length; n++)
                {
                    file = files[files_inx[file_selected[n]]];
                    document = {};
                    document.type = 0;
                    document._id = file.recid;
                    document.curr_state = file.state;
                    document.new_state = newsate_id;
                    document.body = {};
                    document.body.document = file.cryptohash;  
                    document.body.move = {};
                    document.body.move.curr_state = file.state;
                    document.body.move.curr_state_name = file.statename;
                    document.body.move.new_state = newsate_id;
                    document.body.move.new_state_name = states[states_inx[newsate_id]].name;
                            
                    if (need_file_eds) document.signature = true; else document.signature = null;
                            docToMoveArray.push(document);                  
                }
                
                if (docToMoveArray.length)
                {
                    w2ui['formfilegrid'].lock('', true);
                    function next(result)
                    {
                        socket.emit('forms_forward_file', capt_selected[0], 
                                                                    result.arr[result.cnt].new_state, 
                                                                    result.arr[result.cnt]);                            
                        result.cnt++;
                        if (result.cnt < result.arr.length)
                            SignDocuments(result, next, stop);
                            else
                            w2ui['formfilegrid'].unlock();  
                    }
                    function stop(error) 
                    { 
                        console.log(error); 
                        if (error.message) ShowMessage(error.message);
                        if (error.error) ShowMessage(error.error);
                        w2ui['formfilegrid'].unlock();  
                    } 
                    if (need_file_eds)   
                    {                     
                        GetCertificateBySubjectName("Мустафин Азат Мансурович", function(res)
                        {
                            SignDocuments({ cnt: 0, from: 0, arr: docToMoveArray, certificate: res.certificate }, next, stop); 
                        }, stop);                        
                    } else SignDocuments({ cnt: 0, from: 0, arr: docToMoveArray, certificate: null }, next, stop);                     
                }
            }
        });

            //console.log($('#file').data('readContent', false));
        var el = document.getElementById("fileinput");
        el.onchange = function () 
        { 
            //var el = document.getElementById("actid");            
            //el.submit();
            //var el = document.getElementById("fileinput");   
             //upload(el.files[0]);
            if (w2ui['formfilegrid']) w2ui['formfilegrid'].lock();
            SendFile();
        }
        el.onkeyup = function (e){ e.target.blur();  e.target.focus();  }
        
        var el = document.getElementById("selformid");
        el.onchange = function () { socket.emit('forms_get_template', document.getElementById("selformid").value); }
        el.onkeyup = function (e){ e.target.blur();  e.target.focus();  }

        socket.emit('forms_get_list'); 
    }
}

