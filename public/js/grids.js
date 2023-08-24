
var AzModule = {};

var isCtrl = false;
var isShift = false;
var lastTableFocused = null;

document.addEventListener('keydown', function(event) 
{
	if ((event.code == 'ControlLeft') || (event.code == 'ControlRight')) isCtrl=true;
	if ((event.code == 'ShiftLeft') || (event.code == 'ShiftRight')) isShift=true;
	
	if (isCtrl && (event.code == 'KeyZ'))
	{
		var table_obj = lastTableFocused;
		if (table_obj && (table_obj.SelectedRowNum >= 0) && (table_obj.SelectedCollNum >= 0))
		{
			var table_data = table_obj.Data;
			var collums = table_obj.Settings.collums;
			var curr_row = table_obj.SelectedRowNum;
			var curr_col = table_obj.SelectedCollNum;
			var cell_sett = table_data[curr_row][collums[curr_col].Name];
            if (cell_sett && cell_sett.edit && cell_sett.changed) 
			{
				var box_id = table_obj.ID + '_editcell';
				var box_el = document.getElementById(box_id);
				if (box_el)
				{
					var par_el = box_el.parentNode;
					box_el.value = cell_sett.value;					
					cell_sett.new_value = "";
					cell_sett.changed = false;
				}
				event.preventDefault();
			}			
		}		
	}
	
	if (event.code == 'ArrowDown')
	{
		var table_obj = lastTableFocused;
		if (table_obj)
		{
			var curr_row = table_obj.SelectedRowNum;
			var table_data = table_obj.Data;
		
			curr_row++;
			if (curr_row < table_data.length) 
			{
				//event.preventDefault();
				azSetSelectedRow(table_obj, curr_row, table_obj.SelectedCollNum, isShift ? 1 : 0);
			}
			event.preventDefault();
		}		
	}
	
	if (event.code == 'ArrowUp')
	{
		var table_obj = lastTableFocused;
		if (table_obj)
		{
			var curr_row = table_obj.SelectedRowNum;
			var table_data = table_obj.Data;
		
			curr_row--;
			if (curr_row >= 0) 
			{
				//event.preventDefault();
				azSetSelectedRow(table_obj, curr_row, table_obj.SelectedCollNum, isShift ? 1 : 0);
			}
			event.preventDefault();
		}
	}
	
	if (event.code == 'ArrowLeft')
	{
		var table_obj = lastTableFocused;
		var collums = table_obj.Settings.collums;
		if (table_obj)
		{
			var curr_coll = table_obj.SelectedCollNum;
			var table_data = table_obj.Data;
		
			curr_coll--;
			if (curr_coll >= 0) 
			{
				//event.preventDefault();
				azSetSelectedRow(table_obj, table_obj.SelectedRowNum, curr_coll, isShift ? 1 : 0);
			}
			event.preventDefault();
		}		
	}
	
	if (event.code == 'ArrowRight')
	{
		var table_obj = lastTableFocused;
		var collums = table_obj.Settings.collums;
		if (table_obj)
		{
			var curr_coll = table_obj.SelectedCollNum;
			var table_data = table_obj.Data;
		
			curr_coll++;
			if (curr_coll < collums.length) 
			{
				//event.preventDefault();
				azSetSelectedRow(table_obj, table_obj.SelectedRowNum, curr_coll, isShift ? 1 : 0);
			}			
			event.preventDefault();
		}		
	}
});

document.addEventListener('keyup', function(event) 
{
    if ((event.code == 'ControlLeft') || (event.code == 'ControlRight')) isCtrl=false;
	if ((event.code == 'ShiftLeft') || (event.code == 'ShiftRight')) isShift=false;
});

function GetIdInfo(id, type)
{
    if (id.indexOf("_editcell") >= 0) return null;
    var frst = id.indexOf("_" + type + "_");
    if (frst < 0) 
    {
        console.log('Wrong cell ID: '+ id + ' in table');
        return null;
    }
    frst += 6;
    var sec = id.indexOf("_", frst);
    if (sec < 0) 
    {
        console.log('Wrong cell ID: '+ id + ' in table');
        return null;
    }
    var row = Number(id.substring(frst, sec));
    var row_id = id.substring(0, sec);
    var col = Number(id.substring(sec + 1));

    return { row_id: row_id, row: row, col: col};
}

function azCreateTableToolbar(table_obj) 
{
	var table_id = table_obj.ID;  
	var tools = table_obj.Toolbar;   
	var el_tools = document.createElement("DIV");
	el_tools.id = table_obj.ID + '_tools';
    el_tools.classList.add("grid-tools");
	
	var el_row = document.createElement("DIV");
    el_row.classList = "grid-toolbar-row";
    el_tools.appendChild(el_row);
	
	//{ Type: "button", Text: "Обновить", Action: "Refresh", Enabled: true, Icon: "icon-refresh"},
	
	for (var i = 0; i < tools.length; i++)
    {		
			var cell_id = table_id + '_tools_' + tools[i].Id;
			el_cell = document.createElement("div");
			el_cell.classList.add(tools[i].Icon);
            el_cell.id = cell_id;
			el_cell.innerText = tools[i].Text;
            el_row.appendChild(el_cell);
			
            if (tools[i].Type == "Button") 
			{
				el_cell.classList.add("grid-tool-button");
				if (typeof tools[i].Action == 'function') el_cell.addEventListener("mouseup", tools[i].Action);
				if (tools[i].Action == 'Refresh') el_cell.addEventListener("mouseup", azToolRefresh);
				if (tools[i].Action == 'Cancel') el_cell.addEventListener("mouseup", azToolCancel);
				if (tools[i].Action == 'Accept') el_cell.addEventListener("mouseup", azToolAccept);
				if (tools[i].Action == 'Insert') el_cell.addEventListener("mouseup", azToolInsert);
				if (tools[i].Action == 'Delete') el_cell.addEventListener("mouseup", azToolDelete);
			}
			
			if (tools[i].Type == "SplitButton") 
			{
				el_cell.classList.add("grid-tool-splitbutton");
				var el_add = document.createElement("div");
				el_add.classList = "grid-tool-splitaddon";
				//if (typeof tools[i].Action == 'function') el_cell.addEventListener("mouseup", tools[i].Action);
				el_add.id = cell_id + '_menu';
				el_row.appendChild(el_add);
				
				var el_menu = document.createElement("div");
				el_menu.classList = "grid-tool-splitaddmenu";
				el_add.appendChild(el_menu);
				var el_item = document.createElement("div");
				el_item.classList = "grid-tool-splitadditem";
				el_item.innerText = "Text";
				el_menu.appendChild(el_item);
				var el_item = document.createElement("div");
				el_item.classList = "grid-tool-splitadditem";
				el_item.innerText = "Text";
				el_menu.appendChild(el_item);
				var el_item = document.createElement("div");
				el_item.classList = "grid-tool-splitadditem";
				el_item.innerText = "Text";
				el_menu.appendChild(el_item);
			}			
    }
	
	return el_tools;    
}

function azCreateTableHead(table_obj) 
{
    var table_id = table_obj.ID;    
    var groups = table_obj.Settings.headgroup;
    var collums = table_obj.Settings.collums;
    var CurrentDocPosX = 0;
    var ResizingCol = -1;
    var el_head = document.createElement("DIV");
	el_head.id = table_id + '_head';
    el_head.classList.add("grid-header");

    var el_row = document.createElement("DIV");
    el_row.classList = "grid-head-row";

    el_head.appendChild(el_row);
    
    var el_cell, cell_id;
    var row = 0;
    var grp = 0;
    var curgrp = 0;
    var width = 0;
	
	for (var col = 0; ((col < collums.length) && (grp < groups.length)); col++)
    {		
        curgrp++;
        width += collums[col].Width;
        width -= 4;
        if (col == 0) width += 3;
        if (col == (collums.length - 1)) width--;

        if (groups[grp].Count <= curgrp)
        {
            width += (curgrp - 1) * 5;
			curgrp = 0;
            cell_id = table_id + '_head_' + row + '_' + col;
            el_cell = document.createElement("div");
            el_cell.classList.add("grid-head-cell");     
            el_cell.id = cell_id;
            el_cell.style.width = width + "px";
            el_cell.style.maxWidth = width + "px";
            el_cell.style.minWidth = width + "px";
			el_cell.innerText = groups[grp].Text;
            el_row.appendChild(el_cell);

            cell_id = table_id + '_size_' + row + '_' + col;
            el_cell = document.createElement("DIV");
            if (col == (collums.length - 1)) el_cell.classList.add("grid-head-resize-last"); 
                else 
					el_cell.classList.add("grid-head-resize");    
            el_cell.id = cell_id;
            el_cell.addEventListener("mousedown", onDownHeadCell);
            el_row.appendChild(el_cell);

            width = 0;
            grp++;
        }        
    }
	el_cell = document.createElement("div");
    el_cell.classList.add("grid-head-dummy");
	el_row.appendChild(el_cell);


    row++;
    
    el_row = document.createElement("DIV");
    el_row.classList.add("grid-head-row");
    el_head.appendChild(el_row);
    
    for (var col = 0; col < collums.length; col++)
    {
        width = collums[col].Width - 4;
        if (col == 0) width += 3;
        if (col == (collums.length - 1)) width--;

        cell_id = table_id + '_head_' + row + '_' + col;
        el_cell = document.createElement("DIV");
        el_cell.classList.add("grid-head-cell");    
        el_cell.id = cell_id;
        el_cell.style.width = width + "px";
        el_cell.style.maxWidth = width + "px";
        el_cell.style.minWidth = width + "px";
        el_cell.innerText = collums[col].Text;
        el_row.appendChild(el_cell);
		
        cell_id = table_id + '_size_' + row + '_' + col;
        el_cell = document.createElement("DIV");
        if (col == (collums.length - 1)) el_cell.classList.add("grid-head-resize-last"); 
            else el_cell.classList.add("grid-head-resize");    
        el_cell.id = cell_id;
        el_cell.addEventListener("mousedown", onDownHeadCell);
        el_row.appendChild(el_cell);
    }
	el_cell = document.createElement("div");
    el_cell.classList.add("grid-head-dummy");
	el_row.appendChild(el_cell);
	
    return el_head;

    function onMoveHeadCell(event)
    {
        var collums = table_obj.Settings.collums;
        
        if (ResizingCol >= 0)        
        {        
            var width = collums[ResizingCol].Width + (event.pageX - CurrentDocPosX);
            CurrentDocPosX = event.pageX;
            azSetCollumnWidth(table_obj, ResizingCol, width)
        }
    }

    function onDownHeadCell(event)
    {
        event.preventDefault();
        var e = event || window.event;
        var target = e.target || e.srcElement;

        CurrentDocPosX = event.pageX;
        
        var cell_info = GetIdInfo(target.id, "size"); 
        if (!cell_info) return;
        
        ResizingCol = cell_info.col;
        document.addEventListener("mousemove", onMoveHeadCell);
        document.addEventListener("mouseup", onUpHeadCell);
    }

    function onUpHeadCell(event)
    {
        if (ResizingCol >= 0)
        {
            document.removeEventListener("mousemove", onMoveHeadCell);
            document.removeEventListener("mouseup", onUpHeadCell); 
            ResizingCol = -1;            
        }
    }
}

function azSetCollumnWidth(table_obj, col, width)
{
    if (width < 4) width = 4;
    var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
    var groups = table_obj.Settings.headgroup;
    
    var el;

    var group_num = 0;
    var col_cnt = 0;
    var hd_width = 0;
    var i = 0;

    collums[col].Width = width;
	
    for (i = 0; i < collums.length; i++)
    {   
        col_cnt++;     
        hd_width += collums[i].Width - 5;
		if (i == 0) hd_width += 4;	
		        		
        if (groups[group_num].Count <= col_cnt)
        {
            if (i >= col)
            {
				hd_width += (col_cnt - 1) * 7;                
                break;
            }
            col_cnt = 0;
            hd_width = 0;
            group_num++;            
        }        
        if (i >= groups.length)
        {
            break;
        }
    }
	
	//if (col == (collums.length - 1)) hd_width += 8;	
	el = document.getElementById(table_id + '_head_0_' + i);
    if (el) 
    {
        el.style.width = hd_width + "px";
        el.style.minWidth = hd_width + "px";
        el.style.maxWidth = hd_width + "px";		
    }

    if (col == 0) hd_width = width - 1; else 
		if (col != (collums.length - 1)) hd_width = width - 4;
			else hd_width = width - 5;
	//if (col == (collums.length - 1)) hd_width += 8;	
	el = document.getElementById(table_id + '_head_1_' + col);
    if (el) 
    {
        el.style.width = hd_width + "px";
        el.style.minWidth = hd_width + "px";
        el.style.maxWidth = hd_width + "px";		
    }    
    
    for (var i = 0; i < table_data.length; i++)
    {
        el = document.getElementById(table_id + '_body_' + i + '_' + col);
        if (el)
        {
            el.style.width = width + "px";
            el.style.minWidth = width + "px";
            el.style.maxWidth = width + "px";			
        }
    }
	
	var tools_el = document.getElementById(table_id + '_tools');
	var head_el = document.getElementById(table_id + '_head');
	var body_el = document.getElementById(table_id + '_body');
	var footer_el = document.getElementById(table_id + '_footer');
	
	var tools_style = window.getComputedStyle(tools_el);
	var head_style = window.getComputedStyle(head_el);
	var footer_style = window.getComputedStyle(footer_el);
	
	var calc_h = Number(head_style.height.substring(0, head_style.height.length - 2));
	calc_h += Number(footer_style.height.substring(0, footer_style.height.length - 2));
	calc_h += Number(tools_style.height.substring(0, tools_style.height.length - 2));
	
	body_el.style.height = (table_obj.maxHeight - calc_h - 24) + "px";
	body_el.style.minHeight = (table_obj.maxHeight - calc_h - 24) + "px";
	body_el.style.maxHeight = (table_obj.maxHeight - calc_h - 24) + "px";
	console.log(table_obj.maxHeight + '  ' + body_el.style.maxHeight +' ' + tools_style.height +' ' + head_style.height  +' '+ footer_style.height);
}

function azCreateTableBody(table_obj) 
{
    var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
	
	var el_body = document.createElement("DIV");
	el_body.classList.add("grid-body");
	el_body.id = table_id + '_body' ;
	el_body.addEventListener("scroll", function(event) 
	{
		var el_head = document.getElementById(table_id + "_head");
		el_head.scrollTo(this.scrollLeft, el_head.scrollTop);
	});
	
    return el_body;
}

function azSetSelectedRow(table_obj, row_num, col_num, add_row)
{
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
    var table_id = table_obj.ID;
	
	
	if ((table_obj.SelectedRowNum >= 0) && (table_obj.SelectedCollNum >= 0))
	{
		var cell_id = table_id + '_body_' + table_obj.SelectedRowNum + '_' + table_obj.SelectedCollNum;
		var cell_sett = table_data[table_obj.SelectedRowNum][collums[table_obj.SelectedCollNum].Name];
		var el = document.getElementById(cell_id);
		var classname = "grid-body-cell-marked";
		if (cell_sett && cell_sett.edit) 
		{		
			if (cell_sett.changed) classname = "grid-body-cell-edited-marked";
				else classname = "grid-body-cell-edit-marked";
			var box_id = table_obj.ID + '_editcell';
			var box_el = document.getElementById(box_id);
			if (box_el)
			{
				var par_el = box_el.parentNode;
				var val = box_el.value;
				par_el.innerHTML = val;
				var cell_sett = table_data[table_obj.SelectedRowNum][collums[table_obj.SelectedCollNum].Name];
				if (val != cell_sett.value) 
				{
					cell_sett.new_value = val;
					cell_sett.changed = true;
					classname = "grid-body-cell-edited-marked";
				} else cell_sett.changed = false;
			}
		}
		el.className = classname;		
	}
			
    var isNewRow;
    var SelRowNum = table_obj.SelectedRows.indexOf(row_num);
    if (SelRowNum < 0) isNewRow = true; else isNewRow = false;
    if (add_row)
    {
        if (isNewRow) 
        {            
            table_obj.SelectedRows.push(row_num);
            table_obj.SelectedRowsCount++;
            for (var i = 0; i < collums.length; i++) 
            {
                var cell_id = table_id + '_body_' + row_num + '_' + i;
                var cell_sett = table_data[row_num][collums[i].Name];
                var el = document.getElementById(cell_id);
                if (cell_sett && cell_sett.edit) 
				{
					if (i == col_num) el.className = "grid-body-cell-edit-selected"
						else 
						{
							if (cell_sett.changed) el.className = "grid-body-cell-edited-marked";
								else el.className = "grid-body-cell-edit-marked"
						}
				}
                else 
				{
					if (i == col_num) el.className = "grid-body-cell-selected"
						else el.className = "grid-body-cell-marked";		
				}
            };			
			
			if (col_num >= 0)
			{
				var cell_id = table_id + '_body_' + row_num + '_' + col_num;
				var cell_sett = table_data[row_num][collums[col_num].Name];
				var el = document.getElementById(cell_id);
				if (cell_sett && (cell_sett.edit)) el.className = "grid-body-cell-edit-selected"
					else el.className = "grid-body-cell-selected";
			}
        }
        else
        {
			if ((add_row != 1) && (table_obj.SelectedRowsCount > 1))
			{
				table_obj.SelectedRowsCount--;
				table_obj.SelectedRows[SelRowNum] = -1;
				for (var i = 0; i < collums.length; i++) 
				{
					var cell_id = table_id + '_body_' + row_num + '_' + i;
					var cell_sett = table_data[row_num][collums[i].Name];
					var el = document.getElementById(cell_id);
					if (cell_sett && cell_sett.edit) 
					{
						if (cell_sett.changed) el.className = "grid-body-cell-edited"
							else el.className = "grid-body-cell-edit"
					}
					else el.className = "grid-body-cell";
				};
				for (var i = table_obj.SelectedRows.length - 1; i >= 0; i--)
				{
					if (table_obj.SelectedRows[i] != -1)
					{
						row_num = table_obj.SelectedRows[i];
						break;
					}
				}
			}
        }
    }
    else 
    {
        for (var i = 0; i < table_obj.SelectedRows.length; i++)
        {            
            if ((table_obj.SelectedRows[i] != -1) && (row_num != table_obj.SelectedRows[i]))
            {
                for (var n = 0; n < collums.length; n++) 
                {
                    var cell_id = table_id + '_body_' + table_obj.SelectedRows[i] + '_' + n;
                    var cell_sett = table_data[table_obj.SelectedRows[i]][collums[n].Name];
                    var el = document.getElementById(cell_id);
                    if (cell_sett && cell_sett.edit) 
					{
						if (cell_sett.changed) el.className = "grid-body-cell-edited";
							else el.className = "grid-body-cell-edit";
					}
                    else el.className = "grid-body-cell";
                }; 
            }
        }
				
        table_obj.SelectedRows = [];
        table_obj.SelectedRows.push(row_num);
        table_obj.SelectedRowsCount = 1;        
             
        if (isNewRow)
        {
            for (var n = 0; n < collums.length; n++) 
            {
                var cell_id = table_id + '_body_' + row_num + '_' + n;
                var cell_sett = table_data[row_num][collums[n].Name];
                var el = document.getElementById(cell_id);
                if (cell_sett && cell_sett.edit) 
				{
					if (n == col_num) el.className = "grid-body-cell-edit-selected"
						else el.className = "grid-body-cell-edit-marked"
				}
                else 
				{
					if (n == col_num) el.className = "grid-body-cell-selected"
						else el.className = "grid-body-cell-marked";					
				}
            };
        }
    }
        
    if (col_num >= 0)
    {
        if (((!add_row) && (!isNewRow)) || (table_obj.SelectedRowNum != row_num) || (table_obj.SelectedCollNum != col_num))
        {			
            azDestroyEditBox(table_obj);			
            if ((!add_row) && (table_data[row_num].edit) && (collums[col_num].edit))
            {
                var cell_sett = table_data[row_num][collums[col_num].Name];
                if (cell_sett && cell_sett.edit) azCreateEditBox(table_obj, { row: row_num, col: col_num});                
            }            
        }
		var cell_id = table_id + '_body_' + row_num + '_' + col_num;
		var cell_sett = table_data[row_num][collums[col_num].Name];
		var el = document.getElementById(cell_id);
		if (cell_sett && cell_sett.edit) el.className = "grid-body-cell-edit-selected"
			else el.className = "grid-body-cell-selected";
        table_obj.SelectedCellName = collums[col_num].Name;
    } else table_obj.SelectedCellName = "";

	table_obj.SelectedCollNum = col_num;
    table_obj.SelectedRowNum = row_num;
	scrollIntoViewIfOutOfView(table_obj);
}

function scrollIntoViewIfOutOfView(table_obj) 
{
	var cell_id = table_obj.ID + '_body_' + table_obj.SelectedRowNum + '_' + table_obj.SelectedCollNum;
	var cell_el = document.getElementById(cell_id);
	if (!cell_el) return;
	
	var row_el = cell_el.parentElement
	var body_el = row_el.parentElement;	
	var view_el = body_el.parentElement;
	
	var view_rect = view_el.getBoundingClientRect();
	var body_rect = body_el.getBoundingClientRect();
	var cell_rect = cell_el.getBoundingClientRect();
	
	if ((cell_rect.bottom + 10) > view_rect.bottom) return body_el.scrollBy(0, cell_rect.bottom - view_rect.bottom + 10);
	if (cell_rect.top < body_rect.top) return body_el.scrollBy(0, cell_rect.top - body_rect.top);
	if ((cell_rect.right + 10) > view_rect.right) return body_el.scrollBy(cell_rect.right - view_rect.right + 10, 0);
	if (cell_rect.left < body_rect.left) return body_el.scrollBy(cell_rect.left - body_rect.left, 0);
}

function azDestroyEditBox(table_obj)
{
    var box_id = table_obj.ID + '_editcell';
    var el = document.getElementById(box_id);
    if (!el) return;
    var par_el = el.parentNode;
    var val = el.value;
    el.remove();
    par_el.innerHTML = val;
	table_obj.SelectedCellEdit = false;
}

function azCreateEditBox(table_obj, cell_info)
{
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
    var table_id = table_obj.ID;

    var cell_id = table_id + '_body_' + cell_info.row + '_' + cell_info.col;
    var cell_el = document.getElementById(cell_id);
    if (!cell_el) return console.log("Error get element for edit");
    var cell_w = cell_el.style.width;
    var cell_h = cell_el.style.height
    var cell_val = cell_el.innerHTML;
    
    var edit_id = table_id + '_editcell';
    var edit_el = document.createElement("TEXTAREA");
    edit_el.className = "grid-body-cell-change";
    edit_el.style.width = cell_w;
    edit_el.style.minWidth = cell_w;
    edit_el.style.maxWidth = cell_w;
    edit_el.style.height = "5px";
    edit_el.setAttribute("id", edit_id);
    edit_el.style.overflow = "hidden";
    edit_el.style.resize = "none";
    //edit_el.setAttribute("onkeyup", "this.style.height = \"5px\"; this.style.height = (this.scrollHeight)+\"px\";");
    edit_el.innerHTML = cell_val;  
    cell_el.innerHTML = "";
    cell_el.appendChild(edit_el);
    autosize(edit_el);
    edit_el.focus();
	table_obj.SelectedCellEdit = true;

    return;
}

function azCreateTableFooter(table_obj) 
{
    var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
    
    var el_footer = document.createElement("DIV");
	el_footer.id = table_id + '_footer';
    el_footer.classList.add("grid-footer");

    var el_row = document.createElement("DIV");
    el_row.classList.add("grid-footer-row");
    el_row.setAttribute("style", "height:20px; max-height:20px; min-height:20px;");
    el_footer.appendChild(el_row);

    return el_footer;
}

function azCreateTable(tableparent, tableid, settings) 
{
    var toolbar_setts = [{ Id: "RefrBtn", Type: "Button", Text: "", Tip: "Обновить", Action: "Refresh", Enabled: true, Icon: "icon-refresh" },
									{ Id: "CnclBtn", Type: "Button", Text: "Отменить", Action: "Cancel", Enabled: true, Icon: "icon-undo" },
									{ Id: "DelBtn", Type: "SplitButton", Text: "", Action: "Delete", Enabled: true, Icon: "icon-delete" }];
	var data = [{ "edit": true, "recid": "id1", "Name": { value: "Мустафин", edit: true }, "Family": { value: "Азат" }, "OldName": { value: "Мансурович" }, "Position": { value: "Консультант" }},
                { "edit": true, "recid": "id2", "Name": { value: "Диденко", edit: true }, "Family": { value: "Сергей", edit: true }, "OldName": { value: "Александрович" }, "Position": { value: "Министр" }},
                { "edit": true, "recid": "id3", "Name": { value: "Диденко", edit: true }, "Family": { value: "Сергей" }, "OldName": { name: "Александрович"}, "Position": { value: "Министр" }},
                { "edit": true, "recid": "id4", "Name": { value: "Диденко" }, "Family": { value: "Сергей" }, "OldName": { value: "Александрович", edit: true }, "Position": { value: "Министр" }},
                {"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},
                {"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},{"Name":{}},
                { "edit": true, "recid": "id5", "Name": { value: "Диденко" }, "Family": { value: "Сергей" }, "OldName": { value: "Александрович" }, "Position": { value: "Министр"} }];    
    var table_setts = { headgroup: [ { Count: 1, Text: ""},
								{ Count: 2, Text: "Шапка"},
								{ Count: 1, Text: ""}],
                        collums:   [{ Name: "Name", Text: "Имя", Width: 100, edit: true }, 
                                    { Name: "Family",  Text: "Фамилия", Width: 200, edit: true }, 
                                    { Name: "OldName",  Text: "Отчество", Width: 100, edit: true },
                                    { Name: "Position",  Text: "Должность", Width: 100, edit: true }] };
    
	var table_obj = {};
    table_obj.Data = data;
    table_obj.Toolbar = toolbar_setts;
    table_obj.Settings = table_setts;
    table_obj.ID = tableid;
	table_obj.parentID = tableparent;
    table_obj.SelectedRows = []; 
    table_obj.SelectedRowsCount = 0; 
    table_obj.SelectedCellEdit = false;
    table_obj.SelectedCellId = null;
    table_obj.SelectedRowNum == -1;
    table_obj.SelectedCollNum == -1;
	
	AzModule[tableid] = table_obj;
	
    
    var parent = document.getElementById(tableparent);
    //parent.style.width = settings.Width;
    //parent.style.minWidth = settings.Width;
	table_obj.maxWidth = Number(settings.Width);
    parent.style.maxWidth = settings.Width + "px";
    //parent.style.height = settings.Height;
    //parent.style.minHeight = settings.Height;
    table_obj.maxHeight = Number(settings.Height);
    parent.style.maxHeight = settings.Height + "px";    
    parent.classList.add("grid-parent");
    
    var tablebase = document.createElement("DIV");
    tablebase.id = tableid;
    tablebase.className = "grid-tablebase";
    parent.appendChild(tablebase);
	var bodybase = document.createElement("DIV");	
    bodybase.id =  tableid + '_main';
	bodybase.className = "grid-bodybase";
	
    var toolbar = azCreateTableToolbar(table_obj);    
    var head = azCreateTableHead(table_obj);    
    var grid = azCreateTableBody(table_obj);    
    var footer = azCreateTableFooter(table_obj);
    
	bodybase.style.width = (settings.Width - 16) + "px";    
	bodybase.style.minWidth = (settings.Width - 16) + "px";    
	bodybase.style.maxWidth = (settings.Width - 16) + "px";    
	//head.style.width = "100%"; 
	//grid.style.width = "100%"; 
    
	tablebase.appendChild(toolbar);
	tablebase.appendChild(bodybase);  
	bodybase.appendChild(head); 
	bodybase.appendChild(grid); 
	tablebase.appendChild(footer);
	
	var tools_style = window.getComputedStyle(toolbar);
	var head_style = window.getComputedStyle(head);
	var footer_style = window.getComputedStyle(footer);
	
	var calc_h = Number(head_style.height.substring(0, head_style.height.length - 2));
	calc_h += Number(footer_style.height.substring(0, footer_style.height.length - 2));
	calc_h += Number(tools_style.height.substring(0, tools_style.height.length - 2));
	table_obj.GridHeight = (table_obj.maxHeight - calc_h - 24) + "px";
	
	grid.style.height = table_obj.GridHeight;
	grid.style.minHeight = table_obj.GridHeight;
	grid.style.maxHeight = table_obj.GridHeight;
	azLoadDataInGrid(table_obj);
	
    if (table_obj.Data.length) azSetSelectedRow(table_obj, 0, -1, 0);
}

function azLoadDataInGrid(table_obj)
{
	var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
	
	var el_cell, cell_id, row_width;
	var el_body = document.getElementById(table_id + '_body');
	if (!el_body) return;
    
    for (var row = 0; row < table_data.length; row++)
    {
		row_width = 0;
        var el_row = document.createElement("DIV");
        el_row.id = table_id + '_body_' + row;  
        el_row.classList.add("grid-body-row");
        el_body.appendChild(el_row);
        
        for (var col = 0; col < collums.length; col++)
        {
            var cell_sett = table_data[row][collums[col].Name];           
            
            cell_id = table_id + '_body_' + row + '_' + col;
            el_cell = document.createElement("DIV");            
            if (cell_sett)
            {
                if (cell_sett.edit) el_cell.classList.add("grid-body-cell-edit"); else el_cell.classList.add("grid-body-cell");
                if (cell_sett.value) el_cell.innerText = cell_sett.value; 
                else
                {
                    el_cell.style.height = "20px";
                    el_cell.style.maxHeight = "20px";
                    el_cell.style.minHeight = "20px";
                }
            } else el_cell.classList.add("grid-body-cell");
            el_cell.style.width = collums[col].Width + "px";
            el_cell.style.maxWidth = collums[col].Width + "px";
            el_cell.style.minWidth = collums[col].Width + "px";        
            el_cell.id = cell_id; 
			row_width += collums[col].Width;

            el_cell.addEventListener("mousedown", onClickBodyCell);
            			
			el_row.style.width = row_width + "px";
            el_row.appendChild(el_cell);
        }        
    }  

    function onClickBodyCell(event)
    {        
        var e = event || window.event;
        var target = e.target || e.srcElement;
        var target_id = target.id;

        var table_data = table_obj.Data;

        var new_cell_info = GetIdInfo(target_id, "body"); 
        if (!new_cell_info) return;
        
        if (table_data.length <= new_cell_info.row) return console.log('Wrong row in cell ID: '+ id + ' in table: ' + table_obj.ID);     

		lastTableFocused = table_obj;
        
		if ((new_cell_info.row == table_obj.SelectedRowNum) && (new_cell_info.col == table_obj.SelectedCollNum) 
			&& !isCtrl && table_obj.SelectedCellEdit) return event.preventDefault();
		
        azSetSelectedRow(table_obj, new_cell_info.row, new_cell_info.col, isCtrl ? 2 : 0);
    }
}

function azRefreshData(table_obj, select_row_num)
{
	var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
	
    var bodybase = document.getElementById(table_id + '_main');	    
	var body = document.getElementById(table_id + '_body');	
	
    body.remove();
	body = azCreateTableBody(table_obj);
	bodybase.appendChild(body); 
	
	body.style.height = table_obj.GridHeight;
	body.style.minHeight = table_obj.GridHeight;
	body.style.maxHeight = table_obj.GridHeight;
	
	azLoadDataInGrid(table_obj);
	
    if (table_obj.Data.length) azSetSelectedRow(table_obj, select_row_num, -1, 0);
}

function azDeleteRow(table_obj)
{
    var table_data = table_obj.Data;
	
	if (table_obj.SelectedRowNum < 0) return 0;
	table_data[table_obj.SelectedRowNum] = null;
	
	azRefreshData(table_obj);
}
        
function azInsertRow(table_obj, after_num) 
{
    var table_id = table_obj.ID;
    var collums = table_obj.Settings.collums;
    var table_data = table_obj.Data;
	
	if (after_num == -1) after_num = table_data.length - 1;
}

function azToolRefresh(event)
{
	console.log('azToolRefresh');
	event.preventDefault();
}

function azToolCancel(event)
{
	console.log('azToolCancel');
	event.preventDefault();
}

function azToolAccept(event)
{
	console.log('azToolAccept');
	event.preventDefault();
}

function azToolInsert(event)
{
	console.log('azToolInsert');
	event.preventDefault();
}

function azToolDelete(event)
{
	event.preventDefault();
	var target_id = event.target.id;
	var table_id = target_id.substring(0, target_id.indexOf("_"));
	
	if (!AzModule[table_id]) return console.log("Wrong ID table: " + table_id);
	azDeleteRow(AzModule[table_id]);
}






