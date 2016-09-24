var Cookies = require('cookies')
var fs = require('fs')
var http = require("http")
var https = require("https")
var qs = require('querystring')
var request = require('request')
var url = require("url")

var config = require('./config.json')

var util = require('./util')
var parser = require('./parser')

// logged in user sessions
var userInfo = {};


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
				parser.processDashboard(html, module, session, function(res) {
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
				parser.processDashboard(html, module, session, function(res) {
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

function processLogin(html) {
	return util.cleanHTML(html);
}

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
			cert: fs.readFileSync('/etc/letsencrypt/live/fowl.rocks/cert.pem')
		}
		
		https.createServer(options, serverFunc).listen(config.securePort);		
		http.createServer(insecureFunc).listen(config.port);
    } else {
	    http.createServer(serverFunc).listen(config.port);
    }
});

exports.userInfo = userInfo