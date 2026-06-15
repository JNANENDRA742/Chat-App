
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");


// asyncHandler is a middleware that handles exceptions in async functions and passes them to the error handler middleware in Express. It allows us to write cleaner code without having to use try-catch blocks in every async function.
const registerUser = asyncHandler(async (req, res) => {

    console.log(req.body);

    const { name, email, password, profilePicture } = req.body;

    if (!name || !email || !password) {
        res.status(400).json({ message: "Please Enter all the fields" });
    }

    const userExists = await User.findOne({ email });

    console.log(userExists);

    if (userExists) {
        res.status(400).json({ message: "User already exists" });
    }

    console.log("Creating user...");

    const user = await User.create({
        name,
        email,
        password,
        profilePicture,
    });

    console.log("USER CREATED SUCCESSFULLY");
    console.log(user);

    res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        token: generateToken(user._id),
        message : "User Registered Successfully"
    });
});


const authUser = asyncHandler(async(req , res) =>{
    const {email , password} = req.body;

    const user = await User.findOne({ email });

    if(user && (await user.matchPassword(password)))
    {
        res.json({
            _id : user._id,
            name : user.name,
            email : user.email,
            profilePicture : user.profilePicture,
            token : generateToken(user._id),
            message : "User Logged in Successfully"
        });
    }
    else{
        res.status(401).json({ message: "Invalid email or password" });
    }     
})

const allUsers = asyncHandler(async (req, res) => {
    // if search query is present in the request, we create a keyword object to search for users based on the name or email. The $regex operator is used to perform a case-insensitive search for the provided search term in both the name and email fields of the User collection. If no search query is provided, we set keyword to an empty object, which means we will retrieve all users.
    const keyword = req.query.search
        ? {
            // $or is a MongoDB operator that allows you to search for documents that match any of the specified conditions. Here, it's used to Find users where: name matches OR email matches
            $or: [
                { name: { $regex: req.query.search, $options: "i" } }, // $options: "i" makes the search case-insensitive
                { email: { $regex: req.query.search, $options: "i" } }, // $regex is used to perform a pattern match search on the name and email fields. It allows for partial matches based on the search term provided in req.query.search. if search term is "ja", it will match "Janu", "Jane", "Jack", etc.
            ],
        }
        : {};

    console.log(keyword);

    const user = await User.find(keyword)
    .find({ _id: { $ne: req.user._id } }); // “Give me all users EXCEPT the current logged-in user.”
    // $ne is a MongoDB operator that stands for "not equal". Here, it's used to exclude the currently authenticated user (identified by req.user._id) from the search results. This ensures that when a user searches for other users, they won't see themselves in the results.
    // The first find(keyword) retrieves users based on the search criteria defined in the keyword object. The second find({ _id: { $ne: req.user._id } }) further filters the results to exclude the currently authenticated user from the list of users returned by the query.
    // the $ne operator is used to exclude the current user from the search results. which means in our chat application we are not allowing users to search for themselves when they are looking for other users to chat with.    
    // if we want to include the current user in the search results, we can simply remove the second find() method that uses the $ne operator. This way, all users, including the currently authenticated user, will be returned in the search results based on the search criteria defined in the keyword object.  
    res.send(user);
});

const getProfile = asyncHandler(async(req , res) =>{
    const user = await User.findById(req.user._id);

    if(user)
    {
        res.json({
            _id : user._id,
            name : user.name,
            email : user.email,
            profilePicture : user.profilePicture,
        });
    }
    else{
        res.status(404).json({ message: "User not found" });
    }
})

const updateProfile = asyncHandler(async (req , res) =>{
    const user = await User.findById(req.user._id);
    
    if(user){
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.profilePicture = req.body.profilePicture || user.profilePicture;

        if(req.body.password){
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id : updatedUser._id,
            name : updatedUser.name,
            email : updatedUser.email,
            profilePicture : updatedUser.profilePicture,
            token : generateToken(updatedUser._id),
            message : "Profile Updated Successfully"
        });
    }
    else{
        res.status(404).json({ message: "User not found" });
    }
})

module.exports = { registerUser , authUser  , allUsers , getProfile , updateProfile };