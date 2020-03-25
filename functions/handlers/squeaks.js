const { database } = require('../util/admin');

exports.getAllSqueaks = (request, response) => {
    database.collection('squeaks').orderBy('timeCreated', 'desc').get().then(data => {
        let squeaks = [];

        data.forEach(doc => {
            const { user, body, timeCreated, countLike, countComment, userImage } = doc.data();

            squeaks.push({
                squeakId: doc.id,
                body,
                user,
                timeCreated,
                countLike,
                countComment,
                userImage
            });
        });

        return response.json(squeaks);

    }).catch(e => console.error(e));
};

exports.postSqueak = (request, response) => {
    if (!request.body.body.trim()) {
        return response.status(400).json({ body: 'Body must not be empty' });
    }

    const newSqueak = {
        user: request.user.username,
        body: request.body.body,
        userImage: request.user.imageUrl,
        timeCreated: new Date().toISOString(),
        countLike: 0,
        countComment: 0,
    };

    database.collection('squeaks').add(newSqueak).then(data => {
        const responseSqueak = {
            ...newSqueak,
            squeakId: data.id,
        };

        return response.json(responseSqueak);

    }).catch(e => {
        console.error(e);
        return response.status(500).json({ error: 'Sorry, something went wrong :(' });
    });
};

exports.getSqueak = (request, response) => {
    let squeakData = {};

    database.doc(`/squeaks/${request.params.squeakId}`).get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Squeak not found' });
        }

        squeakData = {
            ...doc.data(),
            squeakId: doc.id
        };

        return database.collection('comments').where('squeakId', '==', request.params.squeakId).orderBy('timeCreated', 'desc').get();

    }).then(data => {
        squeakData.comments = [];
        data.forEach(doc => {
            squeakData.comments.push(doc.data());
        });

        return response.json(squeakData);

    }).catch(e => {
        console.error(e);
        response.status(500).json({ error: e.code });
    });
};

exports.likeSqueak = (request, response) => {
    const likeDocument = database.collection('likes').where('user', '==', request.user.username).where('squeakId', '==', request.params.squeakId).limit(1);
    const squeakDocument = database.doc(`/squeaks/${request.params.squeakId}`);
    let squeakData;

    squeakDocument.get().then(doc => {
        if (doc.exists) {
            squeakData = {
                ...doc.data(),
                squeakId: doc.id
            };
            return likeDocument.get();

        } else {
            return response.status(404).json({ error: 'Squeak not found :/ '});
        }
    }).then(data => {
        if (data.empty) {
            return database.collection('likes').add({
                squeakId: request.params.squeakId,
                user: request.user.username
            }).then(() => {
                squeakData.countLike++;
                return squeakDocument.update({ countLike: squeakData.countLike });

            }).then(() => {
                return response.json(squeakData);
            });
        } else {
            return response.status(400).json({ error: 'Squeak already liked' });
        }
    }).catch(e => {
        console.error(e);
        return response.status(400).json({ error: e.code });
    });
};

exports.unlikeSqueak = (request, response) => {
    const likeDocument = database.collection('likes').where('user', '==', request.user.username).where('squeakId', '==', request.params.squeakId).limit(1);
    const squeakDocument = database.doc(`/squeaks/${request.params.squeakId}`);
    let squeakData;

    squeakDocument.get().then(doc => {
        if (doc.exists) {
            squeakData = {
                ...doc.data(),
                squeakId: doc.id
            };

            return likeDocument.get();

        } else {
            return response.status(404).json({ error: 'Squeak not found :/ '});
        }
    }).then(data => {
        if (!data.empty) {
            // CHK
            return database.doc(`/likes/${data.docs[0].id}`).delete().then(() => {
                squeakData.countLike--;
                return squeakDocument.update({ countLike: squeakData.countLike });

            }).then(() => {
                response.json(squeakData);
            });
        } else {
            return response.status(400).json({ error: 'Squeak not liked' });
        }
    }).catch(e => {
        console.error(e);
        return response.status(400).json({ error: e.code });
    });
};

exports.commentOnSqueak = (request, response) => {
    if (request.body.body.trim() === '') return response.status(400).json({ error: 'Comment must not be empty'});

    const newComment = {
        squeakId: request.params.squeakId,
        user: request.user.username,
        body: request.body.body,
        timeCreated: new Date().toISOString(),
        userImage: request.user.imageUrl
    };

    database.doc(`/squeaks/${request.params.squeakId}`).get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Squeak not found :/' });
        }

        return doc.ref.update({ countComment: doc.data().countComment + 1 });

    }).then(() => {
        return database.collection('comments').add(newComment);

    }).then(() => {
        return response.json(newComment);

    }).catch(e => {
        console.error(e);
        response.status(500).json({ error: e.code });
    });
};

exports.deleteSqueak = (request, response) => {
    const document = database.doc(`/squeaks/${request.params.squeakId}`);

    document.get().then(doc => {
        if (!doc.exists) {
            return response.status(404).json({ error: 'Squeak not found :/'});
        }

        if (doc.data().user !== request.user.username) {
            return response.status(403).json({ error: 'Unauthorized' });

        } else {
            return document.delete();
        }
    }).then(() => {
        return response.json({ message: 'Squeak deleted successfully' });

    }).catch(e => {
        console.error(e);
        return response.json({ error: e.code });
    });
};