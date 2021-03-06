
// TODO
//
//  - it is asummed that tokens are sytactically correct but it is not checked
//    I have put in catch statments to avoid crashing during parsing but this 
//    provides bad error messages + might still allow bad instructions through
//      (e.g. last token can be a NOT or first tokern can be an OR etc...)
//

// pretty print values to console log - used for debugging only.
function pConLog(...args) {
    console.log(JSON.stringify(args,null,4))
}

function dataToTable(data,tabID,fields="",linkon="",linkfunc="") {

    var flist, h,i,j,k,l ;
    pConLog(fields)

    if( data[0][0] != "cols" ) {
        console.log("ERROR: first line of data should be a 'cols' row")
        return
    }

    // setup links
    links={}
    if( linkon != "" && linkfunc != "" ) {
       linkon.split(",").forEach( function(l){ links[l]="x" } )
    }

    // make a list of columns to display in flist + collist
    if( fields=="" ) fields = data[0].join(",");
    flist=fields.split(",");
    collist=[]
    colnames=[]
    for( h=0 ; h<flist.length ; h++ ) {
        for( i=1 ; i< data[0].length ; i++ ) {
            if( data[0][i] == flist[h] ) {
                collist.push(i);
                colnames.push(flist[h])
                continue;
            }
        }
    }

    // build header
    var str = '<tr>'
    for( j=0 ; j<collist.length ; j++ ) {
        str += "<th>"+data[0][collist[j]]+"</th>";
    }
    str += "</tr>\n"

    // build body
    for ( k=1 ; k<data.length ; k++ ) {
        if( data[k][0] != "data" ) continue
        str += "<tr>"
        for( l=0 ; l< collist.length ; l++ ) {   
            if( links[colnames[l]] == null ) {
                str += "<td>"+data[k][collist[l]]+"</td>";
            } else {
                str += '<td><span class=lnk onclick="'+linkfunc+'(\''+colnames[l]+'\',this.textContent)" href=#>'+data[k][collist[l]]+"</span></td>";
            }
        }
        str += "</tr>\n"
    }

    document.getElementById(tabID).innerHTML = str;
    document.getElementById(tabID).setAttribute("data-fields",fields);
}

function filterTable(tableID,searchID) {

    var td, txtValue, hid;

    var tr = document.getElementById(tableID).getElementsByTagName("tr");
    var fields = document.getElementById(tableID).getAttribute("data-fields").split(",")
    var filter = parse( tokenize(document.getElementById(searchID).value) );
    // pConLog(filter)
    if( filter != null && filter["type"] == "error") {
        return filter["message"]
    }

    console.log("filterTable()",tableID,filter);
    
    if( filter == null ) {
        // display all rows
        for (i = 1; i < tr.length; i++) {
            tr[i].style.display = ""
        } 
    } else {
    
        // loop through each table row
        for (i = 1; i < tr.length; i++) {

            td = tr[i].getElementsByTagName("td");
            if (td.length == 0) continue; 
            
            // display only rows where a field matches the search
            var line = {}
            for (j = 0 ; j < td.length ; j++ ) {
                line[fields[j]] = td[j].textContent || td[j].innerText;
            }
            if( evaluate(line,filter) ) {
                tr[i].style.display = ""
            } else {
                tr[i].style.display = "none"
            }
        }
    }
}

function press(e,keycode,f) {
    var evt = e || window.event;
    if (evt.keyCode==keycode ) {
        f();
        return false;
    }
}


// operandize()
// This generates a operandized array out of search string to enable
// features liek AND, OR, NOT and BRACKETS for complex queries
//

// create quick lookup contants for speed

const _OPERAND_NORMAL_  = 11
const _OPERAND_QUOTE_   = 12
const _OPERAND_MATCH_   = 13
const _OPERATOR_OR_     = 21
const _OPERATOR_AND_    = 22
const _OPERATOR_NOT_    = 23
const _LEFT_PARENTH_    = 31
const _RIGHT_PARENTH_   = 32
const _EXPRESSION_      = 41

var ops_lookup = {
    "operand:normal" :_OPERAND_NORMAL_,
    "operand:quotes" :_OPERAND_QUOTE_,
    "operand:match"  :_OPERAND_MATCH_,
    "operator:and"   :_OPERATOR_AND_,  
    "operator:or"    :_OPERATOR_OR_,  
    "operator:not"   :_OPERATOR_NOT_,
    "leftp:("        :_LEFT_PARENTH_,
    "rightp:)"       :_RIGHT_PARENTH_,
}

function tokenize(str) {

    var tokens = []
    str = str.trim() 

    // define regular expressions used here
    var re_wspace = new RegExp(/ /)
    var re_quote = new RegExp(/["'\/]/)
    var re_quote_only = new RegExp(/["']/)
    var re_push_operand = new RegExp(/[()]/)
    var re_operand_end = new RegExp(/[ ()]/)
    var re_and_or_not = new RegExp(/^(?:and|or|not)$/i)

    // loop through each character of the provided string
    while ( true ) {
        
        // skip white space 
        str = str.trim()
        if( str.length == 0 ) break
        
        // capture charecters which are on their own are avalid operand e.g. brackets
        if ( str.substring(0,1) == "(" ) {
            tokens.push( { type:"leftp", style:str[0] } )
            str = str.substring(1)
            continue
        }
        if ( str.substring(0,1) == ")" ) {
            tokens.push( { type:"rightp", style:str[0] } )
            str = str.substring(1)
            continue
        }
        if ( str.substring(0,1) == "!" ) {
            tokens.push( { type:"operator", style:"not" } )
            str = str.substring(1)
            continue
        }
        if ( str.substring(0,2) == "&&" ) {
            tokens.push( { type:"operator", style:"and" } )
            str = str.substring(2)
            continue
        }        
        if ( str.substring(0,2) == "||" ) {
            tokens.push( { type:"operator", style:"or" } )
            str = str.substring(2)
            continue
        }

        // Deal with quoted strings (single or double quotes)
        if ( str[0].match(re_quote) ) {

            var style = "quotes"
            var result = ""
            var c = str[0]
            if ( c == "/" ) style="match"

            str = str.substring(1)
            while ( str.length > 0 ) {

                if( str[0] == "\\" ) {
                    var x = escaped(str)
                    result += x[0]
                    str = str.substring(x[1])
                    continue
                }

                if( str[0] == c ) {
                    str = str.substring(1)
                    tokens.push( { type:"operand", value:result, style:style })
                    c=""
                    if ( str.length>0 && ! str[0].match(re_operand_end)  ) {
                        return [ {type:"error",message:"quotes in the middle of a operand"} ]
                    }
                    break
                }

                result+=str.substring(0,1)
                str=str.substring(1)
            }

            if ( c != "" ) {
                return [ {type:"error",message:"unmatched quote"} ]
            }
            continue
        }

        // Deal with normal operands
        var result = ""
        while ( str.length>0 ) {
            if ( str[0].match(re_quote_only) ) {
                return [ {type:"error",message:"quotes in the middle of a operand"} ]               
            }           
            if ( str[0].match(re_operand_end) )  break;
            result+=str.substring(0,1)
            str=str.substring(1)
        }
        if( result.match(re_and_or_not) ) {
            tokens.push( { type:"operator", style:result.toLowerCase() } )
        } else {
            // add as a standard value operand
            tokens.push( { type:"operand", value:result, style:"normal" })
        }

    }

    // Add in implied AND statements where no operator
    var expand = []
    while ( tokens.length >= 2 ) {
        expand.push( tokens[0] )
        if ( 
            ( tokens[0]["type"]=="operand" && tokens[1]["type"]=="operand" ) || 
            ( tokens[0]["type"]=="rightp"  && tokens[1]["type"]=="operand" ) || 
            ( tokens[0]["type"]=="operand" && tokens[1]["style"]=="not" ) || 
            ( tokens[0]["type"]=="rightp"  && tokens[1]["style"]=="not" ) || 
            ( tokens[0]["type"]=="operand" && tokens[1]["type"]=="leftp" ) 
        ) {
            expand.push( { type:"operator", style:"and"} )
        }
        tokens.shift()
    }
    if( t = tokens.shift() ) expand.push(t)

    // add codes to each type
    for( n in expand ) {
        if( typeof expand[n]["code"] == "undefined" ) {
            expand[n]["code"] = ops_lookup[expand[n]["type"]+":"+expand[n]["style"]]
        }   
    }

    return expand
}

function escaped (s) {
    // needs more work - rhight now just allows escaping of single non-special chars
    if( s[0] != "\\" || s.length < 2 ) return [ "\\",1 ]
    return [s.substr(1,1),2]
}


// parse()
// operandize a seach string and then 'reverse polish' it into fast
// search structure
function parse(tokenized) {

    var a=0, b=0
    if( typeof tokenized[0] == "undefined" ) return null;

    // expand brackets
    var PARENtoken = []
    
    try {
        while( a = tokenized.pop() ) {
            if( a["code"] != _LEFT_PARENTH_) {
                PARENtoken.unshift(a)
            } else {
                var e = []
                while( b = PARENtoken.shift() ) {
                    if( b["code"] != _RIGHT_PARENTH_) {
                        e.push(b)
                    } else {
                        PARENtoken.unshift( { type:"expression", style:"parenthesis", code:_EXPRESSION_, expression:parse(e) } )
                        break
                    }
                }
            }
        }
    } catch(err) {
        console.log(err)
        return {type:"error",message:"parenthesie issue: "+err.message}
    }

    // expand NOT 
    // we scan list in reverse to allow NOT of NOT of NOT...
    var NOTtoken = []
    try {
        while ( a = PARENtoken.pop() ) {
            if( a["code"] != _OPERATOR_NOT_ ) {
                NOTtoken.unshift(a)
                continue
            }
            b = NOTtoken.shift()
            if( b["code"] == _OPERATOR_NOT_) {
                NOTtoken.unshift( b["expression"] )
            } else {
                NOTtoken.unshift( { type:"operator", style:"not", code:_OPERATOR_NOT_, expression: b } )
            }
        }
    } catch(err) {
        console.log(err)
        return {type:"error",message:"NOT operator issue: "+err.message}
    }


    // expand AND 
    var ANDtoken = []
    try {
        while ( a = NOTtoken.shift() ) {
            if( a["code"] != _OPERATOR_AND_ ) {
                ANDtoken.push(a)
                continue
            }
            b = ANDtoken.pop()
            a = NOTtoken.shift()
            if( b["code"]==_OPERATOR_AND_ ) {
                b["expressions"].push(a)
                ANDtoken.push( b )
            } else {
                ANDtoken.push( { type:"operator", style:"and", code:_OPERATOR_AND_, expressions: [b,a] } )
            }
        }
    } catch(err) {
        console.log(err)
        return {type:"error",message:"AND operator issue: "+err.message}
    }

    // expand OR 
    var ORtoken = []
    try {
        while ( a = ANDtoken.shift() ) {
            if( a["code"] != _OPERATOR_OR_ ) {
                ORtoken.push(a)
                continue
            }
            b = ORtoken.pop()
            a = ANDtoken.shift()
            if( b["code"]==_OPERATOR_OR_ ) {
                b["expressions"].push(a)
                ORtoken.push( b )
            } else {
                ORtoken.push( { type:"operator", style:"or", code:_OPERATOR_OR_, expressions: [b,a] } )
            }
        }
    } catch(err) {
        console.log(err)
        return {type:"error",message:"OR operator issue: "+err.message}
    }


    if( ORtoken.length == 0 ) return {type:"error",message:"no tokens found"}           
    if( ORtoken.length > 1  ) return {type:"error",message:"badly parsed string"}           

    return ORtoken[0]
}

// evaluate()
// compares a dictionary list with a search string in "parse()" format
function evaluate(line,filter) {

    // evaluate operator/operands/expressions
    switch( filter["code"] ) {

        //
        //   Handle "OPERANDS" ie. values to be used for matching
        // 

        case _OPERAND_NORMAL_ :
            // default match is CASE IN-SENSITIVE
            for( var n in line ){
                if( line[n].toUpperCase().indexOf(filter["value"].toUpperCase()) >= 0 ) return true
            }
            return false

        case _OPERAND_QUOTE_ :
            // quoted strings allow whiet space and is CASE SENSITIVE
            for( var n in line ){
                if( line[n].indexOf(filter["value"]) >= 0 ) return true
            }
            return false

        case _OPERAND_MATCH_ :
            // strings specified using /'s are treated like pattern matches
            for( var n in line ){
                if( line[n].indexOf(filter["value"]) >= 0 ) return true
            }
            return false
        
        //
        //   Handle "OPERATORS" e.g. and, or, not
        // 

        case _OPERATOR_AND_:
            for( var n in filter["expressions"] ){
                if( evaluate(line,filter["expressions"][n]) ) continue
                return false
            }
            return true

        case _OPERATOR_OR_:
            for( var n in filter["expressions"] ){
                if( evaluate(line,filter["expressions"][n]) ) return true
            }
            return false

        case _OPERATOR_NOT_:
            return ! evaluate(line,filter["expression"] )
    
        case _EXPRESSION_:
            return evaluate(line,filter["expression"] )
        
        default:
            console.log("evaluate() unhandled operand/operator type")
            return false
    }

    return false
}