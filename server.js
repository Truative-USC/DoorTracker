var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');

var expressApp = express();

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs'),
    mysql = require('mysql'),
    connectionsArray = [],
    connection = mysql.createConnection({
        host: '################',
        user: '################',
        password: '##########',
        database: '##########',
        port: ####, 
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }

    }),
    POLLING_INTERVAL = 5000,
    pollingTimer;




// If there is an error connecting to the database
connection.connect(function(err) {
    // connected! (unless `err` is set)
    if (err) {
        console.log(err);
    }
});

// creating the server ( localhost:8000 )
app.listen(8000);

// on server started we can load our client.html page
function handler(req, res) {
    fs.readFile(__dirname + '/index.html', function(err, data) {
        if (err) {
            console.log("fucking ERROR");
            res.writeHead(500);
            return res.end('Error loading client.html');
        }
        res.writeHead(200);
        res.end(data);
    });
}




function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}

/*
 *
 * HERE IT IS THE COOL PART
 * This function loops on itself since there are sockets connected to the page
 * sending the result of the database query after a constant interval
 *
 */

var checkRecent = function(callback) {

    var pullUsers = connection.query('Select * FROM dooraccess.users;', function(err, data) {

        if (err) {
            callback(err, null);
        } else {
            callback(null, data);
        }


    });
};



var checkUsers = function(callback) {


    var users = [];
    var currRecord;
    var RecentUser = connection.query('SELECT * FROM dooraccess.timestamps WHERE idTimeStamps=(SELECT max(idTimeStamps) FROM dooraccess.timestamps);', function(err, result) {

        if (err)
            callback(err, null);
        else {
            var RecentUser = callback(null, result);

        }
    });



}

let sqlUpdate = 'UPDATE dooraccess.users SET state = ? WHERE card = ?';

var pollingLoop = function() {


    var userData;

    checkUsers(function(err, data) {
        if (err) {
            console.log("ERROR: ", err);
        } else {

            userData = data;
            checkRecent(function(err, allUsers) {
                if (err) {
                    consolel.log("ERROR: ", err);
                } else {
                    
                    for (var i = allUsers.length - 1; i >= 0; i--) {
                        if ((allUsers[i].fname == data[0].fname) && (allUsers[i].lname == data[0].lname)) {
                            if (allUsers[i].state == data[0].state) {
                            } else {
                              let currData = [data[0].state, data[0].card];
                                connection.query(sqlUpdate, currData, (err, results, fields) => {
                                  if(err) {
                                    return console.error(err.message);
                                  }
                                  console.log('Rows affected', results.affectedRows);
                                  console.log(data[0].fname + " has " + data[0].state + " the building");
                                });
                            }
                        }
                    }
                }
            });
        }
    });
    // Doing the database query
    var query = connection.query('SELECT * FROM dooraccess.users;'),
        users = []; // this array will contain the result of our db query

    // setting the query listeners
    query
        .on('error', function(err) {
            // Handle error, and 'end' event will be emitted after this as well
            console.log("fucking error");
            updateSockets(err);
        })
        .on('result', function(user) {
            // it fills our array looping on each user row inside the db
            users.push(user);
        })
        .on('end', function() {
            // loop on itself only if there are sockets still connected
            if (connectionsArray.length) {

                pollingTimer = setTimeout(pollingLoop, POLLING_INTERVAL);

                updateSockets({
                    users: users
                });
            } else {

                console.log('The server timer was stopped because there are no more socket connections on the app')

            }
        });
};


// creating a new websocket to keep the content updated without any AJAX request
io.sockets.on('connection', function(socket) {

    console.log('Number of connections:' + connectionsArray.length);
    // starting the loop only if at least there is one user connected
    if (!connectionsArray.length) {
        pollingLoop();
    }

    socket.on('disconnect', function() {
        var socketIndex = connectionsArray.indexOf(socket);
        console.log('socketID = %s got disconnected', socketIndex);
        if (~socketIndex) {
            connectionsArray.splice(socketIndex, 1);
        }
    });

    console.log('A new socket is connected!');
    connectionsArray.push(socket);

});

var updateSockets = function(data) {
    // adding the time of the last update
    data.time = new Date();
    console.log('Pushing new data to the clients connected ( connections amount = %s ) - %s', connectionsArray.length, data.time);
    // sending new data to all the sockets connected
    connectionsArray.forEach(function(tmpSocket) {
        tmpSocket.volatile.emit('notification', data);
    });
};

console.log('Please use your browser to navigate to http://localhost:8000');