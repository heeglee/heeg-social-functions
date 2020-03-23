const { admin, database } = require('./admin');

module.exports = (request, response, next) => {
    let idToken;

    if (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
        idToken = request.headers.authorization.split('Bearer ')[1];

    } else {
        console.error('No token found :/');
        return response.status(403).json({ error: 'Unauthorized' });
    }

    admin.auth().verifyIdToken(idToken).then(idTokenDecoded => {
        request.user = idTokenDecoded;
        console.log(idTokenDecoded);
        /*
            idTokenDecoded = { iss: 'https://securetoken.google.com/heeg-social',
            aud: 'heeg-social',
            auth_time: 1583925988,
            user_id: 'Svqk2hZ9OBOz7UQb6Q4DpClfOVY2',
            sub: 'Svqk2hZ9OBOz7UQb6Q4DpClfOVY2',
            iat: 1583925988,
            exp: 1583929588,
            email: 'heeg@email.com',
            email_verified: false,
            firebase: { identities: { email: [Array] }, sign_in_provider: 'password' },
            uid: 'Svqk2hZ9OBOz7UQb6Q4DpClfOVY2' }
        */
        return database.collection('users').where('userId', '==', request.user.uid).limit(1).get();

    }).then(data => {
        request.user.handle = data.docs[0].data().handle;
        // request.user.imageUrl = data.docs[0].data().imageUrl;
        return next();

    }).catch(e => {
        console.error(e);
        response.status(403).json(e);
    });
};