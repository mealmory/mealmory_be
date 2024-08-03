/**
 * mealmory
 */

"use strict";

const errorCode = [];

errorCode.errors = {
    TooManyRequest: { code: 1000, message: "Too many request" },
    ParameterInvalid: { code: 1001, message: "Data invalid" },
    TimestampInvalid: { code: 1002, message: "Data invalid" },
    TokenInvalid: { code: 1003, message: "Token invalid" },
    AuthorizationNull: { code: 1004, message: "Authorization error" },
    AuthorizationFailed: { code: 1005, message: "Authorization error" },
    AuthorizationInvalid: { code: 1006, message: "Authorization error" },
    AuthorizationExpired: { code: 1007, message: "Authorization error" },
    MealPlanNull: { code: 1008, message: "Meal plan null" },
    MealPlanDuplicate: { code: 1009, message: "Meal plan duplicate" },

    NotFound: { code: 2000, message: "Not found" },
    ServerError: { code: 2001, message: "Server error" },
    UserNotFound: { code: 2002, message: "User not found" },

    QueryError: { code: 3000, message: "Database error" },
    AffectedEmpty: { code: 3001, message: "Database error" },
    DuplicateError: { code: 3002, message: "Database error" },
    TransactionError: { code: 3003, message: "Database error" },
};

errorCode.get = function (errorCode) {
    return this.errors[errorCode];
};

module.exports = errorCode;
