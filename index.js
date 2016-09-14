var cheerio = require('cheerio');
var http = require("http");
var request = require('request');
var http = require("http"); 
var url = require("url");

var temp = '';

function gotHTML(err, resp, html) {
	if (err) return console.error(err);
	var parsedHTML = cheerio.load(html);
	// get all img tags and loop over them
	
	parsedHTML('div').map(function(i, div) {
		var href = cheerio(div).attr('id');
		if (href && href.match('mastHead')) 
			temp = cheerio.html(div);
	})
	
	parsedHTML('img').map(function(i, img) {
		var href = cheerio(img).attr('src')
		temp = temp.replace(''+href,'http://owl.uwo.ca'+href);
	})	
}

var domain = ''

http.createServer(function(req, response) { 
	response.writeHead(200, {"Content-Type": "text/html"}); 
	var pathname = url.parse(req.url).pathname;
	
	if (!pathname.match('/portal/xlogin')) {
		request('http://owl.uwo.ca/portal', function(err, resp, html) {
			gotHTML(err, resp, html);
			response.write(temp);		
			response.end();		
		});
	} else {
		request('http://owl.uwo.ca/', function(err, resp, html) {
			response.write(html);		
			response.end();		
		});	
	}
}).listen(8888);