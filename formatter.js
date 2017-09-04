var $ = require('cheerio')
var crypto = require('crypto')
var df = require('dateformat')
var fs = require('fs')
var util = require('./util')

var mainId = '#pageBody .Mrphs-pagebody'

var config = require('./config.json')
delete config.key	// so it's not kept in memory

// must be called first, returns an opaque object that should be passed on all subsequent calls

function loadPage(html) {
	return $.load(html);
}
function initPage(html, cachedHTML) {
	var parsedHTML = loadPage(html);
	
	// removes normal OWL content
	if (cachedHTML !== undefined) {	
		parsedHTML(mainId).html(cachedHTML);	
	} else
		parsedHTML(mainId).empty();	
	parsedHTML('li.nav-menu').css('display','none')
	parsedHTML('li.more-tab').css('display','none')	
	parsedHTML('.nav-selected').css('display','default')
	
	
	return parsedHTML;
}
function addHeaders(parsedHTML) {	
	parsedHTML('<h1 class="fakeheader" style="padding-left:2.5%; margin-bottom: -30px; position:relative;">Lectures</h1><div class="topnav" style="padding: 2em;" id="fakelecturenav"></div><div><h1 class="fakeheader" style="padding-left:2.5%; margin-bottom: -30px; margin-top: -1em;">Homework</h1></div><div class="topnav" style="padding: 2em; padding-top: 0em;" id="faketopnav"></div>').appendTo(mainId)
	
	parsedHTML('<div id="fakeweek" style="padding:1%; width:40%; max-width:40%; display:inline-block; float:left; position:relative;"><h2 class="fakeheader" id="fakeweeklabel">This Week</h2></div><div  id="fakepcciacontainer" style="padding:1%; max-width:27%; display:inline-block; float:right;"><div id="fakepccia"><h2 class="fakeheader">PCCIA</h2></div><div id="fakeassignments" style="margin-top:3em;"><h2 class="fakeheader">Pending Assignments</h2></div></div><div id="fakecoursecontainer" style="padding:1%; max-width:27%; display:inline-block; float:right;"><h2 class="fakeheader">Course Pages</h2></div>').appendTo('#faketopnav');
}

function addClass(parsedHTML, content, expired) {
	var opacity = '1.0'
	if (expired)
		opacity = '0.4'
	parsedHTML('<div class="fakebox" style="padding: 2px 8px 2px 8px; margin-bottom: 8px; opacity:'+opacity+'; '+util.dropShadowForCourse(content.title)+' background-color:'+util.colourForCourse(content.title)+';"><h5><a id="'+content.hash+'" target="_blank" href="'+content.href+'" title="'+content.title+'"><span>'+content.title+'</span></a><h5></div>').appendTo('#fakecoursecontainer');
}

function addLectureHeader(parsedHTML) {
	parsedHTML('<div id="fakelectureheader" style="display:table; width:102%; overflow-x:scroll;"></div>').appendTo('#fakelecturenav')
	parsedHTML('<div id="faketodaylecture" style="padding:1%; padding-bottom:0px; width:48%; display:table-cell; position:relative; vertical-align:top;"><h2 id="faketodayheader" class="fakeheader">Today</h2></div><div id="faketomorrowlecture" style="padding:1%; padding-bottom:0px; width:48%; display:table-cell; position:relative; vertical-align:top;"><h2 id="faketomorrowheader" class="fakeheader">Tomorrow</h2></div><div style="display:table-row"></div><div id="fakelecturerow" style="display:table-row"></div>').appendTo('#fakelectureheader')
}

var pastDate = undefined
var lectureData = {}
var displayType = 'table-cell' 

function addLecture(parsedHTML, content, date, compareToToday) {
	var dateNum = util.getDateText(date)
	
	var className = ''
	if (compareToToday === 0 || compareToToday === 1)
		displayType = 'table-cell'	
	
	if (compareToToday === 0)
		className = ' todayLecture'
	if (compareToToday === 1)
		className = ' tomorrowLecture'		
	
	if (pastDate != dateNum) {
		if (pastDate === undefined)
			pastDate = dateNum
			
		var output = '<div class="day_'+pastDate+'" style="display:'+displayType+'; width:46%; padding:1%; padding-right:4%; padding-top: 0px; padding-bottom: 1%;">'
		var lectures = Object.keys(lectureData).sort()	// might actually result in lectures out of order...
		for (var i = 0; i < lectures.length; i++) {
			lectureContent = lectureData[lectures[i]]
			output += '<div class="fakebox '+lectures[i]+className+'" style="margin-top:0px; padding: 2px 8px 8px 8px; '+util.dropShadowForCourse(lectureContent.course)+'margin-bottom: 8px; width:100%; background-color:'+util.colourForCourse(lectureContent.course)+'; opacity: 1.0;"><p>'+lectureContent.data.html+'</p></div>'
		}
		output += '<div style="height:100%"></div></div>'	// TODO: cache all lectures
		
		if (lectures.length > 0)
			parsedHTML(output).insertBefore('#fakelecturerow')	// TODO: do this only once (after cache)
		lectureData = {}
		displayType = 'none' 	
		pastDate = dateNum		
	}
		
	if (content !== undefined) {
		var hash = crypto.createHash('md5').update(content.course+content.data.date).digest('hex');		
		if (lectureData.hasOwnProperty('.lecture_'+hash)) {
			lectureData['.lecture_'+hash].data.html += '<br><br>'+content.data.html
		} else {
			lectureData['.lecture_'+hash] = content
		}
	}
}

var _comments = [
	'No lectures!',
	'Nothing scheduled today',	
	'Nada',
	'Zilch',
	'Nothing today!',
	'*crickets*',
	'Nothing to see here',
	'Quiet study day',
	'Sleep in!',
	'This day has been cancelled',
	'Did you know screen lout is an anagram for no lectures?',
	'Inside: Netflix, pillows, warm things;<br>Outside: I dunno bears? Better not risk it.',
	'Wow. Such quiet.',
	'A nice clear day for you',
	'Another day off brought to you by OWL',
	'Are you enjoying your day off?',
	'A clear night',
	'Here, have some time off',
	'Such freedom. Wow amaze.',
	'Is this thing still working?',
	'ZzzzZZzzzzzZzzz',
	'¯\\_(ツ)_/¯',
	'Call your mom, she misses you.',
	'#wellness day'
]
function addLecturePlaceholder(parsedHTML, date, compareToToday) {	
	// dumps any lectures waiting to be added to the HTML
	addLecture(parsedHTML, undefined, date)	
	
	var displayType = 'none'
	var className = ''
	if (compareToToday === 0 || compareToToday === 1)
		displayType = 'table-cell'	
	
	if (compareToToday === 0)
		className = ' todayLecture'
	if (compareToToday === 1)
		className = ' tomorrowLecture'	

		
	var dateNum = util.getDateText(date)
	var dateText = df(date,'mmm dd')
	var comment = _comments[Math.floor(Math.random()*_comments.length)]
	
	parsedHTML('<div class="placeholder_'+dateNum+className+'"style="display:'+displayType+'; width:46%; padding:1%; padding-right:4%; padding-top: 0px; padding-bottom: 1%;"><div class="fakebox" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; background-color: hsl(0, 0%, 96%); width:100%"><p><span style="font-size: 16.0px; font-family: arial , helvetica , sans-serif;"><strong>'+dateText+'</strong></span><br><span style="font-family: Verdana;font-size: small;">'+comment+'</span></p></div><div style="height:100%"></div></div>').insertBefore('#fakelecturerow')
}

/**
 * Actually inserts the last lectures
 */
function addLectureFooter(parsedHTML) {
	var output = '<div class="day_'+pastDate+'" style="display:'+displayType+'; width: 46%; padding:1%; padding-right:4%; padding-top: 0px; padding-bottom: 1%;">'
	var lectures = Object.keys(lectureData).sort()
	for (var i = 0; i < lectures.length; i++) {
		lectureContent = lectureData[lectures[i]]
		output += '<div class="fakebox '+lectures[i]+'" style="margin-top:0px; padding: 2px 8px 8px 8px; '+util.dropShadowForCourse(lectureContent.course)+'margin-bottom: 8px; width:100%; background-color:'+util.colourForCourse(lectureContent.course)+'; opacity: 1.0;"><p>'+lectureContent.data.html+'</p></div>'
	}
	output += '<div style="height:100%"></div></div>'
	
	parsedHTML(output).insertBefore('#fakelecturerow')
	lectureData = {}
	pastDate = undefined
	displayType = 'table-cell' 	
}

function addPCCIA(parsedHTML, content) {
	var output = '<div class="fakebox" style="padding: 2px 8px 8px 8px; opacity: 1.0; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h5>Week '+content.data.week+' - '+content.data.topic+'<h5>';
	if (content.data.objectives !== undefined) {
		output += content.data.objectives+' '
	} else {
		output += '&nbsp; '
	}
	if (util.isArray(content.data.resources)) {
		 for (var j = 0; j < content.data.resources.length; j++) {
		 	var item = content.data.resources[j];
		    if (j == 0) {
		    	output += '<span style="position:absolute; right:8px;">'+item+'</span><br><strong>Additional Resources</strong><ul>'
		    } else if (item !== undefined) {
			  	output += '<li>'+item+'</li>'
		    }
		 }
		 output += '</ul>'
	} else 
		output += '<span style="position:absolute; right:8px;">'+content.data.resources+'</span></div>'
	parsedHTML(output).appendTo("#fakepccia")
}

function removeAllAssignments(parsedHTML) {
	parsedHTML("#fakeassignments").html('<h2 class="fakeheader">Pending Assignments</h2>')
}

function addAssignment(parsedHTML, content) {
	if (content.data.status.indexOf("Submitted") === -1)					
		parsedHTML('<div class="fakebox" style="padding: 2px 8px 8px 8px; opacity: 1.0; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h5>'+content.data.title+'</h5>'+
	'<strong>Status</strong>: '+content.data.status+' <span style="float:right;"><strong>Due</strong>: '+df(util.addDays(new Date(content.data.dueDate),-0.05), 'mmm dd, yyyy')+'</span></div>').appendTo("#fakeassignments")	
}

function addHomework(parsedHTML, content, maxPreviousDate) {
	var futureHomeworkExists = false;
	
	var output = '<div style="padding: 2px 8px 8px 8px; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><h5>%DATE%';
	var output2 = '<div style="padding: 2px 8px 8px 8px; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><h5>%DATE%';			
	var multipleOutput = false;
	var replaceDate = true;		// whether a date should be replaced by a relative date (tonight, tomorrow, etc)
	
	var dates;
	var dateStr1, dateStr2;
	
	if (util.isArray(content.data.date)) {
		if (typeof content.data.date[0] === 'object') {
			multipleOutput = true;
			dates = [new Date(content.data.date[0].date), new Date(content.data.date[1].date)]
			dateStr1 = '<span class="fakedate">'+df(content.data.date[0].date, 'mmm dd')+'</span> ('+ content.data.date[0].location+' only)';
			dateStr2 = '<span class="fakedate">'+df(content.data.date[1].date, 'mmm dd')+'</span> ('+ content.data.date[1].location+' only)';					
		} else {
			dates = [];	
			for (var j = 0; j < content.data.date.length; j++) {
				dates.push(new Date(content.data.date[j]));
			}
			dateStr1 = '<span class="fakedate">Prior to your session</span>';
		}								
	} else {
		dates = [new Date(content.data.date)];
		if (!isNaN(Date.parse(content.data.date)))
			dateStr1 = '<span class="fakedate">'+df(content.data.date, 'mmm dd')+'</span>';
		else {
			console.log("INVALID DATE", content.data.date);
			dateStr1 = "Invalid Date"
			logErrors = true;
		}
	}
	
	if (content.data.displayDate && !multipleOutput) {
		dateStr1 = 'Prior to your ' + content.data.displayDate;
		dateStr2 = 'Prior to your ' + content.data.displayDate;
		replaceDate = false;				
	} 
	
	if (util.isArray(content.data.topic)) {
		output += ' - '+content.data.topic[0];
		output2 += ' - '+content.data.topic[0];	
	} else {
		output += ' - '+content.data.topic;
		output2 += ' - '+content.data.topic;	
	}
	if (content.data.lecturer) {
		output += ' ('+content.data.lecturer+')';
		output2 += ' ('+content.data.lecturer+')';	
	}	
	output += '</h5>';		
	output2 += '</h5>';			

	if (util.isArray(content.data.objectives)) {
		for (var j = 0; j < content.data.objectives.length; j++) {
		 	var item = content.data.objectives[j];
		    if (j == 0) {
		    	output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives</strong><ul>'
		    	output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives</strong><ul>'				    	
		    } 
		    if (item !== undefined) {
			    if (item.indexOf('<a') !== -1) {
				  	output += '<li>'+item+'</li>'
				  	output2 += '<li>'+item+'</li>'						  	
				} else {
					output += item+"<br>";
					output2 += item+"<br>";	
				}						
		    } else if (j == content.data.objectives.length-1 || content.data.objectives[j+1] === undefined)
			    break;		// hacky way to deal with last row full of the same text, just unstyled
		}
		output += '</ul></span>'
    	output2 += '</ul></span>'	
	}
	
	if (util.isArray(content.data.topic)) {
		for (var j = 0; j < content.data.topic.length; j++) {
		 	var item = content.data.topic[j];
		    if (j == 0) {
			    if (!util.isArray(content.data.objectives)) {
				    output += '<br>'
			    	output2 += '<br>'
			    }
			    
		    	output += '<strong style="color: #555;">Independent Learning</strong>'
		    	output2 += '<strong style="color: #555;">Independent Learning</strong>'				    	
		    	
		    	if (content.data.objectives && !util.isArray(content.data.objectives)) {
				    if (content.data.objectives.indexOf('<a') !== -1) {
						output += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
						output2 += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
					} else {
						output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
						output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
					}
				}
		    	
		    	output += '<ul>'
		    	output2 += '<ul>'
		    } else if (item !== undefined) {
			    if (item.indexOf('<a') !== -1) {
				  	output += '<li>'+item+'</li>'
				  	output2 += '<li>'+item+'</li>'						  	
				} else {
					output += item+"<br>";
					output2 += item+"<br>";	
				}						
		    } else if (j == content.data.topic.length-1 || content.data.topic[j+1] === undefined)
			    break;		// hacky way to deal with last row full of the same text, just unstyled
		}
		output += '</ul>'
    	output2 += '</ul>'				    					 
	} else if (content.data.objectives && !util.isArray(content.data.objectives)) {
	    if (content.data.objectives.indexOf('<a') !== -1) {
			output += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
			output2 += '<br><span style="position:absolute; right:8px;"><strong>'+content.data.objectives+'</strong></span>';
		} else {
			output += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
			output2 += '<br><span style="position:absolute; right:8px;"><strong style="color: #555;">Objectives '+content.data.objectives+'</strong></span>';
		}
	}

	if (util.isArray(content.data.resources)) {
		for (var j = 0; j < content.data.resources.length; j++) {
		 	var item = content.data.resources[j];
		    if (j == 0) {
		    	output += '<strong style="color: #555;">Additional Resources</strong><ul>'
		    	output2 += '<strong style="color: #555;">Additional Resources</strong><ul>'				    	
		    } 
		    if (item !== undefined) {
			    if (item.indexOf('<a') !== -1) {
				  	output += '<li>'+item+'</li>'
				  	output2 += '<li>'+item+'</li>'						  	
				} else {
					output += item+"<br>";
					output2 += item+"<br>";	
				}						
		    } else if (j == content.data.resources.length-1 || content.data.resources[j+1] === undefined)
			    break;		// hacky way to deal with last row full of the same text, just unstyled
		}
		output += '</ul>'
    	output2 += '</ul>'	
    } else if (content.data.resources) {
	    var item = content.data.resources;
	    if (item.indexOf('<a') !== -1) {			    
		    output += '<br><strong style="color: #555;">Additional Resources</strong><ul><li>'+item+'</li></ul>'
	    	output2 += '<br><strong style="color: #555;">Additional Resources</strong><ul><li>'+item+'</li></ul>'
	    } else {
		    output += '<br><strong style="color: #555;">Additional Resources</strong><ul>'+item+'<br></ul>'
	    	output2 += '<br><strong style="color: #555;">Additional Resources</strong><ul>'+item+'<br></ul>'				    
	    }
    }					 
    	
	output += '</div>';
	output2 += '</div>';			
	
	var startDate = util.getDateText(dates[0])
	var endDate = util.getDateText(dates[dates.length-1])
	
	var today = new Date();
	today = util.addDays(today, -0.25);	// adjusts for time zones
	var tomorrow = util.addDays(today, 1);
	var twodays = util.addDays(today, 2);
	var yesterday = util.addDays(today, -1)
	var nextweek = util.addDays(today, 6)		
	var pastweek = util.addDays(today, -7)
	var pastweek2 = util.addDays(today, -14)
	var pastweek3 = util.addDays(today, -21)											
	var pastweek4 = util.addDays(today, -28)
	var pastweek5 = util.addDays(today, -35)						
	var upcoming = false;
	var upcomingLater = false;
	var upcomingSoon = false;
	var passed = false;			
	var withinWeek = false;	
	var prevWeek = -1;						
	for (var j = 0; j < dates.length; j++) {
		if (dates[j] >= pastweek5)
			prevWeek = 5;
		if (dates[j] >= pastweek4)
			prevWeek = 4;
		if (dates[j] >= pastweek3)
			prevWeek = 3;
		if (dates[j] >= pastweek2)
			prevWeek = 2;
		if (dates[j] >= pastweek)
			prevWeek = 1;																		
		if (dates[j] >= yesterday) {
			prevWeek = 0;
			passed = true;
		}
		if (dates[j] >= today) {
			passed = false;
			upcomingSoon = true;
		}
		if (dates[j] >= tomorrow) {
			upcomingSoon = false;
			upcoming = true;
		}				
		if (dates[j] >= twodays) {
			upcoming = false;
			upcomingLater = true;
		}
		if (dates[j] < nextweek) {
			withinWeek = true;
		}
	}
	
	if ((passed || upcoming || upcomingSoon || upcomingLater) && withinWeek) {
		if (passed) {
			output = output.replace('opacity: 1.0;"', 'opacity: 0.4;" class="fakebox start_'+startDate+' end_'+endDate+'"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4;" class="fakebox start_'+startDate+' end_'+endDate+'"');				
		} else {
			output = output.replace('opacity: 1.0;"', 'opacity: 1.0;" class="fakebox start_'+startDate+' end_'+endDate+'"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 1.0;" class="fakebox start_'+startDate+' end_'+endDate+'"');
		}
						
		if (passed && replaceDate) {
			output = output.replace('%DATE%', '<span class="fakedate">Yesterday</span>');
			output2 = output2.replace('%DATE%', '<span class="fakedate">Yesterday</span>');
		} else if (upcomingSoon && replaceDate) {
			output = output.replace('%DATE%', '<span class="fakedate">Tonight</span>');
			output2 = output2.replace('%DATE%', '<span class="fakedate">Tonight</span>');
		} else if (upcoming && replaceDate) {
			output = output.replace('%DATE%', '<span class="fakedate">Tomorrow</span>');
			output2 = output2.replace('%DATE%', '<span class="fakedate">Tomorrow</span>');
		} else {
			output = output.replace('%DATE%', dateStr1);
			output2 = output2.replace('%DATE%', dateStr2);
		}		
		
		parsedHTML(output).appendTo('#fakeweek');
		if (multipleOutput)
			parsedHTML(output2).appendTo('#fakeweek');			
	} else if (!withinWeek || prevWeek > 0) {
		futureHomeworkExists = !withinWeek;
		
		if (prevWeek > 0) {
			if (prevWeek > maxPreviousDate)
				maxPreviousDate = prevWeek
			output = output.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="fakebox start_'+startDate+' end_'+endDate+' pastweek'+prevWeek+'"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="fakebox start_'+startDate+' end_'+endDate+'pastweek'+prevWeek+'"');	
		} else {
			output = output.replace('opacity: 1.0;"', 'display:none;" class="fakebox comingsoon start_'+startDate+' end_'+endDate+'"');
			output2 = output2.replace('opacity: 1.0;"', 'display:none;" class="fakebox comingsoon start_'+startDate+' end_'+endDate+'"');						
		}
					
		parsedHTML(output.replace('%DATE%', dateStr1)).appendTo('#fakeweek');
		if (multipleOutput)
			parsedHTML(output2.replace('%DATE%', dateStr2)).appendTo('#fakeweek');									
	}

	return {outputHomework: futureHomeworkExists, maxDate: maxPreviousDate};
}

function addLoginForms(parsedHTML, session, userInfo) {
	parsedHTML('<iframe id="fakeloginframe" name="fakeloginframe" style="position:fixed; top:-900px; width:900px; height:0px; border:none;" src=""></iframe>').appendTo('body')
	parsedHTML('<form id="fakeloginform" method="post" target="fakeloginframe" action="https://owl.uwo.ca/access/login" enctype="application/x-www-form-urlencoded"><input name="eid" id="eid" value="'+session+'" type="hidden"><input name="pw" id="pw" value="'+util.decrypt(userInfo[session].pass)+'" type="hidden"><input name="fakesubmit" type="hidden" value="Login"></form>').appendTo('body')
}

function addButtons(parsedHTML, addNextButton) {
	if (addNextButton)
		parsedHTML('<div class="fakebox hoverButton noselect" id="showAllButton" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-right: 20%; margin-left: 20%; text-align: center; cursor: pointer;"><h5>Show Upcoming Weeks</h5></div>').appendTo('#fakeweek');		
	parsedHTML('<div class="hoverButton textButton fakeButton noselect" id="hidePrevButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 18px; margin: 0; font-size: small; display:none;"><h5>Hide Previous Weeks</h5></div>').appendTo('#fakeweeklabel');		
	parsedHTML('<div class="hoverButton textButton fakeButton noselect" id="showPrevButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 18px; margin: 0; font-size: small;"><h5>Show Previous Week</h5></div>').appendTo('#fakeweeklabel');
	
	parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="prevLectureButton" style="position: absolute; top: 120px; padding:1%; margin-left: -30px; cursor: pointer; font-size:large; transform:scale(1,2);">&lt;</span>').insertBefore('#fakelectureheader')						
	parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="nextLectureButton" style="position: absolute; top: 120px; padding:1%; left: 97.0%; cursor: pointer; font-size:large; transform:scale(1,2);">&gt;</span>').insertAfter('#fakelectureheader')	
	
	if (config.debug)
		parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="fakeTestButton" style="z-index:999; position: absolute; cursor: pointer; font-size:large;">TEST</span>').prependTo(mainId)	
	else		
		parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="fakeTestButton" style="z-index:999; position: absolute; cursor: pointer; font-size:large; display:none;">TEST</span>').prependTo(mainId)			
	var expiry = new Date()
	expiry = util.addDays(expiry, 7-expiry.getDay());
	parsedHTML('<span class="noselect" id="fakeExpiryButton" style="position: absolute; display:none;">Best Before: <span id="fakeexpiry">'+util.getDateText(expiry)+'</span></span>').prependTo(mainId)	
}

var clientsideJS = undefined;
function addFooters(parsedHTML, maxPreviousDate) {
	if (!clientsideJS) {
		clientsideJS = fs.readFileSync('./clientside.js', 'utf8')
	}
	
	parsedHTML('body').append('<style>#showAllButton {background-color: hsl(0, 0%, 96%);} #showAllButton:hover {background-color: hsl(0, 0%, 93%);} .textButton {color: #9776C1;} .textButton:hover {color: #623f8d;} .noselect {-webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; } @media screen and (max-width: 800px) { h1.fakeheader {margin-top:60px;} #prevLectureButton {margin-top: 40px;} #nextLectureButton {margin-top: 40px;}} @media screen and (max-width: 767px) { #fakeweek {width: 55% !important; max-width: 55% !important;} #fakepcciacontainer {max-width:40% !important;} #fakecoursecontainer {display:none !important;}}  @media screen and (max-width: 520px) { #fakeweek {width: 100% !important; max-width: 100% !important;} #fakepcciacontainer {display:none !important;} #faketomorrowlecture {display:none !important;} .tomorrowLecture {display:none !important;} #prevLectureButton {display:none !important;} #nextLectureButton {display:none !important;}}</style>')
	parsedHTML('body').append('<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>')
	parsedHTML('body').append('<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>')
	parsedHTML('body').append('<script type="text/javascript">'+clientsideJS.replace('%MAX_DATE%',maxPreviousDate)+'</script>')	
}

exports.addAssignment 			= addAssignment
exports.removeAllAssignments	= removeAllAssignments
exports.addButtons 				= addButtons
exports.addClass 				= addClass
exports.addFooters 				= addFooters
exports.addHeaders 				= addHeaders
exports.addHomework 			= addHomework
exports.addLecture 				= addLecture
exports.addLectureHeader 		= addLectureHeader
exports.addLectureFooter 		= addLectureFooter
exports.addLecturePlaceholder 	= addLecturePlaceholder
exports.addLoginForms			= addLoginForms
exports.addPCCIA 				= addPCCIA
exports.initPage 				= initPage
exports.loadPage 				= loadPage
exports.mainId	 				= mainId
