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
		$("#fakeloginframe").attr('src','https://owl.uwo.ca/portal/logout')					
	}
})