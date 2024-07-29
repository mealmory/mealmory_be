/**
 * mealmory
 */

"use strict";

const express = require("express");
const router = express.Router();
const mysql = require("../../mysql/main");
const { util, log, config, verify } = require("../../util");
const { jwtVerify, refreshVerify } = require("../../util/verify");
const { matchedData, validationResult, body, query } = require("express-validator");
const validationHandler = require("../validationHandler");
const axios = require("axios");
const schema = config.database.schema;

router.post("/login", async (req, res) => {
    try {
        let code = req.headers.authorization;

        code = code.split(" ")[1];

        let kakaoToken = await axios.post("https://kauth.kakao.com/oauth/token", null, {
            params: {
                grant_type: "authorization_code",
                client_id: config.kakao.client_id,
                redirect_uri: config.kakao.redirect_uri,
                code: code,
            },
        });

        let kakao_token = kakaoToken.data.access_token;

        if (!kakao_token) {
            res.failResponse("TokenInvalid");
            return;
        }

        let userData = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
                Authorization: `Bearer ${kakao_token}`,
            },
        });

        let userInfo = {
            email: userData.data.kakao_account.email,
            nickName: userData.data.kakao_account.profile.nickname,
            profile: userData.data.kakao_account.profile_image,
        };

        if (userInfo.profile === undefined) {
            userInfo.profile = 0;
        }

        let checkUser = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE email = ?;`, [userInfo.email]);

        if (!checkUser.success) {
            res.failResponse("QueryError");
            return;
        }

        let data = {};

        let result = await mysql.transactionStatement(async (method) => {
            if (checkUser.rows.length === 0) {
                let joinUser = await method.execute(`INSERT INTO ${schema.COMMON}.user (email, nickname, profile) VALUES (?, ?, ?);`, [userInfo.email, userInfo.nickName, userInfo.profile]);

                if (!joinUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let selectID = await method.query(`SELECT id FROM ${schema.COMMON}.user WHERE email = ?;`, [userInfo.email]);

                if (!selectID.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let joinFlag = await method.execute(`INSERT INTO ${schema.COMMON}.user_flag (uid, collect, agreement, notice) VALUES (?, ?, ?, ?);`, [selectID.rows[0].id, 0, 0, 0]);

                if (!joinFlag.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let tokenData = {
                    id: selectID.rows[0].id,
                    email: userInfo.email,
                };

                let token = util.createToken(tokenData);
                console.log(token);

                let verificationUser = await method.execute(`INSERT INTO ${schema.COMMON}.verification (uid, token) VALUES (?, ?);`, [tokenData.id, token.refreshToken]);

                if (!verificationUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                data = {
                    id: tokenData.id,
                    email: userInfo.email,
                    nickName: userInfo.nickName,
                    profile: userInfo.profile,
                    collect: 0,
                    agreement: 0,
                    accessToken: token.accessToken,
                    refreshToken: token.refreshToken,
                };
            } else {
                let userID = await method.query(`SELECT id FROM ${schema.COMMON}.user WHERE email = ?;`, [userInfo.email]);

                if (!userID.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let userFlag = await method.query(`SELECT collect, agreement FROM ${schema.COMMON}.user_flag WHERE uid = ?;`, [userID.rows[0].id]);

                if (!userFlag.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let tokenData = {
                    id: userID.rows[0].id,
                    email: userInfo.email,
                };

                let token = util.createToken(tokenData);

                let tokenVerify = await method.query(`SELECT uid FROM ${schema.COMMON}.verification WHERE uid = ?;`, [userID.rows[0].id]);

                if (!tokenVerify.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                let verificationUser;

                if (tokenVerify.rows.length === 0 || !tokenVerify.rows) {
                    verificationUser = await method.execute(`INSERT INTO ${schema.COMMON}.verification (uid, token) VALUES (?, ?);`, [userID.rows[0].id, token.refreshToken]);
                } else {
                    verificationUser = await method.execute(`UPDATE ${schema.COMMON}.verification SET token = ? WHERE uid = ?;`, [token.refreshToken, userID.rows[0].id]);
                }

                if (!verificationUser.success) {
                    return mysql.TRANSACTION.ROLLBACK;
                }

                data = {
                    id: tokenData.id,
                    email: userInfo.email,
                    nickName: userInfo.nickName,
                    profile: userInfo.profile,
                    collect: userFlag.rows[0].collect,
                    agreement: userFlag.rows[0].agreement,
                    accessToken: token.accessToken,
                    refreshToken: token.refreshToken,
                };
            }

            return mysql.TRANSACTION.COMMIT;
        });

        if (!result.success || !result.commit) {
            res.failResponse("TransactionError");
            return;
        }

        res.successResponse(data);
        return;
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }
});

const processValidator = [body("collect").isInt().isIn([0, 1]).optional(), body("agreement").isInt().isIn([0, 1]).optional(), validationHandler.handle];

router.put("/process", jwtVerify, processValidator, async (req, res) => {
    try {
        let userInfo = req.userInfo;
        let reqData = matchedData(req);

        let userVerify = await mysql.query(`SELECT id FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (userVerify.rows.length === 0) {
            res.failResponse("ParameterInvalid");
            return;
        }
        let query = ''
        let queryParams = [];

        query = `UPDATE ${schema.COMMON}.user_flag SET `;
        if (reqData.collect != undefined && reqData.agreement != undefined) {
            res.failResponse("ParameterInvalid");
            return;
        } else if (reqData.agreement == 1) {
            query += `agreement = ? `;
            queryParams.push(reqData.agreement);
        } else if (reqData.collect == 1) {
            query += `collect = ? `;
            queryParams.push(reqData.collect);
        }

        query += `WHERE uid = ?;`;
        queryParams.push(userInfo.id);

        let updateFlag = await mysql.execute(query, queryParams);

        if (!updateFlag.success) {
            res.failResponse("QueryError");
            return;
        }

        if (updateFlag.affectedRows === 0) {
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

router.post("/token", jwtVerify, async (req, res) => {
    try {
        let userInfo = req.userInfo;

        let re_token = util.extractionToken(req.headers.authorization);

        let userVerify = await mysql.query(`SELECT id, email FROM ${schema.COMMON}.user WHERE id = ?;`, [userInfo.id]);

        if (!userVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        let tokenVerify = await mysql.query(`SELECT token FROM ${schema.COMMON}.verification WHERE uid = ?;`, [userInfo.id]);

        if (!tokenVerify.success) {
            res.failResponse("QueryError");
            return;
        }

        if (tokenVerify.rows[0].token !== re_token || tokenVerify.rows.length === 0) {
            res.failResponse("AuthorizationInvalid");
            return;
        }

        let token = util.createToken(userInfo);

        let tokenUpdate = await mysql.execute(`UPDATE ${schema.COMMON}.verification SET token = ? WHERE uid = ?;`, [token.refreshToken, userInfo.id]);

        if (!tokenUpdate.success) {
            res.failResponse("QueryError");
            return;
        }

        if (tokenUpdate.affectedRows === 0) {
            res.failResponse("AffectedEmpty");
            return;
        }

        let data = {
            access_token: token.accessToken,
            refresh_token: token.refreshToken,
        }

        res.successResponse(data);
    } catch (exception) {
        log.error(exception);
        res.failResponse("ServerError");
        return;
    }

});
module.exports = router;
