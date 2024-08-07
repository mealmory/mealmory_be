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
const { jwt } = require("../../util/config");
const schema = config.database.schema;

// TODO: 관리자 등급 설정
const addValidator = [body("title").notEmpty().isString(), body("description").notEmpty().isString(), validationHandler.handle];

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
            res.failResponse("DataNotFound");
            return;
        }

        let inputNotice = await mysql.execute(`INSERT INTO ${schema.COMMON}.notice (title, description) VALUES (?, ?);`, [reqData.title, reqData.description]);

        if (!inputNotice.success) {
            res.failResponse("QueryError");
            return;
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const searchValidator = [query("page").notEmpty().isInt(), validationHandler.handle];

router.get("/search", jwtVerify, searchValidator, async (req, res) => {
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

        let startId;
        if (reqData.page == 1) {
            startId = 0;
        } else {
            startId = reqData.page * 10 - 9;
        }

        let getNotice = await mysql.query(`SELECT id, title, DATE_FORMAT(reg_date, '%Y-%m-%d') AS date FROM ${schema.COMMON}.notice LIMIT 10 OFFSET ?;`, [startId]);

        if (!getNotice.success) {
            res.failResponse("QueryError");
            return;
        }

        if (getNotice.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        let getFlag = await mysql.query(`SELECT notice FROM ${schema.COMMON}.user_flag WHERE uid = ?;`, [userInfo.id]);

        if (!getFlag.success) {
            res.failResponse("QueryError");
            return;
        }

        if (getFlag.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        let data = {};
        data.flag = getFlag.rows[0].notice;
        data.notice = getNotice.rows;

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const infoValidator = [query("id").notEmpty().isInt(), validationHandler.handle];

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

        let flagVerify = await mysql.query(`SELECT id FROM ${schema.COMMON}.notice ORDER BY id ASC LIMIT 1;`);

        if (!flagVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (flagVerify.rows.length === 0) {
            res.FailResponse("DataNotFound");
            return;
        }

        let userFlag = await mysql.query(`SELECT notice FROM ${schema.COMMON}.user_flag WHERE uid = ?;`, [userInfo.id]);

        if (!userFlag.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userFlag.rows.length === 0) {
            res.FailResponse("DataNotFound");
            return;
        }

        if (userFlag.rows[0].notice == 0) {
            if (reqData.id == flagVerify.rows[0].id) {
                let flagUpdate = await mysql.execute(`UPDATE ${schema.COMMON}.user_flag SET notice = 1 WHERE uid = ?;`, [userInfo.id]);

                if (!flagUpdate.success) {
                    res.failResponse("QueryError");
                    return;
                }

                if (flagUpdate.affectedRows === 0) {
                    res.failResponse("AffectedEmpty");
                    return;
                }
            }
        }

        let getInfo = await mysql.query(`SELECT id, title, description, DATE_FORMAT(reg_date, '%Y-%m-%d') AS date FROM ${schema.COMMON}.notice WHERE id = ?;`, [reqData.id]);

        if (!getInfo.success) {
            res.failResponse("QueryError");
            return;
        }

        if (getInfo.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        res.successResponse(getInfo.rows);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const editValidator = [body("id").notEmpty().isInt(), body("title").isString().optional(), body("description").isString().optional(), validationHandler.handle];

router.put("/edit", jwtVerify, editValidator, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        if (!reqData.title && !reqData.description) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("DataNotFound");
            return;
        }

        let query = `UPDATE ${schema.COMMON}.notice SET`;
        let queryParams = [];

        for (let v in reqData) {
            if (v !== "id") {
                query += ` ${v} = ?,`;
                queryParams.push(reqData[v]);
            }
        }

        query = query.slice(0, -1);
        query += ` WHERE id = ?;`;
        queryParams.push(reqData.id);

        let editNotice = await mysql.execute(query, queryParams);

        if (!editNotice.success) {
            res.failResponse("QueryError");
            return;
        }

        if (editNotice.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        res.successResponse();
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const deleteValidator = [body("id").notEmpty().isInt(), validationHandler.handle];

router.delete("/delete", jwtVerify, deleteValidator, async (req, res) => {
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

        let idVerify = await mysql.query(`SELECT id FROM ${schema.COMMON}.notice WHERE id = ?;`, [reqData.id]);

        if (!idVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (idVerify.rows.length === 0) {
            res.failResponse("ParameterInvalid");
            return;
        }

        let deleteNotice = await mysql.execute(`DELETE FROM ${schema.COMMON}.notice WHERE id = ?;`, [reqData.id]);

        if (!deleteNotice.success) {
            res.failResponse("QueryError");
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
