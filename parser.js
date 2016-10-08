var $ = require('cheerio')
var async = require('async')
var crypto = require('crypto')
var df = require('dateformat')
var Set = require('set') 

var formatter = require('./formatter')
var util = require('./util')

function _processPage(href, module, course, session, userInfo, callback) {
	href = href.replace('https','http');
	module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session].cookie}}, function(err, resp, html) {  
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			_processPageSidebar(html, module, course, session, userInfo, callback);
		}
	});	 	
}

// grabs the sidebar links from a page and picks out the relevant parts for a dashboard
function _processPageSidebar(html, module, course, session, userInfo, callback) {
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
		_processPageInner(site, module, itemp[site], course, session, userInfo, _callback);
	}, callback);
}

// finds the frame holding the homework or assignments list and grabs the table
function _processPageInner(href, module, pageType, course, session, userInfo, callback) {
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
								_callback(err, _processPageTableSync(out, pageType, course))
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
										__callback(err, _processPageLectureSync(parsedHTML, course, href))						
									} else {									
										var out = parsedHTML('table');
										
										__callback(err, _processPageTableSync(out, pageType, course))
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

function _processPageLectureSync(parsedHTML, course, href) {
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
					
					date1 = util.addDays(date1, +0.95)
					date2 = util.addDays(date2, +0.95)					
					util.changeYearIfNeeded(date1);
					util.changeYearIfNeeded(date2);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';

					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})					
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					var date = new Date(dateStr);
					
					date = util.addDays(date, +0.95)
					util.changeYearIfNeeded(date);	
					
					lastDate = date.toString()
					lastDateStr = dateStr;
					
					output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
				}
			} else {
				var keep = false;
				var text = $(col).find('a').each(function(i, a) {
					if ($(a).text().trim().indexOf("Objective") !== -1 || $(a).text().trim().indexOf("Slide") !== -1)
						keep = true;
				});
				
				if (keep) {
					if (util.isArray(lastDate)) {
						output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
						output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					} else {
						output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
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
					
					date1 = util.addDays(date1, +0.95)
					date2 = util.addDays(date2, +0.95)					
					util.changeYearIfNeeded(date1);
					util.changeYearIfNeeded(date2);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' '+new Date().getFullYear()+' UTC';
					
					var date = new Date(dateStr);
					
					date = util.addDays(date, +0.95)
					util.changeYearIfNeeded(date);	
					
					lastDate = date.toString()
					lastDateStr = dateStr;
					
					output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
				}
			} else {
				var keep = false;
				var text = $(col).find('a').each(function(i, a) {
					if ($(a).text().trim().indexOf("Objective") !== -1 || $(a).text().trim().indexOf("Slide") !== -1)
						keep = true;
				});
				
				if (keep) {
					if (util.isArray(lastDate)) {
						output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
						output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					} else {
						output.push({'type':'Lecture', 'data':{date:lastDate, html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					}
				}
			}
		});
	});
	
	return output;
}

// converts a table containing homework or assignment info and converts it to JSON
function _processPageTableSync(input, type, course) {
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
			var dateData = _processPageDates(output[i].data, firstDate, endDate, course)
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

function _processPageDates(obj, firstDate, lastDate, course) {	
	if (obj.date === undefined)
		return {data: obj, firstDate:firstDate, endDate:lastDate};
	if (obj.date_processed)
		return {data: obj, firstDate:firstDate, endDate:lastDate};	
	var temp = []	// used to determine the first and last dates
	
	obj.textDate = obj.date;	// saves the original
	
	if (obj.date.toLowerCase().indexOf('end') !== -1) {
		util.changeYearIfNeeded(lastDate);
		obj.date = util.addDays(lastDate,1).toString();
	} else if (obj.date.toLowerCase().indexOf('week') !== -1) {		
		if (firstDate == undefined) {
			return {deferred: true, firstDate:firstDate, endDate:lastDate}
		}	
		var date = util.addDays(firstDate,-1.05)
		var endDate = util.addDays(date, 4)
		var out = []
		
		do {
			util.changeYearIfNeeded(date);
			out.push(date.toString())
			temp.push(date);			
			date = util.addDays(date, 1)
		} while (date <= endDate)
		
		obj.date = out;
		
		obj.displayDate = obj.textDate.substring(obj.textDate.toLowerCase().indexOf('week'));
	} else if (obj.date.toLowerCase().indexOf('session') !== -1 && obj.date.indexOf('(') !== -1 && obj.date.indexOf(')') !== -1) {
		var dateString = obj.textDate.substring(obj.textDate.indexOf('(')+1,obj.textDate.indexOf(')'));
		var string1 = dateString.substring(0, dateString.indexOf('-'))
		var string2 = dateString.substring(0, dateString.indexOf(' '))+ ' '+dateString.substring(dateString.indexOf('-')+1)
		
		var date = new Date(string1+' '+new Date().getFullYear()+' UTC')
		var endDate = new Date(string2+' '+new Date().getFullYear()+' UTC')
		
		date = util.addDays(date, -0.05)
		
		var out = []
		
		do {
			util.changeYearIfNeeded(date);
			out.push(date.toString())
			temp.push(date);			
			date = util.addDays(date, 1)
		} while (date <= endDate)
		
		obj.date = out;
		
		obj.displayDate = course + ' Session'		
	} else if (obj.date.indexOf('(W)') !== -1 && obj.date.indexOf('(L)') !== -1) {
		var windsorFirst = obj.date.indexOf('(W)') < obj.date.indexOf('(L)');
		var string1 = obj.textDate.substring(0, obj.textDate.indexOf('('));
		var string2 = obj.textDate.substring(0, obj.textDate.indexOf('(')-2) + ' '+ obj.textDate.substring(obj.textDate.lastIndexOf('(')-2,obj.textDate.lastIndexOf('('));		
		var date1 = new Date(string1+' '+new Date().getFullYear()+' UTC')
		var date2 = new Date(string2+' '+new Date().getFullYear()+' UTC')
		
		date1 = util.addDays(date1, -0.05)
		date2 = util.addDays(date2, -0.05)
		
		util.changeYearIfNeeded(date1);
		util.changeYearIfNeeded(date2);
		
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
		
		date = util.addDays(date, -0.05)
		util.changeYearIfNeeded(date);		
		
		obj.date = date.toString();
		temp.push(date);
	}
	
	for (var i = 0; i < temp.length; i++) {
		if (firstDate === undefined || temp[i] < firstDate)
			firstDate = temp[i]
		if (lastDate === undefined || temp[i] > lastDate)
			lastDate = temp[i]
	}
		
	obj.date_processed = true;	
		
	return {data: obj, firstDate:firstDate, endDate:lastDate};
}

function processJSON(html, module, session, userInfo, JSONoutput, prettyOutput, callback) {
	var ignoredURLs = new Set();	
	var sites = {}	
	var classes = []

	var formatObj = formatter.initPage(html);
	
	formatObj('ul[class=otherSitesCategorList]').children().map(function(i, li) {
		$(li).children().map(function(i, a) {
			var href = $(a).attr('href');
			var title = $(a).attr('title');			
			
			if (!href.match('#') && title.lastIndexOf('MEDICINE', 0) === 0) {
				var hash = crypto.createHash('md5').update(title).digest('hex');
				sites[hash] = {'href':href, 'course':title};
				ignoredURLs.add(href);
				
				classes.push({title:title, href:href, hash:hash, displayTitle:util.replaceClasses(title)})
			}
		})
	});		

	async.map(Object.keys(sites), function(site, _callback) {
		_processPage(sites[site]['href'], module, sites[site]['course'], session, userInfo, _callback)
	}, function(err, results) {
		if (err) console.log(err);
				
		results = util.flattenArray(results)
		
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
				
				if (util.isArray(a.data.date)) {
					dateA = a.data.date[0];
					if (typeof dateA === 'object')
						dateA = dateA.date;
				}				
			}
			if (dateB !== undefined) {
				dateB = dateB.date;
				
				if (util.isArray(b.data.date)) {
					dateB = b.data.date[0];
					if (typeof dateB === 'object')
						dateB = dateB.date;
				}				
			}			
			return new Date(dateA) - new Date(dateB);
		})
		
		if (JSONoutput) {
			if (prettyOutput)
				callback(JSON.stringify({classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}, null, 4))
			else
				callback(JSON.stringify({classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}));
		} else
			callback({ignoredURLs:ignoredURLs, formatObj:formatObj, classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia});
	});	
}

// finds the class pages wanted on the dashboard
function processDashboard(html, module, session, userInfo, callback) {	
	processJSON(html, module, session, userInfo, false, undefined, function(out) {
		var classes = out.classes
		var homework = out.homework;
		var assignments = out.assignments;
		var pccia = out.pccia;
		var lectures = out.lectures;
		
		var formatObj = out.formatObj;
						
		var todayLecture = false
		var tomorrowLecture = false
		for (var i = 0; i < lectures.length; i++) {
			var content = lectures[i];						
			var today = new Date();
			today = util.addDays(today, -0.25);	// adjusts for time zones
			var tomorrow = util.addDays(today, 1);
			var twodays = util.addDays(today, 2);			
			var yesterday = util.addDays(today, -1)			
			
			var dates = []
			if (util.isArray(content.data.date)) {
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
		
		
		formatter.addHeaders(formatObj, session, userInfo);

		for (var i = 0; i < classes.length; i++) {
			formatter.addClass(formatObj, classes[i])
		}
		
		formatter.addLectureHeader(formatObj, todayLecture, tomorrowLecture)
			
		for (var i = 0; i < lectures.length; i++) {
			var content = lectures[i];						
			var today = new Date();
			today = util.addDays(today, -0.25);	// adjusts for time zones
			var tomorrow = util.addDays(today, 1);
			var twodays = util.addDays(today, 2);			
			var yesterday = util.addDays(today, -1)			
			
			var dates = []
			if (util.isArray(content.data.date)) {
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
				
			if (isToday) {
				formatter.addLecture(formatObj, content, false)
			}	
			if (isTomorrow) {
				formatter.addLecture(formatObj, content, true)			
			}			
		}
		
		for (var i = 0; i < pccia.length; i++) {
			formatter.addPCCIA(formatObj, pccia[i])
		}
		
		for (var i = 0; i < assignments.length; i++) {
			formatter.addAssignment(formatObj, assignments[i])
		}
		
		var maxPreviousDate = 0;
		var futureHomeworkExists = false;		// used to toggle 'Show All' button
		var logErrors = false;
		for (var i = 0; i < homework.length; i++) {		
			var content = homework[i];
			if (Object.keys(content.data).length < 4)
				continue;				
				
			var out = formatter.addHomework(formatObj, content, maxPreviousDate)
			
			// this indirection is needed because if addHomework returns false in future calls, we still have some homework to show
			if (out.outputHomework)
				futureHomeworkExists = true;
			maxPreviousDate = out.maxDate;
		}
		
		if (futureHomeworkExists) {
			formatter.addShowNextButton(formatObj)		
		}
		
		formatter.addShowPrevButton(formatObj)
		formatter.addFooters(formatObj)

		callback(util._cleanHTML(formatObj, classes.length > 0?formatObj.html():html, out.ignoredURLs));		
	});
}

exports.processDashboard 	= processDashboard;
exports.processJSON 		= processJSON;