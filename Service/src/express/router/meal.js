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

const addValidator = [
    body("time").notEmpty().isString(),
    body("type").notEmpty().isInt().isIn([1, 2, 3, 4, 5]),
    body("total").notEmpty().isFloat(),
    body("menuList").notEmpty(),
    body("menuList.*").notEmpty().isObject(),
    body("menuList.*.menu").notEmpty().isString(),
    body("menuList.*.kcal").notEmpty().isFloat(),
    body("menuList.*.amount").notEmpty().isFloat(),
    body("menuList.*.unit").notEmpty().isInt().isIn([0, 1]),
    body("menuList.*.did").notEmpty().isInt().isIn([1, 2, 3, 4]),
    body("menuList.*.cid").notEmpty().isInt(),
    body("menuList.*.fid").notEmpty().isInt(),
    body("menuList.*.carbs").notEmpty().isFloat(),
    body("menuList.*.protein").notEmpty().isFloat(),
    body("menuList.*.fat").notEmpty().isFloat(),
    validationHandler.handle,
];

router.post("/add", jwtVerify, addValidator, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        // user 검증
        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        // did, cid로 조건 걸어서 fid 검증 + did = 4일땐 패스
        let menuList = util.safeParseJSON(reqData.menuList);

        let query = "";
        let queryParams = [];
        let d_count = 0;
        for (let i = 0; i < menuList.length; i++) {
            let table = util.didVerify(menuList[i].did);

            if (table !== "") {
                query += `
                SELECT id FROM ${schema.DATA}.${table} WHERE did = ? AND cid = ? AND id = ?;
            `;
                queryParams.push(menuList[i].did, menuList[i].cid, menuList[i].fid);
                d_count += 1;
            } else {
                continue;
            }
        }

        let foodVerify = await mysql.query(query, queryParams);

        if (!foodVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (foodVerify.rows.length !== d_count) {
            res.failResponse("ParameterInvalid");
            return;
        }

        // type 검증 1,2,3,4 type은 하루에 한번 + 5 type은 여러번 가능
        if (Number(reqData.type) !== 5) {
            queryParams = [];

            query = `SELECT id FROM ${schema.COMMON}.plan WHERE uid = ? AND type = ?;`;
            queryParams.push(userInfo.id, reqData.type);

            let planVerify = await mysql.query(query, queryParams);

            if (!planVerify.success) {
                res.failResponse("QueryError");
                return;
            }

            if (planVerify.rows.length > 0) {
                res.failResponse("MealPlanDuplicate");
                return;
            }
        }

        // plan insert
        let result = await mysql.transactionStatement(async (method) => {
            queryParams = [];
            query = `INSERT INTO ${schema.COMMON}.plan (uid, type, total, time) VALUES (?, ?, ?, ?);`;
            queryParams.push(userInfo.id, reqData.type, reqData.total, reqData.time);

            let inputPlan = await method.execute(query, queryParams);

            if (!inputPlan.success) {
                return mysql.TRANSACTION.ROLLBACK;
            }

            queryParams = [];
            query = `SELECT id FROM ${schema.COMMON}.plan WHERE uid = ? AND type = ? AND time = ?;`;
            queryParams.push(userInfo.id, reqData.type, reqData.time);

            let getPid = await method.query(query, queryParams);

            if (!getPid.success || getPid.rows.length === 0) {
                return mysql.TRANSACTION.ROLLBACK;
            }
            queryParams = [];
            for (let i = 0; i < menuList.length; i++) {
                query = `INSERT INTO ${schema.COMMON}.plan_spec (uid, pid, did, cid, fid, unit, menu, kcal, amount, carbs, protein, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
                queryParams.push(userInfo.id, getPid.rows[0].id, menuList[i].did, menuList[i].cid, menuList[i].fid, menuList[i].unit, menuList[i].menu, menuList[i].kcal, menuList[i].amount, menuList[i].carbs, menuList[i].protein, menuList[i].fat);
                let inputPlanSpec = await method.execute(query, queryParams);

                if (!inputPlanSpec.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                queryParams = [];
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
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const infoValidator = [query("time").isString().optional(), query("id").isInt().optional(), validationHandler.handle];

router.get("/info", jwtVerify, infoValidator, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        if (!reqData.time && !reqData.id) {
            res.failResponse("ParameterInvalid");
            return;
        }

        if (reqData.time && reqData.id) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let query = "";
        let queryParams = [];

        // meal plan 검색

        query = `SELECT id, type, total, time FROM ${schema.COMMON}.plan WHERE 1 = 1 AND uid = ? `;
        queryParams.push(userInfo.id);
        if (reqData.time) {
            let start = moment(reqData.time).startOf("day").format("YYYY-MM-DD HH:mm:ss");
            let end = moment(reqData.time).endOf("day").format("YYYY-MM-DD HH:mm:ss");
            query += `AND time BETWEEN ? AND ? `;
            queryParams.push(start, end);
        }

        if (reqData.id) {
            query += `AND id = ? `;
            queryParams.push(reqData.id);
        }

        query += ";";

        let getPlan = await mysql.query(query, queryParams);

        if (!getPlan.success) {
            res.failResponse("QueryError");
        }

        if (getPlan.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }
        query = "";
        queryParams = [];

        for (let i = 0; i < getPlan.rows.length; i++) {
            query += `SELECT pid, did, cid, fid, unit, menu, kcal, amount, carbs, protein, fat FROM ${schema.COMMON}.plan_spec WHERE uid = ? AND pid = ?;
            `;
            queryParams.push(userInfo.id, getPlan.rows[i].id);
        }

        let getPlanSpec = await mysql.query(query, queryParams);

        if (!getPlanSpec.success) {
            res.failResponse("QueryError");
            return;
        }

        if (getPlanSpec.rows.length === 0) {
            res.failResponse("Data Not Found");
            return;
        }

        let data = [];
        let planSpecRows = [].concat(...getPlanSpec.rows);

        for (let row of getPlan.rows) {
            let menu_spec = planSpecRows.filter((spec) => spec.pid == row.id);
            let newObj = new Object();
            newObj.id = row.id;
            newObj.type = row.type;
            newObj.total = row.total;
            newObj.time = row.time;
            newObj.menu_spec = menu_spec;

            data.push(newObj);
        }

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
