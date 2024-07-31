/**
 * mealmory
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config, verify } = require("../../util");
const { jwtVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema;

router("/home", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let userVerify = await mysql.query(`SELEC id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("UserNotFound");
            return;
        }

        let userData = await mysql.query(
            `
            SELECT u.id, u.gender, u.age, u.bmi, u.bmr, u.amr, p.total, DATE_FORMAT(u.reg_date, '%Y-%m-%d') AS date 
            FROM ${schema.COMMON}.user u
            LEFT OUTER JOIN ${schema.COMMON}.plan p
            ON u.id = p.uid
            WHERE u.id = ?;
            `, [userInfo.id]);

        if (!userData.success || userData.rows.legnth === 0) {
            res.failResponse("QueryError");
            return;
        }

        let user = {}

        if (userData.rows[0].total = null) {
            user.total = 0
        } else {
            user.total = userData.rows[0].total;
        }

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
            `, [userData.rows[0].gender, userData.rows[0].age, userData.rows[0].age]);

        if (!avgData.success || avgData.rows.legnth === 0) {
            res.failResponse("QueryError");
            return;
        }

        let average = {};

        average.bmi = avgData.rows[0].bmi;
        average.bmr = avgData.rows[0].bmr;
        average.height = avgData.rows[0].hegiht;
        average.weight = avgData.rows[0].weight;

        let data = {};

        data.avg = average;
        data.user = user;
        data.date = userData.rows[0].date;

        res.successResponse(data);

    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});
module.exports = router;