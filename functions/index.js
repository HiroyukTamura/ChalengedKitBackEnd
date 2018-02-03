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
const DELIMITER = "9mVSv";

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
                if(childSnap.key === DEFAULT || !checkHasChild(childSnap, ['displayName', 'photoUrl'], 'searchUser'))
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
        let uid = event.data.uid;
        let photoUrl = setWhenNull(event.data.photoUrl);
        let email = setWhenNull(event.data.email);
        let displayName = setWhenNull(event.data.displayName);
        let date = moment().format("YYYYMMDD");

        //todo テンプレ整備すること
        let updates = {};
        updates[scheme('userData', uid, 'registeredDate')] = date;
        updates[scheme('userData', uid, 'template')] = DEFAULT;
        updates[scheme('userData', uid, 'group',DEFAULT)] = DEFAULT;
        updates[scheme('friend', uid, DEFAULT, "name")] = DEFAULT;
        updates[scheme('friend', uid, DEFAULT, "photoUrl")] = DEFAULT;
        updates[scheme('userParam', uid, DEFAULT)] = DEFAULT;
        updates[scheme('combinedCalendar', uid, DEFAULT)] = DEFAULT;

        admin.database.ref().update(updates).then(() => {

        }).catch((error) => {
            console.log(error);
        });

        let records ={
            objectID: uid,
            displayName: displayName,
            photoUrl: photoUrl
        };

        //ここ、firebaseの無料プランだとサードパーティにデータ送信できないので動作しません
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
// exports.onPrefNameUpdate = functions.database.ref("/userData/{userUid}/displayName")
//     .onUpdate(event => {
//
//         let newMyName = event.data.val();
//         let myUid = event.params.userUid;
//         let rootRef = event.data.ref.root;
//
//         return rootRef.child("friend").child(myUid)
//             .once("value")
//             .then(function(snapshot){
//
//                 snapshot.forEach(function(child) {
//                     if(child.key !== DEFAULT){
//                         event.data.ref.root
//                             .child("friend").child(child.key).child(myUid).child("name")
//                             .set(event.data.val());
//                     }
//                 });
//
//                 event.data.ref.parent.child("group")
//                     .once("value")
//                     .then(function(snapshot){
//                         snapshot.forEach(function (child) {
//                             const groupKey = child.key;
//                             if(groupKey !== DEFAULT){
//                                 //groupKey基づいて、各groupNodeを見ていく
//                                 rootRef.child("group").child(groupKey)
//                                     .once("value")
//                                     .then(function(snapShotGroup){
//                                         if(snapShotGroup.hasChild("contents")){
//                                             snapShotGroup.child("contents").forEach(function (snapContents) {
//                                                 if(snapContents.child("type").val() === "data"){
//                                                     const string = newMyName + "さんの記録";
//                                                     snapContents.child("contentName").ref.set(string);
//                                                 }
//                                             });
//                                         }
//
//                                         if(snapShotGroup.hasChild("member")){
//                                             snapShotGroup.child("member").forEach(function (snapMember) {
//                                                 if(snapMember.key === myUid){
//                                                     snapMember.child("name").ref.set(newMyName);
//                                                 }
//                                             })
//                                         }
//                                     });
//                             }
//                         });
//                     });
//             });
// });

/**
 * プロフィールのphotoUrlアップデート時に発火。
 * 1.friendノードから友達のuidを検索→各友達の友人データ上書き
 * 2.自分が参加しているグループを検索→メンバーノードを上書き
 * todo 未デバッグ
 */
// exports.onPrefPhotoUrlUpdate = functions.database.ref("/userData/{userUid}/photoUrl")
//     .onUpdate(event => {
//
//     let newMyPhotoUrl = event.data.val();
//     let myUid = event.params.userUid;
//     let rootRef = event.data.ref.root;
//
//     return rootRef.child("friend").child(myUid).once("value")
//         .then(function(snapshot){
//
//             let updates = {};
//             snapshot.forEach(function(child) {
//                 if(child.key !== DEFAULT)
//                     return;
//
//                 updates[scheme('friend', child.key, myUid, 'photoUrl')] = newMyPhotoUrl;
//                 // rootRef.child("friend").child(child.key).child(myUid).child("photoUrl")
//                 //     .set(event.data.val());
//             });
//
//             //groupノードを丸ごと取り出し、該当するgroupに書き込んでゆく
//             return rootRef.child("group").once("value").then(function(snapshot){
//                 snapshot.forEach(function (child) {
//                     let groupKey = child.key;
//                     if(groupKey === DEFAULT)
//                         return;
//
//                     // return rootRef.child("group").child(groupKey).once("value")
//                     //     .then(function(snapShotGroup){
//                     if(!child.hasChild("member"))
//                         return;
//
//                     child.child("member").forEach(function (snapMember) {
//                         if (snapMember.key === myUid) {
//                             snapMember.child("photoUrl").ref.set(newMyPhotoUrl);
//                             updates[scheme('group', groupKey, 'member', myUid, 'photoUrl')] = newMyPhotoUrl;
//                         }
//                     });
//
//                     return rootRef.update(updates).then(() => {
//
//                     }).catch((error) => {
//                         console.log(error);
//                     });
//                         //     }
//                         // }).catch((error) => {
//                         //     console.log(error);
//                         // });
//                 });
//             }).catch((error) => {
//                 console.log(error);
//             });
//         });
// });

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

exports.onUpdateSchedule = functions.database.ref('/calendar/{groupKey}/{ym}/{d}/{scheduleKey}').onWrite(event => {
    let rootRef = event.data.ref.root;
    let groupKey = event.params.groupKey;
    let ym = event.params.ym;
    let date = event.params.d;
    let scheduleKey = event.params.scheduleKey;
    let updates = {};

    if (!checkHasChild(event.data, ['colorNum', 'title'], 'onDeleteイベント回避用です'))
        return null;//ここでreturnすることで、onDelete()のイベントを踏まなくて済む。

    return rootRef.child(scheme('group', groupKey)).once('value').then((snapshot) => {
        let groupName = snapshot.child('groupName').val();

        snapshot.child('member').forEach((memberSnap) => {

            if (memberSnap.key === DEFAULT) return;

            let memberKey = memberSnap.key;
            // let rootScheme = scheme('combinedCalendar', memberKey, ym, date, groupKey, scheduleKey);
            let rootScheme = scheme('combinedCalendar', memberKey, ym, date, scheduleKey);
            updates[scheme(rootScheme, 'colorNum')] = event.data.child('colorNum').val();
            updates[scheme(rootScheme, 'title')] = event.data.child('title').val();
            updates[scheme(rootScheme, 'groupKey')] = groupKey;
            updates[scheme(rootScheme, 'groupName')] = groupName;
            // updates[scheme(rootScheme, 'scheduleKey')] = scheduleKey;
        });

        return rootRef.update(updates).then(() => {
            console.log('onUpdateSchedule 成功');
        }).catch((error) => {
            console.log(error);
        });
    });
});

exports.onDeleteSchedule = functions.database.ref('/calendar/{groupKey}/{ym}/{d}/{scheduleKey}').onDelete(event => {
    let rootRef = event.data.ref.root;
    let groupKey = event.params.groupKey;
    let ym = event.params.ym;
    let date = event.params.d;
    let scheduleKey = event.params.scheduleKey;
    let updates = {};

    return rootRef.child(scheme('group', groupKey, 'member')).once('value').then((snapshot) => {
        snapshot.forEach((memberSnap) => {

            if (memberSnap.key === DEFAULT) return;

            let memberKey = memberSnap.key;
            let rootScheme = scheme('combinedCalendar', memberKey, ym, date, scheduleKey);
            updates[rootScheme] = null;
        });

        return rootRef.update(updates).then(() => {
            console.log('onDeleteSchedule 成功');
        }).catch((error) => {
            console.log(error);
        });
    });
});

exports.onCreateUsersParam = functions.database.ref('/usersParam/{uid}/{ymd}').onCreate(event => {
    let uid = event.params.uid;
    let ymd = event.params.ymd;
    let createdMoment = moment(ymd, 'YYYYMMDD');
    let ym = createdMoment.format('YYYYMM');

    return event.data.ref.parent.once('value').then(snapshot => {

        let mounthlyCount = 0;
        let weeklyCount = {};

        snapshot.forEach(childSnap => {

            if (childSnap.key === DEFAULT) return;

            let recordedMoment = moment(childSnap.key, 'YYYYMMDD');
            if (ym === recordedMoment.format('YYYYMM'))
                mounthlyCount++;

            if (recordedMoment.isoWeek() === createdMoment.isoWeek()) {
                let sundayYmd = recordedMoment.clone().startOf('isoWeek').format('YYYYMMDD');
                if (weeklyCount[sundayYmd])
                    weeklyCount[sundayYmd]++;
                else
                    weeklyCount[sundayYmd] = 1;
            }
        });

        let updates = {};
        let rootScheme = scheme('analytics', uid, 'recordCountMon', ym);
        let weekScheme = scheme('analytics', uid, 'recordCountWeek');
        updates[rootScheme] = mounthlyCount;

        for (let keyYmd in weeklyCount)
            if(weeklyCount.hasOwnProperty(keyYmd))
                updates[scheme(weekScheme, keyYmd)] = weeklyCount[keyYmd];


        return event.data.ref.root.update(updates).then(() => {
            console.log('onCreateUsersParam 成功');
        }).catch(error => {
            console.log(error);
        });
    });
});

exports.onUpdateUsersParam = functions.database.ref('/usersParam/{uid}/{ymd}').onUpdate(event => {
    let uid = event.params.uid;
    let ymd = event.params.ymd;
    let updates = {};
    let updatedMoment = moment(ymd, 'YYYYMMDD');
    let ym = updatedMoment.format('YYYYMM');
    let timeEventScheme = scheme('analytics', uid, ym, 'timeEvent');
    let modelRagne = {
        // date: 'YYYYMM / YYYYMMDD(sundayYmd)',
        type: 'range/event',
        min: 'minuteFrom 0:00',
        diffMin: '前週/前月の時間'
    };
    let rangeObjects = {};
    let eventObjects = {};
    let paramsObjects = {};

    return event.data.ref.parent.once('value').then(snapshot => {
        snapshot.forEach(childSnap => {

            if (childSnap.key === DEFAULT) return;

            let recordedMoment = moment(childSnap.key, 'YYYYMMDD');
            if (ym === recordedMoment.format('YYYYMM')) {
                childSnap.forEach((dataSnap) => {
                    switch (dataSnap.child('dataType').val()){
                        case 1:
                            let timeJson = JSON.parse(dataSnap.child('data').val());

                            timeJson['eventList'].forEach(timeEve => {
                                let minute = timeEve['cal']['hourOfDay'] * 60 + timeEve['cal']['minute'];
                                if(Object.keys(eventObjects).indexOf(timeEve['name']) === -1) {
                                    eventObjects[timeEve['name']] = {};
                                    eventObjects[timeEve['name']]['min'] = minute;
                                    eventObjects[timeEve['name']]['count'] = 1;
                                } else {
                                    eventObjects[timeEve['name']]['min'] += minute;
                                    eventObjects[timeEve['name']]['count']++;
                                }
                            });

                            timeJson['rangeList'].forEach(rangeEve => {
                                let objName = rangeEve['start']['name']+ DELIMITER +rangeEve['end']['name'];
                                let startMin = 60 * rangeEve['start']['cal']['hourOfDay'] + rangeEve['start']['cal']['minute'] +  24*60 * rangeEve['start']['offset'];
                                let endMin = 60 * rangeEve['end']['cal']['hourOfDay'] + rangeEve['end']['cal']['minute'] +  24*60 * rangeEve['end']['offset'];

                                if(Object.keys(rangeObjects).indexOf(objName) === -1) {
                                    rangeObjects[objName] = {};
                                    rangeObjects[objName]['startMin'] = startMin;
                                    rangeObjects[objName]['endMin'] = endMin;
                                    rangeObjects[objName]['count'] = 1;
                                } else {
                                    rangeObjects[objName]['startMin'] += startMin;
                                    rangeObjects[objName]['endMin'] += endMin;
                                    rangeObjects[objName]['count']++;
                                }
                            });
                            break;

                        case 3:
                            dataSnap.child('data').forEach(itemSnap => {
                                let splited = itemSnap.val().split(DELIMITER);
                                let dataName = dataSnap.child('dataName').val();

                                if (Object.keys(paramsObjects).indexOf(dataSnap.child('dataName').val()) === -1)
                                    paramsObjects[dataName] = {};

                                if (Object.keys(paramsObjects[dataName]).indexOf(splited[1]) === -1) {
                                    paramsObjects[dataName][splited[1]] = {};
                                    paramsObjects[dataName][splited[1]]['param'] = 0;
                                    paramsObjects[dataName][splited[1]]['type'] = parseInt(splited[0]);
                                }

                                switch (splited.length) {
                                    case 3:
                                        if (!splited[2])
                                            return;
                                        paramsObjects[dataName][splited[1]]['param']++;
                                        break;
                                    case 4:
                                        let fraction = splited[2] / splited[3];
                                        paramsObjects[dataName][splited[1]]['param'] += fraction;
                                        break;
                                    default:
                                        console.log('!不正な値!  '+ splited +' uid: '+ uid +'ymd: '+ ymd);
                                        break;
                                }
                            });
                            break;
                    }
                });
            }
        });

        console.log(JSON.stringify(eventObjects));
        console.log(JSON.stringify(rangeObjects));
        console.log(JSON.stringify(paramsObjects));
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
            let key = event.data.child('key').val();
            let targetUserKey = event.data.child('targetUserKey').val();

            return rootRef.child('userData').once('value').then(function (snapshot) {
                if(!checkHasChild(snapshot, [key, targetUserKey], 'ADD_FRIEND'))
                    return null;

                if (!checkHasChild(snapshot.child(key), ['displayName', 'photoUrl'], 'ADD_FRIEND')
                        || !checkHasChild(snapshot.child(targetUserKey), ['displayName', 'photoUrl'], 'ADD_FRIEND')) {
                    return null;
                }

                let updates = {};
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

            //todo 未デバッグ
        case 'UPDATE_PROFILE': {
            if (!checkHasChild(event.data, ['whose', 'newPhotoUrl', 'newUserName', 'newEmail'], command))
                return null;

            let updates = {};
            let userUid = event.data.child('whose').val();
            let newPhotoUrl = event.data.child('newPhotoUrl').val();
            let newUserName = event.data.child('newUserName').val();
            let newEmail = event.data.child('newEmail').val();

            updates[scheme('userData', userUid, 'displayName')] = newUserName;
            updates[scheme('userData', userUid, 'photoUrl')] = newPhotoUrl;
            updates[scheme('userData', userUid, 'newEmail')] = newEmail;

            return rootRef.child('friend').once('value').then((snapShot) => {
                snapShot.forEach((friendSnap) => {

                    if (friendSnap.key === DEFAULT || friendSnap.key === userUid)
                        return;

                    friendSnap.forEach((childSnap) => {

                        if (childSnap.key !== userUid) return;

                        updates[scheme('friend', friendSnap.key, userUid, 'displayName')] = newUserName;
                        updates[scheme('friend', friendSnap.key, userUid, 'photoUrl')] = newPhotoUrl;
                    });
                });

                return rootRef.child('group').once('value').then((groupSnap) => {

                    if (!checkHasChild(groupSnap, ['member'], command)) return;

                    groupSnap.child('member').forEach((memberSnap) => {

                        if (memberSnap.key !== userUid) return;

                        updates[scheme('group', groupSnap.key, 'member', userUid, 'displayName')] = newUserName;
                        updates[scheme('group', groupSnap.key, 'member', userUid, 'photoUrl')] = newPhotoUrl;
                    });

                    return rootRef.update(updates).then(() => {

                    }).catch((error) => {
                        console.log(error);
                    })
                });
            });

            // snapshot.forEach(function (child) {
            //     if (child.key !== DEFAULT)
            //         return;
            //
            //     updates[scheme('friend', child.key, myUid, 'photoUrl')] = newMyPhotoUrl;
            //     // rootRef.child("friend").child(child.key).child(myUid).child("photoUrl")
            //     //     .set(event.data.val());
            // });
            //
            // //groupノードを丸ごと取り出し、該当するgroupに書き込んでゆく
            // return rootRef.child("group").once("value").then(function (snapshot) {
            //     snapshot.forEach(function (child) {
            //         let groupKey = child.key;
            //         if (groupKey === DEFAULT)
            //             return;
            //
            //         // return rootRef.child("group").child(groupKey).once("value")
            //         //     .then(function(snapShotGroup){
            //         if (!child.hasChild("member"))
            //             return;
            //
            //         child.child("member").forEach(function (snapMember) {
            //             if (snapMember.key === myUid) {
            //                 snapMember.child("photoUrl").ref.set(newMyPhotoUrl);
            //                 updates[scheme('group', groupKey, 'member', myUid, 'photoUrl')] = newMyPhotoUrl;
            //             }
            //         });
            //
            //         return rootRef.update(updates).then(() => {
            //
            //         }).catch((error) => {
            //             console.log(error);
            //         });
            //         //     }
            //         // }).catch((error) => {
            //         //     console.log(error);
            //         // });
            //     });
            // }).catch((error) => {
            //     console.log(error);
            // });
        }
        case 'UPDATE_EMAIL':{
            if (!checkHasChild(event.data, ['whose', 'newEmail'], command))
                return null;

            let userUid = event.data.child('whose').val();
            let newEmail = event.data.child('newEmail').val();

            return rootRef.child(scheme('userData', userUid, 'email')).set(newEmail).then(() => {
                console.log('成功！　UPDATE_EMAIL');
            }).catch((error) => {
               console.log(error);
            });
        }
        case 'UPDATE_DISPLAY_NAME':
            return updateDisplayName(event, rootRef, command);
        case 'UPDATE_PROF_PHOTO':
            return updatePhotoUrl(event, rootRef, command);
        default:
            console.log('!waring! invalid command: ' + command);
            return null;
    }
});

//todo だが、ちょっと待ってほしい。以下の実装では、documentデータの中身のユーザ名まで更新してはいない。そこを実装しないと。
function updateDisplayName(event, rootRef, command) {
    if (!checkHasChild(event.data, ['whose', 'newDisplayName'], command))
        return null;

    let updates = {};
    let userUid = event.data.child('whose').val();
    let newUserName = event.data.child('newDisplayName').val();

    updates[scheme('userData', userUid, 'displayName')] = newUserName;

    return rootRef.child('friend').once('value').then((snapShot) => {
        snapShot.forEach((friendSnap) => {

            if (friendSnap.key === DEFAULT || friendSnap.key === userUid)
                return;

            friendSnap.forEach((childSnap) => {

                if (childSnap.key !== userUid) return;

                updates[scheme('friend', friendSnap.key, userUid, 'name')] = newUserName;
            });
        });

        return rootRef.child('group').once('value').then((parentSnap) => {

            parentSnap.forEach((groupSnap) => {

                if (!checkHasChild(groupSnap, ['member'], command)) return;

                groupSnap.child('member').forEach((memberSnap) => {

                    if (memberSnap.key !== userUid) return;

                    updates[scheme('group', groupSnap.key, 'member', userUid, 'name')] = newUserName;
                });
            });

            return rootRef.update(updates).then(() => {
                console.log('成功！　UPDATE_DISPLAY_NAME'+ scheme(userUid, newUserName));
            }).catch((error) => {
                console.log(error);
            });
        });
    });
}

function updatePhotoUrl(event, rootRef, command) {
    if (!checkHasChild(event.data, ['whose', 'newPhotoUrl'], command))
        return null;

    let updates = {};
    let userUid = event.data.child('whose').val();
    let newUserName = event.data.child('newPhotoUrl').val();

    updates[scheme('userData', userUid, 'photoUrl')] = newUserName;

    return rootRef.child('friend').once('value').then((snapShot) => {
        snapShot.forEach((friendSnap) => {

            if (friendSnap.key === DEFAULT || friendSnap.key === userUid)
                return;

            friendSnap.forEach((childSnap) => {

                if (childSnap.key !== userUid) return;

                updates[scheme('friend', friendSnap.key, userUid, 'photoUrl')] = newUserName;
            });
        });

        return rootRef.child('group').once('value').then((parentSnap) => {

            parentSnap.forEach((groupSnap) => {

                if (!checkHasChild(groupSnap, ['member'], command)) return;

                groupSnap.child('member').forEach((memberSnap) => {

                    if (memberSnap.key !== userUid) return;

                    updates[scheme('group', groupSnap.key, 'member', userUid, 'photoUrl')] = newUserName;
                });
            });

            return rootRef.update(updates).then(() => {
                console.log('成功！' + command + scheme(userUid, newUserName));
            }).catch((error) => {
                console.log(error);
            });
        });
    });
}

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

























