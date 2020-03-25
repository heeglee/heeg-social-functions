const { admin, database } = require('../util/admin');
const config = require('../util/config');
const { validateSignUpData, validateLoginData, reduceUserDetails } = require('../util/validators');
const firebase = require('firebase');
firebase.initializeApp(config);

exports.signUp = (request, response) => {
    let token, userId;
    // TODO: no-image deal
    const noImg = 'no-img.png';

    const newUser = {
        email: request.body.email,
        password: request.body.password,
        confirmPassword: request.body.confirmPassword,
        username: request.body.username,
    };

    const { errors, valid } = validateSignUpData(newUser);
    if (!valid) return response.status(400).json(errors);

    database.doc(`/users/${newUser.username}`).get().then(doc => {
        if (doc.exists) {
            return response.status(400).json({ username: 'Sorry, this name is already taken' });
        } else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
        }

    }).then(data => {
        userId = data.user.uid;
        return data.user.getIdToken();

    }).then(t => {
        token = t;
        const userCredentials = {
            username: newUser.username,
            email: newUser.email,
            timeCreated: new Date().toISOString(),
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
            userId
        };

        database.doc(`/users/${newUser.username}`).set(userCredentials);

    }).then(() => {
        return response.status(201).json({ token });

    }).catch(e => {
        console.error(e);

        switch (e.code) {
            case 'auth/email-already-in-use':
                return response.status(400).json({ email: 'Email is already in use' });
            default:
                return response.status(500).json({ general: 'Something went wrong :/ Please try again.' });
        }
    });
};

exports.login = (request, response) => {
	const user = {
		email: request.body.email,
		password: request.body.password
	};

	const { errors, valid } = validateLoginData(user);
    if (!valid) return response.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password).then(data => {
        return data.user.getIdToken();

    }).then(t => {
        return response.json({ token: t })

    }).catch(e => {
        console.error(e);

        switch (e.code) {
            case 'auth/invalid-email':
                return response.status(500).json({ general: 'Wrong e-mail account, please check it again.'});
            case 'auth/user-not-found':
                return response.status(500).json({ general: 'User not found.' });
            case 'auth/wrong-password':
                return response.status(403).json({ general: 'Wrong password, please check it again.' });
            default:
                return response.status(500).json({ general: 'Something went wrong :/ Please try again.' });
        }
    });
};

exports.addUserDetails = (request, response) => {
    let userDetails = reduceUserDetails(request.body);

    database.doc(`/users/${request.user.username}`).update(userDetails).then(() => {
        return response.json({ message: 'Added user details successfully '});

    }).catch(e => {
        console.error(e);
        return response.status(500).json({ error: e.code });
    });
};

exports.getUserDetails = (request, response) => {
    let userData = {};
    database.doc(`/users/${request.params.username}`).get().then(doc => {
        if (doc.exists) {
            userData.user = doc.data();
            return database.collection('squeaks').where('user', '==', request.params.username).orderBy('timeCreated', 'desc').get();

        } else {
            return response.status(404).json({ error: 'User not found :/ '});
        }

    }).then(data => {
        userData.squeaks = [];
        data.forEach(doc => {
            userData.squeaks.push({
                body: doc.data().body,
                timeCreated: doc.data().timeCreated,
                user: doc.data().writer,
                countLike: doc.data().countLike,
                countComment: doc.data().countComment,
                squeakId: doc.id
            });
        });

        return response.json(userData);

    }).catch (e => {
        console.error(e);
        return response.status(500).json({ error: e.code });
    });
};

exports.getAuthenticatedUser = (request, response) => {
    let userData = {};
    database.doc(`/users/${request.user.username}`).get().then(doc => {
        if (doc.exists) {
            userData.credentials = doc.data();
            return database.collection('likes').where('user', '==', request.user.username).get();
        }
    }).then(data => {
        userData.likes = [];
        if (data) {
            data.forEach(doc => {
                userData.likes.push(doc.data());
            });
        }

        return database.collection('notifications').where('recipient', '==', request.user.username).orderBy('timeCreated', 'desc').limit(10).get();

    }).then(data => {
        userData.notifications = [];
        if (data) {
            data.forEach(doc => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    timeCreated: doc.data().timeCreated,
                    squeakId: doc.data().squeakId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id
                });
            });
        }

        return response.json({ userData });

    }).catch(e => {
        console.error(e);
        return response.status(500).json({ error: e.code });
    });
};

exports.markNotificationsRead = (request, response) => {
    let batch = database.batch();
    request.body.forEach(notificationId => {
        const notification = database.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: true });
    });

    batch.commit().then(() => {
        return response.json({ message: 'Notifications marked read'});

    }).catch(e => {
        console.error(e);
        return response.status(500).json({ error: e.code });
    });
};

exports.uploadImage = (request, response) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const mimeSupported = ['image/jpeg', 'image/png', 'image/webp'];

    const busboy = new BusBoy({ headers: request.headers });

    let imageFileName;
    let imageToBeUploaded = {};

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (!mimeSupported.includes(mimetype)) {
            return response.status(400).json({ error: 'Wrong file type submitted' });
        }

        // image.png or my.image.png
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        // 132154673544.png
        imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`;
        const filePath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('finish', () => {
        admin.storage().bucket('heeg-social.appspot.com').upload(imageToBeUploaded.filePath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        }).then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;

            return database.doc(`/users/${request.user.username}`).update({ imageUrl });

        }).then(() => {
            return response.json({ message: 'Image uploaded successfully' });

        }).catch(e => {
            console.error(e);
            return response.status(500).json({ error: e.code });
        });
    });

    busboy.end(request.rawBody);
};