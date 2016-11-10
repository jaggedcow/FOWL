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