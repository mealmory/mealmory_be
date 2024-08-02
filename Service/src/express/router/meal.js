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
    body("menuList").notEmpty(),
    // body("menuList").notEmpty().isArray(),
    // body("menuList.*").notEmpty().isObject(),
    // body("menuList.*.menu").notEmpty().isString(),
    // body("menuList.*.kcal").notEmpty().isFloat(),
    // body("menuList.*.amount").notEmpty().isFloat(),
    // body("menuList.*.unit").notEmpty().isInt().isIn([0, 1]),
    // body("menuList.*.did").notEmpty().isInt(),
    // body("menuList.*.cid").notEmpty().isInt(),
    // body("menuList.*.fid").notEmpty().isInt(),
    // body("menuList.*.menu_spec").notEmpty().isObject(),
    // body("menuList.*.menu_spec.carbs").notEmpty().isFloat(),
    // body("menuList.*.menu_spec.protein").notEmpty().isFloat(),
    // body("menuList.*.menu_spec.fat").notEmpty().isFloat(),
    body("total").notEmpty().isFloat(),
    validationHandler.handle,
];

router.post("/add", jwtVerify, addValidator, async (req, res) => {
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
            let getDid = await method.query(`SELECT id FROM ${schema.DATA}.division;`);
            if (!getDid.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let getCid = await method.query(`SELECT id FROM ${schema.DATA}.category;`);
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
            let menuList = [];
            let parseList = JSON.parse(reqData.menuList);

            for (let i = 0; i < parseList.length; i++) {
                let newObj = new Object();
                (newObj.menu = parseList[i].menu), (newObj.kcal = parseList[i].kcal), (newObj.amount = parseList[i].amount), (newObj.unit = parseList[i].unit), (newObj.did = parseList[i].did), (newObj.cid = parseList[i].cid), (newObj.fid = parseList[i].fid), menuList.push(newObj);
            }
            console.log(parseList.length);
            for (let v in menuList) {
                if (menuList[v].did === 4) {
                    continue;
                }

                if (!did.includes(menuList[v].did) || !cid.includes(menuList[v].cid)) {
                    return mysql.TRANSACTION.ROLLBACK;
                }
            }

            let menu_spec = [];

            for (let v in parseList) {
                menu_spec.push(parseList[v].menu_spec);
            }
            let inputPlan = await method.execute(
                `
                INSERT INTO ${schema.COMMON}.plan (uid, type, list, total, time) VALUES (?, ?, ?, ?, ?);
                `,
                [userInfo.id, reqData.type, menuList, reqData.total, reqData.time],
            );

            if (!inputPlan.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let getPid = await method.query(`SELECT id FROM ${schema.COMMON}.plan WHERE uid = ? AND time = ?;`, [userInfo.id, reqData.time]);

            if (!getPid.success || getPid.rows.length === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let inputPlanSpec = await method.execute(
                `
                INSERT INTO ${schema.COMMON}.plan_spec (uid, pid, cpf) VALUES (?, ?, ?);
                `,
                [userInfo.id, getPid.rows[0].id, menu_spec],
            );

            if (!inputPlanSpec.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            return mysql.TRANSACTION.COMMIT;
        });

        if (!result.success || !result.commit) {
            res.failResponse("TransactionError");
            return;
        }

        res.successResponse();
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
