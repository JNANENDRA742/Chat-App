const expess = require("express");
const router = expess.Router();
const {registerUser , authUser , allUsers , getProfile , updateProfile} = require("../controllers/userControllers");
const {protect} = require("../middleware/authMiddleware");


router.route("/").post(registerUser).get(protect,allUsers); // here protect is middleware (in that middleware the next() will be executed if user is authenticated) and next() in protect middleware is used to call the next middleware or route handler function , in this case it is used to call route handler function allUsers if the user is authenticated successfully. If the user is not authenticated, it will return a 401 Unauthorized response and will not call next(), which means the allUsers route handler will not be executed.
// here protect is middleware that ensures only authenticated users can access the allUsers route. It checks for a valid JWT token in the request headers and allows access to the route if the token is valid. If the token is missing or invalid, it returns a 401 Unauthorized response.
router.post("/login" , authUser);
router.get("/profile" , protect , getProfile); // here we are using protect middleware to protect the profile route, which means only authenticated users can access this route. If the user is authenticated successfully, the getProfile route handler will be executed and it will return the user's profile information. If the user is not authenticated, it will return a 401 Unauthorized response and will not call next(), which means the getProfile route handler will not be executed.
router.put("/profile" , protect , updateProfile); // here we are using protect middleware to protect the profile update route, which means only authenticated users can access this route. If the user is authenticated successfully, the updateProfile route handler will be executed and it will allow the user to update their profile information. If the user is not authenticated, it will return a 401 Unauthorized response and will not call next(), which means the updateProfile route handler will not be executed.
module.exports = router;