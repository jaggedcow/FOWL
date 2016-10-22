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
	
/*
	$('#fakeloginframe').on('load', function(){
        if ($(this).attr('src').indexOf('/portal/logout') !== -1) {
    		$("#fakeloginframe").attr('src','')

        }
    });
*/
	
// 	$("#fakeloginframe").attr('src','https://owl.uwo.ca/portal/logout')
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