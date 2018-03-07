var $ = require('cheerio')
var crypto = require('crypto')
var dateformat = require('dateformat')
var deasync = require('deasync')
var fs = require('fs')
var Set = require('set') 
var sys = require('systeminformation')
var xor = require('buffer-xor')

var formatter = require('./formatter')

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
	
	parsedHTML('link').map(function(i, img) {
		var href = $(img).attr('href')
		replaceSet.add(href);
	})		
	parsedHTML('script').map(function(i, img) {
		var href = $(img).attr('src')
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
	temp = replaceAll('<title>OWL', '<title>FOWL', temp);
	temp = replaceAll('Welcome to FOWL', 'Welcome to Fake OWL', temp);	
	temp = replaceAll("window.location='https://owl.uwo.ca/portal'", "window.location='/portal'", temp);
	temp = replaceAll('<a href="https://owl.uwo.ca/portal">','<a href="/portal">',temp)		// requires full tag to prevent removing other portal links
	temp = replaceAll('href="https://owl.uwo.ca/portal/logout"','href="/portal/logout"',temp)	
	temp = replaceAll('<meta http-equiv="Refresh" content="0:URL=https://owl.uwo.ca/portal">','<meta http-equiv="Refresh" content="0:URL=/portal">',temp)	
	
	parsedHTML = $.load(temp)
	
	logo = parsedHTML('.Mrphs-headerLogo--institution')
	logo.css('background', 'url("/images/owlEmblemWithText-small.svg") center center no-repeat')
	logo.css('width','134px')
	logo.css('margin-left','-20px')	
	
	parsedHTML('form').map(function(i, img) {
		var id = $(img).attr('id');
		if (id && id.match('loginForm')) {
			$(img).prepend('<label for="fakesave" class="Mrphs-loginForm__label">Remember Me:</label><input name="fakesave" id="fakesave" class="Mrphs-loginForm__input" style="margin: 0 1em 0 0; padding:0.25em" type="checkbox">')
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

function logVisit(username, classes, json, cached) {
	return;
	if (username === undefined) {
		// TODO: why is this happening?
		return;
	}
	var year = getYearFromClasses(classes);
	username = crypto.createHash('md5').update(username).digest('hex')		// store as little info as possible	
	var prefix = ''
	if (cached)
		prefix = '*'
	// temp
	fs.writeFile(prefix+year+'_'+username+'.json', JSON.stringify(json, null, 4))	
}

_staticCache = {}
function cacheStatic(classes, json) {
	var year = getYearFromClasses(classes)
	if (isFinite(year)) {
		var dynamic = new Set();
		for (var i = 0; i < json.assignments.length; i++) {
			dynamic.add(json.assignments[i].course)
		}
		_staticCache[year] = {classes:classes, data:{homework:json.homework, lectures:json.lectures, pccia:json.pccia}, dynamicClasses:dynamic};	
	}
}

_dynamicCache = {}
function cacheDynamic(user, href, course) {
	if (_dynamicCache[user] === undefined)
		_dynamicCache[user] = [];
	_dynamicCache[user].push({href:href, course:course})
}

_htmlCache = {}
function cacheHTML(classes, htmlObj, maxPreviousDate) {
	var year = getYearFromClasses(classes)
	if (isFinite(year)) {
		_htmlCache[year] = {html:htmlObj(formatter.mainId).html().toString(), classes:classes, maxPreviousDate:maxPreviousDate};	
	}
}

function checkDynamicCache(user) {
	return _dynamicCache[user];
}

function checkStaticCache(classes) {
	var year = getYearFromClasses(classes)
	var cache = _staticCache[year]
	
	if (cache === undefined)
		return undefined
	
	// confirms that there are no new classes
	if (cache.classes.length !== classes.length)
		return undefined
	
	var titles = new Set()
	for (var i = 0; i < classes.length; i++) {
		titles.add(classes[i].title)	
	}
	
	// confirms that all cached classes are present
	for (var i = 0; i < classes.length; i++) {
		if (!titles.contains(cache.classes[i].title))
			return undefined
	}
	
	if (cache.data.homework.length === 0 && cache.data.lectures.length === 0 && cache.data.pccia.length === 0) {
		delete _htmlCache[year]
		return undefined
	}
	
	return {data:cache.data, dynamicClasses:cache.dynamicClasses}
}

function checkHTMLCache(classes) {
	var year = getYearFromClasses(classes)	
	var cache = _htmlCache[year]
	
	if (cache === undefined)
		return undefined
	
	// confirms that there are no new classes
	if (cache.classes.length !== classes.length)
		return undefined
	
	var titles = new Set()
	for (var i = 0; i < classes.length; i++) {
		titles.add(classes[i].title)	
	}
	
	// confirms that all cached classes are present
	for (var i = 0; i < classes.length; i++) {
		if (!titles.contains(cache.classes[i].title))
			return undefined
	}
	
	return cache
}

function getYearFromClasses(classes) {
	var temp;
	var year = undefined;
	for (var i = 0; i < classes.length; i++) {
		course = classes[i].title
		temp = parseInt('20'+course.substring(course.length-2))
		if (year === undefined || temp < year)
			year = temp;
	}
	year += 4
	return year;
}

function isArray(a) {
    return (!!a) && (a.constructor === Array);
}

function addDays(date, days) {
	if (date === undefined && days === undefined)
		return new Date()
	else if (days === undefined && typeof date === 'number') {
		days = date;
		date = new Date();
	}
	
    var result = new Date(date);
    result.setTime(result.getTime() + days * 86400000);
    return result;
}

// dates before the start of the school year should be next year
function changeYearIfNeeded(date, course) {
	if (date.getMonth() < 8)
		date.setFullYear(parseInt('20'+course.substring(course.length-2))+1)
}

function getDateText(date) {
	var d = date.getDate()
	
	if (d < 10)
		d = "0"+d
	return (date.getMonth()+1)+""+d+""+date.getFullYear()
}

function compareDates(dateA, dateB) {
	if (!isFinite(dateA) && isFinite(dateB))
		return 2;	
	if (isFinite(dateA) && !isFinite(dateB))
		return -2;	
	if (!isFinite(dateA) && !isFinite(dateB))
		return 0;		
											
  var utc1 = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  var utc2 = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());

  return Math.floor((utc1 - utc2) / 86400000);
}

function replaceClasses(temp) {
	temp = temp.replace(/MEDICINE 5115\w? \d{3} FW(\d){2}/g, 'ITM + PCCIA');
	temp = temp.replace(/MEDICINE 5151\w? \d{3} FW(\d){2}/g, 'Social Medicine');
	temp = temp.replace(/MEDICINE 5140\w? \d{3} FW(\d){2}/g, 'Professional Portfolio');
	temp = temp.replace(/MEDICINE 5139\w? \d{3} FW(\d){2}/g, 'PCCM');		
	temp = temp.replace(/MEDICINE 5121\w? \d{3} FW(\d){2}/g, 'Blood + PCCIA');
	temp = temp.replace(/MEDICINE 5116\w? \d{3} FW(\d){2}/g, 'Infection & Immunity + PCCIA');
	temp = temp.replace(/MEDICINE 5104\w? \d{3} FW(\d){2}/g, 'Genitourinary + PCCIA');
	temp = temp.replace(/MEDICINE 5105\w? \d{3} FW(\d){2}/g, 'Population Health');
	temp = temp.replace(/MEDICINE 5117\w? \d{3} FW(\d){2}/g, 'Skin + PCCIA');
	temp = temp.replace(/MEDICINE 5130\w? \d{3} FW(\d){2}/g, 'Medical Ethics');
	temp = temp.replace(/MEDICINE 5107\w? \d{3} FW(\d){2}/g, 'Epidemiology & CrAp');						
	temp = temp.replace(/MEDICINE 5119\w? \d{3} FW(\d){2}/g, 'Respiration & Airways + PCCIA');
	temp = temp.replace(/MEDICINE 5120\w? \d{3} FW(\d){2}/g, 'Heart & Circulation + PCCIA');		
		
	temp = temp.replace(/MEDICINE 5250\w? \d{3} FW(\d){2}/g, 'Professional Identity');		
	temp = temp.replace(/MEDICINE 5246\w? \d{3} FW(\d){2}/g, 'PCCM 2');		
	temp = temp.replace(/MEDICINE 5203\w? \d{3} FW(\d){2}/g, 'Digestion + PCCIA');							
	temp = temp.replace(/MEDICINE 5202\w? \d{3} FW(\d){2}/g, 'Endocrine & Metabolism + PCCIA');	
	temp = temp.replace(/MEDICINE 5205\w? \d{3} FW(\d){2}/g, 'Reproduction + PCCIA');		
	temp = temp.replace(/MEDICINE 5210\w? \d{3} FW(\d){2}/g, 'Family Med');		
	temp = temp.replace(/MEDICINE 5218\w? \d{3} FW(\d){2}/g, 'MSK + PCCIA');	
	temp = temp.replace(/MEDICINE 5208\w? \d{3} FW(\d){2}/g, 'Emergency Care');	
	
	return temp
}

exports.addDays 			= addDays
exports.cacheDynamic 		= cacheDynamic
exports.cacheStatic 		= cacheStatic
exports.cacheHTML 			= cacheHTML
exports.changeYearIfNeeded 	= changeYearIfNeeded
exports.checkDynamicCache	= checkDynamicCache
exports.checkStaticCache	= checkStaticCache
exports.checkHTMLCache		= checkHTMLCache
exports.cleanHTML 			= cleanHTML
exports._cleanHTML			= _cleanHTML
exports.colourForCourse 	= colourForCourse
exports.compareDates 		= compareDates
exports.dropShadowForCourse = dropShadowForCourse
exports.decrypt 			= decrypt
exports.encrypt 			= encrypt
exports.flattenArray 		= flattenArray
exports.getDateText			= getDateText
exports.getKey				= getKey
exports.isArray 			= isArray
exports.logVisit 			= logVisit
exports.replaceAll 			= replaceAll
exports.replaceClasses 		= replaceClasses