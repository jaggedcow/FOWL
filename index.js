var $ = require('cheerio');
var crypto = require('crypto');
var async = require('async');
var fs = require('fs');
var http = require("http");
var request = require('request');
var http = require("http");
var https = require("https");
var url = require("url");
var qs = require('querystring');
var Cookies = require('cookies');
var df = require('dateformat');
var Set = require('set') 

var config = require('./config.json');

function replaceAll (find, replace, str) {
  var find = find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(find, 'g'), replace);
}

function processRequest(req, module, response, pathname, session, cookiejar) {
    if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;
            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            var post = qs.parse(body);
            var auth = "Basic " + new Buffer(post['eid'] + ":" + post['pw']).toString("base64");
            
			module.post({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {"Authorization": auth, 'Cookie': userInfo[session]?userInfo[session]['cookie']:''}, form:post}, function(err, resp, html) {          	
				if (!err) {
					cookiejar.set('eid', post['eid']);
					cookiejar.set('pw', post['pw']);
				}
				processDashboard(html, module, session, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();	
					delete userInfo[session]	// logs out user											
				});		
			});	            
        });
    } else {
		module({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {'Cookie': userInfo[session]?userInfo[session]['cookie']:''}}, function(err, resp, html) {          
			if (pathname.match('/')) {
				processDashboard(html, module, session, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();	
					delete userInfo[session]	// logs out user											
				});	
			} else {
				response.writeHead(200, {"Content-Type": "text/html"});  		
				response.write(cleanHTML(html));		
				response.end();	
			}
		});	    
    }
}


function cleanHTML(html) {
	return _cleanHTML($.load(html), html);
}

function _cleanHTML(parsedHTML, temp, ignoredURLs) {
	if (!ignoredURLs)	// prevents having to check for existence, but not used
		ignoredURLs = new Set();
		
	var replaceSet = new Set();
	var redirectSet = new Set();
	var downgradeSet = new Set();

	parsedHTML('img').map(function(i, img) {
		var href = $(img).attr('src')
		if (href.lastIndexOf('http://owl.uwo.ca', 0) !== 0 && href.lastIndexOf('https://owl.uwo.ca', 0) !== 0)		
			replaceSet.add(href);		
	})
	parsedHTML('link').map(function(i, img) {
		var href = $(img).attr('href')
		replaceSet.add(href);
	})		
	parsedHTML('script').map(function(i, img) {
		var href = $(img).attr('src')
		replaceSet.add(href);
	})			
	
	parsedHTML('a').map(function(i, img) {
		var href = $(img).attr('href')
		if (!ignoredURLs.contains(href))
			replaceSet.add(href);
	})	
	parsedHTML('form').map(function(i, img) {
		var href = $(img).attr('action')
		redirectSet.add(href);
	})			
	
	parsedHTML('frame').map(function(i, img) {
		var href = $(img).attr('src')		
		if (href.lastIndexOf('https://owl.uwo.ca', 0) === 0)
			downgradeSet.add(href);
	})			
	
		
	replaceSet.get().forEach(function(href) {
		if (href.lastIndexOf('/', 0) === 0)
			temp = replaceAll(''+href,'http://owl.uwo.ca'+href, temp);	
	});
	redirectSet.get().forEach(function(href) {
		if (href.lastIndexOf('http://owl.uwo.ca', 0) === 0)
			temp = replaceAll(''+href,''+href.substring(17), temp);	
		else if (href.lastIndexOf('https://owl.uwo.ca', 0) === 0)
			temp = replaceAll(''+href,''+href.substring(18), temp);	
	});	
	downgradeSet.get().forEach(function(href) {
		temp = replaceAll('https://owl.uwo.ca'+href.substring(18),'http://owl.uwo.ca'+href.substring(18), temp);	
	});	
	
	temp = replaceAll('http://owl.uwo.ca', 'https://owl.uwo.ca', temp);
	temp = replaceAll('OWL', 'FOWL', temp);
	temp = replaceAll('Welcome to FOWL', 'Welcome to Fake OWL', temp);	
	temp = replaceAll("window.location='https://owl.uwo.ca/portal'", "window.location='/portal'", temp);
	temp = replaceAll('<a href="https://owl.uwo.ca/portal">','<a href="/portal">',temp)		// requires full tag to prevent removing other portal links
	temp = replaceAll('href="https://owl.uwo.ca/portal/logout"','href="/portal/logout"',temp)	
	temp = replaceAll('<meta http-equiv="Refresh" content="0:URL=https://owl.uwo.ca/portal">','<meta http-equiv="Refresh" content="0:URL=/portal">',temp)
	
	return replaceClasses(temp);
}

function replaceClasses(temp) {
	temp = temp.replace(/MEDICINE 5115 001 FW16/g, 'ITM + PCCIA');
	temp = temp.replace(/MEDICINE 5151 001 FW16/g, 'Social Medicine');
	temp = temp.replace(/MEDICINE 5140 001 FW16/g, 'Professional Portfolio');
	temp = temp.replace(/MEDICINE 5139 001 FW16/g, 'PCCM');		
	temp = temp.replace(/MEDICINE 5250 001 FW16/g, 'Professional Identity');		
	temp = temp.replace(/MEDICINE 5246 001 FW16/g, 'PCCM 2');		
	temp = temp.replace(/MEDICINE 5203 001 FW16/g, 'Digestion');						
	
	return temp
}

function processLogin(html) {
	return _cleanHTML($.load(html), html);
}

// grabs the dashboard info for a given class page
function processPage(href, module, course, session, callback) {
	href = href.replace('https','http');
	module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
		if (err)
			callback(err, null);
		else {
			processPageSidebar(html, module, course, session, callback);
		}
	});	 	
}

// grabs the sidebar links from a page and picks out the relevant parts for a dashboard
function processPageSidebar(html, module, course, session, callback) {
	var options = ['PCCIA', 'Homework', 'Assignments', 'Lecture'];
	var blacklist = new Set(['Assignments Course Map']);
	
	var temp = {}
	var itemp = {}	// stores value:key compared to temp's key:value
	
	var parsedHTML = $.load(html);    
	var output = [];
	
	parsedHTML('a.toolMenuLink').map(function(i, a) {
		var title = $(a).children('.menuTitle').text();
		var href = $(a).attr('href');		
		
		for (var i = 0; i < options.length; i++) {
			if (title.indexOf(options[i]) !== -1 && !blacklist.contains(title)) {
				temp[options[i]] = href;
				itemp[href] = options[i];				
				break;
			}
		}
	})   
	
	// used to sort output
	for (var i = 0; i < options.length; i++) {
		output.push(temp[options[i]]);
	}
	
	async.map(output, function(site, _callback) {
		processPageInner(site, module, itemp[site], course, session, _callback);
	}, callback);
}

// finds the frame holding the homework or assignments list and grabs the table
function processPageInner(href, module, pageType, course, session, callback) {
	if (!href) {
		callback(null, undefined);
		return;
	}

	href = href.replace('https','http');	
	
	async.waterfall([
		function(_callback) {
			module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
				if (err) {
					console.log(err);
					_callback(err, null);
				} else {
					var parsedHTML = $.load(html);
					
					parsedHTML('iframe').map(function(i, frame) {
						var src = $(frame).attr('src');
						
						_callback(err, src);
					});
				}
			})			
		},
		function(src, _callback) {
			module({followAllRedirects: true, url: src, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
				if (err) {
					console.log(err);
					_callback(err, null);
				} else {
					var parsedHTML = $.load(html);
					var homework = [];
					
					// for ITM ILs, which are split up over multiple weeks
					parsedHTML('.itemlink').each(function(i, link) {
						var href = $(link).attr('href');
						
						homework.push(href);
					});
					
					if (homework.length === 0) {
						if (pageType.match('Lecture')) {
							console.log("NO LECTURE")
							_callback(err, undefined)						
						} else {
							var out = parsedHTML('table');
							
							if (out.length > 0)
								_callback(err, processPageTableSync(out, pageType, course))
							else {
								console.log("NO HOMEWORK")								
								_callback(err, undefined)
// 									fail = true;
							}
						}
					} else {
						async.map(homework, function(href, __callback) {	
							module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
								if (err)
									__callback(err, null);
								else {
									var parsedHTML = $.load(html);	
									if (pageType.match('Lecture')) {
										__callback(err, processPageLectureSync(parsedHTML, course, href))						
									} else {									
										var out = parsedHTML('table');
										
										__callback(err, processPageTableSync(out, pageType, course))
									}
								}
							});						
						}, _callback);
					}
				}
			})	
		}
	], callback)
}

function processPageLectureSync(parsedHTML, course, href) {
	var output = [];
	var lastDate = []
	var lastDateStr;

	parsedHTML('table').each(function(i, table) {
		
		$.load(table)('td, th').each(function(j, col) {
			var text = $(col).text().trim();
			if (text.search(/^(\w{3,5} +\d{1,2})/) !== -1) {
					// deal with lectures!!
				if (text.search(/^(\w{3,5} +\d{1,2} +& +\d{1,2})/) !== -1) {
					// dealing with multiple dates
					var dateStr1 = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					var dateStr2 = text.match(/^(\w{3,5})/)[0]+' '+text.match(/(& +\d{1,2})/)[0].substring(1).trim()+' '+new Date().getFullYear()+' UTC';			

					var date1 = new Date(dateStr1);
					var date2 = new Date(dateStr2);					
					
					date1 = addDays(date1, +0.95)
					date2 = addDays(date2, +0.95)					
					changeYearIfNeeded(date1);
					changeYearIfNeeded(date2);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';

					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})					
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					var date = new Date(dateStr);
					
					date = addDays(date, +0.95)
					changeYearIfNeeded(date);	
					
					lastDate = date.toString()
					lastDateStr = dateStr;
					
					output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
				}
			} else {
				var keep = false;
				var text = $(col).find('a').each(function(i, a) {
					if ($(a).text().trim().indexOf("Objective") !== -1 || $(a).text().trim().indexOf("Slide") !== -1)
						keep = true;
				});
				
				if (keep) {
					if (isArray(lastDate)) {
						output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
						output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					} else {
						output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					}
				}
			}
		});
	});
	
	parsedHTML('div.textbox').each(function(i, table) {
		// removes duplicates
		if ($(table).find('table').length > 0)
			return;
		
		$.load(table)('p').each(function(j, col) {
			var text = $(col).text().trim();
			if (text.search(/^(\w{3,5} +\d{1,2})/) !== -1) {
					// deal with lectures!!
				if (text.search(/^(\w{3,5} +\d{1,2} +& +\d{1,2})/) !== -1) {
					// dealing with multiple dates
					var dateStr1 = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					var dateStr2 = text.match(/^(\w{3,5})/)[0]+' '+text.match(/(& +\d{1,2})/)[0].substring(1).trim()+' '+new Date().getFullYear()+' UTC';			

					var date1 = new Date(dateStr1);
					var date2 = new Date(dateStr2);					
					
					date1 = addDays(date1, +0.95)
					date2 = addDays(date2, +0.95)					
					changeYearIfNeeded(date1);
					changeYearIfNeeded(date2);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					var date = new Date(dateStr);
					
					date = addDays(date, +0.95)
					changeYearIfNeeded(date);	
					
					lastDate = date.toString()
					lastDateStr = dateStr;
					
					output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
				}
			} else {
				var keep = false;
				var text = $(col).find('a').each(function(i, a) {
					if ($(a).text().trim().indexOf("Objective") !== -1 || $(a).text().trim().indexOf("Slide") !== -1)
						keep = true;
				});
				
				if (keep) {
					if (isArray(lastDate)) {
						output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
						output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					} else {
						output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, dateProcessed:true}, 'course':course})
					}
				}
			}
		});
	});
	
	return output;
}

// converts a table containing homework or assignment info and converts it to JSON
function processPageTableSync(input, type, course) {
	var startRow = -1;
	var week, topic, objectives, resources, date, module, lecturer		// keeps track of which columns are which data
	
	var parsedHTML = $.load(input.html());
	var firstDate		// keeps track of when each block starts (to replace 'prior to Week N' dates)
	var endDate			// keeps track of when each block ends (to replace 'prior to end of X' dates)
	
	var columnOffset = 0; 	// used to adjust for multi-row date columns
	var offendingRow = -1;	// row that caused the last column offset 
	var lastDate = undefined;	// date of the row that caused the last column offset
	
	var output = parsedHTML('tr').map(function(i, row) {
		var temp = {}
		var skipRow = false;
		
		if (columnOffset > 0) {
			columnOffset--;
			
			if (columnOffset === 0) {
				offendingRow = -1
				lastDate = undefined
			}
		}
		
		$.load(row)('td, th').each(function(j, col) {
			var header = $(col).attr('headers');
			
			var findStr = 'a';
			

			var tempJ = j;
			if (columnOffset > 0 && i !== offendingRow) {
				tempJ++;
			} 
			
			if (type.match('Homework') && tempJ === topic)
				findStr = 'a, strong'
				
			var foundLink = !type.match('Homework') || tempJ !== topic;	// we only want extra elements on Homework
			var title = $(col).find(findStr);	

			if (title.length === 1) {
				title = title.first();
				title = '<a target="_blank" href="'+$(title).attr('href')+'">'+$(title).text().trim()+'</a>'				
			} else if (title.length >= 1) {
				title = Object.keys(title).map(function (key) {return title[key]}) 	// converts title into an array
				title = title.map(function(title) {
					if ($(title).attr('href')) {
						foundLink = true;
						return '<a target="_blank" href="'+$(title).attr('href')+'">'+$(title).text().trim()+'</a>'
					} else if ($(title).text().trim().length > 0 && type.match("Homework"))
						return '<strong>'+$(title).text().trim()+'</strong>'
				}, '')
			} 
			if (title.length === 0 || !foundLink) {
				title = $(col).find('span');
			
				if (title.length === 1)
					title = title.first().text().trim();
				else
					title = $(col).text().trim();
			}
			
			var rowspan = $(col).attr('rowspan');
			if (j === 0 && rowspan !== undefined && parseInt(rowspan) > 1) {
				columnOffset = parseInt(rowspan)
				offendingRow = i
			}
			
			if (type.match('Assignments')) {					
				temp[header] = title;			
			} else if (type.match('PCCIA')) {
				if (week === undefined || i === startRow) {
					if (title.indexOf('Week') !== -1) {
						week = j;
						startRow = i;
					}
					if (title.indexOf('Topic') !== -1) {
						topic = j;
					}
					if (title.indexOf('Objectives') !== -1) {
						objectives = j;
					}
					if (title.indexOf('Module') !== -1) {
						resources = j;
					}
				} else {
					if (j === week) {
						skipRow = title.length === 0;
						if (!skipRow)
							temp['week'] = title;
					}
					if (!skipRow) {
						if (j == topic) {
							temp['topic'] = title
						}
						if (j == objectives) {
							temp['objectives'] = title
						}
						if (j == resources) {
							temp['resources'] = title
						}
					}
				}
			} else if (type.match('Homework')) {			
				if (date === undefined || i === startRow) {
					if (title.indexOf('Date') !== -1) {
						date = j;
						startRow = i;						
					}
					if (title.indexOf('Topic') !== -1) {
						topic = j;
					} else if (title.indexOf('Reading') !== -1) {
						topic = j;
					}					
					if (title.indexOf('Objectives') !== -1) {
						objectives = j;
					}
					if (title.indexOf('Resources') !== -1) {
						resources = j;
					}
					if (title.indexOf('Author') !== -1) {
						lecturer = j;
					}					
				} else {	
					if (columnOffset > 0 && i !== offendingRow) {
						j++;
						skipRow = false;
						temp['date'] = lastDate;
					} else if (j === date) {
						skipRow = title.length === 0;
						if (!skipRow) {
							temp['date'] = title;
							if (i === offendingRow) {
								lastDate = title
							}
						}
					}
					if (!skipRow) {
						if (j == topic) {
							temp['topic'] = title
						}
						if (j == objectives) {
							if (typeof title !== 'string' || !title.match('NA'))							
								temp['objectives'] = title
						}
						if (j == resources) {
							if (typeof title !== 'string' || !title.match('NA'))
								temp['resources'] = title
						}
						if (j == lecturer) {
							temp['lecturer'] = title
						}						
					}					
				}			
			}
		});	
		
		return {'type':type, 'data':temp, 'course':course};
	}).get();
	
	var deferred = true;
	
	while (deferred) {
		deferred = false;
		for (var i = 0; i < output.length; i++) {
			var dateData = processPageDates(output[i].data, firstDate, endDate, course)
			firstDate = dateData.firstDate;
			endDate = dateData.endDate;	
			
			if (!dateData.deferred)
				output[i].data = dateData.data;
			else 
				deferred = true;
		}
	}

	return output
}

function processPageDates(obj, firstDate, lastDate, course) {	
	if (obj.date === undefined)
		return {data: obj, firstDate:firstDate, endDate:lastDate};
	if (obj.dateProcessed)
		return {data: obj, firstDate:firstDate, endDate:lastDate};	
	var temp = []	// used to determine the first and last dates
	
	obj.textDate = obj.date;	// saves the original
	
	if (obj.date.toLowerCase().indexOf('end') !== -1) {
		changeYearIfNeeded(lastDate);
		obj.date = addDays(lastDate,1).toString();
	} else if (obj.date.toLowerCase().indexOf('week') !== -1) {		
		if (firstDate == undefined) {
			return {deferred: true, firstDate:firstDate, endDate:lastDate}
		}	
		var date = addDays(firstDate,-1.05)
		var endDate = addDays(date, 4)
		var out = []
		
		do {
			changeYearIfNeeded(date);
			out.push(date.toString())
			temp.push(date);			
			date = addDays(date, 1)
		} while (date <= endDate)
		
		obj.date = out;
		
		obj.displayDate = obj.textDate.substring(obj.textDate.toLowerCase().indexOf('week'));
	} else if (obj.date.toLowerCase().indexOf('session') !== -1 && obj.date.indexOf('(') !== -1 && obj.date.indexOf(')') !== -1) {
		var dateString = obj.textDate.substring(obj.textDate.indexOf('(')+1,obj.textDate.indexOf(')'));
		var string1 = dateString.substring(0, dateString.indexOf('-'))
		var string2 = dateString.substring(0, dateString.indexOf(' '))+ ' '+dateString.substring(dateString.indexOf('-')+1)
		
		var date = new Date(string1+' '+new Date().getFullYear()+' UTC')
		var endDate = new Date(string2+' '+new Date().getFullYear()+' UTC')
		
		date = addDays(date, -0.05)
		
		var out = []
		
		do {
			changeYearIfNeeded(date);
			out.push(date.toString())
			temp.push(date);			
			date = addDays(date, 1)
		} while (date <= endDate)
		
		obj.date = out;
		
		obj.displayDate = course + ' Session'		
	} else if (obj.date.indexOf('(W)') !== -1 && obj.date.indexOf('(L)') !== -1) {
		var windsorFirst = obj.date.indexOf('(W)') < obj.date.indexOf('(L)');
		var string1 = obj.textDate.substring(0, obj.textDate.indexOf('('));
		var string2 = obj.textDate.substring(0, obj.textDate.indexOf('(')-2) + ' '+ obj.textDate.substring(obj.textDate.lastIndexOf('(')-2,obj.textDate.lastIndexOf('('));		
		var date1 = new Date(string1+' '+new Date().getFullYear()+' UTC')
		var date2 = new Date(string2+' '+new Date().getFullYear()+' UTC')
		
		date1 = addDays(date1, -0.05)
		date2 = addDays(date2, -0.05)
		
		changeYearIfNeeded(date1);
		changeYearIfNeeded(date2);
		
		var out = [	{location:windsorFirst?'Windsor':'London' ,date:date1.toString()},
					{location:windsorFirst?'London':'Windsor' ,date:date2.toString()}]
					
		temp.push(date1)
		temp.push(date2)
		
		obj.date = out;
	} else {
		obj.date = obj.textDate;
		
		// todo: replace this with proper regex for numbers
		if (obj.date.indexOf('lecture') !== -1) {
			obj.date = obj.date.substring(0, obj.date.indexOf('lecture')-1);
		}
		if (obj.date.indexOf('test') !== -1) {
			obj.date = obj.date.substring(0, obj.date.indexOf('test')-1);
		}		
		var date = new Date(obj.date+' '+new Date().getFullYear()+' UTC')
		
		date = addDays(date, -0.05)
		changeYearIfNeeded(date);		
		
		obj.date = date.toString();
		temp.push(date);
	}
	
	for (var i = 0; i < temp.length; i++) {
		if (firstDate === undefined || temp[i] < firstDate)
			firstDate = temp[i]
		if (lastDate === undefined || temp[i] > lastDate)
			lastDate = temp[i]
	}
		
	obj.dateProcessed = true;	
		
	return {data: obj, firstDate:firstDate, endDate:lastDate};
}

// finds the class pages wanted on the dashboard
function processDashboard(html, module, session, callback) {
	var parsedHTML = $.load(html);
	
	var sites = {}
	var ignoredURLs = new Set();
	
	// removes normal OWL content
	parsedHTML('#innercontent').empty();
	parsedHTML('li.nav-menu').css('display','none')
	parsedHTML('li.more-tab').css('display','none')	
	parsedHTML('.nav-selected').css('display','default')	
	
	var found = false;	
	
	parsedHTML('<h1 style="padding-left:2.5%; margin-bottom: -30px; position:relative;">Lectures</h1><div class="topnav" style="padding: 2em;" id="fakelecturenav"></div><h1 style="padding-left:2.5%; margin-bottom: -30px; margin-top: -1em;">Homework</h1><div class="topnav" style="padding: 2em;" id="faketopnav"></div>').appendTo('#innercontent')
	
	parsedHTML('<div id="fakeweek" style="padding:1%; max-width:40%; display:inline-block; float:left; position:relative;"><h2 id="fakeweeklabel">This Week</h2></div><div style="padding:1%; max-width:27%; display:inline-block; float:right;"><div id="fakepccia"><h2>PCCIA</h2></div><div id="fakeassignments" style="margin-top:3em;"><h2>Assignments</h2></div></div><div id="fakehomework" style="padding:1%; max-width:27%; display:inline-block; float:right;"><h2>Course Pages</h2></div>').appendTo('#faketopnav');
	
	parsedHTML('ul[class=otherSitesCategorList]').children().map(function(i, li) {
		found = true;
		$(li).children().map(function(i, a) {
			var href = $(a).attr('href');
			var title = $(a).attr('title');			
			
			if (!href.match('#') && title.lastIndexOf('MEDICINE', 0) === 0) {
				var hash = crypto.createHash('md5').update(title).digest('hex');
				sites[hash] = {'href':href, 'course':title};
				ignoredURLs.add(href);
				parsedHTML('<div style="padding: 2px 8px 2px 8px; margin-bottom: 8px; '+dropShadowForCourse(title)+' background-color:'+colourForCourse(title)+';"><h3><a id="'+hash+'" target="_blank" href="'+href+'" title="'+title+'"><span>'+title+'</span></a><h3></div>').appendTo('#fakehomework');
			}
		})
	});
	
	async.map(Object.keys(sites), function(site, _callback) {
		processPage(sites[site]['href'], module, sites[site]['course'], session, _callback)
	}, function(err, results) {
		if (err) console.log(err);
		
		results = flattenArray(results)
		
		var homework = [];
		var assignments = [];
		var pccia = [];
		var lectures = [];
		
		for (var i = 0; i < results.length; i++) {
			if (results !== null && results[i] !== undefined && results[i].data !== undefined) {
				if (Object.keys(results[i].data).length > 1) {
					if (results[i].type === 'Homework')
						homework.push(results[i]);
					if (results[i].type === 'Assignments')
						assignments.push(results[i]);
					if (results[i].type === 'PCCIA')
						pccia.push(results[i]);
					if (results[i].type === 'Lecture')
						lectures.push(results[i]);						
				}
			}
		}			
		
// 				fs.writeFileSync('templc.json', JSON.stringify(lectures, null, 4))
		
		pccia.sort(function(a,b) {
			return parseInt(a.data.week) - parseInt(b.data.week);
		});
		
		assignments.sort(function(a,b) {
			return new Date(a.data.dueDate) - new Date(b.data.dueDate);
		});
		
		lectures.sort(function(a,b) {
			return new Date(a.data.date) - new Date(b.data.date);
		});		
		
		homework.sort(function(a, b) {
			var dateA = a.data;
			var dateB = b.data;
			
			if (dateA !== undefined) {
				dateA = dateA.date;
				
				if (isArray(a.data.date)) {
					dateA = a.data.date[0];
					if (typeof dateA === 'object')
						dateA = dateA.date;
				}				
			}
			if (dateB !== undefined) {
				dateB = dateB.date;
				
				if (isArray(b.data.date)) {
					dateB = b.data.date[0];
					if (typeof dateB === 'object')
						dateB = dateB.date;
				}				
			}			
			return new Date(dateA) - new Date(dateB);
		})		
				
		var todayLecture = false
		var tomorrowLecture = false
		for (var i = 0; i < lectures.length; i++) {
			var content = lectures[i];						
			var today = new Date();
			today = addDays(today, -0.25);	// adjusts for time zones
			var tomorrow = addDays(today, 1);
			var twodays = addDays(today, 2);			
			var yesterday = addDays(today, -1)			
			
			var dates = []
			if (isArray(content.data.date)) {
				for (var j = 0; j < content.data.date.length; j++)
					dates.push(new Date(content.data.date[j]));
			} else {
				dates = [new Date(content.data.date)];
			}
			
			var passed = false;
			var isToday = false;
			var isTomorrow = false;
			
			for (var j = 0; j < dates.length; j++) {
				if (dates[j] >= yesterday) {
					passed = true;
				}
				if (dates[j] >= today) {
					passed = false;
					isToday = true;
				}
				if (dates[j] >= tomorrow) {
					isToday = false;
					isTomorrow = true;
				}
				if (dates[j] >= twodays) {
					isTomorrow = false;
					passed = true;
				}				
			}
			
			if (isToday)
				todayLecture = true;
			
			if (isTomorrow)
				tomorrowLecture = true;
		}
		
		if (todayLecture || tomorrowLecture)
			parsedHTML('<div id="faketodaylecture" style="padding:1%; width:48%; display:inline-block; position:relative; vertical-align:top;"><h2>Today</h2></div><div id="faketomorrowlecture" style="padding:1%; width:48%; display:inline-block; position:relative; vertical-align:top;"><h2>Tomorrow</h2></div>').appendTo('#fakelecturenav')
		else
			parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>No Immediate Lectures!</h4></div>').appendTo('#fakelecturenav');
			
		if (!todayLecture) {
			parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>None Today!</h4></div>').appendTo('#faketodaylecture');
		}
		if (!tomorrowLecture) {
			parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>None Tomorrow!</h4></div>').appendTo('#faketomorrowlecture');
		}
			
		for (var i = 0; i < lectures.length; i++) {
			var content = lectures[i];						
			var today = new Date();
			today = addDays(today, -0.25);	// adjusts for time zones
			var tomorrow = addDays(today, 1);
			var twodays = addDays(today, 2);			
			var yesterday = addDays(today, -1)			
			
			var dates = []
			if (isArray(content.data.date)) {
				for (var j = 0; j < content.data.date.length; j++)
					dates.push(new Date(content.data.date[j]));
			} else {
				dates = [new Date(content.data.date)];
			}
			
			var passed = false;
			var isToday = false;
			var isTomorrow = false;
			
			for (var j = 0; j < dates.length; j++) {
				if (dates[j] >= yesterday) {
					passed = true;
				}
				if (dates[j] >= today) {
					passed = false;
					isToday = true;
				}
				if (dates[j] >= tomorrow) {
					isToday = false;
					isTomorrow = true;
				}
				if (dates[j] >= twodays) {
					isTomorrow = false;
					passed = true;
				}				
			}
				
			var hash = crypto.createHash('md5').update(content.course).digest('hex');
	
				
			if (isToday) {
				var prev = parsedHTML('#faketodaylecture').find('.today_'+hash)
				if (prev.length > 0)
					$(prev).append('<br><br>'+content.data.html)
				else
					parsedHTML('<div class="today_'+hash+'" style="padding: 2px 8px 8px 8px; position:relative; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; margin-left: 1%; margin-right: 1%; background-color:'+colourForCourse(content.course)+'; opacity: 1.0;">'+content.data.html+'</div>').appendTo('#faketodaylecture')
			}	
			if (isTomorrow) {
				var prev = parsedHTML('#faketomorrowlecture').find('.tomorrow_'+hash)
				if (prev.length > 0)
					$(prev).append('<br><br>'+content.data.html)
				else				
					parsedHTML('<div class="tomorrow_'+hash+'" style="padding: 2px 8px 8px 8px; position:relative; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; margin-left: 1%; margin-right: 1%; background-color:'+colourForCourse(content.course)+'; opacity: 1.0;">'+content.data.html+'</div>').appendTo('#faketomorrowlecture')				
			}			
		}
		
		for (var i = 0; i < pccia.length; i++) {
			var content = pccia[i];			
			var output = '<div style="padding: 2px 8px 8px 8px; opacity: 1.0; position:relative; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+colourForCourse(content.course)+';"><h4>Week '+content.data.week+' - '+content.data.topic+'<h4>'+
			content.data.objectives+' ';
			if (isArray(content.data.resources)) {
				 for (var j = 0; j < content.data.resources.length; j++) {
				 	var item = content.data.resources[j];
				    if (j == 0) {
				    	output += '<span style="position:absolute; right:8px;">'+item+'</span><br><h5>Additional Resources</h5><ul>'
				    } else if (item !== undefined) {
					  	output += '<li>'+item+'</li>'
				    }
				 }
				 output += '</ul>'
			} else 
				output += '<span style="position:absolute; right:8px;">'+content.data.resources+'</span></div>'
			parsedHTML(output).appendTo("#fakepccia")
		}
		
		for (var i = 0; i < assignments.length; i++) {
			var content = assignments[i];						
			parsedHTML('<div style="padding: 2px 8px 8px 8px; opacity: 1.0; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+colourForCourse(content.course)+';"><h4>'+content.data.title+'</h4>'+
			'<strong>Status</strong>: '+content.data.status+' <span style="float:right;"><strong>Due</strong>: '+df(addDays(new Date(content.data.dueDate),-0.05), 'mmm dd, yyyy')+'</span></div>').appendTo("#fakeassignments")	
		}
		
		var maxPreviousDate = 0;
		var futureHomeworkExists = false;		// used to toggle 'Show All' button
		var logErrors = false;
		for (var i = 0; i < homework.length; i++) {
			var content = homework[i];
			var output = '<div style="padding: 2px 8px 8px 8px; position:relative; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+colourForCourse(content.course)+'; opacity: 1.0;"><h4>%DATE%';
			var output2 = '<div style="padding: 2px 8px 8px 8px; position:relative; '+dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+colourForCourse(content.course)+'; opacity: 1.0;"><h4>%DATE%';			
			var multipleOutput = false;
			var replaceDate = true;		// whether a date should be replaced by a relative date (tonight, tomorrow, etc)
			
			if (Object.keys(content.data).length < 4)
				continue;
			
			var dates;
			var dateStr1, dateStr2;
			
			if (isArray(content.data.date)) {
				if (typeof content.data.date[0] === 'object') {
					multipleOutput = true;
					dates = [new Date(content.data.date[0].date), new Date(content.data.date[1].date)]
					dateStr1 = df(content.data.date[0].date, 'mmm dd')+' ('+ content.data.date[0].location+' only)';
					dateStr2 = df(content.data.date[1].date, 'mmm dd')+' ('+ content.data.date[1].location+' only)';					
				} else {
					dates = [];	
					for (var j = 0; j < content.data.date.length; j++) {
						dates.push(new Date(content.data.date[j]));
					}
					dateStr1 = df(content.data.date[0].date, 'mmm dd');
				}								
			} else {
				dates = [new Date(content.data.date)];
				if (!isNaN(Date.parse(content.data.date)))
					dateStr1 = df(content.data.date, 'mmm dd');
				else {
					console.log(content.data.date);
					dateStr1 = "Invalid Date"
					logErrors = true;
				}
			}
			
			if (content.data.displayDate && !multipleOutput) {
				dateStr1 = 'Prior to your ' + content.data.displayDate;
				dateStr2 = 'Prior to your ' + content.data.displayDate;
				replaceDate = false;				
			} 
			
			if (isArray(content.data.topic)) {
				output += ' - '+content.data.topic[0];
				output2 += ' - '+content.data.topic[0];	
			} else {
				output += ' - '+content.data.topic;
				output2 += ' - '+content.data.topic;	
			}
			if (content.data.lecturer) {
				output += ' ('+content.data.lecturer+')';
				output2 += ' ('+content.data.lecturer+')';	
			}	
			output += '</h4>';		
			output2 += '</h4>';			
		
			if (isArray(content.data.objectives)) {
				for (var j = 0; j < content.data.objectives.length; j++) {
				 	var item = content.data.objectives[j];
				    if (j == 0) {
				    	output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives</strong><ul>'
				    	output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives</strong><ul>'				    	
				    } 
				    if (item !== undefined) {
					    if (item.indexOf('<a') !== -1) {
						  	output += '<li>'+item+'</li>'
						  	output2 += '<li>'+item+'</li>'						  	
						} else {
							output += item+"<br>";
							output2 += item+"<br>";	
						}						
				    } else if (j == content.data.objectives.length-1 || content.data.objectives[j+1] === undefined)
					    break;		// hacky way to deal with last row full of the same text, just unstyled
				}
				output += '</ul></span>'
		    	output2 += '</ul></span>'	
			}
			
			if (isArray(content.data.topic)) {
				for (var j = 0; j < content.data.topic.length; j++) {
				 	var item = content.data.topic[j];
				    if (j == 0) {
					    if (!isArray(content.data.objectives)) {
						    output += '<br>'
					    	output2 += '<br>'
					    }
					    
				    	output += '<strong style="color: #555;">Independent Learning</strong>'
				    	output2 += '<strong style="color: #555;">Independent Learning</strong>'				    	
				    	
				    	if (content.data.objectives && !isArray(content.data.objectives)) {
						    if (content.data.objectives.indexOf('<a') !== -1) {
								output += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
								output2 += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
							} else {
								output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
								output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
							}
						}
				    	
				    	output += '<ul>'
				    	output2 += '<ul>'
				    } else if (item !== undefined) {
					    if (item.indexOf('<a') !== -1) {
						  	output += '<li>'+item+'</li>'
						  	output2 += '<li>'+item+'</li>'						  	
						} else {
							output += item+"<br>";
							output2 += item+"<br>";	
						}						
				    } else if (j == content.data.topic.length-1 || content.data.topic[j+1] === undefined)
					    break;		// hacky way to deal with last row full of the same text, just unstyled
				}
				output += '</ul>'
		    	output2 += '</ul>'				    					 
			} else if (content.data.objectives && !isArray(content.data.objectives)) {
			    if (content.data.objectives.indexOf('<a') !== -1) {
					output += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
					output2 += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
				} else {
					output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
					output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
				}
			}

			if (isArray(content.data.resources)) {
				for (var j = 0; j < content.data.resources.length; j++) {
				 	var item = content.data.resources[j];
				    if (j == 0) {
				    	output += '<strong style="color: #555;">Additional Resources</strong><ul>'
				    	output2 += '<strong style="color: #555;">Additional Resources</strong><ul>'				    	
				    } 
				    if (item !== undefined) {
					    if (item.indexOf('<a') !== -1) {
						  	output += '<li>'+item+'</li>'
						  	output2 += '<li>'+item+'</li>'						  	
						} else {
							output += item+"<br>";
							output2 += item+"<br>";	
						}						
				    } else if (j == content.data.resources.length-1 || content.data.resources[j+1] === undefined)
					    break;		// hacky way to deal with last row full of the same text, just unstyled
				}
				output += '</ul>'
		    	output2 += '</ul>'	
		    } else if (content.data.resources) {
			    var item = content.data.resources;
			    if (item.indexOf('<a') !== -1) {			    
				    output += '<br><strong style="color: #555;">Additional Resources</strong><ul><li>'+item+'</li></ul>'
			    	output2 += '<br><strong style="color: #555;">Additional Resources</strong><ul><li>'+item+'</li></ul>'
			    } else {
				    output += '<br><strong style="color: #555;">Additional Resources</strong><ul>'+item+'<br></ul>'
			    	output2 += '<br><strong style="color: #555;">Additional Resources</strong><ul>'+item+'<br></ul>'				    
			    }
		    }					 
		    	
			output += '</div>';
			output2 += '</div>';			
			
			var today = new Date();
			today = addDays(today, -0.25);	// adjusts for time zones
			var tomorrow = addDays(today, 1);
			var twodays = addDays(today, 2);
			var yesterday = addDays(today, -1)
			var nextweek = addDays(today, 6)		
			var pastweek = addDays(today, -7)
			var pastweek2 = addDays(today, -14)
			var pastweek3 = addDays(today, -21)											
			var pastweek4 = addDays(today, -28)
			var pastweek5 = addDays(today, -35)						
			var upcoming = false;
			var upcomingLater = false;
			var upcomingSoon = false;
			var passed = false;			
			var withinWeek = false;	
			var prevWeek = -1;						
			for (var j = 0; j < dates.length; j++) {
				if (dates[j] >= pastweek5)
					prevWeek = 5;
				if (dates[j] >= pastweek4)
					prevWeek = 4;
				if (dates[j] >= pastweek3)
					prevWeek = 3;
				if (dates[j] >= pastweek2)
					prevWeek = 2;
				if (dates[j] >= pastweek)
					prevWeek = 1;																		
				if (dates[j] >= yesterday) {
					prevWeek = 0;
					passed = true;
				}
				if (dates[j] >= today) {
					passed = false;
					upcomingSoon = true;
				}
				if (dates[j] >= tomorrow) {
					upcomingSoon = false;
					upcoming = true;
				}				
				if (dates[j] >= twodays) {
					upcoming = false;
					upcomingLater = true;
				}
				if (dates[j] < nextweek) {
					withinWeek = true;
				}
			}
			
			if ((passed || upcoming || upcomingSoon || upcomingLater) && withinWeek) {
				if (passed) {
					output = output.replace('opacity: 1.0;', 'opacity: 0.4;');
					output2 = output2.replace('opacity: 1.0;', 'opacity: 0.4;');					
				}
								
				if (passed && replaceDate) {
					output = output.replace('%DATE%', 'Yesterday');
					output2 = output2.replace('%DATE%', 'Yesterday');
				} else if (upcomingSoon && replaceDate) {
					output = output.replace('%DATE%', 'Tonight');
					output2 = output2.replace('%DATE%', 'Tonight');
				} else if (upcoming && replaceDate) {
					output = output.replace('%DATE%', 'Tomorrow');
					output2 = output2.replace('%DATE%', 'Tomorrow');
				} else {
					output = output.replace('%DATE%', dateStr1);
					output2 = output2.replace('%DATE%', dateStr2);
				}
				parsedHTML(output).appendTo('#fakeweek');
				if (multipleOutput)
					parsedHTML(output2).appendTo('#fakeweek');			
			} else if (!withinWeek || prevWeek > 0) {
				futureHomeworkExists = !withinWeek;
				
				if (prevWeek > 0) {
					if (prevWeek > maxPreviousDate)
						maxPreviousDate = prevWeek
					output = output.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="pastweek'+prevWeek+'"');
					output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="pastweek'+prevWeek+'"');	
				} else {
					output = output.replace('opacity: 1.0;"', 'display:none;" class="comingsoon"');
					output2 = output2.replace('opacity: 1.0;"', 'display:none;" class="comingsoon"');						
				}
							
				parsedHTML(output.replace('%DATE%', dateStr1)).appendTo('#fakeweek');
				if (multipleOutput)
					parsedHTML(output2.replace('%DATE%', dateStr2)).appendTo('#fakeweek');									
			}
		}
		
		if (futureHomeworkExists) {
			parsedHTML('<div id="showAllButton" class="hoverButton" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-right: 20%; margin-left: 20%; text-align: center; cursor: pointer;"><h4>Show Upcoming Weeks</h4></div>').appendTo('#fakeweek');	
			parsedHTML('<font small><div id="showPrevButton" class="hoverButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 29px; margin: 0; font-size: small;">Show Previous Week</div></font>').appendTo('#fakeweeklabel');				
		}
			
		parsedHTML('body').append('<style>#showAllButton { background-color: hsl(0, 0%, 96%); } #showAllButton:hover {background-color: hsl(0, 0%, 93%);}#showPrevButton { color: #9776C1; } #showPrevButton:hover {color: #623f8d;}</style>')
		parsedHTML('body').append('<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>')
		parsedHTML('body').append('<script type="text/javascript">$(document).ready(function() {var count = 1;$("#showAllButton").on("click", function(){$("#showAllButton").fadeOut();$(".comingsoon").fadeIn()});$("#showPrevButton").on("click", function(){if (count === '+maxPreviousDate+')$("#showPrevButton").fadeOut();$(".pastweek"+count).fadeIn();count++;});});</script>')		

		callback(_cleanHTML(parsedHTML, found?parsedHTML.html():html, ignoredURLs));		
	});
}

function flattenArray(array) {
	var out = [];
	
	for (var i = 0; i < array.length; i++) {
		if (isArray(array[i])) {
			flattenArray(array[i]).forEach(function(item) {
				out.push(item);
			});
		} else {
			out.push(array[i]);
		}
	}
	return out;
}

function colourForCourse(course) {
	var seed = parseInt(/(\d+)/.exec(course))
	
	var x = Math.sin(seed++) * 10000;
	var random = x - Math.floor(x);

	var h = Math.floor(random * 360);
	
	return 'hsl('+h+', 100%, 92%)';
}

function dropShadowForCourse(course) {
	var seed = parseInt(/(\d+)/.exec(course))
	
	var x = Math.sin(seed++) * 10000;
	var random = x - Math.floor(x);

	var h = Math.floor(random * 360);
	
	return '-webkit-box-shadow: hsla('+h+', 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla('+h+', 20%, 55%, 0.5) 0px 2px 2px;'
}

function isArray(a) {
    return (!!a) && (a.constructor === Array);
}

function addDays(date, days) {
    var result = new Date(date);
    result.setTime(result.getTime() + days * 86400000);
    return result;
}

// dates before the start of the school year should be next year
function changeYearIfNeeded(date) {
	if (date.getMonth() < 8)
		date.setFullYear(new Date().getFullYear()+1)
}

var domain = '';
var userInfo = {};


serverFunc = function(req, response) { 
	var cookiejar = new Cookies(req, response);
	var pathname = url.parse(req.url).pathname;
	
	var session = cookiejar.get('JSESSIONID');
	var username = cookiejar.get('eid');
	var password = cookiejar.get('pw');		
	
	if (!session || !userInfo[session] || !userInfo[session]['cookie']) {
		request('http://owl.uwo.ca/portal', function(err, resp, html) {
			
			if (err)
				console.log(err)
			if (resp) {
				cookieIn = resp.headers['set-cookie']		
				for (var i = 0; i < cookieIn.length; i++) {
					cookieIn[i] = cookieIn[i].replace('Secure;','')
					cookieIn[i] = cookieIn[i].replace('secure','')						
				}
				
				session = cookieIn[0].substring(cookieIn[0].indexOf('=')+1, cookieIn[0].indexOf(';'))
				userInfo[session] = {'cookie': cookieIn};
				cookiejar.set('JSESSIONID', session);

				response.writeHead(200, {"Content-Type": "text/html"}); 		
				response.write(processLogin(html));		
				response.end();	
			}
		});
	} else {
		if (pathname.match('/portal/logout'))
			delete userInfo[session] 
		processRequest(req, request, response, pathname, session, cookiejar);
	}
}

insecureFunc = function(req, response) {
	response.setHeader('Location', 'https://' + req.headers.host.replace(/:\d+/, ':' + config.securePort) + req.url);
	response.statusCode = 302;
	response.end();
}

fs.lstat('/etc/letsencrypt/live/fowl.rocks/', function(err, stats) {
    if (!err && stats.isDirectory()) {
		var options = {
			key: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/privkey.pem'),
			cert: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/cert.pem')
		}
		
		https.createServer(options, serverFunc).listen(config.securePort);		
		http.createServer(insecureFunc).listen(config.port);
    } else {
	    http.createServer(serverFunc).listen(config.port);
    }
});