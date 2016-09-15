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

function processRequest(req, module, response, pathname, cookies) {
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
            
			module.post({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {"Authorization": auth, 'Cookie': cookies}, form:post}, function(err, resp, html) {          	
				processDashboard(html, module, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();							
				});		
			});	            
        });
    } else {
    	console.log("GET "+pathname);
		module({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {'Cookie': cookies}}, function(err, resp, html) {          
			response.writeHead(200, {"Content-Type": "text/html"});  		
			response.write(cleanHTML(html));		
			response.end();		
		});	    
    }
}


function cleanHTML(html) {
	return _cleanHTML($.load(html), html);
}

function _cleanHTML(parsedHTML, temp) {
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
		if (!target)		// ignores external links
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
	var parsedHTML = $.load(html);
	// get all img tags and loop over them
	
	// parsedHTML('div').map(function(i, div) {
// 		var href = $(div).attr('id');
// 		if (href && href.match('mastHead')) 
// 			temp = $.html(div);
// 	})
	
	return _cleanHTML(parsedHTML, html);
}

function processPage(href, module, callback) {
	href = href.replace('https','http');
	console.log('PROCESS',href);
	module({followAllRedirects: true, url: href, headers: {'Cookie': cookies}}, function(err, resp, html) {          
		callback(err, html);
	});	 	
}

function processDashboard(html, module, _callback) {
	var parsedHTML = $.load(html);
	
	var sites = {}
	
	// removes normal OWL content
	parsedHTML('#innercontent').empty();
	parsedHTML('li.nav-menu').css('display','none')
	parsedHTML('li.more-tab').css('display','none')	
	parsedHTML('.nav-selected').css('display','default')	
	
	var found = false;	
	
	parsedHTML('<ul class="topnav" id="faketopnav"></ul>').appendTo('#innercontent')
	
	
	parsedHTML('ul[class=otherSitesCategorList]').children().map(function(i, li) {
		found = true;
		$(li).children().map(function(i, a) {
			var href = $(a).attr('href');
			var title = $(a).attr('title');			
			
			if (!href.match('#') && title.lastIndexOf('MEDICINE', 0) === 0) {
				var hash = crypto.createHash('md5').update(title).digest('hex');
				sites[hash] = href;
				parsedHTML('<li><a id="'+hash+'" href="'+href+'" title="'+title+'"><span>'+title+'</span></a></li>').appendTo('#faketopnav');
			}
		})
	});
	
	async.each(Object.keys(sites), function(site, callback) {
		processPage(sites[site], module, function(err, res) {
			// do something with res
			console.log(res);
			parsedHTML(res).after('#'+site)
			callback(err);
		})
	}, function(err) {
		if (err) console.log(err);
		_callback(_cleanHTML(parsedHTML, found?parsedHTML.html():html));		
	});
}

var domain = '';
var cookies = {};

http.createServer(function(req, response) { 
	var cookiejar = new Cookies(req, response);
	var pathname = url.parse(req.url).pathname;
	
	var session = cookiejar.get('JSESSIONID');
	
	if (!session || !cookies[session]) {
		request('http://owl.uwo.ca/portal', function(err, resp, html) {
			
			cookieIn = resp.headers['set-cookie']		
			for (var i = 0; i < cookies.length; i++) {
				cookieIn[i] = cookieIn[i].replace('Secure;','')
				cookieIn[i] = cookieIn[i].replace('secure','')						
			}
			
			session = cookieIn[0].substring(cookieIn[0].indexOf('=')+1, cookieIn[0].indexOf(';'))
			cookies[session] = cookieIn;
			cookiejar.set('JSESSIONID', session);
			
			response.writeHead(200, {"Content-Type": "text/html"}); 		
			response.write(processLogin(html));		
			response.end();		
		});
	} else {
		if (pathname.match('/portal/logout'))
			delete cookies[session] 
		processRequest(req, request, response, pathname, cookies[session]);
	}
}).listen(config.port);