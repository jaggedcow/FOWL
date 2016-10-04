var Cookies = require('cookies')
var fs = require('fs')
var http = require("http")
var https = require("https")
var qs = require('querystring')
var request = require('request')
var sys = require('systeminformation')
var url = require("url")

var config = require('./config.json')
delete config.key	// so it's not kept in memory

var util = require('./util')
var parser = require('./parser')

// logged in user sessions
var userInfo = {};

function processLogin(module, response, pathname, username, cookiejar) {	
	if (pathname.match('/'))
		pathname = '/portal/xlogin'
	
	var query = {}
	
	query.user = username
	query.pw = util.decrypt(userInfo[username].pass)	
	
	var post = {eid:query.user, pw:query.pw}
    var auth = "Basic " + new Buffer(post['eid'] + ":" + post['pw']).toString("base64");
	
	module('http://owl.uwo.ca/portal', function(err, resp, html) {
		if (err)
			console.log(err)
		if (resp) {
			cookieIn = resp.headers['set-cookie']		
			for (var i = 0; i < cookieIn.length; i++) {
				cookieIn[i] = cookieIn[i].replace('Secure;','')
				cookieIn[i] = cookieIn[i].replace('secure','')						
			}
			
			session = cookieIn[0].substring(cookieIn[0].indexOf('=')+1, cookieIn[0].indexOf(';'))
			userInfo[username].cookie = cookieIn
			userInfo[username].session = session
		}
		
		request.post({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {"Authorization": auth, 'Cookie': userInfo[username]?userInfo[username].cookie:''}, form:post}, function(err, resp, html) {          	
			if (!err) {
				cookiejar.set('eid', post['eid'], {expires:util.addDays(new Date(), 7)});
				cookiejar.set('pw', util.encrypt(post['pw']), {expires:util.addDays(new Date(), 7)});
				cookiejar.set('key', util.getKey(), {expires:util.addDays(new Date(), 7)});								
			}
					
			parser.processDashboard(html, module, username, userInfo, function(res) {
				response.writeHead(200, {"Content-Type": "text/html"});  							
				response.write(res);
				response.end();	
				delete userInfo[username].cookie	// logs out user
				delete userInfo[username].session														
			});			
		});	 
		
	});
}


function processJSON(module, response, query, username, cookiejar) {			
	var post = {eid:query.user, pw:query.pw}
    var auth = "Basic " + new Buffer(post['eid'] + ":" + post['pw']).toString("base64");
	
	module('http://owl.uwo.ca/portal', function(err, resp, html) {
		if (err)
			console.log(err)
		if (resp) {
			cookieIn = resp.headers['set-cookie']		
			for (var i = 0; i < cookieIn.length; i++) {
				cookieIn[i] = cookieIn[i].replace('Secure;','')
				cookieIn[i] = cookieIn[i].replace('secure','')						
			}
			
			session = cookieIn[0].substring(cookieIn[0].indexOf('=')+1, cookieIn[0].indexOf(';'))
			
			if (userInfo[username])
				userInfo[username].cookie = cookieIn
			else
				userInfo[username] = {cookie: cookieIn, session: session}
		}
		
		request.post({followAllRedirects: true, url: 'http://owl.uwo.ca/portal/xlogin', headers: {"Authorization": auth, 'Cookie': userInfo[username]?userInfo[username].cookie:''}, form:post}, function(err, resp, html) {          	
			if (!err) {
				cookiejar.set('eid', post['eid'], {expires:util.addDays(new Date(), 7)});
				cookiejar.set('pw', util.encrypt(post['pw']), {expires:util.addDays(new Date(), 7)});
				cookiejar.set('key', util.getKey(), {expires:util.addDays(new Date(), 7)});				
			} 
			
			parser.processJSON(html, request, username, userInfo, true, query.pretty, function(res) {
				response.writeHead(200, {"Content-Type": "application/json"});  							
				response.write(res);
				response.end();	
				delete userInfo[username].cookie	// logs out user															
				delete userInfo[username].session				
			});		
		});	 
		
	});
}

function processRequest(req, module, response, pathname, username, cookiejar) {
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
            
			module.post({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {"Authorization": auth, 'Cookie': userInfo[username]?userInfo[username].cookie:''}, form:post}, function(err, resp, html) {          	
				if (!err) {
					cookiejar.set('eid', post['eid'], {expires:util.addDays(new Date(), 7)});
					cookiejar.set('pw', util.encrypt(post['pw']), {expires:util.addDays(new Date(), 7)});	
					cookiejar.set('key', util.getKey(), {expires:util.addDays(new Date(), 7)});												
				}
				parser.processDashboard(html, module, username, userInfo, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();	
					
					if (username) {
						delete userInfo[username].cookie	// logs out user	
						delete userInfo[username].session
					
						if (!err) {
							userInfo[username].pass = util.encrypt(""+post['pw']);
						}	
					}									
				});		
			});	            
        });
    } else {
		module({followAllRedirects: true, url: 'http://owl.uwo.ca'+pathname, headers: {'Cookie': userInfo[username]?userInfo[username].cookie:''}}, function(err, resp, html) {          
			if (pathname.match('/')) {
				parser.processDashboard(html, module, username, userInfo, function(res) {
					response.writeHead(200, {"Content-Type": "text/html"});  							
					response.write(res);
					response.end();	
					if (username) {
						delete userInfo[username].cookie	// logs out user
						delete userInfo[username].session
					}											
				});	
			} else {
				response.writeHead(200, {"Content-Type": "text/html"});  		
				response.write(cleanHTML(html));		
				response.end();	
			}
		});	    
    }
}

serverFunc = function(req, response) { 
	var cookiejar = new Cookies(req, response);
	var pathname = url.parse(req.url).pathname;
		
	var username = cookiejar.get('eid')
	var key = cookiejar.get('key')
	
	if (key) {
		password = util.decrypt(cookiejar.get('pw'), new Buffer(key,'hex')) 	
	}
	
	if (username && !password && !userInfo[username])
		username = undefined
	
	if (username && !userInfo[username])
		userInfo[username] = {pass: util.encrypt(""+password)}
	
    var query = url.parse(unescape(req.url), true).query; 

	if (pathname.match('/portal/logout')) {
		delete userInfo[username] 
		cookiejar.set('eid')
		cookiejar.set('pw')
		cookiejar.set('key')		
	}

	if (pathname.match('/json')) {
		if (query.user !== undefined && query.pw !== undefined)		
			processJSON(request, response, query, username, cookiejar);
		else {
			response.writeHead(403, {"Content-Type": "text/html"}); 		
			response.end();	
		}
	} else if (!pathname.match('/portal/relogin') && (!userInfo[username] || !userInfo[username].cookie)) {	
		if (!userInfo[username]) {			
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
					userInfo[username] = {cookie: cookieIn, session: session}					
	
					response.writeHead(200, {"Content-Type": "text/html"}); 		
					response.write(util.cleanHTML(html));		
					response.end();	
				}
			});
		} else {
			processLogin(request, response, pathname, username, cookiejar);
		}
	} else {
		processRequest(req, request, response, pathname, username, cookiejar);
	}
}

// redirects people to the HTTPS server
insecureFunc = function(req, response) {
	response.setHeader('Location', 'https://' + req.headers.host.replace(/:\d+/, ':' + config.securePort) + req.url);
	response.statusCode = 302;
	response.end();
}

fs.lstat('/etc/letsencrypt/live/fowl.rocks/', function(err, stats) {
    if (!err && stats.isDirectory()) {
		var options = {
			key: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/privkey.pem'),
			cert: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/fullchain.pem'),
			ca: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/chain.pem'),			
		}
		
		https.createServer(options, serverFunc).listen(config.securePort);		
		http.createServer(insecureFunc).listen(config.port);
    } else {
	    http.createServer(serverFunc).listen(config.port);
    }
});