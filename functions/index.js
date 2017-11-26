const functions = require('firebase-functions');
const pw = 'ss954a0120777777';
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
const app = express();
const moment = require('moment');
const DEFAULT = "DEFAULT";

const validateFirebaseIdToken = (req, res, next) => {
    console.log('Check if request is authorized with Firebase ID token');

    if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
        !req.cookies.__session) {
        console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
            'Make sure you authorize your request by providing the following HTTP header:',
            'Authorization: Bearer <Firebase ID Token>',
            'or by passing a "__session" cookie.');
        res.status(403).send('Unauthorized');
        return;
    }

    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        console.log('Found "Authorization" header');
        // Read the ID Token from the Authorization header.
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.log('Found "__session" cookie');
        // Read the ID Token from cookie.
        idToken = req.cookies.__session;
    }

    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next();

    }).catch(error => {
            console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};

app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);
app.get('/api', (req, res) => {
    if(!req.headers.groupKey || !req.headers.contentsKey){
        res.status(403).send('Unauthorized');
        return;
    }

    const commentRef = functions.database.ref('/group/'+ req.headers.groupKey + "/contents/"+ req.headers.contentsKey + "comment");

    commentRef.transaction(current => {
        if (event.data.exists() && !event.data.previous.exists()) {
            return (current || 0) + 1;
        } else if (!event.data.exists() && event.data.previous.exists()) {
            return (current || 0) - 1;
        }
    }).then(() => {
        console.log('Counter updated.');
    });

    res.send("groupKey: "+ req.headers.groupKey +"contentsKey: "+ req.headers.contentsKey);
});

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest(app);

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

exports.updateGroupName = functions.database.ref('/group/{groupKey}/groupName')
    .onUpdate(event => {
        event.data.ref.parent.child('member')
            .once('value')
            .then(function(snapshot){
                snapshot.forEach(function(child) {
                    event.data.ref.root
                        .child("userData").child(child.key).child('group').child(event.params.groupKey).child("name")
                        .set(event.data.val());
                });

                return admin.database().ref('/log').set("ここまで走った。");
        });
});

exports.onCreateAccount = functions.auth.user()
    .onCreate(event => {
        const uid = event.data.uid;
        const date = moment().format("YYYYMMDD");

        admin.database().ref().child(userData).child(uid).child("registeredDate").set(date);
        admin.database().ref().child("userData").child(uid).child("template").set(DEFAULT);
        admin.database().ref().child("userData").child(uid).child("group").set(DEFAULT);
        admin.database().ref().child("userData").child(uid).child("group").set(DEFAULT);
        admin.database().ref().child("friend").child(uid).child(DEFAULT).child("name").set(DEFAULT);
        admin.database().ref().child("friend").child(uid).child(DEFAULT).child("photoUrl").set(DEFAULT);
        admin.database().ref().child("usersParam").child(uid).set(DEFAULT);
});

























