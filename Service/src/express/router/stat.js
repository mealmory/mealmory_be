/**
 * mealmory
 */

"use strict";
//TODO : sql trigger 개발 -> refreshToken delete, notice flag 0 update
const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config } = require("../../util");
const { jwtVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const schema = config.database.schema;

const homeValidator = [query("type").notEmpty().isInt().isIn([1, 2, 3]), query("date").notEmpty().isString(), validationHandler.handle];

router.get("/home", jwtVerify, homeValidator, async (req, res) => {
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

        let range = util.rangeDate(reqData.date, reqData.type);
        let dateArray = util.dateArray(range.start, range.end);
        console.log(dateArray);
        let query = `SELECT COALESCE(SUM(spec.kcal), 0) AS kcal, 
                            COALESCE(SUM(spec.carbs), 0) AS carbs,
                            COALESCE(SUM(spec.protein), 0) AS protein,
                            COALESCE(SUM(spec.fat), 0) AS fat
                    FROM ${schema.COMMON}.plan INNER JOIN ${schema.COMMON}.plan_spec AS spec
                    ON plan.id = spec.pid
                    WHERE plan.uid = ? AND plan.time BETWEEN ? AND ?;`;
        let queryParams = [userInfo.id, range.start, range.end];
        let getSummary = await mysql.query(query, queryParams);

        if (!getSummary.success) {
            res.failResponse("QueryError");
            return;
        }

        query = `SELECT DATE_FORMAT(time, '%Y-%m-%d') AS date, SUM(total) AS total
                 FROM ${schema.COMMON}.plan
                 WHERE uid = ? AND time BETWEEN ? AND ?
                 GROUP BY date
                 ORDER BY date ASC;`;
        queryParams = [userInfo.id, range.start, range.end];

        let getRank = await mysql.query(query, queryParams);

        if (!getRank.success) {
            res.failResponse("QueryError");
            return;
        }
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

module.exports = router;
