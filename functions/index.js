'use strict';

const functions = require('firebase-functions');
// const pw = 'ss954a0120777777';
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
const app = express();
const moment = require('moment');
const DEFAULT = "DEFAULT";

//algolia
const algoliasearch = require('algoliasearch');
const dotenv = require('dotenv');
const ALGOLIA_APP_ID= '3NLQXPNR7M';
const ALGOLIA_API_KEY= '0cbce220bac5fc0ad682407c2e37c300';
const ALGOLIA_INDEX_NAME= 'uid';
const FIREBASE_DATABASE_URL= 'https://wordsupport3.firebaseio.com/';

// // load values from the .env file in this directory into process.env
// dotenv.load();
//
// // configure firebase
// firebase.initializeApp({
//     databaseURL: process.env.FIREBASE_DATABASE_URL,
// });
// const database = firebase.database();

// configure algolia
const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);


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
// app.get('/api', (req, res) => {
//     if(!req.headers.groupKey || !req.headers.contentsKey){
//         res.status(403).send('Unauthorized');
//         return;
//     }
//
//     const commentRef = functions.database.ref('/group/'+ req.headers.groupKey + "/contents/"+ req.headers.contentsKey + "comment");
//
//     commentRef.transaction(current => {
//         if (event.data.exists() && !event.data.previous.exists()) {
//             return (current || 0) + 1;
//         } else if (!event.data.exists() && event.data.previous.exists()) {
//             return (current || 0) - 1;
//         }
//     }).then(() => {
//         console.log('Counter updated.');
//     });
//
//     res.send("groupKey: "+ req.headers.groupKey +"contentsKey: "+ req.headers.contentsKey);
// });

app.post('/searchUser', (req, res) => {
    const NO_RESULT = 'NO_RESULT';
    const OVER_50 = 'OVER_50';
    const SUCCESS ='SUCCESS';
    const OPERATION_ERROR = 'OPERATION_ERROR';
    console.log('こっち');
    if(!req.body.keyword){
        res.status(403).send('non-keyword');
    } else {
        console.log(req.body.keyword);

        admin.database().ref().child('userData').once('value').then((snapshot) => {

            let result = [];
            snapshot.forEach(function (childSnap) {
                if(childSnap.key === DEFAULT || !checkHasChild(childSnap, ['displayName', 'photoUrl'], 'searchUser') || childSnap.key === )
                    return;

                let displayName = childSnap.child('displayName').val();
                let bigDisplayName = displayName.toUpperCase();
                let bigKeyword = req.body.keyword.toUpperCase();
                if (bigDisplayName.indexOf(bigKeyword) === -1)
                    return;

                let photoUrl = childSnap.child('photoUrl').val();
                let user = {
                    displayName: displayName,
                    photoUrl: photoUrl,
                    uid: childSnap.key
                };
                result.push(user);
            });

            if (result.length === 0) {
                let json = { status: NO_RESULT };
                res.status(200).send(JSON.stringify(json));
            } else if (snapshot.numChildren() > 50){
                let json = { status: OVER_50 };
                res.status(200).send(JSON.stringify(json));
            } else {
                let json = {
                    status: SUCCESS,
                    result: result
                };
                res.status(200).send(JSON.stringify(json));
            }
        }).catch((error) =>{
            console.log(error);
            let response = {status: OPERATION_ERROR};
            res.status(200).send(JSON.stringify(response));
        });
    }
});

exports.searchUser = functions.https.onRequest(app);

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

// exports.helloWorld = functions.https.onRequest(app);


exports.updateGroupName = functions.database.ref('/group/{groupKey}/groupName')
    .onUpdate(event => {
        return event.data.ref.parent.child('member')
            .once('value')
            .then(function(snapshot){
                snapshot.forEach(function(child) {
                    event.data.ref.root
                        .child("userData").child(child.key).child('group').child(event.params.groupKey).child("name")
                        .set(event.data.val());
                });
        });
});

exports.updatePhotoUrl = functions.database.ref("/group/{groupKey}/photoUrl")
    .onUpdate(event => {
        return event.data.ref.parent.child('member')
            .once('value')
            .then(function(snapshot){
                snapshot.forEach(function(child) {
                    event.data.ref.root
                        .child("userData").child(child.key).child('group').child(event.params.groupKey).child("photoUrl")
                        .set(event.data.val());
                });
            });
});

exports.onCreateAccount = functions.auth.user()
    .onCreate(event => {
        const uid = event.data.uid;
        const photoUrl = setWhenNull(event.data.photoUrl);
        const email = setWhenNull(event.data.email);
        const displayName = setWhenNull(event.data.displayName);
        const date = moment().format("YYYYMMDD");

        //これってまとめられるんすか？
        admin.database().ref().child("userData").child(uid).child("registeredDate").set(date);
        admin.database().ref().child("userData").child(uid).child("template").set(DEFAULT);
        admin.database().ref().child("userData").child(uid).child("group").child(DEFAULT).set(DEFAULT);
        admin.database().ref().child("friend").child(uid).child(DEFAULT).child("name").set(DEFAULT);
        admin.database().ref().child("friend").child(uid).child(DEFAULT).child("photoUrl").set(DEFAULT);
        admin.database().ref().child("usersParam").child(uid).child(DEFAULT).set(DEFAULT);

        let records ={
            objectID: uid,
            displayName: displayName,
            photoUrl: photoUrl
        };

        return admin.database().ref().child("userData").child(uid).set({
            photoUrl: photoUrl,
            email: email,
            displayName: displayName
        }).then(() => {
            let index = algolia.initIndex(ALGOLIA_INDEX_NAME);
            return index.saveObject(records);
        }).catch(error => {
            console.log(error);
        });
});

// "userData", user.getUid(), "displayName")
/**
 * プロフィールの名前更新時に発火。主な機能は、
 * 1.friendノードから友達のuidを検索→各友達の友人データ上書き
 * 2.自分が参加しているグループを検索→メンバー、「○○さんの記録」の部分を上書き
 */
exports.onPrefNameUpdate = functions.database.ref("/userData/{userUid}/displayName")
    .onUpdate(event => {

        let newMyName = event.data.val();
        let myUid = event.params.userUid;
        let rootRef = event.data.ref.root;

        return rootRef.child("friend").child(myUid)
            .once("value")
            .then(function(snapshot){

                snapshot.forEach(function(child) {
                    if(child.key !== DEFAULT){
                        event.data.ref.root
                            .child("friend").child(child.key).child(myUid).child("name")
                            .set(event.data.val());
                    }
                });

                event.data.ref.parent.child("group")
                    .once("value")
                    .then(function(snapshot){
                        snapshot.forEach(function (child) {
                            const groupKey = child.key;
                            if(groupKey !== DEFAULT){
                                //groupKey基づいて、各groupNodeを見ていく
                                rootRef.child("group").child(groupKey)
                                    .once("value")
                                    .then(function(snapShotGroup){
                                        if(snapShotGroup.hasChild("contents")){
                                            snapShotGroup.child("contents").forEach(function (snapContents) {
                                                if(snapContents.child("type").val() === "data"){
                                                    const string = newMyName + "さんの記録";
                                                    snapContents.child("contentName").ref.set(string);
                                                }
                                            });
                                        }

                                        if(snapShotGroup.hasChild("member")){
                                            snapShotGroup.child("member").forEach(function (snapMember) {
                                                if(snapMember.key === myUid){
                                                    snapMember.child("name").ref.set(newMyName);
                                                }
                                            })
                                        }
                                    });
                            }
                        });
                    });
            });
});

/**
 * プロフィールのphotoUrlアップデート時に発火。
 * 1.friendノードから友達のuidを検索→各友達の友人データ上書き
 * 2.自分が参加しているグループを検索→メンバーノードを上書き
 */
exports.onPrefPhotoUrlUpdate = functions.database.ref("/userData/{userUid}/photoUrl")
    .onUpdate(event => {

    let newMyPhotoUrl = event.data.val();
    let myUid = event.params.userUid;
    let rootRef = event.data.ref.root;

    return rootRef.child("friend").child(myUid)
        .once("value")
        .then(function(snapshot){

            snapshot.forEach(function(child) {
                if(child.key !== DEFAULT){
                    rootRef.child("friend").child(child.key).child(myUid).child("photoUrl")
                        .set(event.data.val());
                }
            });

            event.data.ref.parent.child("group")
                .once("value")
                .then(function(snapshot){
                    snapshot.forEach(function (child) {
                        const groupKey = child.key;
                        if(groupKey !== DEFAULT){
                            //groupKey基づいて、各groupNodeを見ていく
                            rootRef.child("group").child(groupKey)
                                .once("value")
                                .then(function(snapShotGroup){
                                    if(snapShotGroup.hasChild("member")){
                                        snapShotGroup.child("member").forEach(function (snapMember) {
                                            if(snapMember.key === myUid){
                                                snapMember.child("photoUrl").ref.set(newMyPhotoUrl);
                                            }
                                        })
                                    }
                                });
                        }
                    });
                });
        });
});

/**
 * グループからメンバー退会→各userDataを更新&&体調管理を解除
 * @param string
 * @returns {*}
 */
exports.onGroupMemberDiscourage = functions.database.ref("/group/{groupKey}/member/{userUid}")
    .onDelete(event => {
        let userUid = event.params.userUid;
        let groupKey = event.params.groupKey;
        let rootRef = event.data.ref.root;
        return rootRef.child("group").child(groupKey).once('value').then(function (groupNode) {

            if (!groupNode.hasChild('contents'))
                return;

            groupNode.child('contents').forEach(function (snap) {
                if (!snap.hasChild('type')) {
                    console.log('warning!! there contents not has type! groupKey: ' + groupKey + 'contentsKey: ' + snap.key);
                    return;
                }
                if (!snap.hasChild('whose')) {
                    console.log('warning!! there contents not has whose! groupKey: ' + groupKey + 'contentsKey: ' + snap.key);
                    return;
                }
                //同期中の体調管理を発見！
                if (snap.child('type').val() === 'data' && snap.child('whose').val() === userUid) {
                    console.log('同期中の体調管理を発見!　ユーザ退会の為削除します！');
                    return rootRef.child('group').child(groupKey).child('contents').child(snap.key).set(null).then(function (value2) {
                        console.log('削除成功！');
                    }).catch(function (reason) {
                        console.log('onGroupMemberDiscourage: ', reason.code, reason.message);
                    });
                }
            });
            // updatedMember.forEach(function(child) {
            //     //とはいえmemberノードはDEFAULT保障されていない
            //     if(child.key !== DEFAULT){
            //         console.log(child.key);
            //     }
            // });
        });
});

// exports.onAddedGroup = functions.database.ref('/group/{groupKey}/member/{userUid}').onCreate(event => {
//     let userUid = event.params.userUid;
//     let groupKey = event.params.groupKey;
//     if(event.data.isChecked === false || event.data.isChecked === 'false') {
//
//     } else {
//         console.log('warning onAddedGroup() userUid: '+ userUid +' groupKey: '+ groupKey);
//         return '';
//     }
// });

/**
 * グループ招待時に動作する。
 * writeTask/{commandId}ノードでコマンドを受け付ける。
 * code: INVITE_GROUP
 *  コマンドからgroupKey, 招待する者のuid（複数可）をパラメータとして受け取る。
 *  →まずグループ名、グループアイコンの値を取得
 *  →次に各ユーザのアイコン・ユーザ名を取得し、groupのmember、及び各ユーザのuserDataのgroupノードに書き込みを行う。
 */
exports.writeTask = functions.database.ref('writeTask/{commandId}').onCreate(event => {
    let rootRef = event.data.ref.root;

    if (!event.data.hasChild('code')) {
        console.log('warning! onAddedGroup() event.data.hasChild(code) === false');
        return null;
    }

    var command = event.data.child('code').val();
    switch (command) {
        case 'INVITE_GROUP':
            if (!checkHasChild(event.data, ['keys', 'groupKey'], 'INVITE_GROUP'))
                return null;

            var keys = event.data.child('keys').val().split('_');
            var groupKeyE = event.data.child('groupKey').val();

            return rootRef.child('group').child(groupKeyE).once('value').then(function (snapshot) {

                if(!checkHasChild(snapshot, ['groupName', 'photoUrl'], 'INVITE_GROUP'))
                    return false;

                var groupName = snapshot.child('groupName').val();
                var groupPhotoUrl = snapshot.child('photoUrl').val();

                return rootRef.child('userData').once('value').then(function (snapshot) {
                    if (!checkHasChild(snapshot, keys, 'INVITE_GROUP'))
                        return;

                    var update ={};
                    keys.forEach(function (key) {
                        var photoUrl = snapshot.child(key).child('photoUrl').val();
                        var name = snapshot.child(key).child('displayName').val();
                        console.log(key, photoUrl, name);

                        update['group/' + groupKeyE + '/member/' + key + '/isChecked'] = false;//todo これはisCheckedでいいんだよな？
                        update['group/' + groupKeyE + '/member/' + key + '/photoUrl'] = photoUrl;
                        update['group/' + groupKeyE + '/member/' + key + '/name'] = name;
                        update['userData/' + key + '/group/' + groupKeyE + '/added'] = false;
                        update['userData/' + key + '/group/' + groupKeyE + '/photoUrl'] = groupPhotoUrl;
                        update['userData/' + key + '/group/' + groupKeyE + '/name'] = groupName;
                    });

                    return rootRef.update(update).then(function () {
                        console.log('onAddedGroup成功!');
                    }).catch(function (reason) {
                        console.log(reason);
                    });
                });
            });
        case 'ADD_FRIEND':
            if (!checkHasChild(event.data, ['key', 'targetUserKey'], 'ADD_FRIEND'))
                return null;
            var key = event.data.child('key').val();
            var targetUserKey = event.data.child('targetUserKey').val();

            return rootRef.child('userData').once('value').then(function (snapshot) {
                if(!checkHasChild(snapshot, [key, targetUserKey], 'ADD_FRIEND'))
                    return null;

                if (!checkHasChild(snapshot.child(key), ['displayName', 'photoUrl'], 'ADD_FRIEND')
                        || !checkHasChild(snapshot.child(targetUserKey), ['displayName', 'photoUrl'], 'ADD_FRIEND')) {
                    return null;
                }

                var updates = {};
                updates[key +'/'+ targetUserKey +'/name'] = snapshot.child(targetUserKey).child('displayName').val();
                updates[key +'/'+ targetUserKey +'/photoUrl'] = snapshot.child(targetUserKey).child('photoUrl').val();
                updates[key +'/'+ targetUserKey +'/isChecked'] = false;
                updates[targetUserKey +'/'+ key +'/name'] = snapshot.child(key).child('displayName').val();
                updates[targetUserKey +'/'+ key +'/photoUrl'] = snapshot.child(key).child('photoUrl').val();
                updates[targetUserKey +'/'+ key +'/isChecked'] = false;

                return rootRef.child('friend').update(updates).then(function () {
                    console.log('ADD_FRIEND 成功！key: '+ key +' targetUserKey: '+ targetUserKey);
                }).catch(function (reason) {
                    console.log(reason);
                });
            });
        case 'ADD_GROUP_AS_INVITED':
            if (!checkHasChild(event.data, ['whose', 'groupKey'], 'ADD_GROUP_AS_INVITED'))
                return null;

            var groupKeyF = event.data.child('groupKey').val();
            var userUid = event.data.child('whose').val();

            var updates = {};
            updates['group/'+ groupKeyF +'/member/'+ userUid +'/isChecked'] = true;
            updates['userData/'+ userUid + '/group/'+ groupKeyF + '/added'] = true;
            return rootRef.update(updates).then(function () {
                console.log('ADD_GROUP_AS_INVITED 成功! userUid: '+ userUid +' groupKey: '+ groupKeyF);
            }).catch(function (reason) {
                console.log(reason);
            });

        case 'LEAVE_GROUP':
            if (!checkHasChild(event.data, ['whose', 'groupKey'], command))
                return null;

            var groupKeyG = event.data.child('groupKey').val();
            var userUidG = event.data.child('whose').val();

            var updatesG = {};
            updatesG['group/'+ groupKeyG +'/member/'+ userUidG] = null;
            updatesG['userData/'+ userUidG + '/group/'+ groupKeyG] = null;
            return rootRef.update(updatesG).then(function () {
                console.log('ADD_GROUP_AS_INVITED 成功! userUid: '+ updatesG +' groupKey: '+ groupKeyG);
            }).catch(function (reason) {
                console.log(reason);
            });

        case 'CREATE_GROUP':
            {
                if (!checkHasChild(event.data, ['groupName', 'keys', 'whose', 'photoUrl', 'newGroupKey'], command))
                    return null;

                //todo keysはwhoseを含まないことに注意してください！(json側でバリデーションしてください)
                let groupName = event.data.child('groupName').val();
                let keys = event.data.child('keys').val().split('_');
                let userUid = event.data.child('whose').val();
                let photoUrlGroup = event.data.child('photoUrl').val();
                let newGroupKey = event.data.child('newGroupKey').val();

                keys.push(userUid);

                let updates = {};
                updates['group/'+ newGroupKey +'/groupName'] = groupName;
                updates['group/'+ newGroupKey +'/host'] = userUid;
                updates['group/'+ newGroupKey +'/photoUrl'] = photoUrlGroup;

                return rootRef.child('userData').once('value').then(function(snapshot) {
                    if (!checkHasChild(snapshot, keys, command))
                        return;

                    keys.forEach(function (key) {
                        if(!checkHasChild(snapshot.child(key), ['displayName', 'photoUrl'], command))
                            return;

                        let displayName = snapshot.child(key + '/displayName').val();
                        let photoUrl = snapshot.child(key + '/photoUrl').val();
                        let parentScheme = scheme('group', newGroupKey, 'member', key);
                        updates[scheme(parentScheme, 'isChecked')] = key === userUid;
                        updates[scheme(parentScheme, 'name')] = displayName;
                        updates[scheme(parentScheme, 'photoUrl')] = photoUrl;

                        let userDataScheme = scheme('userData', key, 'group', newGroupKey);
                        updates[scheme(userDataScheme, 'added')] = key === userUid;
                        updates[scheme(userDataScheme, 'name')] = groupName;
                        updates[scheme(userDataScheme, 'photoUrl')] = photoUrlGroup;
                    });

                    let calScheme = scheme('calendar', newGroupKey, DEFAULT);
                    updates[calScheme] = DEFAULT;

                    return rootRef.update(updates).then(function () {

                        console.log('成功: '+ command +'keys: '+ keys +' groupKey: '+ newGroupKey);

                    }).catch(function(error){
                        console.log(error);
                    });
                });
            }
        default:
            console.log('!waring! invalid command: ' + command);
            return null;
    }
});

function setWhenNull(string){
    if(!string)
        return "null";
    else
        return string;
}

/**
 * @param data event.dataで得られるdata
 * @param params 存在を調べたいkeyを格納した配列
 * @param methodName メソッド名
 */
function checkHasChild(data, params, methodName){
    var hasChild = true;
    params.forEach(function(param){
        if (!data.hasChild(param)) {
            console.log('!WARNING!'+ param + 'がdataノードに存在していない! at ' + methodName);
            hasChild = false;
        }
    });

    return hasChild;
}

function scheme(...nodeNames) {
    return nodeNames.join('/');
}

























