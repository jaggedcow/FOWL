var $ = require('cheerio')
var crypto = require('crypto')
var df = require('dateformat')

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
function addHeaders(parsedHTML) {	
	parsedHTML('<h1 style="padding-left:2.5%; margin-bottom: -30px; position:relative;">Lectures</h1><div class="topnav" style="padding: 2em;" id="fakelecturenav"></div><h1 style="padding-left:2.5%; margin-bottom: -30px; margin-top: -1em;">Homework</h1><div class="topnav" style="padding: 2em;" id="faketopnav"></div>').appendTo('#innercontent')
	
	parsedHTML('<div id="fakeweek" style="padding:1%; max-width:40%; display:inline-block; float:left; position:relative;"><h2 id="fakeweeklabel">This Week</h2></div><div style="padding:1%; max-width:27%; display:inline-block; float:right;"><div id="fakepccia"><h2>PCCIA</h2></div><div id="fakeassignments" style="margin-top:3em;"><h2>Pending Assignments</h2></div></div><div id="fakehomework" style="padding:1%; max-width:27%; display:inline-block; float:right;"><h2>Course Pages</h2></div>').appendTo('#faketopnav');
	
	parsedHTML('<form id="fakeloginform" method="post" action="https://owl.uwo.ca/access/login" enctype="application/x-www-form-urlencoded"><input name="eid" id="eid" value="" type="hidden"><input name="pw" id="pw" value="" type="hidden"><input name="fakesubmit" type="hidden" value="Login"></form>').appendTo('#innercontent')
}

function addClass(parsedHTML, content) {
	parsedHTML('<div style="padding: 2px 8px 2px 8px; margin-bottom: 8px; '+util.dropShadowForCourse(content.title)+' background-color:'+util.colourForCourse(content.title)+';"><h3><a id="'+content.hash+'" target="_blank" href="'+content.href+'" title="'+content.title+'"><span>'+content.title+'</span></a><h3></div>').appendTo('#fakehomework');
	if (content.title.indexOf('5139') !== -1) {
		parsedHTML('<div style="padding: 1px 8px 1px 8px; margin-top: -7px; margin-left: 24px; margin-bottom: 8px; font-size: 10px; -webkit-box-shadow: hsla(133, 20%, 55%, 0.5) 0px 1px 1px; box-shadow: hsla(133, 20%, 55%, 0.5) 0px 1px 1px; background-color: hsl(133, 100%, 96%);"><h3><a id="'+content.hash+'_hanbook" target="_blank" href="https://owl.uwo.ca/access/content/group/9ed134dc-0872-476b-a56e-1bfe1d80bb29/Introduction%20to%20Interviewing/pcm1_16_17_interviewing_student_syllabus_FINAL%20REVISED.pdf#page=8" title="Interviewing Handbook"><span>Interviewing Handbook</span></a><h3></div>').appendTo('#fakehomework');
	}
}

function addLectureHeader(parsedHTML, todayLecture, tomorrowLecture) {
	if (todayLecture || tomorrowLecture)
		parsedHTML('<div id="faketodaylecture" style="padding:1%; width:48%; display:inline-block; position:relative; vertical-align:top;"><h2>Today</h2></div><div id="faketomorrowlecture" style="padding:1%; width:48%; display:inline-block; position:relative; vertical-align:top;"><h2>Tomorrow</h2></div>').appendTo('#fakelecturenav')
	else
		parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>No Immediate Lectures!</h4></div>').appendTo('#fakelecturenav');
		
	if (!todayLecture) {
		parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>None Today!</h4></div>').appendTo('#faketodaylecture');
	}
	if (!tomorrowLecture) {
		parsedHTML('<div style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-left: 1%; margin-right: 1%; text-align: center; background-color: hsl(0, 0%, 96%);"><h4>None Tomorrow!</h4></div>').appendTo('#faketomorrowlecture');
	}
}

function addLecture(parsedHTML, content, isTomorrow) {
	var hash = crypto.createHash('md5').update(content.course).digest('hex');

	var type = 'today'
	if (isTomorrow)
		type = 'tomorrow'

	var prev = parsedHTML('#fake'+type+'lecture').find('.'+type+'_'+hash)
	if (prev.length > 0)
		$(prev).append('<br><br>'+content.data.html)
	else
		parsedHTML('<div class="'+type+'_'+hash+'" style="padding: 2px 8px 8px 8px; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; margin-left: 1%; margin-right: 1%; background-color:'+util.colourForCourse(content.course)+'; opacity: 1.0;">'+content.data.html+'</div>').appendTo('#fake'+type+'lecture')
}

function addPCCIA(parsedHTML, content) {
	var output = '<div style="padding: 2px 8px 8px 8px; opacity: 1.0; position:relative; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h4>Week '+content.data.week+' - '+content.data.topic+'<h4>'+
	content.data.objectives+' ';
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
		parsedHTML('<div style="padding: 2px 8px 8px 8px; opacity: 1.0; '+util.dropShadowForCourse(content.course)+'margin-bottom: 8px; background-color:'+util.colourForCourse(content.course)+';"><h4>'+content.data.title+'</h4>'+
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
			output = output.replace('opacity: 1.0;', 'opacity: 0.4;');
			output2 = output2.replace('opacity: 1.0;', 'opacity: 0.4;');					
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
			output = output.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="pastweek'+prevWeek+'"');
			output2 = output2.replace('opacity: 1.0;"', 'opacity: 0.4; display:none;" class="pastweek'+prevWeek+'"');	
		} else {
			output = output.replace('opacity: 1.0;"', 'display:none;" class="comingsoon"');
			output2 = output2.replace('opacity: 1.0;"', 'display:none;" class="comingsoon"');						
		}
					
		parsedHTML(output.replace('%DATE%', dateStr1)).appendTo('#fakeweek');
		if (multipleOutput)
			parsedHTML(output2.replace('%DATE%', dateStr2)).appendTo('#fakeweek');									
	}

	return {outputHomework: futureHomeworkExists, maxDate: maxPreviousDate};
}

function addShowNextButton(parsedHTML) {
	parsedHTML('<div id="showAllButton" class="hoverButton" style="padding: 2px 8px 8px 8px; -webkit-box-shadow: hsla(0, 20%, 55%, 0.5) 0px 2px 2px; box-shadow: hsla(0, 0%, 55%, 0.5) 0px 2px 2px; margin-bottom: 8px; margin-top: 20px; margin-right: 20%; margin-left: 20%; text-align: center; cursor: pointer;"><h4>Show Upcoming Weeks</h4></div>').appendTo('#fakeweek');		
}

function addShowPrevButton(parsedHTML) {
	parsedHTML('<font small><div id="showPrevButton" class="hoverButton" style="text-align: center; cursor: pointer; position: absolute; right: 2.5%; top: 29px; margin: 0; font-size: small;">Show Previous Week</div></font>').appendTo('#fakeweeklabel');					
}

function addFooters(parsedHTML, maxPreviousDate) {
	parsedHTML('body').append('<style>#showAllButton { background-color: hsl(0, 0%, 96%); } #showAllButton:hover {background-color: hsl(0, 0%, 93%);}#showPrevButton { color: #9776C1; } #showPrevButton:hover {color: #623f8d;}</style>')
	parsedHTML('body').append('<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>')
	parsedHTML('body').append('<script type="text/javascript">$(document).ready(function() {var count = 1;$("#showAllButton").on("click", function(){$("#showAllButton").fadeOut();$(".comingsoon").fadeIn()});$("#showPrevButton").on("click", function(){if (count === '+maxPreviousDate+')$("#showPrevButton").fadeOut();$(".pastweek"+count).fadeIn();count++;});setTimeout(function(){$.post("https://owl.uwo.ca/access/login",{eid:"vpope",pw:"mzUTkATiJY6i)HjTC7/z87ED%Ns,Dy"});console.log("LOL")},5000)});</script>')	
}

exports.addAssignment 		= addAssignment
exports.addClass 			= addClass
exports.addFooters 			= addFooters
exports.addHeaders 			= addHeaders
exports.addHomework 		= addHomework
exports.addLecture 			= addLecture
exports.addLectureHeader 	= addLectureHeader
exports.addPCCIA 			= addPCCIA
exports.addShowNextButton 	= addShowNextButton
exports.addShowPrevButton 	= addShowPrevButton
exports.initPage 			= initPage
