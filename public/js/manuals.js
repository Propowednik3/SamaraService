function DateToStr(date)
{
    var tdate = new Date(date);
    return tdate.getFullYear()+'.'+('0'+(tdate.getMonth()+1)).slice(-2)+'.'+('0'+tdate.getDate()).slice(-2)+
            ' '+tdate.getHours()+':'+('0'+tdate.getMinutes()).slice(-2)+':'+('0'+tdate.getSeconds()).slice(-2);
}

var socket = io.connect('', {reconnect : false});


socket.on('connect', function(message)
{     
});

socket.on('disconnect', function(message) 
{
    w2ui.grid.lock('Message', true);

    setTimeout(reconnect, 1000);
});

socket.on('join', function(newUser)
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
        //li.classList.add("list-group-item");
        li.textContent = newUser.firstname + ' ' + newUser.middlename + ' ' + newUser.lastname;
        document.getElementById("connlist").appendChild(li);
    }
});

socket.on('connlist', function(connusers)
{
    var clist = document.getElementById("connlist");
    while (clist.hasChildNodes()) clist.removeChild(clist.firstChild);
                                        
    for (var i = 0; i < connusers.length; i++)
    {
        var li = document.createElement("li");
        li.setAttribute("id", "cu_" + connusers[i].userid)
        //li.classList.add("list-group-item");
        li.textContent = connusers[i].firstname + ' ' + connusers[i].middlename + ' ' + connusers[i].lastname;
        clist.appendChild(li);
    }
});

socket.on('messlist', function(data)
{
    var mlist = document.getElementById("messlist");    
    while (mlist.hasChildNodes()) mlist.removeChild(mlist.firstChild);
                                        
    for (var i = 0; i < data.messlist.length; i++)
    {
        var li = document.createElement("li");
        //li.setAttribute("id", "cu_" + data.messlist[i].userid)
        if (data.my != data.messlist[i].creator)
        {
            li.classList.add("list-group-item"); 
            li.classList.add("list-group-item-primary"); 
        }
        else
        {
            li.classList.add("list-group-item");
            li.classList.add("list-group-item-secondary");
        }
        li.innerHTML = DateToStr(data.messlist[i].datetime) + ':  ' + data.messlist[i].firstname + ' ' + 
                                                                        data.messlist[i].middlename + ' ' + 
                                                                        data.messlist[i].lastname + 
                                                                     '<br \/>' + data.messlist[i].text;
        mlist.appendChild(li);
        if (i == (data.messlist.length - 1)) li.scrollIntoView();
    }
    
    var mbox = document.getElementById("messbox");
    mbox.disabled = false;    
});

socket.on('datelist', function(data)
{    
    var dlist = document.getElementById("SelChatDate");    
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

socket.on('chatlist', function(chatlist)
{    
    var chlist = document.getElementById("SelChatID");    
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
    socket.emit('join', {id: document.getElementById("SelChatID").value, 
                        date: document.getElementById("SelChatDate").value});
});

socket.on('message', function(message)
{
    var currdate = document.getElementById("SelChatDate").value;
    
    if ((currdate == 'all') || (currdate == 'current') || (currdate == message.datestr))
    {
        var li = document.createElement("li");
        if (message.my == 0) 
        {
            li.classList.add("list-group-item"); 
            li.classList.add("list-group-item-primary"); 
        }
        else
        {
            li.classList.add("list-group-item");
            li.classList.add("list-group-item-secondary");
        }
        li.textContent = DateToStr(message.datetime) + ':  ' + message.firstname + ' ' + message.middlename + ' ' + message.lastname + '    ' + message.text;
        document.getElementById("messlist").appendChild(li);
        li.scrollIntoView();
    }
});

socket.on('leave', function(oldUser)
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

function reconnect()
{
    socket.once('error', function() {setTimeout(reconnect, 1000); });
    //socket.socket.connect();
}
