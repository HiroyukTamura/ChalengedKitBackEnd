const functions = require('firebase-functions');
const pw = 'ss954a0120777777';
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Hiroyuk Tamura!");
});

exports.backUp = functions.https.onRequest((request, response) => {
    // if (req.method === 'PUT') {
    //     res.status(403).send('Forbidden!');
    // }
    //
    // if(req.method !== 'POST'){
    //     res.status(404).send('Not Found');
    // }

    if(request.body.pw !== pw){
        res.status(404).send('Not Found');
    } else {
        response.send(request.body.pw);
        admin.database().ref('/accept').then(snapshot => {
            res.redirect(303, snapshot.ref);
        })
    }
});
