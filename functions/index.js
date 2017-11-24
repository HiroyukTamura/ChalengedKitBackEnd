const functions = require('firebase-functions');
const pw = 'ss954a0120777777';
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Hiroyuk Tamura!");
});

exports.writeCommand = functions.database.ref('/writeTask/{commandId}')
    .onWrite(event => {
        //削除動作であればreturn
        if (!event.data.exists()) {
            return;
        }
        //
        const commandVal =  event.data.child('command').val();
        const url = event.data.child('url').val();
        const writerUid = event.data.child('writerUid').val();
        const value = event.data.child('value').val();

        admin.database().ref('/log').set(commandVal + url + writerUid + value);
        // console.log(commandVal);
});

