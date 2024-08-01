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

const addValidator = [
    body("type").notEmpty().isInt().isIn([1, 2, 3, 4, 5]),
    body("time").notEmpty().isString(),
    body("menuList").notEmpty().isArray(),
    body("menuList.*").notEmpty().isObject(),
    body("menuList.*.menu").notEmpty().isString(),
    body("menuList.*.calory").notEmpty().isFloat(),
    body("menuList.*.amount").notEmpty().isFloat(),
    body("menuList.*.unit").notEmpty().isInt().isIn([0, 1]),
    body("menuList.*.did").notEmpty().isInt(),
    body("menuList.*.cid").notEmpty().isInt(),
    validationHandler.handle,
];

router.post("/add", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("UserNotFound");
            return;
        }

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
                    await mysql.TRANSACTION.ROLLBACK;
                    return res.failResponse("ParameterInvalid");
                }
            }
        });
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
