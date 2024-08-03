/**
 * mealmory
 */

"use strict";

let util = {};

const moment = require("moment-timezone");
const nodeUtil = require("util");
const config = require("./config");
const jwt = require("jsonwebtoken");

util.sleep = (ms) => new Promise((resolve) => setTimeout(resolvem, ms));

/**
 * 안전하게 json 문자열을 파싱
 * @param {string} jsonText 변환할 json 문자열
 * @param {any} defaultValue 변환에 실패했을 경우 반환할 값
 * @returns {any} 객체
 */
util.safeParseJSON = function (jsonText, defaultValue) {
    try {
        return JSON.parse(jsonText);
    } catch (exception) {
        return defaultValue;
    }
};

/**
 * 안전하게 객체를 json 문자열로 변환
 * @param {object} 변환할 객체
 * @param {any} defaultValue 변환에 실패했을 경우 반환할 값
 * @returns {string} json 문자열
 */
util.safeStringifyJSON = function (jsonObj, defaultValue) {
    try {
        return JSON.stringify(jsonObj);
    } catch (exception) {
        return defaultValue;
    }
};

/**
 * 현재 unix 타임스탬프 반환
 * @returns {number} 타임스탬프
 */
util.getCurrentTimestamp = function () {
    return Math.floor(Date.now() / 1000);
};

/**
 * 사용자 정보 기반 jwt 토큰 생성
 * @param {object} 사용자 정보 객체
 * @returns {String} 생성된 jwt 토큰
 */
util.createToken = function (userInfo) {
    try {
        let token = {};
        let access_token = jwt.sign(
            {
                id: userInfo.id,
                email: userInfo.email,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.accessExp },
        );

        let refresh_token = jwt.sign(
            {
                id: userInfo.id,
                email: userInfo.email,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.refreshExp },
        );

        token.accessToken = access_token;
        token.refreshToken = refresh_token;

        return token;
    } catch (exception) {
        return null;
    }
};

util.extractionToken = function (authorization) {
    try {
        let token = authorization.split(" ")[1];
        return token;
    } catch (exception) {
        return null;
    }
};

util.successValidator = function (result, res) {
    if (!result.success) {
        res.failResponse("QueryError");
        return false;
    }

    return true;
};

util.affectedValidator = function (result, res) {
    if (result.affectedRows === 0) {
        res.failResponse("AffectedEmpty");
        return false;
    }

    return true;
};

util.userBmi = function (weight, height) {
    height = height / 100;

    let bmi = parseFloat((weight / (height * height)).toFixed(2));

    return bmi;
};

util.userBmr = function (gender, weight, height, age) {
    let bmr = 10 * weight + 6.25 * height - 5 * age;

    if (Number(gender) === 1) {
        bmr += 5;
    } else if (Number(gender) === 2) {
        bmr -= 161;
    }

    bmr = parseFloat(bmr.toFixed(2));

    return bmr;
};

util.userAmr = function (bmr, activemass) {
    let multi;
    switch (Number(activemass)) {
        case 1:
            multi = 1.2;
            break;
        case 2:
            multi = 1.375;
            break;
        case 3:
            multi = 1.55;
            break;
        case 4:
            multi = 1.725;
            break;
        case 5:
            multi = 1.9;
            break;
    }

    let amr = parseFloat((bmr * multi).toFixed(2));

    return amr;
};

util.rangeDate = function (dateStr, option) {
    let date = moment(dateStr, "YYYY-MM-DD HH:mm:ss");

    let range = {};
    let start, end;

    switch (Number(option)) {
        case 1:
            start = date.format("YYYY-MM-DD HH:mm:ss");
            break;
        case 2:
            start = date.clone().startOf("week").day(0).format("YYYY-MM-DD HH:mm:ss");
            end = date.clone().startOf("week").day(6).format("YYYY-MM-DD HH:mm:ss");
            break;
        case 3:
            start = date.clone().startOf("month").format("YYYY-MM-DD HH:mm:ss");
            end = date.clone().endOf("month").format("YYYY-MM-DD HH:mm:ss");
            break;
    }

    range.start = start;
    range.end = end;

    return range;
};

JSON.emptyObject = JSON.stringify({});
JSON.emptyArray = JSON.stringify([]);

// 기존 nodejs util과 병합
util = { ...util, ...nodeUtil };

module.exports = util;
