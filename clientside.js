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
		$(".pastweek"+count).fadeIn();
		count++;
	});
	$("#hidePrevButton").on("click", function() {
		$("#hidePrevButton").fadeOut();			
		$("#showPrevButton").delay(400).fadeIn();			
		
		while (count > 0) {
			$(".pastweek"+count).fadeOut();
			count--;
		}
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
	window.todayDate = new Date();
	$("#prevLectureButton").on("click", function() {
		var pdelta = 0, ndelta = 0, prevDate, nextDate, prevDateNum, nextDateNum
		
		do {
			pdelta++
		
			prevDate = addDays(window.todayDate, -pdelta)
			prevDateNum = prevDate.getMonth()+""+prevDate.getDate()+""+prevDate.getFullYear()
		} while($('.day_'+prevDateNum).length === 0 && pdelta < _cutoff) 
		
		do {
			ndelta++
			
			nextDate = addDays(window.todayDate, ndelta)		
			nextDateNum = nextDate.getMonth()+""+nextDate.getDate()+""+nextDate.getFullYear()	
		} while($('.day_'+nextDateNum).length === 0 && ndelta < _cutoff) 		
								
		if (pdelta < _cutoff && ndelta < _cutoff) {				
			$('.day_'+prevDateNum).css('display','table-cell')
			$('.day_'+nextDateNum).hide()
			$('.placeholder_'+nextDateNum).hide()				
			
			window.prevVisible = prevDateNum
			window.nextVisible = window.todayDate.getMonth()+""+window.todayDate.getDate()+""+window.todayDate.getFullYear()						

			window.todayDate = addDays(window.todayDate, -pdelta)			
			resetDayCounters(window.todayDate)
		}
	});
	$("#nextLectureButton").on("click", function() {
		var pdelta = 0, ndelta = 0, prevDate, nextDate, prevDateNum, nextDateNum
		
		do {
			pdelta++
		
			prevDate = addDays(window.todayDate, -pdelta)
			prevDateNum = prevDate.getMonth()+""+prevDate.getDate()+""+prevDate.getFullYear()
		} while($('.day_'+prevDateNum).length === 0 && pdelta < _cutoff) 
		
		do {
			ndelta++
			
			nextDate = addDays(window.todayDate, ndelta)		
			nextDateNum = nextDate.getMonth()+""+nextDate.getDate()+""+nextDate.getFullYear()	
		} while($('.day_'+nextDateNum).length === 0 && ndelta < _cutoff) 		
				
		if (pdelta < _cutoff && ndelta < _cutoff) {				
			$('.day_'+prevDateNum).hide()
			$('.placeholder_'+prevDateNum).hide()
			$('.day_'+nextDateNum).css('display','table-cell')
			
			window.prevVisible = window.todayDate.getMonth()+""+window.todayDate.getDate()+""+window.todayDate.getFullYear()
			window.nextVisible = nextDateNum
			
			window.todayDate = addDays(window.todayDate, ndelta)
			resetDayCounters(window.todayDate)
		}
	});	
	
	$("#fakeloginform").submit();		
	window.lastFakeLoginCheck = new Date();
	
	setInterval(function() {
		console.log("Timed login")
		$("#fakeloginform").submit();		
		window.lastFakeLoginCheck = new Date();		
	}, 3600000)
});

$(window).focus(function() {
	if (window.lastFakeLoginCheck && new Date().getTime() - window.lastFakeLoginCheck.getTime() > 3600000) {
		console.log("Focus login")
		$("#fakeloginform").submit();		
		window.lastFakeLoginCheck = new Date();
	}
})

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


function resetLectures() {
	var date = new Date();
	
	var prevDateNum = window.prevVisible
	var nextDateNum = window.nextVisible
	
	$('.day_'+prevDateNum).hide()
	$('.day_'+nextDateNum).hide()
	
	var prevDate = addDays(date, 0)
	prevDateNum = prevDate.getMonth()+""+prevDate.getDate()+""+prevDate.getFullYear()
	var nextDate = addDays(date, 1)
	nextDateNum = nextDate.getMonth()+""+nextDate.getDate()+""+nextDate.getFullYear()		
	
	$('.day_'+prevDateNum).show()
	$('.day_'+nextDateNum).show()
	$('.placeholder_'+prevDateNum).show()
	$('.placeholder_'+nextDateNum).show()	
	
	window.todayDate = date;
	resetDayCounters(window.todayDate)		
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

function addDays(date, days) {
	if (typeof date === 'number') {
		days = date;
		date = new Date();
	}
	
    var result = new Date(date);
    result.setTime(result.getTime() + days * 86400000);
    return result;
}