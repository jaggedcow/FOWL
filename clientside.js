$(document).ready(function() {
	var count = 1;
	$("#showAllButton").on("click", function() {
		$("#showAllButton").fadeOut();
		$(".comingsoon").fadeIn()
	});
	$("#showPrevButton").on("click", function() {
		if (count === %MAX_DATE%) {
			$("#showPrevButton").fadeOut();
			$("#hidePrevButton").delay(400).fadeIn();			
		}
		
		var start = addDays(-7*(count-1)-2);	// -2 to avoid today and yesterday, which are already visible
		for (var i = 0; i < 7; i++) {
			console.log(".end_"+getDateText(addDays(start,i)))
			$(".end_"+getDateText(addDays(start,-i))).fadeIn().addClass("previouslyHidden");
		}
		
		count++;
	});
	$("#hidePrevButton").on("click", function() {
		$("#hidePrevButton").fadeOut();			
		$("#showPrevButton").delay(400).fadeIn();			
		
		$(".previouslyHidden").fadeOut().removeClass("previouslyHidden");
		count = 1;
	});	
	
	var currDate = new Date();
	if (currDate.getMonth() === 9 && currDate.getDate() > 27) {		// todo: replace this with something smarter that finds weekends
		setTimeout(function(){
			$('body, #container').animate({backgroundColor:'#424242'}, 'slow');	
			$('#toolMenu li').animate({backgroundColor:'#808080', borderColor:'#656565'}, 'slow');
			$('.fakebox').animate({backgroundColor:'#f37015'}, 'slow');	
			$('.fakebutton').animate({color:'#f37015'}, 'slow');			
			$('.fakeheader').animate({color:'#dbdbdb'}, 'slow');	
			$('#innercontent span').animate({color:'#424242'}, 'slow')					
			$('#innercontent a').animate({color:'#424242'}, 'slow')											
		}, 1200)
	}
	
	if (currDate.getMonth() === 3 && currDate.getDate() === 0 && !readCookie('aprilfooled')) {
		$('#portalContainer').hide();
		$('#fakeloginframe').css({width:$(document).width()+'px', height:$(document).height()+'px', top: 0+'px'})		
		
		setTimeout(function() {
			alert("April Fools!")
			$('#portalContainer').show();		
			$('#fakeloginframe').animate({top:$(document).height()}, 800)
			createCookie('aprilfooled', true, 7)				
		}, 12000)
	}
	
	var _cutoff = 99
	window.prevDate = addDays(0)
	window.nextDate = addDays(1)
	
	$("#prevLectureButton").on("click", function() {
		var pdelta = 0, ndelta = 0, prevDate, nextDate, prevDateNum, nextDateNum
		
		do {
			pdelta++
		
			prevDate = addDays(window.prevDate, -pdelta)
			prevDateNum = getDateText(prevDate)
		} while($('.day_'+prevDateNum).length === 0 && compareDates(prevDate, addDays(0)) !== 0 && compareDates(prevDate, addDays(1)) !== 0 && pdelta < _cutoff) 
		
		do {
			ndelta++
			
			nextDate = addDays(window.prevDate, ndelta)		
			nextDateNum = getDateText(nextDate)
		} while($('.day_'+nextDateNum).length === 0 && ndelta < _cutoff) 		
								
		if (pdelta < _cutoff && ndelta < _cutoff) {			
			$('.day_'+prevDateNum).css('display','table-cell')
			$('.placeholder_'+prevDateNum).css('display','table-cell')			
			$('.day_'+nextDateNum).hide()
			$('.placeholder_'+getDateText(addDays(window.prevDate,1))).hide()
						
						
			window.nextDate = window.prevDate
			window.prevDate = prevDate
						
			resetDayCounters(window.prevDate)
		}
	});
	$("#nextLectureButton").on("click", function() {
		var pdelta = 0, ndelta = 0, prevDate, nextDate, prevDateNum, nextDateNum
		
		do {
			pdelta++
		
			prevDate = addDays(window.nextDate, -pdelta)
			prevDateNum = getDateText(prevDate)
		} while($('.day_'+prevDateNum).length === 0 && pdelta < _cutoff) 
		
		do {
			ndelta++
			
			nextDate = addDays(window.nextDate, ndelta)		
			nextDateNum = getDateText(nextDate)
		} while($('.day_'+nextDateNum).length === 0 && compareDates(nextDate, addDays(0)) !== 0 && compareDates(nextDate, addDays(1)) !== 0 && ndelta < _cutoff) 		
				
		if (pdelta < _cutoff && ndelta < _cutoff) {				
			$('.day_'+prevDateNum).hide()
			$('.placeholder_'+getDateText(window.prevDate)).hide()
			$('.day_'+nextDateNum).css('display','table-cell')
			$('.placeholder_'+nextDateNum).css('display','table-cell')			
			
			window.prevDate = window.nextDate
			window.nextDate = nextDate
			
			resetDayCounters(window.prevDate)
		}
	});	
	
	var counter = 0;
	$('#fakeTestButton').on('click', function() {performDayTick(counter++)});
	
	$("#fakeloginform").submit();		
	window.lastFakeLoginCheck = new Date();
	
	// gets maximum number of days to move ahead without checking server for new content	
	// right now, counts until next Sunday
	createCookie('tempUser',undefined,-1)
	createCookie('tempPw',undefined,-1)		
	
	setInterval(function() {
		performDayTick()	
				
		console.log("Timed login")
		$("#fakeloginform").submit();		
		window.lastFakeLoginCheck = new Date();	
	}, 3600000)
	
	$(window).on("focus pageshow pagecontainershow", function() {
		performDayTick()					
		if (window.lastFakeLoginCheck && new Date().getTime() - window.lastFakeLoginCheck.getTime() > 3600000) {				console.log("Focus login")
			$("#fakeloginform").submit();		
			window.lastFakeLoginCheck = new Date();		
		}
	})
});

function resetDayCounters(todayDate) {
	$('#backToPresent').off('click')
	
	var date = new Date();
	
	if (compareDates(todayDate, date) <= -10) {
		$('#faketodayheader').html("The Distant Past...")
		$('#faketomorrowheader').html('<font small><div class="fakebutton hoverButton textButton noselect" id="backToPresent" style="cursor: pointer; font-size: small;">Back to Present Day?</div></font>')					
		$('#backToPresent').on("click", resetLectures);
	} else if (compareDates(todayDate, date) <= -2) {
		$('#faketodayheader').html("The Past...")
		$('#faketomorrowheader').html("&nbsp;")			
	} else if (compareDates(todayDate, date) === -1) {
		$('#faketodayheader').html("The Past...")
		$('#faketomorrowheader').html("Today")		
	} else if (compareDates(todayDate, date) === 0) {
		$('#faketodayheader').html("Today")
		$('#faketomorrowheader').html("Tomorrow")		
	} else if (compareDates(todayDate, date) === 1) {
		$('#faketodayheader').html("Tomorrow")
		$('#faketomorrowheader').html("The Future...")		
	} else if (compareDates(todayDate, date) >= 10) {
		$('#faketodayheader').html("The Mysterious Future...")
		$('#faketomorrowheader').html('<font small><div class="fakebutton hoverButton textButton noselect" id="backToPresent" style="cursor: pointer; font-size: small;">Back to Present Day?</div></font>')		
		$('#backToPresent').on("click", resetLectures);		
	} else if (compareDates(todayDate, date) >= 2) {
		$('#faketodayheader').html("The Future...")
		$('#faketomorrowheader').html("&nbsp;")		
	}			
}

// counter is only used for testing purposes, please ignore
function performDayTick(counter) {
	if (counter === undefined) {
		counter = 0
		resetLectures()
	}
	
	var passed = getDateText(addDays(-2+counter))
	var yesterday = getDateText(addDays(-1+counter))
	var today = getDateText(addDays(0+counter))	
	var tomorrow = getDateText(addDays(1+counter))
	
	$('.day_'+yesterday).hide();
	$('.placeholder_'+yesterday).hide();	
	$('.day_'+tomorrow).css('display','table-cell')
	$('.placeholder_'+tomorrow).css('display','table-cell')
	
	$('.end_'+passed).hide()
	$('.end_'+passed+' .fakedate').text(formatDate(getTextDate(passed)))	
	$('.end_'+yesterday).css('opacity',0.4)
	$('.end_'+yesterday+' .fakedate').text('Yesterday')	
	$('.start_'+tomorrow).show();
	$('.start_'+tomorrow+' .fakedate').text('Tomorrow')		
	$('.end_'+today+' .fakedate').text('Tonight')		
	
	if (compareDates(addDays(0), getTextDate($('#fakeexpiry').text())) === 0) {
		createCookie('tempUser',$('#eid').val(),2/24*60)
		createCookie('tempPw',$('#pw').val(),2/24*60)		
		window.location.reload(true)		
	}
}


function resetLectures() {
	var date = new Date();
	
	var prevDateNum = getDateText(window.prevDate)
	var nextDateNum = getDateText(window.nextDate)

	
	$('.day_'+prevDateNum).hide()
	$('.day_'+nextDateNum).hide()
	
	var prevDate = addDays(date, 0)
	prevDateNum =  getDateText(prevDate)
	var nextDate = addDays(date, 1)
	nextDateNum =  getDateText(nextDate)
	
	$('.day_'+prevDateNum).show()
	$('.day_'+nextDateNum).show()
	$('.placeholder_'+prevDateNum).show()
	$('.placeholder_'+nextDateNum).show()	
	
	window.prevDate = prevDate
	window.nextDate = nextDate
	resetDayCounters(window.prevDate)		
}

function createCookie(name,value,days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function compareDates(dateA, dateB) {
	if (!isFinite(dateA) && isFinite(dateB))
		return 1;	
	if (isFinite(dateA) && !isFinite(dateB))
		return -1;	
	if (!isFinite(dateA) && !isFinite(dateB))
		return 0;		
											
  var utc1 = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  var utc2 = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());

  return Math.floor((utc1 - utc2) / 86400000);
}

function getDateText(date) {
	return date.getMonth()+""+date.getDate()+""+date.getFullYear()
}

function getTextDate(text) {
	if (text.indexOf('_') !== -1)
		text = text.substring(text.indexOf('_')+1)
	var y = text.substring(text.length-4), m = text.substring(0,text.length-6), d = text.substring(text.length-6, text.length-4)
	
	return new Date(parseInt(y), parseInt(m), parseInt(d))
}

function formatDate(date) {
	var dates = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	return dates[date.getMonth()]+' '+date.getDate()
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