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

router.get("/home", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

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
            SELECT u.id, u.gender, u.age, u.height, u.weight, u.bmi, u.bmr, u.amr, p.total, DATE_FORMAT(u.reg_date, '%Y-%m-%d') AS date 
            FROM ${schema.COMMON}.user u
            LEFT OUTER JOIN ${schema.COMMON}.plan p
            ON u.id = p.uid
            WHERE u.id = ?;
            `,
            [userInfo.id],
        );

        if (!userData.success || userData.rows.legnth === 0) {
            res.failResponse("QueryError");
            return;
        }
        let user = {};

        if ((userData.rows[0].total = String(null))) {
            user.total = 0;
        } else {
            user.total = userData.rows[0].total;
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
        console.log(average);
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

const testValidator = [body("menuList").notEmpty(), validationHandler.handle];

router.post("/test", testValidator, async (req, res) => {
    let result = await mysql.transactionStatement(async (method) => {
        // logic
        // menu 마다 did, cid 검증
        // plan T에 insert 후
        // menu 마다 data 검색
        // 이후 plan_spec 데이터 조작
        // plan_spec insert

        let getDid = await method.query(`SELECT id FROM ${schema.FDATA}.division;`);
        if (!getDid.success) {
            return mysql.TRANSACTION.ROLLBACK;
        }

        let getCid = await method.query(`SELECT id FROM ${schema.FDATA}.category;`);
        if (!getCid.success) {
            return mysql.TRANSACTION.ROLLBACK;
        }

        let did = [];
        let cid = [];

        for (let v in getDid.rows) {
            did.push(getDid.rows[v].id);
        }
        for (let v in getCid.rows) {
            cid.push(getCid.rows[v].id);
        }

        let menuList = reqData.menuList;

        for (let v in menuList) {
            if (menuList[v].did === String(4)) {
                continue;
            }

            if (!did.includes(menuList[v].did) || !cid.includes(menuList[v].cid)) {
                mysql.TRANSACTION.ROLLBACK;
                return res.failResponse("ParameterInvalid");
            }
        }
    });
});

module.exports = router;
