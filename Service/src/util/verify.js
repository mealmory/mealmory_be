/*
 * mealmory
 */

"use strict";

const jwt = require("jsonwebtoken");
const config = require("../util/config");

const jwtVerify = (req, res, next) => {
    if (!req || !req.headers) {
        res.failResponse("AuthorizationNull");
        return;
    }

    let authHeader = req.headers["authorization"];

    if (!authHeader) {
        res.failResponse("AuthorizationNull");
        return;
    }

    let token = authHeader.split(" ")[1];

    if (!token) {
        res.failResponse("AuthorizationNull");
        return;
    }

    jwt.verify(token, config.jwt.secret, (exception, userInfo) => {
        if (exception) {
            if (exception.name === "TokenExpiredError") {
                res.failResponse("AuthorizationExpired");
                return;
            } else {
                res.failResponse("AuthorizationInvalid");
                return;
            }
        }

        req.userInfo = userInfo;

        next();
    });
};

const refreshVerify = (req, res, next) => {
    if (!req || !req.headers) {
        res.failResponse("AuthorizationNull");
        return;
    }

    let authHeader = req.headers["authorization"];

    if (!authHeader) {
        res.failResponse("AuthorizationNull");
        return;
    }

    let token = authHeader.split(" ")[1];

    if (!token) {
        res.failResponse("AuthorizationNull");
        return;
    }

    jwt.verify(token, config.jwt.secret, (exception, userInfo) => {
        if (exception) {
            if (exception.name === "TokenExpiredError") {
                res.failResponse("AuthorizationFailed");
                return;
            } else {
                res.failResponse("AuthorizationInvalid");
                return;
            }
        }

        req.userInfo = userInfo;

        next();
    });
};

module.exports = {
    jwtVerify,
    refreshVerify,
};
