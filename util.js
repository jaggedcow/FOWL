var $ = require('cheerio')
var crypto = require('crypto')
var deasync = require('deasync')
var fs = require('fs')
var Set = require('set') 
var sys = require('systeminformation')
var xor = require('buffer-xor')

var sourceKey = new Buffer('900f29b4e6564518c09ef4c3adb44fb233a43ad77eae1b4be5cbefe3b35539d42a1feec4','hex')
var memoryKey = undefined

function getKey() {
	if (memoryKey === undefined)
		memoryKey = crypto.randomBytes(36)	
	return memoryKey.toString('hex')
}

function encrypt(string) {
	if (!string)
		return undefined
	
	if (memoryKey === undefined)
		memoryKey = crypto.randomBytes(36)
	var configKey = new Buffer(JSON.parse(fs.readFileSync('./config.json', 'utf8')).key,'hex');

	var key = xor(sourceKey, configKey)	
	var key = xor(key, memoryKey)	
	
	var cipher = crypto.createCipher('aes256', key.toString('hex'))
	var output = cipher.update(string, 'utf-8', 'hex')
	output += cipher.final('hex');
	
	return output.toString('hex');	
}

function decrypt(string, tempKey) {
	if (!string)
		return undefined
		
	var configKey = new Buffer(JSON.parse(fs.readFileSync('./config.json', 'utf8')).key,'hex');

	if (!tempKey)
		tempKey = memoryKey
		
	var key = xor(sourceKey, configKey)	
	var key = xor(key, tempKey)	
	
	var decipher = crypto.createDecipher('aes256', key.toString('hex'))
	var output = decipher.update(string, 'hex', 'utf-8')
	output += decipher.final('utf-8');
	
	return output;	
}

function replaceAll (find, replace, str) {
  var find = find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return str.replace(new RegExp(find, 'g'), replace);
}

String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf = this.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

// WARNING: Not generalizable!
String.prototype.regexLastIndexOf = function(regex, startpos) {
	var string = this.split('').reverse().join('');
	var indexOf = string.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? this.length - (indexOf + (startpos || 0)) : indexOf;
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
		if (href.lastIndexOf('/access/login') !== 17 && href.lastIndexOf('/access/login') !== 18)
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
	
	
	parsedHTML = $.load(temp)
	
	parsedHTML('form').map(function(i, img) {
		var id = $(img).attr('id');
		if (id && id.match('loginForm')) {
			$(img).prepend('<label for="fakesave">Remember Me:</label><input name="fakesave" id="fakesave" type="checkbox">')
		}
	})	
	
	return replaceClasses(parsedHTML.html());
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
function changeYearIfNeeded(date, course) {
	if (date.getMonth() < 8)
		date.setFullYear(parseInt('20'+course.substring(course.length-2))+1)
}

function replaceClasses(temp) {
	temp = temp.replace(/MEDICINE 5115\w? 001 FW(\d){2}/g, 'ITM + PCCIA');
	temp = temp.replace(/MEDICINE 5151\w? 001 FW(\d){2}/g, 'Social Medicine');
	temp = temp.replace(/MEDICINE 5140\w? 001 FW(\d){2}/g, 'Professional Portfolio');
	temp = temp.replace(/MEDICINE 5139\w? 001 FW(\d){2}/g, 'PCCM');		
	temp = temp.replace(/MEDICINE 5121\w? 001 FW(\d){2}/g, 'Blood + PCCIA');
	temp = temp.replace(/MEDICINE 5116\w? 001 FW(\d){2}/g, 'Infection & Immunity + PCCIA');
	temp = temp.replace(/MEDICINE 5104\w? 001 FW(\d){2}/g, 'Genitourinary + PCCIA');
	temp = temp.replace(/MEDICINE 5105\w? 001 FW(\d){2}/g, 'Population Health');
	temp = temp.replace(/MEDICINE 5117\w? 001 FW(\d){2}/g, 'Skin + PCCIA');
	temp = temp.replace(/MEDICINE 5130\w? 001 FW(\d){2}/g, 'Medical Ethics');
	temp = temp.replace(/MEDICINE 5107\w? 001 FW(\d){2}/g, 'Epidemiology & CrAp');						
	temp = temp.replace(/MEDICINE 5119\w? 001 FW(\d){2}/g, 'Respiration & Airways + PCCIA');
	temp = temp.replace(/MEDICINE 5120\w? 001 FW(\d){2}/g, 'Heart & Circulation + PCCIA');		
		
	temp = temp.replace(/MEDICINE 5250\w? 001 FW(\d){2}/g, 'Professional Identity');		
	temp = temp.replace(/MEDICINE 5246\w? 001 FW(\d){2}/g, 'PCCM 2');		
	temp = temp.replace(/MEDICINE 5203\w? 001 FW(\d){2}/g, 'Digestion + PCCIA');							
	temp = temp.replace(/MEDICINE 5202\w? 001 FW(\d){2}/g, 'Endocrine & Metabolism + PCCIA');	
	
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
exports.getKey				= getKey
exports.isArray 			= isArray
exports.replaceAll 			= replaceAll
exports.replaceClasses 		= replaceClasses