var $ = require('cheerio')
var async = require('async')
var crypto = require('crypto')
var df = require('dateformat')
var Set = require('set') 

var formatter = require('./formatter')
var util = require('./util')

var config = require('./config.json')
delete config.key	// so it's not kept in memory

function _processPage(href, module, course, session, userInfo, cached, callback) {
	href = href.replace('https','http');
	module({followAllRedirects: true, url: href, headers: {'Cookie': userInfo[session].cookie}}, function(err, resp, html) {  
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			_processPageSidebar(html, module, course, session, userInfo, cached, callback);
		}
	});	 	
}

// grabs the sidebar links from a page and picks out the relevant parts for a dashboard
function _processPageSidebar(html, module, course, session, userInfo, cached, callback) {
	var options = ['PCCIA', 'Homework', 'Assignments', 'Lecture'];
	var blacklist = new Set(['Assignments Course Map']);
	
	var temp = {}
	var itemp = {}	// stores value:key compared to temp's key:value
	
	var parsedHTML = $.load(html);    
	var output = [];
	
	parsedHTML('a.Mrphs-toolsNav__menuitem--link').map(function(i, a) {	
		var title = $(a).text().trim();
		var href = $(a).attr('href');		
				
		for (var i = 0; i < options.length; i++) {
			if (title.indexOf(options[i]) !== -1 && !blacklist.contains(title)) {
				temp[options[i]] = href;
				itemp[href] = options[i];				
				break;
			}		
			if (title.match('Course Map') && options[i].match('Lecture')) {
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
		if (cached && itemp[site] !== 'Assignments')
			_callback(null, undefined)
		else
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
					var homework = [];
					
					// for ITM ILs, which are split up over multiple weeks
					parsedHTML('.itemlink').each(function(i, link) {
						var href = $(link).attr('href');
						var title = $(link).text()
						
						// added to remove multiple lecture links in Blood, valid pages have Week 1, etc
						if (!pageType.match('Lecture') || title.regexIndexOf('[0-9]') !== -1)
							homework.push(href);
					});
					
					// temp workaround for Cardio not tagging links
					if (course.indexOf('5120') !== -1 && pageType.match('Lecture')) {
						parsedHTML('span.navIntraTool').map(function(i, link) {	
							var title = $(link).children('a').text();
							var href = $(link).children('a').attr('href');		
									
							if (title.indexOf('Week') !== -1 && title.regexIndexOf('[0-9]') !== -1)
								homework.push(href)
						})   
					}
					
					if (homework.length === 0) {
						if (pageType.match('Lecture')) {
							if (config.debug) console.log("NO LECTURE", href)
							_callback(err, undefined)						
						} else {					
// 							if (pageType.match('Assignments'))
// 								util.cacheDynamic(session, src, course)
										
							var out = parsedHTML('table');
							
							if (out.length > 0)
								_callback(err, _processPageTableSync(out, pageType, course))
							else {
								if (config.debug) console.log("NO HOMEWORK", href)								
								_callback(err, undefined)
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
																				
										if (out.length > 0)
											__callback(err, _processPageTableSync(out, pageType, course))
										else {
											if (config.debug) console.log("NO TABLE", href)								
											_callback(err, undefined)											
										}
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
		// removes duplicates
		if ($(table).find('table').length > 0)
			return;
					
		$.load(table)('td, th').each(function(j, col) {
			var text = $(col).text().trim();
			if (text.search(/^(\w{3,5} +\d{1,2})/) !== -1) {
					// deal with lectures!!
				if (text.search(/^(\w{3,5} +\d{1,2} +& +\d{1,2})/) !== -1) {
					// dealing with multiple dates
					var dateStr1 = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
					var dateStr2 = text.match(/^(\w{3,5})/)[0]+' '+text.match(/(& +\d{1,2})/)[0].substring(1).trim()+' 20'+course.substring(course.length-2)+' UTC';			

					var date1 = new Date(dateStr1);
					var date2 = new Date(dateStr2);					
					
					date1 = util.addDays(date1, +0.95)
					date2 = util.addDays(date2, +0.95)					
					util.changeYearIfNeeded(date1, course);
					util.changeYearIfNeeded(date2, course);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';

					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})					
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
					
					var date = new Date(dateStr);
					
					date = util.addDays(date, +0.95)
					util.changeYearIfNeeded(date, course);	
					
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
					var dateStr1 = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
					var dateStr2 = text.match(/^(\w{3,5})/)[0]+' '+text.match(/(& +\d{1,2})/)[0].substring(1).trim()+' 20'+course.substring(course.length-2)+' UTC';			

					var date1 = new Date(dateStr1);
					var date2 = new Date(dateStr2);					
					
					date1 = util.addDays(date1, +0.95)
					date2 = util.addDays(date2, +0.95)					
					util.changeYearIfNeeded(date1, course);
					util.changeYearIfNeeded(date2, course);					
					
					lastDate = [date1.toString(), date2.toString()]					
					lastDateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
					
					output.push({'type':'Lecture', 'data':{date:lastDate[0], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
					output.push({'type':'Lecture', 'data':{date:lastDate[1], html:$(col).html(), textDate:lastDateStr, date_processed:true}, 'course':course})
				} else {
					var dateStr = text.match(/^(\w{3,5} +\d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
					
					var date = new Date(dateStr);
					
					date = util.addDays(date, +0.95)
					util.changeYearIfNeeded(date, course);	
					
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
	
	var rowLength = -1
	var setRowLength = false
	
	var output = parsedHTML('tr').map(function(i, row) {
		var temp = {}
		var skipRow = false;
		var skipLastDate = false;		
		
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
				findStr = 'a, strong, b'
				
			var foundLink = !type.match('Homework') || tempJ !== topic;	// we only want extra elements on Homework
			var title = $(col).find(findStr);	

			if (title.length === 1) {
				title = title.first();
				if ($(title).attr('href')) {
					foundLink = true;
					title = '<a target="_blank" href="'+$(title).attr('href')+'">'+$(title).text().trim()+'</a>'
				} else if ($(title).text().trim().length > 0 && type.match("Homework"))
					title = '<strong>'+$(title).text().trim()+'</strong>'
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
						if (j === date && temp['date'] === undefined) {
							skipRow = false;							
							temp['date'] = lastDate;
						} else {
							skipRow = false;														
							skipLastDate = true;
						}
						j++;
					}
					
					if (j === date && (columnOffset <= 0 || i === offendingRow || skipLastDate)) {
						skipRow = title.length === 0;
						if (!skipRow) {
							temp['date'] = title;
							
							if (i === offendingRow && !skipLastDate) {
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
		
		setRowLength = true;
		
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

var _dates = [
	'<a target="_blank" href="https://owl.uwo.ca/access/content/group/9ed134dc-0872-476b-a56e-1bfe1d80bb29/Primary%20Physical%20Exam%20Skills/pcm1_16_17_PPES_message_to_students.pdf">Message to Students from Course Co-Chairs</a>',
	'Note: An asterisk (*) beside a posting means the item will be selectively released at a later date.',
	'<a target="_blank" href="https://owl.uwo.ca/portal/site/4be60fd6-855f-4499-90aa-ac4efc4853d8/page-reset/2a661295-3fd8-4ec3-9b18-2e42e12a30cb">Assessment</a>',
	'<a target="_blank" href="https://owl.uwo.ca/portal/site/1180d000-6090-44fd-9cc9-6723b53e59a1/page/2757366c-1873-4239-baa4-42750442d2c3">Course Map</a>',
	'TBA',
	'N/A'
] 
var silentDates = new Set(_dates)

function _processPageDates(obj, firstDate, lastDate, course) {	
	if (obj.date === undefined)
		return {data: obj, firstDate:firstDate, endDate:lastDate};
	if (obj.date_processed)
		return {data: obj, firstDate:firstDate, endDate:lastDate};	
	var temp = []	// used to determine the first and last dates
	
	obj.textDate = obj.date;	// saves the original
	
	if (obj.date.search(/(\s{4}\w{3,5} \d{1,2}\s-\s\w{3,5} \d{1,2})/) !== -1) {	// PCCM 2	
		firstDate = undefined
		
		while (obj.date.search(/(\s{4}\w{3,5} \d{1,2} - \w{3,5} \d{1,2})/) !== -1) {
			obj.date = obj.date.substring(obj.date.search(/(\s{4}\w{3,5} \d{1,2} - \w{3,5} \d{1,2})/)).trim()

			// dealing with multiple dates
			var dateStr1 = obj.date.match(/^(\w{3,5} \d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
			var dateStr2 = obj.date.match(/- (\w{3,5} \d{1,2})/)[0]+' 20'+course.substring(course.length-2)+' UTC';
			dateStr2 = dateStr2.substring(2)		

			if (firstDate === undefined) {
				firstDate = dateStr1;
			}
			lastDate = dateStr2;
		}	
		
		firstDate = new Date(firstDate);	
		firstDate = util.addDays(firstDate, +0.95)
		util.changeYearIfNeeded(firstDate, course);		
		
		lastDate = new Date(lastDate);	
		lastDate = util.addDays(lastDate, +0.95)
		util.changeYearIfNeeded(lastDate, course);	
		
		obj.date = [firstDate.toString(), lastDate.toString()]			
	} else if (obj.date.toLowerCase().indexOf('end') !== -1 && lastDate !== undefined) {
		util.changeYearIfNeeded(lastDate, course);
		obj.date = util.addDays(lastDate,1).toString();
	} else if (obj.date.toLowerCase().indexOf('week') !== -1) {		
		if (firstDate == undefined) {
			return {deferred: true, firstDate:firstDate, endDate:lastDate}
		}	
		var date = util.addDays(firstDate,-1.05)
		var endDate = util.addDays(date, 4)
		var out = []
		
		do {
			util.changeYearIfNeeded(date, course);
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
		
		var date = new Date(string1+' 20'+course.substring(course.length-2)+' UTC')
		var endDate = new Date(string2+' 20'+course.substring(course.length-2)+' UTC')
		
		date = util.addDays(date, -0.05)
		
		var out = []
		
		do {
			util.changeYearIfNeeded(date, course);
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
		var date1 = new Date(string1+' 20'+course.substring(course.length-2)+' UTC')
		var date2 = new Date(string2+' 20'+course.substring(course.length-2)+' UTC')
		
		date1 = util.addDays(date1, -0.05)
		date2 = util.addDays(date2, -0.05)
		
		util.changeYearIfNeeded(date1, course);
		util.changeYearIfNeeded(date2, course);
		
		var out = [	{location:windsorFirst?'Windsor':'London' ,date:date1.toString()},
					{location:windsorFirst?'London':'Windsor' ,date:date2.toString()}]
					
		temp.push(date1)
		temp.push(date2)
		
		obj.date = out;
	} else {
		var out = []
		
		obj.date = util.replaceAll('*','', obj.textDate);
		var dateRegex = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|&)'
		
		var tempDate = obj.date
		var pastMonth = undefined		// NB: assumes that every date is on the same month
		while (tempDate.length > 0) {
			var end = tempDate.regexIndexOf('[0-9]{1,2}') + 2
			var start = tempDate.substring(0, end).regexIndexOf(dateRegex)			
			
			if (end === 1 || start === -1)
				break;
			else {
				foundDate = true
				var date = undefined
				if (pastMonth) {
					date = new Date(pastMonth+tempDate.substring(end-2, end)+' 20'+course.substring(course.length-2)+' UTC')
					
					date = util.addDays(date, -0.05)
					util.changeYearIfNeeded(date, course);		
				} else {
					date = new Date(tempDate.substring(start, end)+' 20'+course.substring(course.length-2)+' UTC')
					
					date = util.addDays(date, -0.05)
					util.changeYearIfNeeded(date, course);		
				}
				out.push(date.toString())
				temp.push(date);

				if (!pastMonth && start !== -1) {
					pastMonth = tempDate.substring(start, end-2)
				}

				tempDate = tempDate.substring(end)
			}	
		}
		
		if (out.length === 0) {
			if (!silentDates.contains(obj.textDate))
				console.log("Could not process date:", obj.textDate)
			return {data: obj, firstDate:firstDate, endDate:lastDate};	
		} else if (out.length === 1) {
			obj.date = out[0]
		} else {
			obj.date = out;
		}
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
	
	formatObj('ul.otherSitesCategorList').children().map(function(i, li) {
		$(li).children('div').children().map(function(i, a) {
			var href = $(a).attr('href');
			var title = $(a).text().trim()
			
			if (title !== undefined && !href.match('#') && title.lastIndexOf('MEDICINE', 0) === 0) {
				var hash = crypto.createHash('md5').update(title).digest('hex');
				sites[hash] = {'href':href, 'course':title};
				ignoredURLs.add(href);
				
				classes.push({title:title, href:href, hash:hash, displayTitle:util.replaceClasses(title)})
			}
		})
	});		

	var cachedContent = util.checkStaticCache(classes)
	var cachedLinks = util.checkDynamicCache(session)	
	if (cachedContent === undefined)	// invalidate dynamic cache too if new classes have been added
		cachedLinks = undefined

	// bypass usual stuff and just scrape the dynamic content
	if (cachedLinks !== undefined) {
		console.log("Skipping all pages, using dynamic cache")
		var homework = cachedContent.data.homework
		var pccia = cachedContent.data.pccia
		var lectures = cachedContent.data.lectures	
		var assignments = [];	
		
		async.map(cachedLinks, function(data, _callback) {
			module({followAllRedirects: true, url: data.href, headers: {'Cookie': userInfo[session]['cookie']}}, function(err, resp, html) {  
				if (err) {
					console.log(err);
					_callback(err, null);
				} else {
					var parsedHTML = $.load(html);				
					var out = parsedHTML('table');
					
					if (out.length > 0)
						_callback(err, _processPageTableSync(out, 'Assignments', data.course))
					else {
						if (config.debug) console.log("NO ASSIGNMENTS (cached)", data.href)								
						_callback(err, undefined)
					}	
				}
			});		
		}, function(err, results) {
			if (err) console.log(err);
					
			results = util.flattenArray(results)
			
			for (var i = 0; i < results.length; i++) {
				if (results !== null && results[i] !== undefined && results[i] !== null && results[i].data !== undefined) {
					assignments.push(results[i])
				}
			}
			
			assignments.sort(function(a,b) {
				var dateA = new Date(a.data.dueDate)
				var dateB = new Date(b.data.dueDate)
				
				return util.compareDates(dateA, dateB)			
			});
						
			for (var i = 0; i < classes.length; i++) {			
				var startDate = undefined;
				var endDate = undefined;			
				
				// convert relative PCCIA weeks into absolute dates
				for (var j = 0; j < homework.length; j++) {
					if (classes[i].title.match(homework[j].course)) {
						startDate = new Date(homework[j].data.date);
						if (!isNaN(startDate.getTime()))
							break;
					}
				}
				
				if (startDate) {
					startDate = util.addDays(startDate, -startDate.getDay())	// clever way to reset all the dates to prior Sunday
					
				
					for (var j = 0; j < pccia.length; j++) {
						if (classes[i].title.match(pccia[j].course)) {
							var displayDate = util.addDays(startDate, 7*pccia[j].data.week - 1)		// figures when PCCIA sesh is done
							pccia[j].data.displayUntil = displayDate.toString();
						}
					}
				}
				
				// determine when course ends
				for (var j = homework.length-1; j >= 0; j--) {
					if (classes[i].title.match(homework[j].course)) {
						endDate = new Date(homework[j].data.date);
						if (!isNaN(endDate.getTime()))
							break;
					}
				}
				
				for (var j = assignments.length-1; j >= 0; j--) {
					if (classes[i].title.match(assignments[j].course)) {
						var temp = new Date(assignments[j].data.dueDate);
						
						if (!isNaN(temp.getTime())) {
							if (endDate < temp)
								endDate = temp;
							break;
						}
					}
				}			
				
				if (endDate) {
					if (endDate.getDay() !== 0)			
						endDate = util.addDays(endDate, 7-endDate.getDay())	// clever way to reset all the dates to next Sunday				
					classes[i].displayUntil = endDate.toString();
				}
			}					
							
			util.logVisit(session, classes, {classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}, true)
					
			if (JSONoutput) {
				if (prettyOutput)
					callback(JSON.stringify({classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}, null, 4))
				else
					callback(JSON.stringify({classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}));
			} else
				callback({ignoredURLs:ignoredURLs, formatObj:formatObj, classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia});
		});
		return;
	}
	
	async.map(Object.keys(sites), function(site, _callback) {
		if (cachedContent === undefined || cachedContent.dynamicClasses.contains(sites[site].course))
			_processPage(sites[site]['href'], module, sites[site]['course'], session, userInfo, cachedContent !== undefined, _callback)
		else {
			console.log('Skipping static cached page:', sites[site])
			_callback()
		}
	}, function(err, results) {
		if (err) console.log(err);
				
		results = util.flattenArray(results)
		
		var homework = [];
		var assignments = [];
		var pccia = [];
		var lectures = [];
		
		for (var i = 0; i < results.length; i++) {
			if (results !== null && results[i] !== undefined && results[i] !== null && results[i].data !== undefined) {
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
						
		assignments.sort(function(a,b) {
			var dateA = new Date(a.data.dueDate)
			var dateB = new Date(b.data.dueDate)
			
			return util.compareDates(dateA, dateB)			
		});
		
		if (cachedContent !== undefined) {
			homework = cachedContent.data.homework
			pccia = cachedContent.data.pccia
			lectures = cachedContent.data.lectures	
		}
		
		lectures.sort(function(a,b) {
			var dateA = new Date(a.data.date)
			var dateB = new Date(b.data.date)
			
			return util.compareDates(dateA, dateB)							
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
			dateA = new Date(dateA)
			dateB = new Date(dateB)
			
			return util.compareDates(dateA, dateB)				
		})
		
		for (var i = 0; i < classes.length; i++) {			
			var startDate = undefined;
			var endDate = undefined;			
			
			// convert relative PCCIA weeks into absolute dates
			for (var j = 0; j < homework.length; j++) {
				if (classes[i].title.match(homework[j].course)) {
					startDate = new Date(homework[j].data.date);
					if (!isNaN(startDate.getTime()))
						break;
				}
			}
			
			if (startDate) {
				startDate = util.addDays(startDate, -startDate.getDay())	// clever way to reset all the dates to prior Sunday
				
			
				for (var j = 0; j < pccia.length; j++) {
					if (classes[i].title.match(pccia[j].course)) {
						var displayDate = util.addDays(startDate, 7*pccia[j].data.week - 1)		// figures when PCCIA sesh is done
						pccia[j].data.displayUntil = displayDate.toString();
					}
				}
			}
			
			// determine when course ends
			for (var j = homework.length-1; j >= 0; j--) {
				if (classes[i].title.match(homework[j].course)) {
					endDate = new Date(homework[j].data.date);
					if (!isNaN(endDate.getTime()))
						break;
				}
			}
			
			for (var j = assignments.length-1; j >= 0; j--) {
				if (classes[i].title.match(assignments[j].course)) {
					var temp = new Date(assignments[j].data.dueDate);
					
					if (!isNaN(temp.getTime())) {
						if (endDate < temp)
							endDate = temp;
						break;
					}
				}
			}			
			
			if (endDate) {
				if (endDate.getDay() !== 0)			
					endDate = util.addDays(endDate, 7-endDate.getDay())	// clever way to reset all the dates to next Sunday				
				classes[i].displayUntil = endDate.toString();
			}
		}
				
		pccia.sort(function(a,b) {
			var dateA = new Date(a.data.displayUntil)
			var dateB = new Date(b.data.displayUntil)
			
			return util.compareDates(dateA, dateB)			
		});
		
					
		if (cachedContent === undefined)
			util.cacheStatic(classes, {homework:homework, lectures:lectures, assignments:assignments, pccia:pccia})

		
		util.logVisit(session, classes, {classes:classes, homework:homework, lectures:lectures, assignments:assignments, pccia:pccia}, cachedContent !== undefined)
				
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
		
		formatter.addHeaders(formatObj, session, userInfo);

		var today = new Date();
		var tempDate = undefined;
		today = util.addDays(today, -0.25);	// adjusts for time zones
		var tomorrow = util.addDays(today, 1);
		var twodays = util.addDays(today, 2);			
		var yesterday = util.addDays(today, -1)	
		var lastDate = undefined

		for (var i = 0; i < classes.length; i++) {
			if (classes[i].displayUntil === undefined || yesterday < new Date(classes[i].displayUntil))
				formatter.addClass(formatObj, classes[i])
		}
		
		for (var i = 0; i < classes.length; i++) {
			if (yesterday >= new Date(classes[i].displayUntil))
				formatter.addClass(formatObj, classes[i], true)
		}		
		
		formatter.addLectureHeader(formatObj)
				
										
		for (var i = 0; i < lectures.length; i++) {
			var content = lectures[i];								
			
			var dates = []
			if (util.isArray(content.data.date)) {
				for (var j = 0; j < content.data.date.length; j++)
					dates.push(new Date(content.data.date[j]));
			} else {
				dates = [new Date(content.data.date)];
			}
			
			// only sets it for the first lecture (aka earliest date)
			if (tempDate === undefined) {
				tempDate = dates[0]
				placeholderDate = tempDate
				placeholderCount = 0
				while (today < placeholderDate) {
					placeholderDate = util.addDays(placeholderDate, -1);
					placeholderCount++;			
				}
				for (var j = 0; j < placeholderCount-1; j++) {
					placeholderDate = util.addDays(placeholderDate, 1);					
					compareDate = util.compareDates(placeholderDate, today);
					if (compareDate === 0 || compareDate === 1)
						formatter.addLecturePlaceholder(formatObj, placeholderDate, compareDate === 1);
					else
						formatter.addLecturePlaceholder(formatObj, placeholderDate, null, compareDate > 1);
				}
			}
			
			var compareDate = 0
			
			var isEmptyDate = true;
			var emptyDateCounter = 0;
			
			while (isEmptyDate && emptyDateCounter < 99) {		
				for (var j = 0; j < dates.length; j++) {
					if (lastDate !== undefined && isFinite(lastDate) && (dates[j].getMonth() !== lastDate.getMonth() || dates[j].getDate() !== lastDate.getDate()))
						tempDate = util.addDays(tempDate, 1)		
					
					if (dates[j] < util.addDays(tempDate,1)) {
						isEmptyDate = false;
						emptyDateCounter = 0;
					}
					if (!isFinite(dates[j])) {
						isEmptyDate = false;
						emptyDateCounter = 0;						
					}
					
					lastDate = dates[j]
						
					compareDate = util.compareDates(dates[j], today)			
				}	
									
				if (!isEmptyDate) {					
					if (compareDate === 0 || compareDate === 1) {
						formatter.addLecture(formatObj, content, dates[0], compareDate === 1)			
					} else {
						formatter.addLecture(formatObj, content, dates[0], null, compareDate > 1)
					}
				} else {
					compareDate = util.compareDates(tempDate, today)			
					
					if (compareDate === 0 || compareDate === 1) {
						formatter.addLecturePlaceholder(formatObj, tempDate, compareDate === 1)			
					} else {
						formatter.addLecturePlaceholder(formatObj, tempDate, null, compareDate > 1)
					}					
				}
			
				if (isEmptyDate) {
					tempDate = util.addDays(tempDate, 1)				
					emptyDateCounter++
				}
			}
		}
		
		formatter.addLectureFooter(formatObj)
				
		for (var i = 0; i < pccia.length; i++) {
			if (today < new Date(pccia[i].data.displayUntil))
				formatter.addPCCIA(formatObj, pccia[i])
		}
		
		for (var i = 0; i < assignments.length; i++) {
			if (yesterday < new Date(assignments[i].data.dueDate))
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
		
		
		formatter.addButtons(formatObj, futureHomeworkExists)
		formatter.addFooters(formatObj, maxPreviousDate)

		callback(util._cleanHTML(formatObj, classes.length > 0?formatObj.html():html, out.ignoredURLs));		
	});
}

exports.processDashboard 	= processDashboard;
exports.processJSON 		= processJSON;