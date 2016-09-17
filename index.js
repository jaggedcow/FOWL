var $ = require('cheerio');
var crypto = require('crypto');
var async = require('async');
var fs = require('fs');
var http = require("http");
var request = require('request');
var http = require("http"); 
var url = require("url");
var qs = require('querystring');
var Cookies = require('cookies');
var Set = require('set') 

var config = require('./config.json');

function replaceAll (find, replace, str) {
  var find = find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(find, 'g'), replace);
}

function processRequest(req, module, response, pathname, session) {
    if (req.method == 'POST') {
    	console.log("POST "+pathname);
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
				processDashboard(html, module, session, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();							
				});		
			});	            
        });
    } else {
    	console.log("GET "+pathname);
		module({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {'Cookie': userInfo[session]?userInfo[session]['cookie']:''}}, function(err, resp, html) {          
			response.writeHead(200, {"Content-Type": "text/html"});  		
			response.write(cleanHTML(html));		
			response.end();		
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
		var target = $(img).attr('target')		
		if (!target && !ignoredURLs.contains(href))		// ignores external links
			redirectSet.add(href);
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
	
	temp = replaceAll('OWL', 'FOWL', temp);
	temp = replaceAll('Welcome to FOWL', 'Welcome to Fake OWL', temp);	
	
	return replaceClasses(temp);
}

function replaceClasses(temp) {
	temp = temp.replace(/MEDICINE 5115 001 FW16/g, 'ITM + PCCIA');
	temp = temp.replace(/MEDICINE 5151 001 FW16/g, 'Social Medicine');
	temp = temp.replace(/MEDICINE 5140 001 FW16/g, 'Professional Portfolio');
	temp = temp.replace(/MEDICINE 5139 001 FW16/g, 'PCCM');			
	
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
	var options = ['PCCIA', 'Homework', 'Assignments'];
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
	
	async.mapSeries(output, function(site, _callback) {
		processPageInner(site, module, itemp[site], course, session, _callback);
	}, callback);
/*
	}, function(err, results) {
		var out = $.load('<br><ul class="faketools" style="display:block !important; overflow:visible !important"></ul>');	// hacky css to overcome js hiding everything
		
		for (var i = 0; i < options.length; i++) {
			if (!results[i])
				continue;
			out('.faketools').append('<span>'+options[i]+'</span>');			
			out('.faketools').append(results[i]);
		}
		
		if (err) console.log(err);
		callback(err, out.html());		
	});	
*/	
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
				if (err)
					_callback(err, null);
				else {
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
				if (err)
					_callback(err, null);
				else {
					var parsedHTML = $.load(html);
					var homework = [];
					
					parsedHTML('.itemlink').map(function(i, link) {
						var href = $(link).attr('href');
						
						homework.push(href);
					});
					
					if (homework.length === 0) {
						var out = parsedHTML('table');
						
						_callback(err, processPageTableSync(out, pageType, course))//'<table style="width:400px">'+out.html()+'</table>');
					} else {
						async.mapSeries(homework, function(href, __callback) {	
							module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
								if (err)
									__callback(err, null);
								else {
									var parsedHTML = $.load(html);	
									var out = parsedHTML('table');
									
									__callback(err, processPageTableSync(out, pageType, course))//'<table style="width:400px">'+out.html()+'</table>');									
								}
							});						
						}, _callback);
					}
				}
			})			
		}
	], callback)
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
			var title = $(col).find('a');			

			if (title.length === 1) {
				title = title.first();
				title = '<a target="_blank" href="'+$(title).attr('href')+'">"'+$(title).text().trim()+'</a>'				
			} else if (title.length >= 1) {
				title = Object.keys(title).map(function (key) {return title[key]}) 	// converts title into an array
				title = title.map(function(title) {
					if ($(title).attr('href'))
						return '<a target="_blank" href="'+$(title).attr('href')+'">"'+$(title).text().trim()+'</a>'
					else
						return undefined
				}, '')
			} else {
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
				console.log("OFF",columnOffset);
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
						if (j === date)
							console.log(title, lastDate, columnOffset);
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
		return {'type':type, 'data':processPageDates(temp, firstDate, endDate), 'course':course};
	}).get();

	return output
}

function processPageDates(obj, firstDate, endDate) {
// 	if (obj.date === undefined)
		return obj;
	
	obj.textDate = obj.date;	// saves the original
	
// 	console.log(obj.date);
	
	if (obj.date.indexOf('Week') !== -1) {
				console.log("1");
	} else if (obj.date.indexOf('End') !== -1) {
				console.log("2");
	} else if (obj.date.indexOf('Session') !== -1 && obj.date.indexOf('(') !== -1 && obj.date.indexOf(')') !== -1) {
				console.log("3");
	} else if (obj.date.indexOf('(') !== -1 && obj.date.indexOf(')') !== -1) {
				console.log("4");
	} else {
				console.log("5");
		obj.date = new Date(obj.textDate+' '+new Date().getFullYear()+' UTC').toString();
	}
	
	return obj;
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
	
	parsedHTML('<div class="topnav" style="padding: 24px; -webkit-columns: 4 450px; -webkit-column-gap: 4em; -webkit-column-rule: 1px dotted #ddd; -moz-columns: 4 450px; -moz-column-gap: 4em; -moz-column-rule: 1px dotted #ddd; columns: 4 450px; column-gap: 4em; column-rule: 1px dotted #ddd;" id="faketopnav"></div>').appendTo('#innercontent')
	
	
	parsedHTML('ul[class=otherSitesCategorList]').children().map(function(i, li) {
		found = true;
		$(li).children().map(function(i, a) {
			var href = $(a).attr('href');
			var title = $(a).attr('title');			
			
			if (!href.match('#') && title.lastIndexOf('MEDICINE', 0) === 0) {
				var hash = crypto.createHash('md5').update(title).digest('hex');
				sites[hash] = {'href':href, 'course':title};
				ignoredURLs.add(href);
				parsedHTML('<div style="break-inside: avoid"><a id="'+hash+'" target="_blank" href="'+href+'" title="'+title+'"><span>'+title+'</span></a></div>').appendTo('#faketopnav');
			}
		})
	});
	
	async.mapSeries(Object.keys(sites), function(site, _callback) {
		processPage(sites[site]['href'], module, sites[site]['course'], session, _callback)/*
function(err, res) {
			// do something with res
// 			fs.writeFileSync(site+".html",res);
			parsedHTML('#'+site).after(res)
			_callback(err);
		})
*/
	}, function(err, results) {
		if (err) console.log(err);
		
		// flatten out all the data
		while (isArray(results[0])) {
			var pages = [];
			for (var i = 0; i < results.length; i++) {
				if (results[i] !== undefined)
					for (var j = 0; j < results[i].length; j++) {
						pages.push(results[i][j]);
					}
			}
			results = pages;
		}
		
		fs.writeFileSync('temp.json', JSON.stringify(pages, null, 4));
		callback(_cleanHTML(parsedHTML, found?parsedHTML.html():html, ignoredURLs));		
	});
}

function isArray(a) {
    return (!!a) && (a.constructor === Array);
};

var domain = '';
var userInfo = {};

http.createServer(function(req, response) { 
	var cookiejar = new Cookies(req, response);
	var pathname = url.parse(req.url).pathname;
	
	var session = cookiejar.get('JSESSIONID');
	
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
		processRequest(req, request, response, pathname, session);
	}
}).listen(config.port);