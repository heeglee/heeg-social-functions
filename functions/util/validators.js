const isEmail = email => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    return email.match(emailRegEx) ? true : false;
};

const isEmpty = string => {
    if (string) {
        return (!string && !string.trim()) ? true : false;
    } else return true;
};

exports.validateSignUpData = data => {
    let errors = {};

    if (isEmpty(data.email)) {
        errors.email = 'Email must not be empty';
    } else if (!isEmail(data.email)) {
        errors.email = 'Must be a valid email address';
    }
    
    if (isEmpty(data.password)) errors.password = 'Password must not be empty';
    if (data.password !== data.confirmPassword) errors.confirmPassword = 'Password Confirmation value must match';
    
    if (isEmpty(data.username)) errors.username = 'Username must not be empty';

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    };
};

exports.validateLoginData = user => {
    let errors = {};

    if (isEmpty(user.email)) errors.email = 'Email must not be empty';
    if (isEmpty(user.password)) errors.password = 'Password must not be empty';
    
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    };
};

exports.reduceUserDetails = data => {
    let userDetails = {};

    if (data.bio && !isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if (data.website && !isEmpty(data.website.trim())) {
        // https://personal.blog.com/
        if (data.website.trim().substring(0, 4) !== 'http') {
            userDetails.website = `http://${data.website.trim()}`;
        } else {
            userDetails.website = data.website.trim();
        }
    }
    if (data.location && !isEmpty(data.location.trim())) userDetails.location = data.location;

    return userDetails;
};