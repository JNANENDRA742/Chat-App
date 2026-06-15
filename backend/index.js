const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const connectDB = require("./config/connectDB");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io accessible to routes
app.set("io", io);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors());

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use(notFound);
app.use(errorHandler);

// Store online users
const onlineUsers = new Map();

// Socket.io setup
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("setup", (userId) => {
    if (userId) {
      socket.join(userId);
      onlineUsers.set(userId, socket.id);
      console.log("User " + userId + " connected with socket id: " + socket.id);
      socket.emit("connected");
      io.emit("online users", Array.from(onlineUsers.keys()));
    }
  });

  socket.on("join chat", (chatId) => {
    if (chatId) {
      // Leave previous chat room if exists
      if (socket.currentChatId && socket.currentChatId !== chatId) {
        socket.leave(socket.currentChatId);
        console.log("Left previous chat room:", socket.currentChatId);
      }
      socket.join(chatId);
      socket.currentChatId = chatId;
      console.log("User joined room: " + chatId);
    }
  });

  socket.on("leave chat", (chatId) => {
    if (chatId) {
      socket.leave(chatId);
      console.log("User left room: " + chatId);
    }
  });

  socket.on("new message", async (newMessageReceived) => {
    console.log("NEW MESSAGE EVENT");
    console.log(newMessageReceived);
    
    let chat = newMessageReceived.chat;
    if (!chat || !chat.users) {
      console.log("Chat.users not defined");
      return;
    }

    // Emit to all users in the chat except the sender
    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;
      
      // Emit to user's personal room
      io.to(user._id).emit("message received", newMessageReceived);
      
      // Also emit a notification for chat list update
      io.to(user._id).emit("chat update", {
        chatId: chat._id,
        lastMessage: newMessageReceived,
      });
    });
  });

  socket.on("typing", ({ chatId, userId, isTyping }) => {
    socket.to(chatId).emit("user typing", { userId, isTyping });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Remove user from online users
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit("online users", Array.from(onlineUsers.keys()));
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});