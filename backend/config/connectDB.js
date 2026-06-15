const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGOURL);

        console.log("MongoDB Connected");
    console.log("Connected DB Name:", mongoose.connection.name);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

module.exports = connectDB;