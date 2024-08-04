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
const moment = require("moment-timezone");
const { info } = require("winston");

const addValidator = [
    body("type").notEmpty().isInt().isIn([1, 2, 3, 4, 5]),
    body("time").notEmpty().isString(),
    body("menuList").notEmpty(),
    body("menuList.*").notEmpty().isObject(),
    body("menuList.*.menu").notEmpty().isString(),
    body("menuList.*.kcal").notEmpty().isFloat(),
    body("menuList.*.amount").notEmpty().isFloat(),
    body("menuList.*.unit").notEmpty().isInt().isIn([0, 1]),
    body("menuList.*.did").notEmpty().isInt(),
    body("menuList.*.cid").notEmpty().isInt(),
    body("menuList.*.fid").notEmpty().isInt(),
    body("menuList.*.menu_spec").notEmpty().isObject(),
    body("menuList.*.menu_spec.carbs").notEmpty().isFloat(),
    body("menuList.*.menu_spec.protein").notEmpty().isFloat(),
    body("menuList.*.menu_spec.fat").notEmpty().isFloat(),
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
        let date = moment(reqData.time, "YYYY-MM-DD").format("YYYY-MM-DD");

        let planVerify = await mysql.query(`SELECT type FROM ${schema.COMMON}.plan WHERE uid = ? AND type = ? AND DATE(time) = ?;`, [userInfo.id, reqData.type, date]);

        if (!planVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (planVerify.rows.length !== 0 && planVerify.rows[0].type === Number(reqData.type)) {
            res.failResponse("MealPlanDuplicate");
            return;
        }

        let result = await mysql.transactionStatement(async (method) => {
            let getIds = await method.query(
                `
                SELECT id FROM ${schema.DATA}.division;
                SELECT id FROM ${schema.DATA}.category;
                `,
            );

            if (!getIds.success || getIds.rows.length === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            let did = [];
            let cid = [];

            for (let i = 0; i < getIds.rows.length; i++) {
                if (i === 0) {
                    did = getIds.rows[i].map((row) => row.id);
                }

                if (i === 1) {
                    cid = getIds.rows[i].map((row) => row.id);
                }
            }

            let menuList = [];
            let parseList = JSON.parse(reqData.menuList);

            for (let i = 0; i < parseList.length; i++) {
                let newObj = new Object();
                (newObj.menu = parseList[i].menu), (newObj.kcal = parseList[i].kcal), (newObj.amount = parseList[i].amount), (newObj.unit = parseList[i].unit), (newObj.did = parseList[i].did), (newObj.cid = parseList[i].cid), (newObj.fid = parseList[i].fid), menuList.push(newObj);
            }

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

            let carbs = 0;
            let protein = 0;
            let fat = 0;

            for (let i = 0; i < menu_spec.length; i++) {
                carbs += menu_spec[i].carbs;
                protein += menu_spec[i].protein;
                fat += menu_spec[i].fat;
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
                INSERT INTO ${schema.COMMON}.plan_spec (uid, pid, cpf, t_carbs, t_protein, t_fat) VALUES (?, ?, ?, ?, ?, ?);
                `,
                [userInfo.id, getPid.rows[0].id, menu_spec, carbs, protein, fat],
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
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const searchValidator = [query("type").notEmpty().isInt().isIn([1, 2, 3]), query("time").notEmpty().isString()];

router.get("/search", jwtVerify, searchValidator, async (req, res) => {
    try {
        let usreInfo = req.userInfo;
        let reqData = matchedData(req);

        let query = `SELECT id, type, total, time, DATE_FORMAT(time, '%Y-%m-%d') AS format_time FROM ${schema.COMMON}.plan WHERE 1 = 1 AND uid = ? AND `;
        let queryParams = [usreInfo.id];

        let dateRange = util.rangeDate(reqData.time, reqData.type);

        query += `time BETWEEN ? AND ? `;
        queryParams.push(dateRange.start, dateRange.end);

        query += `ORDER BY time ASC;`;

        let getPlan = await mysql.query(query, queryParams);

        if (!getPlan.success) {
            res.failResponse("QueryError");
            return;
        }

        let dateArray = util.dateArray(dateRange.start, dateRange.end);

        getPlan.rows.forEach((item) => {
            if (dateArray.hasOwnProperty(item.format_time)) {
                let data = {
                    id: item.id,
                    type: item.type,
                    total: item.total,
                    time: item.time,
                };
                dateArray[item.format_time].push(data);
            }
        });

        res.successResponse(dateArray);
    } catch (exception) {
        console.log(exception);
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const infoValidator = [query("time").isString().optional(), query("id").isInt().optional(), validationHandler.handle];

router.get("/info", jwtVerify, infoValidator, async (req, res) => {
    let userInfo = req.userInfo;
    let reqData = matchedData(req);

    if (!reqData.time && !reqData.id) {
        res.failResponse("ParameterInvalid");
        return;
    }

    let query = "";
    let queryParams = [];
    query = `
        SELECT p.id, p.uid, p.type, p.list, p.total, s.cpf, s.t_carbs, s.t_protein, s.t_fat, p.time
        FROM mealmory.plan AS p INNER JOIN mealmory.plan_spec AS s
        ON p.id = s.pid `;

    if (!reqData.time) {
        query += `WHERE p.id = ? `;
        queryParams.push(reqData.id);
    }

    if (!reqData.id) {
        let start = moment(reqData.time).startOf("day").format("YYYY-MM-DD HH:mm:ss");
        let end = moment(reqData.time).endOf("day").format("YYYY-MM-DD HH:mm:ss");

        query += `WHERE p.uid = ? AND p.time BETWEEN ? AND ? `;
        queryParams.push(userInfo.id, start, end);
    }

    query += `ORDER BY p.time ASC;`;

    let getMealInfo = await mysql.query(query, queryParams);

    if (!getMealInfo.success) {
        res.failResponse("QueryError");
        return;
    }

    if (getMealInfo.rows.length === 0) {
        res.failResponse("MealPlanNull");
        return;
    }

    let data = [];

    for (let i = 0; i < getMealInfo.rows.length; i++) {
        let row = getMealInfo.rows[i];

        let item = {
            id: row.id,
            uid: row.uid,
            type: row.type,
            total: row.total,
            time: row.time,
            list: [],
        };

        for (let j = 0; j < row.list.length; j++) {
            let list = row.list[j];

            let carbs = row.cpf[j].carbs;
            let protein = row.cpf[j].protein;
            let fat = row.cpf[j].fat;

            let listItem = {
                menu: list.menu,
                kcal: list.kcal,
                amount: list.amount,
                unit: list.unit,
                did: list.did,
                cid: list.cid,
                fid: list.fid,
                menu_spec: {
                    carbs: carbs,
                    protein: protein,
                    fat: fat,
                }
            }
            item.list.push(listItem);
        }

        data.push(item);
    }

    res.successResponse(data);
});
module.exports = router;
