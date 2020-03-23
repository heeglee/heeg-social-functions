const app = require('express')();

const { getAllScreams, postScream, getScream, likeScream, unlikeScream, commentOnScream, deleteScream } = require('./handlers/screams');
const { signUp, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead } = require('./handlers/users');
const { database } = require('./util/admin');

const functions = require('firebase-functions');
const firebaseAuthMiddleware = require('./util/firebaseAuthMiddleware');

// Scream routes
app.get('/screams', getAllScreams);
app.post('/screams', firebaseAuthMiddleware, postScream);
app.get('/screams/:screamId', getScream);
app.get('/screams/:screamId/like', firebaseAuthMiddleware, likeScream);
app.get('/screams/:screamId/unlike', firebaseAuthMiddleware, unlikeScream);
app.post('/screams/:screamId/comments', firebaseAuthMiddleware, commentOnScream);
app.delete('/screams/:screamId', firebaseAuthMiddleware, deleteScream);

// Users routes
app.post('/signup', signUp);
app.post('/login', login);
app.post('/user/image', firebaseAuthMiddleware, uploadImage);
app.post('/user', firebaseAuthMiddleware, addUserDetails);
app.get('/user', firebaseAuthMiddleware, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', firebaseAuthMiddleware, markNotificationsRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore.document('likes/{id}').onCreate(snapshot => {
    return database.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists && doc.data().user !== snapshot.data().user) {
            return database.doc(`/notifications/${snapshot.id}`).set({
                timeCreated: new Date().toISOString(),
                recipient: doc.data().user,
                sender: snapshot.data().user,
                type: 'like',
                read: false,
                screamId: doc.id
            });
        }
    }).catch(e => {
        console.error(e);
    });
});

exports.createNotificationOnComment = functions.firestore.document('comments/{id}').onCreate(snapshot => {
    return database.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists && doc.data().user !== snapshot.data().user) {
            return database.doc(`/notifications/${snapshot.id}`).set({
                timeCreated: new Date().toISOString(),
                recipient: doc.data().user,
                sender: snapshot.data().user,
                type: 'comment',
                read: false,
                screamId: doc.id
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

// TEMP
exports.onUserImageChange = functions.firestore.document('/users/{id}').onUpdate(change => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
        console.log('Image has been changed');
        let batch = database.batch();

        return database.collection('screams').where('user', '==', change.before.data().handle).get().then(data => {
            data.forEach(doc => {
                const scream = db.doc(`/screams/${doc.id}`);

                batch.update(scream, { userImage: change.after.data().imageUrl });
            });

            return batch.commit();
        }).catch(e => {
            console.error(e);
        });
    }
});

// TODO: test this again
exports.onScreamDelete = functions.firestore.document('/screams/{id}').onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = database.batch();

    return database.collection('comments').where('parent', '==', screamId).get().then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/comments/${doc.id}`));
        });

        return database.collection('likes').where('screamId', '==', screamId);

    }).then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/likes/${doc.id}`));
        });

        return database.collection('notifications').where('screamId', '==', screamId);

    }).then(data => {
        data.forEach(doc => {
            batch.delete(database.doc(`/notifications/${doc.id}`));
        });

        return batch.commit();

    }).catch(e => {
        console.error(e);
    });
});