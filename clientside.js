$(document).ready(function() {
	var count = 1;
	$("#showAllButton").on("click", function() {
		$("#showAllButton").fadeOut();
		$(".comingsoon").fadeIn()
	});
	$("#showPrevButton").on("click", function() {
		if (count === %MAX_DATE%)
			$("#showPrevButton").fadeOut();
		$(".pastweek"+count).fadeIn();
		count++;
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