#!/usr/bin/env node
var fs = require('fs');
var request = require('request');
var moment = require('moment');
var flags = require('flags');
var colors = require('colors');

/**
 * VARIABLES
 */

// Ruter-specific variables
var transportations = {
	'0': '🚶',
	'2': '🚌',
	'5': '⛴',
	'6': '🚆',
	'7': '🚋',
	'8': '🚇'
};

/**
 * PROCESS START
 */

var currentdate = new Date().toLocaleString();
currentdate = getApiTime(currentdate);

var pointFrom = (process.argv[2] == undefined ? false : process.argv[2]);
var pointTo = (process.argv[3] == undefined ? false : process.argv[3]);

if (pointFrom == false) throw "missing from";
if (pointTo == false) throw "missing to";

//Change args to match with flags..
process.argv[2] = "--from='" + process.argv[2] + "'";
process.argv[3] = "--to='" + process.argv[3] + "'";

//Define flags 
flags.defineInteger('proposals', 5, 'Number of travel proposals');
flags.defineString('from', 'jernbanetorget', 'From-station');
flags.defineString('to', 'stortinget ', 'To-station');
flags.defineString('time', currentdate, 'Time of arrival at destination');
flags.defineBoolean('after', false, 'If proposals should show arrival before defined time'); 
flags.parse();

// Fix time arg if defined
if(flags.get('time').length === 4){
    // Convert the argument into the ruter apis time format
    currentdate = currentdate.substring(0, 8) + flags.get('time');
}
// If the user also has defined a date
if(flags.get('time').length === 8){
    // Convert the argument into the ruter apis time format
    currentdate = flags.get('time').substring(0, 4) + currentdate.substring(4, 8) + flags.get('time').substring(4, 8);
}

//--- FETCH STOPS ---
var searchObject = {
	from_id: null,
	to_id: null
};

var tools = {

	timeStampToDisplay: function(timestamp){

		var deptTime = new moment(timestamp);
		var hrs = deptTime.hours();
		var mns = deptTime.minutes();
		hrs = (hrs >= 10 ? '' : '0') + hrs;
		mns = (mns >= 10 ? '' : '0') + mns;	
		var stamp = '' + hrs + ':' + mns + "";
		return stamp;		

	}
}

function removeCharFromString(string, character){
    while(string.includes(character)){
        string = string.replace(character, '');
    }
    return string;
}

function getApiTime(string){
    string = removeCharFromString(string, '/');
    string = removeCharFromString(string, ' ');
    string = removeCharFromString(string, ':');
    string = removeCharFromString(string, ',');
    return string;
}

var searchProcess = {

};

searchProcess.find_from = function() {

	request('http://reisapi.ruter.no/Place/GetPlaces/?id=' + encodeURI(pointFrom), function (error, response, body) {
		if (!error && response.statusCode == 200) {
			
			var contents = JSON.parse(body);	
			searchObject.from_id = contents[0].ID;

			//Both stations are provided. find trip.
			searchProcess.find_to();
			//end error
		}
	});

}

searchProcess.find_to = function() {
	request('http://reisapi.ruter.no/Place/GetPlaces/?id=' + encodeURI(pointTo), function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var contents = JSON.parse(body);	
			searchObject.to_id = contents[0].ID;
			searchProcess.find_trip();
		}
	});
}

searchProcess.find_trip = function(){
	request('http://reisapi.ruter.no/Travel/GetTravels?fromPlace=' + searchObject.from_id + '&toPlace=' + searchObject.to_id + '&isafter=' + flags.get('after') + '&time=' + currentdate + '&proposals=' + flags.get('proposals'), function (error, response, body) {
		if (!error && response.statusCode == 200) {
            searchProcess.trip_output(JSON.parse(body));
		}
	});
}

searchProcess.trip_output = function(obj) {

	// OUTPUT
	console.log('--------------------------------');
	console.log(colors.green('REISEFORSLAG ' + pointFrom + " -> " + pointTo));

	for (var i = 0; i < obj.TravelProposals.length; i++) {
		var travelProposal = obj.TravelProposals[i];

		console.log(colors.bold.yellow('------- ' + 'Forslag #' + (i+1) + ' (Travel Time: ' + travelProposal.TotalTravelTime + ') -------'));

		console.log('Departure:'.bold.white + "	" + new moment(travelProposal.DepartureTime).toString());
		console.log('Arrival:'.bold.white + "	" + new moment(travelProposal.ArrivalTime).toString());
		console.log('');

		//REMARKS
		if (travelProposal.Remarks.length > 0) {
			console.log('⚠️  Remarks! Check app or ruter.no ⚠️');
			console.log('');
		}

		for (var y = 0; y < travelProposal.Stages.length; y++) {
			var stage = travelProposal.Stages[y];

			var stageStep = (colors.magenta('[') + colors.grey(y + 1) + colors.magenta('] '));
			var emoji = transportations[stage.Transportation];


			if (stage.Transportation == '0') { //Walking
				console.log(stageStep + emoji  + " Walk " + colors.cyan(stage.WalkingTime));
			} else {

				//USING TRANSPORT (NOT WALKING)
				
				var stamp_departure = '(' + colors.red(tools.timeStampToDisplay(stage.DepartureTime)) + ')';
				var stamp_arrival = '(' + colors.red(tools.timeStampToDisplay(stage.ArrivalTime)) + ')';

				console.log(stageStep  + " " + stage.DepartureStop.Name + ' ' + stamp_departure + ' ' + stage.LineName + ' ' + emoji + '  -> ' + stage.ArrivalStop.Name + " " + stamp_arrival);	
			}
			
			//end stage iteration
		}

		console.log(''); //new line at bottom
		//end travel proposal iteration
	}
	//end trip_output
}

//Start process
searchProcess.find_from();

