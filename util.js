var $ = require('cheerio')
var crypto = require('crypto')
var deasync = require('deasync')
var fs = require('fs')
var Set = require('set') 
var sys = require('systeminformation')
var xor = require('buffer-xor')

var sourceKey = new Buffer('900f29b4e6564518c09ef4c3adb44fb233a43ad77eae1b4be5cbefe3b35539d42a1feec4','hex')
var memoryKey = undefined

function encrypt(string) {
	if (memoryKey === undefined)
		memoryKey = crypto.randomBytes(36)
	var configKey = new Buffer(JSON.parse(fs.readFileSync('./config.json', 'utf8')).key,'hex');
	
/*
	var done = false
	var uuidKey = undefined
	sys.system(function(data) {
		uuidKey = new Buffer(data.uuid,'utf-8')
		done = true
	})
	require('deasync').loopWhile(function(){return !done;});
*/
	
// 	var key = xor(sourceKey, uuidKey)
	var key = xor(sourceKey, configKey)	
	var key = xor(key, memoryKey)	
	
	var cipher = crypto.createCipher('aes256', key.toString('hex'))
	var output = cipher.update(string, 'utf-8', 'hex')
	output += cipher.final('hex');
	
	return output.toString('hex');	
}

function decrypt(string) {
	if (!string)
		return undefined
		
	var configKey = new Buffer(JSON.parse(fs.readFileSync('./config.json', 'utf8')).key,'hex');
	
/*
	var done = false
	var uuidKey = undefined
	sys.system(function(data) {
		uuidKey = new Buffer(data.uuid,'utf-8')
		done = true
	})
	require('deasync').loopWhile(function(){return !done;});
*/
	
// 	var key = xor(sourceKey, uuidKey)
	var key = xor(sourceKey, configKey)	
	var key = xor(key, memoryKey)	
	
	var decipher = crypto.createDecipher('aes256', key.toString('hex'))
	var output = decipher.update(string, 'hex', 'utf-8')
	output += decipher.final('utf-8');
	
	return output;	
	
}

function replaceAll (find, replace, str) {
  var find = find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(find, 'g'), replace);
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

function replaceClasses(temp) {
	temp = temp.replace(/MEDICINE 5115 001 FW16/g, 'ITM + PCCIA');
	temp = temp.replace(/MEDICINE 5151 001 FW16/g, 'Social Medicine');
	temp = temp.replace(/MEDICINE 5140 001 FW16/g, 'Professional Portfolio');
	temp = temp.replace(/MEDICINE 5139 001 FW16/g, 'PCCM');		
	temp = temp.replace(/MEDICINE 5121 001 FW16/g, 'Blood + PCCIA');
		
	temp = temp.replace(/MEDICINE 5250 001 FW16/g, 'Professional Identity');		
	temp = temp.replace(/MEDICINE 5246 001 FW16/g, 'PCCM 2');		
	temp = temp.replace(/MEDICINE 5203 001 FW16/g, 'Digestion');							
	
	return temp
}

exports.addDays 			= addDays
exports.changeYearIfNeeded 	= changeYearIfNeeded
exports.cleanHTML 			= cleanHTML
exports._cleanHTML			= _cleanHTML
exports.colourForCourse 	= colourForCourse
exports.dropShadowForCourse = dropShadowForCourse
exports.decrypt 			= decrypt
exports.encrypt 			= encrypt
exports.flattenArray 		= flattenArray
exports.isArray 			= isArray
exports.replaceAll 			= replaceAll
exports.replaceClasses 		= replaceClasses