const app = require('express')();

const { getAllSqueaks, postSqueak, getSqueak, likeSqueak, unlikeSqueak, commentOnSqueak, deleteSqueak } = require('./handlers/squeaks');
const { signUp, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead } = require('./handlers/users');
const { database } = require('./util/admin');

const functions = require('firebase-functions');
const firebaseAuthMiddleware = require('./util/firebaseAuthMiddleware');

// Squeak routes
app.get('/squeaks', getAllSqueaks);
app.post('/squeaks', firebaseAuthMiddleware, postSqueak);
app.get('/squeaks/:squeakId', getSqueak);
app.get('/squeaks/:squeakId/like', firebaseAuthMiddleware, likeSqueak);
app.get('/squeaks/:squeakId/unlike', firebaseAuthMiddleware, unlikeSqueak);
app.post('/squeaks/:squeakId/comments', firebaseAuthMiddleware, commentOnSqueak);
app.delete('/squeaks/:squeakId', firebaseAuthMiddleware, deleteSqueak);

// Users routes
app.post('/signup', signUp);
app.post('/login', login);
app.get('/user/:username', getUserDetails);
app.get('/user', firebaseAuthMiddleware, getAuthenticatedUser);
app.post('/user/image', firebaseAuthMiddleware, uploadImage);
app.post('/user', firebaseAuthMiddleware, addUserDetails);
app.post('/notifications', firebaseAuthMiddleware, markNotificationsRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore.document('likes/{id}').onCreate(snapshot => {
    return database.doc(`/squeaks/${snapshot.data().squeakId}`).get().then(doc => {
        if (doc.exists && doc.data().user !== snapshot.data().user) {
            return database.doc(`/notifications/${snapshot.id}`).set({
                timeCreated: new Date().toISOString(),
                recipient: doc.data().user,
                sender: snapshot.data().user,
                type: 'like',
                read: false,
                squeakId: doc.id
            });
        }
    }).catch(e => {
        console.error(e);
    });
});

exports.createNotificationOnComment = functions.firestore.document('comments/{id}').onCreate(snapshot => {
    return database.doc(`/squeaks/${snapshot.data().squeakId}`).get().then(doc => {
        if (doc.exists && doc.data().user !== snapshot.data().user) {
            return database.doc(`/notifications/${snapshot.id}`).set({
                timeCreated: new Date().toISOString(),
                recipient: doc.data().user,
                sender: snapshot.data().user,
                type: 'comment',
                read: false,
                squeakId: doc.id
            });
        }
    }).catch(e => {
        console.error(e);
    });
});

exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}').onDelete(snapshot => {
    return database.doc(`/notifications/${snapshot.id}`).delete().then(() => {
        return;

    }).catch(e => {
        console.error(e);
    });
});

exports.onUserImageChange = functions.firestore.document('/users/{id}').onUpdate(change => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
        const squeaksDocument = database.collection('squeaks').where('user', '==', change.before.data().username);
        const commentsDocument = database.collection('comments').where('user', '==', change.before.data().username);
        let batch = database.batch();

        return squeaksDocument.get().then(data => {
            data.forEach(doc => {
                batch.update(database.doc(`/squeaks/${doc.id}`), { userImage: change.after.data().imageUrl });
            });

            return commentsDocument.get();

        }).then(data => {
            data.forEach(doc => {
                batch.update(database.doc(`/comments/${doc.id}`), { userImage: change.after.data().imageUrl });
            });

            return batch.commit();

        }).catch(e => {
            console.error(e);
        });
    }
});

exports.onSqueakDelete = functions.firestore.document('/squeaks/{squeakId}').onDelete((snapshot, context) => {
    const squeakId = context.params.squeakId;
    const batch = database.batch();

    return database.collection('comments').where('squeakId', '==', squeakId).get().then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/comments/${doc.id}`));
        });

        return database.collection('likes').where('squeakId', '==', squeakId).get();

    }).then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/likes/${doc.id}`));
        });

        return database.collection('notifications').where('squeakId', '==', squeakId).get();

    }).then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/notifications/${doc.id}`));
        });

        return batch.commit();

    }).catch(e => {
        console.error(e);
    });
});