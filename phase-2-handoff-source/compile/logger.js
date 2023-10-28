"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
const winston_1 = __importDefault(require("winston")); //Logging library
const logLevels = {
    0: 'silent',
    1: 'info',
    2: 'debug',
};
const logLevels_ = {
    silent: 0,
    info: 1,
    debug: 2,
};
function getLogLevel() {
    const logLevel = Number(process.env.LOG_LEVEL);
    if (!logLevel) {
        // Default log level is 0
        return logLevels[0];
    }
    else if (logLevel > 2) {
        // Just for convenience, instead of panicking
        return logLevels[2];
    }
    else if (logLevel < 0) {
        // Also just for convenience, instead of panicking
        return logLevels[0];
    }
    return logLevels[logLevel];
}
function getLogPath() {
    const logPath = process.env.LOG_FILE;
    if (!logPath) {
        const error = new Error("Could not find LOG_FILE path, please make sure it is valid");
        console.error(`Error: ${error}`);
        throw error;
    }
    return logPath;
}
function getLogger() {
    const logLevel = getLogLevel();
    const logPath = getLogPath();
    const logger = winston_1.default.createLogger({
        level: logLevel,
        format: winston_1.default.format.simple(),
        transports: [
            new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
            new winston_1.default.transports.File({ filename: logPath, level: logLevel }), // Actual log file
        ],
    });
    return logger;
}
exports.getLogger = getLogger;
