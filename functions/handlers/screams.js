const { database } = require('../util/admin');

exports.getAllScreams = (request, response) => {
    database.collection('screams').orderBy('timeCreated', 'desc').get().then(data => {
        let screams = [];
        data.forEach(doc => {
            const { body, user, timeCreated, comments } = doc.data();
            screams.push({
                screamId: doc.id,
                body,
                user,
                timeCreated,
                comments,
                // TODO: comment/like count + userImage
            });
        });

        return response.json(screams);
    }).catch(e => console.error(e));
};

exports.postScream = (request, response) => {
    if (!request.body.body.trim()) {
        return response.status(400).json({ body: 'Body must not be empty' });
    }

    const newScream = {
        body: request.body.body,
        user: request.user.handle,
        // CHK
        // userImage: request.user.imageUrl,
        timeCreated: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    database.collection('screams').add(newScream).then(data => {
        const responseScream = newScream;
        responseScream.screamId = data.id;

        return response.json(responseScream);

    }).catch(e => {
        console.error(e);
        return response.status(500).json({ error: 'Sorry, something went wrong :(' });
    });
};

exports.getScream = (request, response) => {
    let screamData = {};
    database.doc(`/screams/${request.params.screamId}`).get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Scream not found' });
        }

        screamData = doc.data();
        screamData.screamId = doc.id;

        // CHK
        return database.collection('comments').where('parent', "==", request.params.screamId).orderBy('timeCreated', 'desc').get();

    }).then(data => {
        screamData.comments = [];
        data.forEach(doc => {
            screamData.comments.push(doc.data());
        });

        return response.json(screamData);

    }).catch(e => {
        console.error(e);
        response.status(500).json({ error: e.code });
    });
};

// TODO: rewrite this; i think this like/unlike func sucks at all.
exports.likeScream = (request, response) => {
    const likeDocument = database.collection('likes').where('user', '==', request.user.handle).where('screamId', '==', request.params.screamId).limit(1);
    const screamDocument = database.doc(`/screams/${request.params.screamId}`);

    let screamData;

    screamDocument.get().then(doc => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            
            return likeDocument.get();

        } else {
            return response.status(404).json({ error: 'Scream not found :/' });
        }
    }).then(data => {
        if (data.empty) {
            return database.collection('likes').add({
                screamId: request.params.screamId,
                user: request.user.handle
            }).then(() => {
                screamData.likeCount++;
                return screamDocument.update({ likeCount: screamData.likeCount });

            }).then(() => {
                return response.json(screamData);
            });
        } else {
            return response.status(400).json({ error: 'Scream already liked' });
        }
    }).catch(e => {
        console.error(e);
        return response.status(400).json({ error: e.code });
    });
};

exports.unlikeScream = (request, response) => {
    const likeDocument = database.collection('likes').where('user', '==', request.user.handle).where('screamId', '==', request.params.screamId).limit(1);
    const screamDocument = database.doc(`/screams/${request.params.screamId}`);

    let screamData;

    screamDocument.get().then(doc => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            
            return likeDocument.get();

        } else {
            return response.status(404).json({ error: 'Scream not found :/' });
        }
    }).then(data => {
        if (!data.empty) {
            // TODO: i think this doesn't works properly.
            console.log(data.docs);
            console.log(data.docs[0].data());
            return database.doc(`/likes/${data.docs[0].data().id}`).delete().then(() => {
                screamData.likeCount--;
                return screamDocument.update({ likeCount: screamData.likeCount });

            }).then(() => {
                response.json(screamData);
            });
        } else {
            return response.status(400).json({ error: 'Scream not liked' });
        }
    }).catch(e => {
        console.error(e);
        return response.status(400).json({ error: e.code });
    });
};

exports.commentOnScream = (request, response) => {
    if (request.body.body.trim() === '') return response.status(400).json({ error: 'Comment must not be empty'});

    const newComment = {
        body: request.body.body,
        timeCreated: new Date().toISOString(),
        parent: request.params.screamId,
        user: request.user.handle,
        // I DONT THINK WE NEED THIS
        // userImage: request.user.imageUrl,
    };

    database.doc(`/screams/${request.params.screamId}`).get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Scream not found :/' });
        }

        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });

    }).then(() => {
        return database.collection('comments').add(newComment);

    }).then(() => {
        return response.json(newComment);

    }).catch(e => {
        console.error(e);
        response.status(500).json({ error: e.code });
    });
};

exports.deleteScream = (request, response) => {
    const document = database.doc(`/screams/${request.params.screamId}`);
    document.get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Scream not found :/' });
        }

        console.log(doc.data().user);
        console.log(request.user.handle);
        
        if (doc.data().user !== request.user.handle) {
            return response.status(403).json({ error: 'Unauthorized' });

        } else {
            return document.delete();
        }
    }).then(() => {
        return response.json({ message: 'Scream deleted successfully' });

    }).catch(e => {
        console.error(e);
        return response.json({ error: e.code });
    });
};