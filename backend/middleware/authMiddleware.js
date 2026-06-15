const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

const protect = asyncHandler(async(req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next(); // next() tells us Authentication completed. Now move to the next function
            // next() is used to pass control to the next middleware function in the stack. In this case, if the token is valid and the user is authenticated, we call next() to allow the request to proceed to the next middleware or route handler function. If the token is invalid or missing, we return a 401 Unauthorized response and do not call next(), which prevents the request from reaching any protected routes.
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    }
    if (!token) {
        res.status(401).json({ message: "Not authorized, no token" });
    }
})

module.exports = {protect}