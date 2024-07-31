/**
 * mealmory
 */

"use strict";

const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const config = {
    log: {
        dir: process.env.LOG_DIR,
    },

    webServer: {
        host: process.env.WS_HOST,
        port: process.env.WS_PORT,

        rateLimit: {
            windowsMS: process.env.WS_RATE_LIMIT_WINDOWS_MS || 1 * 60 * 1000,
            max: process.env.WS_RATE_LIMIT_MAX || 100,
        },

        cors: {
            allowOrigin: process.env.WS_CORS_ALLOW_ORIGIN,
        },
    },

    database: {
        connection: {
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                connectionLimit: process.env.DB_CONNECTION_LIMIT,
            },
        },

        schema: {
            COMMON: process.env.DB_NAME_COMMON,
            DATA: process.env.DB_NAME_FDATA,
        },
    },

    jwt: {
        accessExp: process.env.ACCESS,
        refreshExp: process.env.REFRESH,
        secret: process.env.SECRET,
        timeInterval: process.env.TIME_INTERVAL,
    },

    kakao: {
        client_id: process.env.KAKAO_REST_API,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
    },
};

module.exports = config;
