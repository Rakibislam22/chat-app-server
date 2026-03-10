/**
 * Module socket handlers
 *
 * Export: registerModuleHandlers(socket, { emitToUser, io })
 *
 * Handles inbound events:
 *   module:message:send
 *   module:message:react
 *   module:message:edit
 *   module:message:delete
 *   module:seen
 *   module:typing:start
 *   module:typing:stop
 *   module:join    — manual room subscription
 *   module:leave   — manual room unsubscription
 */

const Workspace = require("../models/Workspace");
const Module = require("../models/Module");
const ModuleMessage = require("../models/ModuleMessage");

// Reuse same constants as typing.js
const TYPING_AUTO_STOP_MS = 5000;
const TYPING_THROTTLE_MS = 500;

// Module-level maps — persist across connections in this process
// Key: "moduleId:userId"
const moduleTypingTimers = new Map();

const registerModuleHandlers = (socket, { emitToUser, io }) => {
    // Per-socket throttle: moduleId → last accepted typing:start timestamp
    const lastModuleTypingEmit = new Map();

    // ----------------------------------------------------------------
    // Handlers will be filled in Days 2-3:
    // - module:join / module:leave (Day 2)
    // - module:message:send (Day 2)
    // - module:message:react (Day 2)
    // - module:message:edit (Day 2)
    // - module:message:delete / deleteForMe (Day 2)
    // - module:typing:start / stop (Day 3)
    // - module:seen (Day 3)
    // ----------------------------------------------------------------

    // Cleanup function for disconnect
    const cleanup = () => {
        // Clear all module typing timers this socket set
        for (const [key, timer] of moduleTypingTimers.entries()) {
            if (key.endsWith(`:${socket.userId}`)) {
                clearTimeout(timer);
                moduleTypingTimers.delete(key);
            }
        }
    };

    return { cleanup };
};

module.exports = registerModuleHandlers;
