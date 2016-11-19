var $ = require('cheerio')
var crypto = require('crypto')
var df = require('dateformat')
var fs = require('fs')
var util = require('./util')

// must be called first, returns an opaque object that should be passed on all subsequent calls
function initPage(html) {
	var parsedHTML = $.load(html);
	
	// removes normal OWL content
	parsedHTML('#innercontent').empty();
	parsedHTML('li.nav-menu').css('display','none')
	parsedHTML('li.more-tab').css('display','none')	
	parsedHTML('.nav-selected').css('display','default')
	
	return parsedHTML;
}
function addHeaders(parsedHTML, session, userInfo) {	
	parsedHTML('<h1 class="fakeheader" style="padding-left:2.5%; margin-bottom: -30px; position:relative;">Lectures</h1><div class="topnav" style="padding: 2em;" id="fakelecturenav"></div><div><h1 class="fakeheader" style="padding-left:2.5%; margin-bottom: -30px; margin-top: -1em;">Homework</h1></div><div class="topnav" style="padding: 2em;" id="faketopnav"></div>').appendTo('#innercontent')
	
	parsedHTML('<div id="fakeweek" style="padding:1%; max-width:40%; display:inline-block; float:left; position:relative;"><h2 class="fakeheader" id="fakeweeklabel">This Week</h2></div><div style="padding:1%; max-width:27%; display:inline-block; float:right;"><div id="fakepccia"><h2 class="fakeheader">PCCIA</h2></div><div id="fakeassignments" style="margin-top:3em;"><h2 class="fakeheader">Pending Assignments</h2></div></div><div id="fakehomework" style="padding:1%; max-width:27%; display:inline-block; float:right;"><h2 class="fakeheader">Course Pages</h2></div>').appendTo('#faketopnav');
	
	parsedHTML('<iframe id="fakeloginframe" name="fakeloginframe" style="position:fixed; top:-900px; width:900px; height:0px; border:none;" src=""></iframe>').appendTo('body')
	parsedHTML('<form id="fakeloginform" method="post" target="fakeloginframe" action="https://owl.uwo.ca/access/login" enctype="application/x-www-form-urlencoded"><input name="eid" id="eid" value="'+session+'" type="hidden"><input name="pw" id="pw" value="'+util.decrypt(userInfo[session].pass)+'" type="hidden"><input name="fakesubmit" type="hidden" value="Login"></form>').appendTo('body')
}

function addClass(parsedHTML, content, expired) {
	var opacity = '1.0'
	if (expired)
		opacity = '0.4'
	parsedHTML('<div class="fakebox" style="padding: 2px 8px 2px 8px; margin-bottom: 8px; opacity:'+opacity+'; '+util.dropShadowForCourse(content.title)+' background-color:'+util.colourForCourse(content.title)+';"><h3><a id="'+content.hash+'" target="_blank" href="'+content.href+'" title="'+content.title+'"><span>'+content.title+'</span></a><h3></div>').appendTo('#fakehomework');
}

function addLectureHeader(parsedHTML) {
	parsedHTML('<div id="fakelectureheader" style="display:table; width:102%; overflow-x:scroll;"></div>').appendTo('#fakelecturenav')
	parsedHTML('<div id="faketodaylecture" style="padding:1%; padding-bottom:0px; width:48%; display:table-cell; position:relative; vertical-align:top;"><h2 id="faketodayheader" class="fakeheader">Today</h2></div><div id="faketomorrowlecture" style="padding:1%; padding-bottom:0px; width:48%; display:table-cell; position:relative; vertical-align:top;"><h2 id="faketomorrowheader" class="fakeheader">Tomorrow</h2></div><div style="display:table-row"></div><div id="fakelecturerow" style="display:table-row"></div>').appendTo('#fakelectureheader')
}

function addLecture(parsedHTML, content, date, isTomorrow, isFuture) {
	var hash = crypto.createHash('md5').update(content.course+content.data.date).digest('hex');
	var displayType = 'table-cell'
	
	if (isFuture !== undefined)
		displayType = 'none'
	
	var dateNum = date.getMonth()+""+date.getDate()+""+date.getFullYear()

	var prev = parsedHTML('#fakelectureheader').find('.lecture_'+hash)
	if (prev.length > 0)
		$(prev).append('<br><br>'+content.data.html)
	else {
		var prevCell = parsedHTML('#fakelectureheader').find('.day_'+dateNum)
		if (prevCell.length > 0)
			$(prevCell).append('<div class="fakebox lecture_'+hash+'" style="margin-top:0px; padding: 2px 8px 8px 8px; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; width:100%; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><p>'+content.data.html+'</p></div>')		
		else
			parsedHTML('<div class="day_'+dateNum+'" style="display:'+displayType+'; width: 46%; padding:1%; padding-right:4%; padding-top: 0px; padding-bottom: 1%;"><div class="fakebox lecture_'+hash+'" style="margin-top:0px; padding: 2px 8px 8px 8px; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; width:100%; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><p>'+content.data.html+'</p></div><div style="height:100%"></div></div>').insertBefore('#fakelecturerow')
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
	'Another day off brought to you by FOWL',
	'Are you enjoying your day off?',
	'A clear night',
	'Here, have some time off',
	'Such freedom. Wow amaze.',
	'Is this thing still working?',
	'ZzzzZZzzzzzZzzz',
	'¯\_(ツ)_/¯',
	'Call your mom today, she misses you.',
	'#wellness day'
]
function addLecturePlaceholder(parsedHTML, date, isTomorrow, isFuture) {
	var displayType = 'table-cell'
	
	if (isFuture !== undefined)
		displayType = 'none'	
		
	var dateNum = date.getMonth()+""+date.getDate()+""+date.getFullYear()	
	var dateText = df(date,'mmm dd')
	var comment = _comments[Math.floor(Math.random()*_comments.length)]
	console.log(dateText, isTomorrow, isFuture)
	
	parsedHTML('<div class="placeholder_'+dateNum+'"style="display:'+displayType+'; width: 46%; padding:1%; padding-right:4%; padding-top: 0px; padding-bottom: 1%;"><div class="fakebox" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; background-color: hsl(0, 0%, 96%); width:100%"><p><span style="font-size: 16.0px; font-family: arial , helvetica , sans-serif;"><strong>'+dateText+'</strong></span><br><span style="font-family: Verdana;font-size: small;">'+comment+'</span></p></div><div style="height:100%"></div></div>').insertBefore('#fakelecturerow')
}

function addPCCIA(parsedHTML, content) {
	var output = '<div class="fakebox" style="padding: 2px 8px 8px 8px; opacity: 1.0; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h4>Week '+content.data.week+' - '+content.data.topic+'<h4>';
	if (content.data.objectives !== undefined) {
		output += content.data.objectives+' '
	} else {
		output += '&nbsp; '
	}
	if (util.isArray(content.data.resources)) {
		 for (var j = 0; j < content.data.resources.length; j++) {
		 	var item = content.data.resources[j];
		    if (j == 0) {
		    	output += '<span style="position:absolute; right:8px;">'+item+'</span><br><h5>Additional Resources</h5><ul>'
		    } else if (item !== undefined) {
			  	output += '<li>'+item+'</li>'
		    }
		 }
		 output += '</ul>'
	} else 
		output += '<span style="position:absolute; right:8px;">'+content.data.resources+'</span></div>'
	parsedHTML(output).appendTo("#fakepccia")
}

function addAssignment(parsedHTML, content) {
	if (content.data.status.indexOf("Submitted") === -1)					
		parsedHTML('<div class="fakebox" style="padding: 2px 8px 8px 8px; opacity: 1.0; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h4>'+content.data.title+'</h4>'+
	'<strong>Status</strong>: '+content.data.status+' <span style="float:right;"><strong>Due</strong>: '+df(util.addDays(new Date(content.data.dueDate),-0.05), 'mmm dd, yyyy')+'</span></div>').appendTo("#fakeassignments")	
}

function addHomework(parsedHTML, content, maxPreviousDate) {
	var futureHomeworkExists = false;
	
	var output = '<div style="padding: 2px 8px 8px 8px; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><h4>%DATE%';
	var output2 = '<div style="padding: 2px 8px 8px 8px; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;"><h4>%DATE%';			
	var multipleOutput = false;
	var replaceDate = true;		// whether a date should be replaced by a relative date (tonight, tomorrow, etc)
	
	var dates;
	var dateStr1, dateStr2;
	
	if (util.isArray(content.data.date)) {
		if (typeof content.data.date[0] === 'object') {
			multipleOutput = true;
			dates = [new Date(content.data.date[0].date), new Date(content.data.date[1].date)]
			dateStr1 = df(content.data.date[0].date, 'mmm dd')+' ('+ content.data.date[0].location+' only)';
			dateStr2 = df(content.data.date[1].date, 'mmm dd')+' ('+ content.data.date[1].location+' only)';					
		} else {
			dates = [];	
			for (var j = 0; j < content.data.date.length; j++) {
				dates.push(new Date(content.data.date[j]));
			}
			dateStr1 = df(content.data.date[0].date, 'mmm dd');
		}								
	} else {
		dates = [new Date(content.data.date)];
		if (!isNaN(Date.parse(content.data.date)))
			dateStr1 = df(content.data.date, 'mmm dd');
		else {
			console.log(content.data.date);
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
	output += '</h4>';		
	output2 += '</h4>';			

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
			output = output.replace('opacity: 1.0;"', 'opacity: 0.4;" class="fakebox"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4;" class="fakebox"');				
		} else {
			output = output.replace('opacity: 1.0;"', 'opacity: 1.0;" class="fakebox"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 1.0;" class="fakebox"');
		}
						
		if (passed && replaceDate) {
			output = output.replace('%DATE%', 'Yesterday');
			output2 = output2.replace('%DATE%', 'Yesterday');
		} else if (upcomingSoon && replaceDate) {
			output = output.replace('%DATE%', 'Tonight');
			output2 = output2.replace('%DATE%', 'Tonight');
		} else if (upcoming && replaceDate) {
			output = output.replace('%DATE%', 'Tomorrow');
			output2 = output2.replace('%DATE%', 'Tomorrow');
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
			output = output.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="fakebox pastweek'+prevWeek+'"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="fakebox pastweek'+prevWeek+'"');	
		} else {
			output = output.replace('opacity: 1.0;"', 'display:none;" class="fakebox comingsoon"');
			output2 = output2.replace('opacity: 1.0;"', 'display:none;" class="fakebox comingsoon"');						
		}
					
		parsedHTML(output.replace('%DATE%', dateStr1)).appendTo('#fakeweek');
		if (multipleOutput)
			parsedHTML(output2.replace('%DATE%', dateStr2)).appendTo('#fakeweek');									
	}

	return {outputHomework: futureHomeworkExists, maxDate: maxPreviousDate};
}

function addButtons(parsedHTML, addNextButton) {
	if (addNextButton)
		parsedHTML('<div class="fakebox hoverButton noselect" id="showAllButton" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-right: 20%; margin-left: 20%; text-align: center; cursor: pointer;"><h4>Show Upcoming Weeks</h4></div>').appendTo('#fakeweek');		
	parsedHTML('<font small><div class="fakebutton hoverButton textButton noselect" id="hidePrevButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 29px; margin: 0; font-size: small; display:none;">Hide Previous Weeks</div></font>').appendTo('#fakeweeklabel');		
	parsedHTML('<font small><div class="fakebutton hoverButton textButton noselect" id="showPrevButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 29px; margin: 0; font-size: small;">Show Previous Week</div></font>').appendTo('#fakeweeklabel');
	
	parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="prevLectureButton" style="position: absolute; top: 156px; padding:1%; margin-left: -1.5%; cursor: pointer; font-size:large; transform:scale(1,2);">&lt;</span>').insertBefore('#fakelectureheader')						
	parsedHTML('<span class="fakebutton hoverButton textButton noselect" id="nextLectureButton" style="position: absolute; top: 156px; padding:1%; left: 97.5%; cursor: pointer; font-size:large; transform:scale(1,2);">&gt;</span>').insertAfter('#fakelectureheader')	
}

var clientsideJS = undefined;
function addFooters(parsedHTML, maxPreviousDate) {
	if (!clientsideJS) {
		clientsideJS = fs.readFileSync('./clientside.js', 'utf8')
	}
	
	parsedHTML('body').append('<style>#showAllButton {background-color: hsl(0, 0%, 96%);} #showAllButton:hover {background-color: hsl(0, 0%, 93%);} .textButton {color: #9776C1;} .textButton:hover {color: #623f8d;} .noselect {-webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}</style>')
	parsedHTML('body').append('<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>')
	parsedHTML('body').append('<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>')
	parsedHTML('body').append('<script type="text/javascript">'+clientsideJS.replace('%MAX_DATE%',maxPreviousDate)+'</script>')	
}

exports.addAssignment 			= addAssignment
exports.addButtons 				= addButtons
exports.addClass 				= addClass
exports.addFooters 				= addFooters
exports.addHeaders 				= addHeaders
exports.addHomework 			= addHomework
exports.addLecture 				= addLecture
exports.addLectureHeader 		= addLectureHeader
exports.addLecturePlaceholder 	= addLecturePlaceholder
exports.addPCCIA 				= addPCCIA
exports.initPage 				= initPage
