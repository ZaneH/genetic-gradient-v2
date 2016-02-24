var lwip = require("lwip");

lwip.open("testing.jpg", function(err, image) {
	if (err) return console.log(err);
	console.log(image.width());
});
