var lwip = require("lwip");
var blessed = require("blessed");
var contrib = require("blessed-contrib");

// global "settings"
var desired_output = [255, 255, 255, 100];
var generation_population = 50;
var max_generations = 150;
var mutation_chance = 0.2;
var threshold = 0.02;

// global variables
var current_generation_species = [[]];
var current_generation = 0;

// final result variable
var result = [[0, 0], 0];

// bless up
var screen = blessed.screen({
	smartCSR: true
});
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
	return process.exit(0);
});
screen.title = "Gradient Genetic Algorithm v2";
/*
Global blessed variables. Not sure if this is good practice, but it's the
only option I could think of
*/
var grid;
var speciesBox;
var logBox;
var infoBox;
var finalBox;

lwip.open("demo.jpg", function(err, image) {
	if (err) return console.log(err);

	// now is as good a time as any to run this
	setupTerminal();

	// generate some random species (coordinates) for the first generation
	for (var i = 0; i < generation_population; i++) {
		current_generation_species[i] = [randomCoordinate(), 0];
	}

	// along with the random species (coordinates) we need a fitness for the next part
	addFitnessCalculations();

	for (var gen = 0; gen < max_generations; gen++) {
		// drop the lowest value
		var lowestIndex = 0;
		for (var i = 0; i < current_generation_species.length; i++) {
			if (current_generation_species[i][1] < current_generation_species[lowestIndex][1]) {
				lowestIndex = i;
			}
		}
		current_generation_species.splice(lowestIndex, 1);

		// take a random point, cross the x and y, and add it as a new point
		var tempIndex = Math.floor(Math.random() * (generation_population - 1));
		var tempX = current_generation_species[tempIndex][0][0];
		var tempY = current_generation_species[tempIndex][0][1];
		/*
		because the x and y are going to be exchanged, we need to ensure they
		don't cross the bounds of the width and height of the image. took way
		longer to debug this problem than I'm proud to admit.
		*/
		tempX = clamp(tempX, 0, image.height() - 1);
		tempY = clamp(tempY, 0, image.width() - 1);
		current_generation_species.push([[tempY, tempX], 0]);

		// mutate all species by a few pixels
		for (var i = 0; i < current_generation_species.length; i++) {
			// there's an mutation_chance% chance each coordinate will be mutated
			if (Math.random() < 0.2) {
				// x or y value mutation? up to chance
				var tempCoord = Math.round(Math.random());
				if (Math.random() > 0.5) {
					current_generation_species[i][0][tempCoord] += 4;
				} else {
					current_generation_species[i][0][tempCoord] -= 4;
				}

				// don't go past the image bounds
				if (tempCoord == 0) {
					// the mutation is on the x-axis, clamp it to the width
					current_generation_species[i][0][tempCoord] = clamp(current_generation_species[i][0][tempCoord], 0, (image.width() - 1));
				} else if (tempCoord == 1) {
					// the mutation is on the y-axis, clamp it to the height
					current_generation_species[i][0][tempCoord] = clamp(current_generation_species[i][0][tempCoord], 0, (image.height() - 1));
				} else {
					throw console.error("This is never supposed to happen, and if it does there's a likely crash ahead.");
				}
			}
		}

		current_generation++;
		logBox.log("Starting generation " + current_generation);
		addFitnessCalculations();
		if (checkPerfectMatch()) {
			logBox.log("Found the desired output");
			break;
		}
		updateTerminalContent();
	}

	// the generations have finished, now calculate the coordinates with the highest fitness
	for (var i = 0; i < current_generation_species.length; i++) {
		if (current_generation_species[i][1] > result[1]) {
			result = current_generation_species[i];
		}
	}
	logBox.log("Final result calculated");
	updateTerminalContent();

	function addFitnessCalculations() {
		// give each a fitness value
		for (var i = 0; i < current_generation_species.length; i++) {
			var rgbData = image.getPixel(current_generation_species[i][0][0], current_generation_species[i][0][1]);
			current_generation_species[i][1] = (rgbData['r'] + rgbData['g'] + rgbData['b'] + rgbData['a']) / 865;
		}
	}

	function randomCoordinate() {
		// decided against shorthand because it's hard to read
		var tempCoordinate = new Array();
		var ran = Math.random();
		tempCoordinate[0] = Math.round(ran * (image.width() - 1));
		tempCoordinate[1] = Math.round(ran * (image.height() - 1));
		return tempCoordinate;
	}

	function checkPerfectMatch() {
		for (var i = 0; i < current_generation_species.length; i++) {
			if (current_generation_species[i][1] == 1 || current_generation_species[i][1] >= 1 - threshold) {
				result = current_generation_species[i];
				return true;
			} else {
				return false;
			}
		}
	}

	function setupTerminal() {
		grid = new contrib.grid({rows: 12, cols: 2, screen: screen});

		infoBox = grid.set(0, 0, 2, 2, blessed.box, {
			content: "Generation: " + current_generation + " / " + max_generations + "\n" + "Desired Output: " + desired_output,
			label: "Information",
			border: {
				type: 'line'
			}
		});

		speciesBox = grid.set(2, 0, 10, 1, blessed.box, {
			content: JSON.stringify(current_generation_species, null, 4),
			label: "Current Generation",
			border: {
				type: 'line'
			},
			scrollable: true,
			scrollbar: {
				bg: 'white'
			}
		});
		speciesBox.on("wheeldown", function() {
			speciesBox.scroll(1);
		});
		speciesBox.on("wheelup", function() {
			speciesBox.scroll(-1);
		});

		logBox = grid.set(7, 1, 5, 1, contrib.log, {
			label: "Log",
			fg: "green",
			scrollable: true,
			scrollbar: {
				bg: 'green'
			}
		});
		logBox.on("wheeldown", function() {
			logBox.scroll(1);
		});
		logBox.on("wheelup", function() {
			logBox.scroll(-1);
		});

		finalBox = grid.set(2, 1, 5, 1, blessed.box, {
			label: "Results",
			content: JSON.stringify(result, null, 4),
			border: {
				type: 'line'
			}
		});

		screen.render();
	}

	function updateTerminalContent() {
		infoBox.setContent("Generation: " + current_generation + " / " + max_generations + "\n" + "Desired Output: " + desired_output);
		speciesBox.setContent(JSON.stringify(current_generation_species, null, 4));
		finalBox.setContent(JSON.stringify(result, null, 4));

		screen.render();
	}

	// http://stackoverflow.com/a/11410079
	function clamp(num, min, max) {
		return num < min ? min : num > max ? max : num;
	}
});
