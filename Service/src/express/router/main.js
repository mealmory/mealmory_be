/**
 * mealmory
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const { jwtVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema;

const moment = require("moment");
router.get("/home", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        let userData = await mysql.query(
            `
            SELECT id, gender, age, height, weight, bmi, bmr, amr, DATE_FORMAT(reg_date, '%Y-%m-%d') AS date
            FROM ${schema.COMMON}.user
            WHERE id = ?;
            `,
            [userInfo.id],
        );
        console.log(userData.rows[0]);
        if (!userData.success || userData.rows.legnth === 0) {
            res.failResponse("QueryError");
            return;
        }
        let user = {};

        if (userData.rows[0].total == null) {
            user.total = 0;
        } else {
            user.total = userTotal.rows[0].total.toFixed(2);
        }

        user.height = userData.rows[0].height;
        user.weight = userData.rows[0].weight;
        user.bmi = userData.rows[0].bmi;
        user.bmr = userData.rows[0].bmr;
        user.amr = userData.rows[0].amr;

        let avgData = await mysql.query(
            `
            SELECT * FROM ${schema.COMMON}.avg_data 
            WHERE 1 = 1
                AND gender = ?
                AND ? >= age_bottom
                AND ? <= age_top;
            `,
            [userData.rows[0].gender, userData.rows[0].age, userData.rows[0].age],
        );

        if (!avgData.success || avgData.rows.legnth === 0) {
            res.failResponse("QueryError");
            return;
        }

        let average = {};

        average.bmi = avgData.rows[0].bmi;
        average.bmr = avgData.rows[0].bmr;
        average.height = avgData.rows[0].height;
        average.weight = avgData.rows[0].weight;
        let data = {};

        data.avg = average;
        data.user = user;
        data.date = userData.rows[0].date;

        res.successResponse(data);
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const tokenValidator = [query("id").notEmpty(), query("email").notEmpty(), validationHandler.handle];
const jwt = require("jsonwebtoken");

router.get("/token", tokenValidator, async (req, res) => {
    let reqData = matchedData(req);

    let refresh_token = jwt.sign(
        {
            id: reqData.id,
            email: reqData.email,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshExp },
    );
    let token = `Bearer ${refresh_token}`;
    res.successResponse(token);
});

router.get("/data", async (req, res) => {
    try {
        let getData = await mysql.query(
            `
            SELECT * FROM ${schema.DATA}.in LIMIT 10;
            SELECT * FROM ${schema.DATA}.out LIMIT 10;
            SELECT * FROM ${schema.DATA}.processed LIMIT 10;
        `,
        );

        if (!getData.success) {
            res.failResponse("QueryError");
            return;
        }

        let data = {};
        data.in = getData.rows[0];
        data.out = getData.rows[1];
        data.processed = getData.rows[2];

        res.successResponse(data);
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});
const testValidator = [query("time").isString().optional(), query("id").isInt().optional(), validationHandler.handle];

router.get("/test", jwtVerify, testValidator, async (req, res) => {
    try {
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
