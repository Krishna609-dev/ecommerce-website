const { format } = require('util');

module.exports = function flash() {
    return function (req, res, next) {
        if (req.flash) {
            return next();
        }

        req.flash = function (type, message) {
            if (req.session === undefined) {
                throw new Error('req.flash() requires sessions');
            }

            const messages = req.session.flash = req.session.flash || {};

            if (type && message) {
                if (arguments.length > 2) {
                    message = format.apply(undefined, Array.prototype.slice.call(arguments, 1));
                } else if (Array.isArray(message)) {
                    message.forEach(function (value) {
                        (messages[type] = messages[type] || []).push(value);
                    });
                    return messages[type].length;
                }

                return (messages[type] = messages[type] || []).push(message);
            }

            if (type) {
                const queuedMessages = messages[type];
                delete messages[type];
                return queuedMessages || [];
            }

            req.session.flash = {};
            return messages;
        };

        next();
    };
};
